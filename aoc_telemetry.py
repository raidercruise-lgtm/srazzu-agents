import time
import requests
import functools
import traceback

AOC_ENDPOINT = "https://srazzu-sync-agents.vercel.app/api/v1/telemetry/webhook"

def send_telemetry(agent_id: str, action: str, status: str, latency_ms: int, reasoning: str = None):
    """Sends telemetry data directly to the AOC Webhook and receives healing instructions."""
    payload = {
        "agentId": agent_id,
        "action": action,
        "status": status.upper(),
        "latency": f"{latency_ms}ms",
        "reasoning": reasoning
    }
    try:
        response = requests.post(AOC_ENDPOINT, json=payload, timeout=5)
        if response.status_code == 200:
            data = response.json()
            healing = data.get("healingInstruction", {})
            if healing.get("action") != "NONE":
                print(f"\n[⚡ SRAZZU HEALING ENGINE] Policy Action Triggered for '{agent_id}':")
                print(f" ├─ Action: {healing.get('action')}")
                print(f" └─ Recommendation: {healing.get('recommendation')}\n")
            return healing
        return None
    except Exception as e:
        print(f"[AOC Telemetry] Failed to send log: {e}")
        return None

def trace_agent_action(agent_id: str, action_name: str = None, max_auto_retries: int = 1):
    """
    Decorator that tracks execution and handles autonomous retries / model fallbacks
    based on healing instructions returned by SRAZZU SYNC.
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            action = action_name or func.__name__
            start_time = time.time()
            
            try:
                result = func(*args, **kwargs)
                latency_ms = int((time.time() - start_time) * 1000)
                reasoning = str(result)[:250] if result else "Action completed successfully."
                
                send_telemetry(agent_id, action, "SUCCESS", latency_ms, reasoning)
                return result
                
            except Exception as e:
                latency_ms = int((time.time() - start_time) * 1000)
                error_msg = f"Error: {str(e)}"
                
                # Report failure & fetch policy instruction from SRAZZU Policy Engine
                healing = send_telemetry(agent_id, action, "FAILED", latency_ms, error_msg)
                
                # Execute Healing Policy
                if healing:
                    policy_action = healing.get("action")
                    
                    if policy_action == "RETRY_WITH_BACKOFF" and max_auto_retries > 0:
                        delay = healing.get("delay_ms", 1000) / 1000.0
                        print(f"[Self-Healing] Waiting {delay}s before retrying action '{action}'...")
                        time.sleep(delay)
                        
                        # Re-run decorated function (Retry #1)
                        return wrapper(*args, **kwargs)
                        
                    elif policy_action == "SWAP_MODEL_FALLBACK":
                        print(f"[Self-Healing] Routing '{agent_id}' to fallback model: {healing.get('fallback_model')}...")
                        kwargs['model_override'] = healing.get('fallback_model')
                        return func(*args, **kwargs)

                raise e
        return wrapper
    return decorator