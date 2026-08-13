import time
import uuid
import os
import requests
import functools
from supabase import create_client, Client

# =====================================================================
# CONFIGURATION
# =====================================================================
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://YOUR_PROJECT_ID.supabase.co").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "YOUR_SUPABASE_ANON_OR_SERVICE_KEY")

PRICING = {
    "gpt-4": {"input": 0.03, "output": 0.06},
    "gpt-4o": {"input": 0.005, "output": 0.015},
    "gpt-3.5-turbo": {"input": 0.0015, "output": 0.002}
}

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception:
    supabase = None

# =====================================================================
# 1. EVALUATION & QUALITY ENGINE (Phase 3 Core)
# =====================================================================
class EvaluationEngine:
    """Calculates multidimensional quality scores and intelligent recommendations."""
    
    @staticmethod
    def evaluate_execution(agent_id, latency_ms, cost, status, prompt_tokens, completion_tokens, model_used, error_msg=None):
        # 1. Latency Score (Target: <= 500ms = 100, > 3000ms = 0)
        if latency_ms <= 500:
            latency_score = 100.0
        else:
            latency_score = max(0.0, 100.0 - ((latency_ms - 500) / 25.0))

        # 2. Cost Score (Target: <= $0.002 = 100)
        cost_score = max(0.0, 100.0 - (cost * 10000.0))

        # 3. Success & Policy Score
        success_score = 100.0 if status == "SUCCESS" else 0.0
        policy_score = 100.0 if status == "SUCCESS" else 20.0

        # 4. Hallucination Risk Estimation (Derived from token ratio & provider stability)
        if status != "SUCCESS":
            hallucination_score = 85.0 # High risk on failure
        else:
            # High output token ratio on short prompts slightly increases hallucination risk
            ratio = completion_tokens / max(1, prompt_tokens)
            hallucination_score = round(min(15.0, ratio * 5.0), 2)

        # 5. Quality Score
        quality_score = round((success_score * 0.4) + (latency_score * 0.3) + (cost_score * 0.3), 1)

        # 6. Overall Composite Score
        overall_score = round((quality_score * 0.5) + (policy_score * 0.3) + ((100.0 - hallucination_score) * 0.2), 1)

        # 7. Intelligent Recommendation Engine
        recommendations = []
        if latency_ms > 1500 and "gpt-4" in model_used and "mini" not in model_used:
            recommendations.append("Move to GPT-4o-mini to reduce latency by ~60% and costs by ~80%.")
        if cost > 0.005:
            recommendations.append("High cost per execution. Consider prompt compression or local caching.")
        if status != "SUCCESS":
            recommendations.append(f"Execution failed ({error_msg}). Trigger automated circuit breaker or fallback agent.")
        if hallucination_score > 10.0:
            recommendations.append("Elevated hallucination risk. Add strict JSON schema validation to response.")
        if not recommendations:
            recommendations.append("Optimal execution. Performance within operational targets.")

        recommendation_str = " | ".join(recommendations)

        return {
            "quality_score": quality_score,
            "success_score": success_score,
            "hallucination_score": hallucination_score,
            "latency_score": round(latency_score, 1),
            "cost_score": round(cost_score, 1),
            "policy_score": policy_score,
            "overall_score": overall_score,
            "recommendation": recommendation_str
        }

# =====================================================================
# 2. PRODUCTION OBSERVER DECORATOR
# =====================================================================
def observe_agent(agent_id, supabase_url=SUPABASE_URL, supabase_key=SUPABASE_KEY):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            status = "SUCCESS"
            error_msg = None
            result = None
            event_id = str(uuid.uuid4())
            
            try:
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                status = "CRITICAL"
                error_msg = str(e)
                raise e
            finally:
                latency = int((time.time() - start_time) * 1000)
                
                if isinstance(result, dict):
                    prompt_tokens = result.get('prompt_tokens', 150)
                    completion_tokens = result.get('completion_tokens', 80)
                    model = result.get('model', 'gpt-4')
                else:
                    prompt_tokens = getattr(result, 'prompt_tokens', 150)
                    completion_tokens = getattr(result, 'completion_tokens', 80)
                    model = getattr(result, 'model', 'gpt-4')
                
                rates = PRICING.get(model, PRICING["gpt-4"])
                cost = ((prompt_tokens / 1000) * rates["input"]) + ((completion_tokens / 1000) * rates["output"])
                
                # 1. Telemetry Payload
                telemetry_payload = {
                    "event_id": event_id,
                    "agent_id": agent_id,
                    "status": status,
                    "error_message": error_msg,
                    "model_used": model,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_cost": round(cost, 6),
                    "latency_ms": latency,
                    "attempt_count": 1,
                    "healing_action": "Production Telemetry Ingestion"
                }
                
                # 2. Run Quality & Evaluation Engine
                eval_metrics = EvaluationEngine.evaluate_execution(
                    agent_id=agent_id,
                    latency_ms=latency,
                    cost=cost,
                    status=status,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    model_used=model,
                    error_msg=error_msg
                )
                
                eval_payload = {
                    "event_id": event_id,
                    "agent_id": agent_id,
                    **eval_metrics
                }

                # Push via REST
                headers = {
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                }
                
                try:
                    # Sync Telemetry
                    requests.post(f"{supabase_url}/rest/v1/telemetry", json=telemetry_payload, headers=headers, timeout=3)
                    # Sync Evaluation Results
                    requests.post(f"{supabase_url}/rest/v1/evaluation_results", json=eval_payload, headers=headers, timeout=3)
                    
                    print(f"  [AOC Observer] Telemetry & Eval Streamed for '{agent_id}'")
                    print(f"   ├─ Quality Score: {eval_metrics['overall_score']}/100 | Latency: {latency}ms | Cost: ${cost:.6f}")
                    print(f"   └─ Recommendation: {eval_metrics['recommendation']}\n")
                except Exception as sync_err:
                    print(f"  ⚠️ [AOC Observer] Sync warning: {sync_err}")
                    
        return wrapper
    return decorator