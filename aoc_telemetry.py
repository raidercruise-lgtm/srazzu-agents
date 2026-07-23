import os
import requests
import uuid

# Base URL to your Vercel deployment (or localhost during dev)
VERCEL_API_URL = os.getenv("VERCEL_API_URL", "https://srazzu-sync.vercel.app/api")

def log_telemetry(
    agent_id: str,
    action: str,
    status: str,
    latency: float,
    reasoning: str,
    trace_id: str = None,
    model: str = "gpt-4o",
    prompt_version: str = "v1.0.0",
    input_payload: dict = None,
    retrieved_context: list = None,
    tools_called: list = None,
    memory_snapshot: dict = None,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    cost_usd: float = 0.0
):
    """
    Sends execution metrics and agent context to api/index.js on Vercel.
    Returns the self-healing instruction issued by the API backend.
    """
    if not trace_id:
        trace_id = f"tr_{uuid.uuid4().hex[:8]}"

    payload = {
        "agentId": agent_id,
        "action": action,
        "status": status,
        "latency": latency,
        "reasoning": reasoning,
        "traceId": trace_id,
        "model": model,
        "promptVersion": prompt_version,
        "inputPayload": input_payload or {},
        "retrievedContext": retrieved_context or [],
        "toolsCalled": tools_called or [],
        "memorySnapshot": memorySnapshot or {},
        "promptTokens": prompt_tokens,
        "completionTokens": completion_tokens,
        "costUsd": cost_usd
    }

    try:
        response = requests.post(VERCEL_API_URL, json=payload, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        healing_instruction = data.get("healingInstruction", {})
        print(f"[{status.upper()}] Sent trace {trace_id} -> Healing action: {healing_instruction.get('action')}")
        return healing_instruction

    except requests.exceptions.RequestException as e:
        print(f"⚠️ Failed to transmit telemetry to {VERCEL_API_URL}: {e}")
        return {"action": "NONE", "error": str(e)}

# Quick standalone sanity test
if __name__ == "__main__":
    print("Testing telemetry pipeline...")
    res = log_telemetry(
        agent_id="test-agent-01",
        action="Run Diagnostics",
        status="SUCCESS",
        latency=0.42,
        reasoning="Executing basic health check query.",
        model="gpt-4o",
        prompt_tokens=150,
        completion_tokens=45,
        cost_usd=0.0012
    )
    print("Response:", res)