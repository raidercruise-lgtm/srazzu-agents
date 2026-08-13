import time
import uuid
import os
import requests
from aoc_telemetry import observe_agent
from policy_engine import PolicyEngineV2  # Import Phase 5 Policy Engine

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ncndzycavosmxdajxuzp.supabase.co").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_vnJMKn-XawScyg-yU1FkyQ_2uXhv-10")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# =====================================================================
# AGENT REGISTRY (AI Employees)
# =====================================================================
@observe_agent(agent_id="receptionist_agent")
def receptionist_agent(input_data):
    time.sleep(0.18)
    return {"prompt_tokens": 80, "completion_tokens": 40, "model": input_data.get("override_model", "gpt-4o-mini"), "intent": "sales_inquiry", "customer": input_data.get("customer")}

@observe_agent(agent_id="intent_router")
def intent_router_agent(input_data):
    time.sleep(0.05)
    return {"prompt_tokens": 50, "completion_tokens": 20, "model": input_data.get("override_model", "gpt-4o-mini"), "route": "sales"}

@observe_agent(agent_id="sales_agent")
def sales_agent(input_data):
    time.sleep(0.45)
    # Dynamic model switch supported
    model_to_use = input_data.get("override_model", "gpt-4o")
    return {"prompt_tokens": 250, "completion_tokens": 120, "model": model_to_use, "quote_amount": 4500.00}

@observe_agent(agent_id="quote_generator")
def quote_generator_agent(input_data):
    time.sleep(0.20)
    model_to_use = input_data.get("override_model", "gpt-4o")
    return {"prompt_tokens": 180, "completion_tokens": 90, "model": model_to_use, "quote_id": f"Q-{uuid.uuid4().hex[:6].upper()}"}

AGENT_REGISTRY = {
    "receptionist": receptionist_agent,
    "intent_router": intent_router_agent,
    "sales": sales_agent,
    "quote_generator": quote_generator_agent
}

# =====================================================================
# WORKFLOW ORCHESTRATOR
# =====================================================================
class WorkflowOrchestrator:
    def __init__(self, workflow_id, name, steps):
        self.workflow_id = workflow_id
        self.name = name
        self.steps = steps

    def register_definition(self):
        payload = {
            "workflow_id": self.workflow_id,
            "name": self.name,
            "definition": {"steps": self.steps}
        }
        try:
            requests.post(f"{SUPABASE_URL}/rest/v1/workflows", json=payload, headers=HEADERS, timeout=3)
        except Exception as e:
            print(f"⚠️ Registration warning: {e}")

    def execute(self, initial_input):
        execution_id = f"wf_exec_{uuid.uuid4().hex[:8]}"
        print(f"\n==================================================")
        print(f"🚀 STARTING WORKFLOW: {self.name} [{execution_id}]")
        print(f"==================================================")

        # Instantiate Policy Engine V2 for this execution run
        policy_evaluator = PolicyEngineV2(execution_id=execution_id)

        # 1. Create execution context in DB
        init_payload = {
            "execution_id": execution_id,
            "workflow_id": self.workflow_id,
            "status": "RUNNING",
            "current_step": self.steps[0]
        }
        try:
            requests.post(f"{SUPABASE_URL}/rest/v1/workflow_executions", json=init_payload, headers=HEADERS, timeout=3)
        except Exception as e:
            print(f"⚠️ Exec init warning: {e}")

        pipeline_data = initial_input
        total_latency = 0
        total_cost = 0.0
        override_model = None

        # 2. Sequential Step Execution with Governance Gates
        for step_name in self.steps:
            print(f"\n▶ Executing Step: [{step_name.upper()}]...")
            agent_fn = AGENT_REGISTRY.get(step_name)
            
            if not agent_fn:
                print(f"❌ Unknown agent step: {step_name}")
                break

            # Pass model downgrade directives downstream if policy engine triggered it
            if override_model:
                pipeline_data["override_model"] = override_model
                print(f"  🛡️ [Policy Override Active] Forcing model -> {override_model}")

            start_t = time.time()
            output = agent_fn(pipeline_data)
            step_latency = int((time.time() - start_t) * 1000)

            total_latency += step_latency
            step_cost = 0.0031 if output.get("model") == "gpt-4o" else 0.00045
            total_cost += step_cost
            pipeline_data.update(output if isinstance(output, dict) else {})

            # --- PHASE 5: RUN POLICY EVALUATOR ---
            directives = policy_evaluator.evaluate_step(
                step_id=step_name,
                latency_ms=step_latency,
                cost=step_cost,
                quality_score=94.5, # Simulated live quality evaluation
                current_model=output.get("model", "gpt-4o")
            )

            # Enforce Model Downgrade Directive for future steps
            if directives.get("model_override"):
                override_model = directives["model_override"]

            # Enforce Quality Gate / Human-in-the-Loop Pause Directive
            if directives.get("status") == "NEEDS_APPROVAL":
                print(f"⏸️ WORKFLOW PAUSED: Human approval required at step [{step_name}]")
                break

            # Log step trace
            step_payload = {
                "execution_id": execution_id,
                "step_id": step_name,
                "agent_id": f"{step_name}_agent",
                "status": "SUCCESS",
                "latency_ms": step_latency,
                "cost": step_cost
            }
            try:
                requests.post(f"{SUPABASE_URL}/rest/v1/workflow_step_events", json=step_payload, headers=HEADERS, timeout=3)
            except Exception as e:
                print(f"⚠️ Step event log warning: {e}")

        # 3. Complete Workflow Execution
        update_payload = {
            "status": "COMPLETED",
            "current_step": "FINISHED",
            "total_latency_ms": total_latency,
            "total_cost": round(total_cost, 6),
            "overall_quality_score": 96.1
        }
        try:
            requests.patch(
                f"{SUPABASE_URL}/rest/v1/workflow_executions?execution_id=eq.{execution_id}",
                json=update_payload,
                headers=HEADERS,
                timeout=3
            )
        except Exception as e:
            print(f"⚠️ Execution completion warning: {e}")

        print(f"\n==================================================")
        print(f"✅ WORKFLOW COMPLETED [{execution_id}]")
        print(f"   ├─ Total Latency: {total_latency}ms")
        print(f"   ├─ Total Cost: ${total_cost:.6f}")
        print(f"   └─ Final Output: {pipeline_data}")
        print(f"==================================================")


if __name__ == "__main__":
    customer_workflow = WorkflowOrchestrator(
        workflow_id="enterprise_sales_dag",
        name="Enterprise Sales Pipeline",
        steps=["receptionist", "intent_router", "sales", "quote_generator"]
    )
    
    customer_workflow.register_definition()
    customer_workflow.execute({"customer": "Acme Corp", "query": "Need 500 licenses"})