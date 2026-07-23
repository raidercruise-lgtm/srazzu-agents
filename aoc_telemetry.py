import time
import uuid
import requests

VERCEL_API_URL = "https://srazzu-sync-agents.vercel.app/api/telemetry"


def send_telemetry(
    agent_id: str,
    status: str,
    model: str,
    latency: int,
    payload: dict = None,
    reasoning: str = None,
    retry_count: int = 1,
) -> dict:
    """Helper function to transmit telemetry data to Vercel backend."""
    trace_id = f"tr_{uuid.uuid4().hex[:8]}"
    telemetry_data = {
        "agentId": agent_id,
        "action": "EXECUTE_WORKFLOW",
        "status": status,
        "latency": latency,
        "reasoning": reasoning or "Autonomous execution",
        "traceId": trace_id,
        "model": model,
        "inputPayload": payload or {},
        "retryCount": retry_count,
    }

    try:
        response = requests.post(VERCEL_API_URL, json=telemetry_data, timeout=5)
        response.raise_for_status()
        return response.json()
    except Exception as err:
        print(f"⚠️ Telemetry transmission failed: {err}")
        return {"success": False, "healingInstruction": {"action": "NONE"}}


def run_agent_llm_call(agent_id: str, payload: dict, model: str):
    """Placeholder function for actual LLM or tool execution."""
    return {"result": f"Executed payload successfully using {model}"}


def execute_with_autonomous_healing(
    agent_id: str, payload: dict, model: str = "gpt-4", max_attempts: int = 5
):
    """Wraps agent execution with an autonomous self-healing loop driven by AOC policies."""
    current_model = model
    attempt = 0

    while attempt < max_attempts:
        attempt += 1
        start_time = time.time()

        try:
            # 1. Execute primary LLM/Agent call
            response_data = run_agent_llm_call(
                agent_id, payload, model=current_model
            )
            latency = int((time.time() - start_time) * 1000)

            # Log SUCCESS telemetry
            send_telemetry(
                agent_id=agent_id,
                status="SUCCESS",
                model=current_model,
                latency=latency,
                payload=payload,
                retry_count=attempt,
            )
            return response_data

        except Exception as e:
            latency = int((time.time() - start_time) * 1000)

            # 2. Log FAILURE telemetry & pass attempt count to Policy Engine
            healing_resp = send_telemetry(
                agent_id=agent_id,
                status="FAILED",
                model=current_model,
                latency=latency,
                reasoning=str(e),
                payload=payload,
                retry_count=attempt,
            )

            instruction = healing_resp.get("healingInstruction", {})
            action = instruction.get("action", "NONE")

            print(
                f"⚠️ [Attempt {attempt}] Agent '{agent_id}' failed with error: {e}"
            )
            print(f"⚙️ [Policy Engine Action]: {action}")

            # 3. Consume Autonomous Instructions
            if action == "RETRY_WITH_BACKOFF":
                backoff_ms = instruction.get("backoffMs", 1000)
                time.sleep(backoff_ms / 1000.0)
                continue  # Retry loop

            elif action == "SWAP_MODEL_FALLBACK":
                fallback_model = instruction.get(
                    "fallbackModel", "gpt-3.5-turbo"
                )
                print(
                    f"🔄 Swapping model from {current_model} -> {fallback_model}"
                )
                current_model = fallback_model
                continue  # Retry loop with new model

            elif action == "CIRCUIT_BREAKER_TRIPPED":
                print(
                    f"🛑 Circuit breaker tripped for '{agent_id}'! Halting execution to prevent cascading failures."
                )
                raise Exception(
                    "CircuitBreakerOpen: Execution halted by AOC Policy Engine."
                )

            else:
                raise e

    raise Exception(f"Max execution attempts reached for agent '{agent_id}'.")