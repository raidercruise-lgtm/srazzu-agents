from __future__ import annotations
import json
import time
import os
import redis.asyncio as aioredis
from typing import Optional, Dict, List, Set

REDIS_URL = os.getenv("REDIS_URL", "redis://aoc_redis:6379/0")

class WorkerRegistry:
    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None

    async def connect(self):
        self.redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        print("✅ [REDIS] Connected to Worker Registry.")

    async def disconnect(self):
        if self.redis:
            await self.redis.close()
            print("🔌 [REDIS] Registry connection closed.")

    async def register_worker(
        self, 
        node_id: str, 
        capabilities: List[str], 
        version: str = "1.0.0", 
        max_concurrency: int = 5,
        zone: str = "us-east-1"
    ):
        """Registers static metadata and capabilities for a worker."""
        pipe = self.redis.pipeline()
        
        # 1. Static Metadata
        pipe.hset(f"worker:{node_id}:meta", mapping={
            "node_id": node_id,
            "version": version,
            "max_concurrency": str(max_concurrency),
            "zone": zone,
            "registered_at": str(time.time())
        })

        # 2. Capabilities Set
        pipe.delete(f"worker:{node_id}:caps")
        if capabilities:
            pipe.sadd(f"worker:{node_id}:caps", *capabilities)

        await pipe.execute()
        print(f"📥 [REGISTRY] Worker '{node_id}' registered with capabilities: {capabilities}")

    async def record_heartbeat(
        self, 
        node_id: str, 
        cpu_pct: float, 
        mem_free_mb: int, 
        active_tasks: int,
        status: str = "HEALTHY"
    ):
        """Records high-frequency telemetry and updates active worker index."""
        now = time.time()
        pipe = self.redis.pipeline()

        pipe.hset(f"worker:{node_id}:status", mapping={
            "status": status,
            "cpu_pct": str(cpu_pct),
            "mem_free_mb": str(mem_free_mb),
            "active_tasks": str(active_tasks),
            "last_seen": str(now)
        })

        pipe.zadd("workers:active", {node_id: now})
        await pipe.execute()

    async def get_worker_profile(self, node_id: str) -> Optional[Dict]:
        """Fetches consolidated view (meta + status + caps) for a worker with safe conversions."""
        pipe = self.redis.pipeline()
        pipe.hgetall(f"worker:{node_id}:meta")
        pipe.hgetall(f"worker:{node_id}:status")
        pipe.smembers(f"worker:{node_id}:caps")
        
        meta, status, caps = await pipe.execute()
        if not meta:
            return None

        # Safe parsing helpers
        def safe_float(val, default=0.0):
            try:
                return float(val) if val else default
            except (ValueError, TypeError):
                return default

        def safe_int(val, default=0):
            try:
                return int(val) if val else default
            except (ValueError, TypeError):
                return default

        last_seen = safe_float(status.get("last_seen") if status else 0.0)

        return {
            **meta,
            **(status or {}),
            "capabilities": list(caps or []),
            "max_concurrency": safe_int(meta.get("max_concurrency"), 1),
            "cpu_pct": safe_float(status.get("cpu_pct") if status else 0.0),
            "mem_free_mb": safe_int(status.get("mem_free_mb") if status else 0),
            "active_tasks": safe_int(status.get("active_tasks") if status else 0),
            "is_stale": (time.time() - last_seen) > 15.0 if last_seen > 0 else True
        }

    async def get_healthy_workers(self, timeout_seconds: float = 15.0) -> List[Dict]:
        """Lists active workers whose heartbeats are within the freshness window."""
        cutoff = time.time() - timeout_seconds
        node_ids = await self.redis.zrangebyscore("workers:active", min=cutoff, max="+inf")
        
        profiles = []
        for nid in node_ids:
            profile = await self.get_worker_profile(nid)
            if profile and profile.get("status") == "HEALTHY":
                profiles.append(profile)
        return profiles

    async def select_best_worker(
        self, 
        required_capability: Optional[str] = None, 
        explicit_target: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Capability-based scoring algorithm:
        1. If explicit_target is provided, check if active & healthy.
        2. Filter workers by required_capability (allowing 'general' match).
        3. Filter out workers at max capacity.
        4. Score candidates based on headroom and system metrics.
        """
        active_workers = await self.get_healthy_workers(timeout_seconds=15.0)
        if not active_workers:
            return None

        # Case A: Targeted Dispatch
        if explicit_target:
            for w in active_workers:
                if w["node_id"] == explicit_target:
                    return w
            return None  # Targeted node is offline/unhealthy

        # Case B: Dynamic Capability Routing
        eligible = []
        for w in active_workers:
            # 1. Capability check (support 'general' or wildcard matches)
            caps = w.get("capabilities", [])
            if required_capability and required_capability != "general" and required_capability not in caps:
                continue
            
            # 2. Capacity check
            max_conc = max(1, w.get("max_concurrency", 1))
            if w.get("active_tasks", 0) >= max_conc:
                continue

            eligible.append(w)

        if not eligible:
            return None

        # 3. Scoring Function
        scored_candidates = []
        for w in eligible:
            max_conc = max(1, w["max_concurrency"])
            capacity_ratio = (max_conc - w["active_tasks"]) / max_conc
            cpu_headroom = (100.0 - w["cpu_pct"]) / 100.0
            
            # Total score between 0.0 and 100.0
            score = (capacity_ratio * 50.0) + (cpu_headroom * 50.0)
            
            w_copy = dict(w)
            w_copy["scheduler_score"] = round(score, 2)
            scored_candidates.append(w_copy)

        # Sort descending by score; highest score wins
        scored_candidates.sort(key=lambda x: x["scheduler_score"], reverse=True)
        return scored_candidates[0]

registry = WorkerRegistry()