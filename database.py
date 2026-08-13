from __future__ import annotations
import os
import json
import uuid
import datetime
import asyncpg
from typing import Optional, Dict, List, Any

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://engine_user:engine_pass@aoc_postgres:5432/aoc_db")

def _serialize_row(row: Optional[asyncpg.Record]) -> Optional[Dict[str, Any]]:
    """Helper to convert asyncpg Record into JSON-serializable dict (handles UUID & datetime)."""
    if not row:
        return None
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
        elif isinstance(v, (datetime.datetime, datetime.date)):
            d[k] = v.isoformat()
    return d

class Database:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        self.pool = await asyncpg.create_pool(dsn=DATABASE_URL, min_size=2, max_size=10)
        await self.init_db()
        print("✅ [POSTGRES] Connection pool established.")

    async def disconnect(self):
        if self.pool:
            await self.pool.close()
            print("🔌 [POSTGRES] Connection pool closed.")

    async def init_db(self):
        async with self.pool.acquire() as conn:
            # 1. Ensure workflows table exists using flexible VARCHAR for status
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS workflows (
                    id VARCHAR(64) PRIMARY KEY,
                    action VARCHAR(64) NOT NULL,
                    target_node VARCHAR(64),
                    required_capability VARCHAR(64) DEFAULT 'general',
                    payload JSONB DEFAULT '{}'::jsonb,
                    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_APPROVAL',
                    approved_by VARCHAR(64),
                    approval_reason TEXT,
                    assigned_node VARCHAR(64),
                    result JSONB DEFAULT '{}'::jsonb,
                    error TEXT,
                    retry_count INT DEFAULT 0,
                    max_retries INT DEFAULT 3,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                -- 2. Add columns if missing (idempotent schema updates)
                ALTER TABLE workflows ADD COLUMN IF NOT EXISTS approved_by VARCHAR(64);
                ALTER TABLE workflows ADD COLUMN IF NOT EXISTS approval_reason TEXT;
                ALTER TABLE workflows ADD COLUMN IF NOT EXISTS assigned_node VARCHAR(64);
                ALTER TABLE workflows ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
                ALTER TABLE workflows ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 3;
                ALTER TABLE workflows ADD COLUMN IF NOT EXISTS error TEXT;
                ALTER TABLE workflows ADD COLUMN IF NOT EXISTS result JSONB DEFAULT '{}'::jsonb;
                
                -- 3. Ensure status column type is VARCHAR(32) even if old table had ENUM
                ALTER TABLE workflows ALTER COLUMN status TYPE VARCHAR(32) USING status::text;
                ALTER TABLE workflows ALTER COLUMN status SET DEFAULT 'PENDING_APPROVAL';
            """)

    async def create_workflow(
        self, 
        wf_id: str, 
        action: str, 
        target_node: Optional[str] = None, 
        required_capability: Optional[str] = "general", 
        payload: Optional[Dict[str, Any]] = None,
        max_retries: int = 3
    ) -> Dict:
        if payload is None:
            payload = {}
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO workflows (id, action, target_node, required_capability, payload, max_retries)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6)
                RETURNING *;
            """, wf_id, action, target_node, required_capability, json.dumps(payload), int(max_retries))
            return _serialize_row(row)

    async def get_workflow(self, wf_id: str) -> Optional[Dict]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM workflows WHERE id = $1;", wf_id)
            return _serialize_row(row)

    async def approve_workflow(self, wf_id: str, approved_by: str, reason: str, assigned_node: str) -> Optional[Dict]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                UPDATE workflows
                SET status = 'APPROVED',
                    approved_by = $2,
                    approval_reason = $3,
                    assigned_node = $4,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *;
            """, wf_id, approved_by, reason, assigned_node)
            return _serialize_row(row)

    async def record_callback(self, wf_id: str, status: str, node_id: Optional[str], result: Optional[Dict], error: Optional[str]) -> Optional[Dict]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                UPDATE workflows
                SET status = $2,
                    assigned_node = COALESCE($3, assigned_node),
                    result = COALESCE($4::jsonb, result),
                    error = $5,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *;
            """, wf_id, status, node_id, json.dumps(result) if result else None, error)
            return _serialize_row(row)

    async def mark_for_retry(self, wf_id: str, new_node_id: str, error_msg: str) -> Optional[Dict]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                UPDATE workflows
                SET retry_count = retry_count + 1,
                    assigned_node = $2,
                    error = $3,
                    status = 'RETRYING',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *;
            """, wf_id, new_node_id, error_msg)
            return _serialize_row(row)

    async def mark_as_dlq(self, wf_id: str, error_msg: str) -> Optional[Dict]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                UPDATE workflows
                SET status = 'STRANDED',
                    error = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *;
            """, wf_id, error_msg)
            return _serialize_row(row)

    async def replay_workflow(self, wf_id: str, replayed_by: str, updated_payload: Dict[str, Any]) -> Optional[Dict]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                UPDATE workflows
                SET status = 'PENDING_APPROVAL',
                    payload = $2::jsonb,
                    approved_by = NULL,
                    approval_reason = NULL,
                    assigned_node = NULL,
                    error = NULL,
                    retry_count = 0,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND status IN ('FAILED', 'STRANDED')
                RETURNING *;
            """, wf_id, json.dumps(updated_payload))
            return _serialize_row(row)

    async def get_dlq_stranded(self) -> List[Dict]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT * FROM workflows
                WHERE status = 'STRANDED'
                ORDER BY updated_at DESC;
            """)
            return [_serialize_row(r) for r in rows]

    async def get_dashboard_metrics(self) -> Dict[str, Any]:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT 
                    COUNT(*) AS total_workflows,
                    COUNT(*) FILTER (WHERE status = 'PENDING_APPROVAL') AS pending_approval,
                    COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved,
                    COUNT(*) FILTER (WHERE status = 'RETRYING') AS retrying,
                    COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
                    COUNT(*) FILTER (WHERE status = 'FAILED') AS failed,
                    COUNT(*) FILTER (WHERE status = 'STRANDED') AS dlq_stranded
                FROM workflows;
            """)
            return dict(row) if row else {
                "total_workflows": 0, "pending_approval": 0, "approved": 0,
                "retrying": 0, "completed": 0, "failed": 0, "dlq_stranded": 0
            }

db = Database()