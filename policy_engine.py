import os
import time
from supabase import create_client, Client

SUPABASE_URL = "https://ncndzycavosmxdajxuzp.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "your_supabase_anon_key")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class PolicyEngineV2:
    def __init__(self, execution_id: str):
        self.execution_id = execution_id
        self.cumulative_cost = 0.0

    def evaluate_step(self, step_id: str, latency_ms: float, cost: float, quality_score: float, current_model: str):
        """
        Evaluates active policies against live step telemetry.
        Returns directives (e.g., model override or approval requirements).
        """
        self.cumulative_cost += cost
        directives = {
            "model_override": None,
            "status": "CONTINUE",
            "violations": []
        }

        # Rule 1: Cost Cap Guardrail ($0.01 max budget)
        if self.cumulative_cost > 0.0100 and current_model == "gpt-4o":
            reason = f"Cumulative execution cost (${self.cumulative_cost:.6f}) exceeded budget threshold ($0.0100)."
            directives["model_override"] = "gpt-4o-mini"
            directives["violations"].append(("BUDGET_CAP_EXCEEDED", reason, "MODEL_DOWNGRADE"))

        # Rule 2: Latency SLA Check
        if latency_ms > 1200:
            reason = f"Step latency ({latency_ms}ms) breached operational SLA (1200ms)."
            directives["violations"].append(("AGENT_LATENCY_SLA", reason, "ALERT"))

        # Rule 3: Quality Gateway (Human-in-the-loop fallback)
        if quality_score < 80.0:
            reason = f"Quality score ({quality_score}) fell below tolerance threshold (80.0)."
            directives["status"] = "NEEDS_APPROVAL"
            directives["violations"].append(("QUALITY_MIN_GATE", reason, "PAUSE_APPROVAL"))

        # Log any triggered violations to Supabase
        for policy_name, reason, action in directives["violations"]:
            self._log_violation(step_id, policy_name, reason, action)

        return directives

    def _log_violation(self, step_id: str, policy_name: str, reason: str, action: str):
        try:
            supabase.table("policy_violations").insert({
                "execution_id": self.execution_id,
                "step_id": step_id,
                "policy_name": policy_name,
                "trigger_reason": reason,
                "action_taken": action
            }).execute()
            print(f"  🚨 [Policy Engine Alert] {policy_name} -> Action: {action} ({reason})")
        except Exception as e:
            print(f"  ❌ Policy logging error: {e}")


# --- TEST SIMULATION ---
if __name__ == "__main__":
    print("\n⚡ Initializing Policy Engine Test Run...")
    engine = PolicyEngineV2(execution_id="wf_exec_test_p5")

    # Simulate step 1 (High latency trigger)
    print("\n--- Evaluating Step 1: Receptionist ---")
    res1 = engine.evaluate_step("receptionist", latency_ms=1350, cost=0.0048, quality_score=92.3, current_model="gpt-4o")
    print("Directives:", res1)

    # Simulate step 2 (Cumulative cost limit breach trigger)
    print("\n--- Evaluating Step 2: Sales Agent ---")
    res2 = engine.evaluate_step("sales_agent", latency_ms=450, cost=0.0065, quality_score=94.0, current_model="gpt-4o")
    print("Directives:", res2)