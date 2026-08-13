from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field

from database import db
from scheduler import registry

BROKER_URL = os.getenv("BROKER_URL", "http://swarm_broker:8080")


# ==========================================
# 1. STANDARDIZED ERROR MODELS & EXCEPTIONS
# ==========================================

class APIErrorResponse(BaseModel):
    error_code: str = Field(..., example="WORKFLOW_NOT_FOUND")
    message: str = Field(..., example="Workflow 'wf-912f63e4' does not exist.")
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class WorkflowNotFoundError(Exception):
    def __init__(self, workflow_id: str):
        self.workflow_id = workflow_id
        self.message = f"Workflow '{workflow_id}' does not exist."


class WorkerNotFoundError(Exception):
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.message = f"Worker '{node_id}' is not registered or active."


# ==========================================
# 2. APPLICATION LIFESPAN & INIT
# ==========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    await registry.connect()
    yield
    await registry.disconnect()
    await db.disconnect()


app = FastAPI(
    title="AOC Workforce Engine",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan
)


# ==========================================
# 3. CENTRAL EXCEPTION HANDLERS
# ==========================================

@app.exception_handler(WorkflowNotFoundError)
async def workflow_not_found_handler(request: Request, exc: WorkflowNotFoundError):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=APIErrorResponse(
            error_code="WORKFLOW_NOT_FOUND",
            message=exc.message
        ).model_dump()
    )


@app.exception_handler(WorkerNotFoundError)
async def worker_not_found_handler(request: Request, exc: WorkerNotFoundError):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content=APIErrorResponse(
            error_code="WORKER_NOT_FOUND",
            message=exc.message
        ).model_dump()
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    first_error = exc.errors()[0]
    loc_parts = [str(x) for x in first_error.get("loc", []) if x != "body"]
    loc = " -> ".join(loc_parts) if loc_parts else "payload"
    msg = f"Validation failed at '{loc}': {first_error.get('msg')}"

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=APIErrorResponse(
            error_code="INVALID_PAYLOAD",
            message=msg
        ).model_dump()
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Handle detail string or detail object gracefully
    detail_msg = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content=APIErrorResponse(
            error_code=f"HTTP_{exc.status_code}",
            message=detail_msg
        ).model_dump()
    )


# ==========================================
# 4. REQUEST SCHEMAS
# ==========================================

class WorkflowTrigger(BaseModel):
    action: str
    target_node: Optional[str] = None
    required_capability: Optional[str] = "general"
    payload: Dict[str, Any] = {}
    max_retries: int = 3


class WorkflowApproval(BaseModel):
    approved_by: str
    reason: Optional[str] = "Approved by operator"


class WorkflowCallback(BaseModel):
    status: str  # COMPLETED or FAILED
    node_id: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class WorkflowReplay(BaseModel):
    replayed_by: str
    updated_payload: Dict[str, Any]


class RegisterWorkerRequest(BaseModel):
    node_id: str
    capabilities: List[str]
    version: str = "1.0.0"
    max_concurrency: int = Field(default=5, ge=1)
    zone: str = "us-east-1"


class HeartbeatRequest(BaseModel):
    node_id: str
    cpu_pct: float
    mem_free_mb: int
    active_tasks: int
    status: str = "HEALTHY"


# ==========================================
# 5. WORKFLOW LIFECYCLE & FAILOVER ENDPOINTS
# ==========================================

@app.post("/workflows/trigger")
async def trigger_workflow(data: WorkflowTrigger):
    wf_id = f"wf-{uuid.uuid4().hex[:8]}"
    wf = await db.create_workflow(
        wf_id=wf_id,
        action=data.action,
        target_node=data.target_node,
        required_capability=data.required_capability,
        payload=data.payload,
        max_retries=data.max_retries
    )
    return {"status": "SUCCESS", "workflow_id": wf_id, "state": "PENDING_APPROVAL"}


@app.post("/workflows/{wf_id}/approve")
async def approve_workflow(wf_id: str, approval: WorkflowApproval):
    wf = await db.get_workflow(wf_id)
    if not wf:
        raise WorkflowNotFoundError(wf_id)

    assigned_worker = await registry.select_best_worker(
        required_capability=wf.get("required_capability"),
        explicit_target=wf.get("target_node")
    )

    if not assigned_worker:
        req_cap = wf.get("required_capability") or "any"
        raise HTTPException(
            status_code=503,
            detail=f"No healthy worker available matching capability '{req_cap}'."
        )

    updated_wf = await db.approve_workflow(
        wf_id=wf_id,
        approved_by=approval.approved_by,
        reason=approval.reason,
        assigned_node=assigned_worker["node_id"]
    )

    return {
        "status": "APPROVED",
        "workflow_id": wf_id,
        "dispatched": True,
        "assigned_node": assigned_worker["node_id"],
        "scheduler_score": assigned_worker.get("scheduler_score", 100.0),
        "task_data": updated_wf
    }


@app.post("/workflows/{wf_id}/callback")
async def workflow_callback(wf_id: str, callback: WorkflowCallback):
    wf = await db.get_workflow(wf_id)
    if not wf:
        raise WorkflowNotFoundError(wf_id)

    if callback.status == "COMPLETED":
        updated = await db.record_callback(
            wf_id=wf_id,
            status="COMPLETED",
            node_id=callback.node_id,
            result=callback.result,
            error=None
        )
        return {"status": "COMPLETED", "workflow_id": wf_id, "data": updated}

    if callback.status == "FAILED":
        current_retries = int(wf.get("retry_count") or 0)
        max_retries = int(wf.get("max_retries") or 3)

        if current_retries < max_retries:
            next_worker = await registry.select_best_worker(
                required_capability=wf.get("required_capability")
            )

            if next_worker:
                updated = await db.mark_for_retry(
                    wf_id=wf_id,
                    new_node_id=next_worker["node_id"],
                    error_msg=callback.error or "Worker task execution failed"
                )
                return {
                    "status": "RETRYING",
                    "workflow_id": wf_id,
                    "attempt": current_retries + 1,
                    "reassigned_to": next_worker["node_id"],
                    "scheduler_score": next_worker.get("scheduler_score", 100.0),
                    "task_data": updated
                }

        dlq_task = await db.mark_as_dlq(
            wf_id=wf_id,
            error_msg=f"Exhausted {max_retries} retries. Last error: {callback.error}"
        )
        return {
            "status": "STRANDED",
            "workflow_id": wf_id,
            "moved_to_dlq": True,
            "task_data": dlq_task
        }

    raise HTTPException(status_code=400, detail="Invalid status. Must be COMPLETED or FAILED.")


@app.post("/workflows/{wf_id}/replay")
async def replay_workflow(wf_id: str, replay: WorkflowReplay):
    wf = await db.replay_workflow(wf_id, replay.replayed_by, replay.updated_payload)
    if not wf:
        raise HTTPException(status_code=400, detail="Only FAILED or STRANDED tasks can be replayed.")

    return {
        "status": "REPLAYED",
        "workflow_id": wf_id,
        "dispatched": True,
        "task_data": wf
    }


@app.get("/dlq/all")
async def get_dlq():
    stranded = await db.get_dlq_stranded()
    return {"dlq_count": len(stranded), "stranded_jobs": stranded}


@app.get("/dashboard")
async def get_dashboard():
    return await db.get_dashboard_metrics()


# ==========================================
# 6. WORKER REGISTRY & HEARTBEAT ENDPOINTS
# ==========================================

@app.post("/workers/register")
async def register_worker(req: RegisterWorkerRequest):
    await registry.register_worker(
        node_id=req.node_id,
        capabilities=req.capabilities,
        version=req.version,
        max_concurrency=req.max_concurrency,
        zone=req.zone
    )
    return {"status": "REGISTERED", "node_id": req.node_id}


@app.post("/workers/heartbeat")
async def worker_heartbeat(req: HeartbeatRequest):
    await registry.record_heartbeat(
        node_id=req.node_id,
        cpu_pct=req.cpu_pct,
        mem_free_mb=req.mem_free_mb,
        active_tasks=req.active_tasks,
        status=req.status
    )
    return {"status": "ACK"}


@app.get("/workers/active")
async def list_active_workers():
    workers = await registry.get_healthy_workers(timeout_seconds=15.0)
    return {"active_count": len(workers), "workers": workers}