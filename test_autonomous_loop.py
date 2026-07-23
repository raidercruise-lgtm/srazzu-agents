import time
import aoc_telemetry

# Shared counter to simulate consecutive failures for a mock LLM call
failure_counter = 0

def mock_flaky_llm_call(agent_id, payload, model):
    """
    Simulates a failing LLM service to test the SDK's autonomous response.
    """
    global failure_counter
    failure_counter += 1
    
    print(f"\n[Mock LLM Engine] Execution #{failure_counter} using model: '{model}'")
    
    # Intentionally fail every call to force the Policy Engine through its escalation ladder
    raise RuntimeError(f"Simulated provider error (Outage #{failure_counter})")

# Patch the placeholder function in aoc_telemetry with our mock LLM caller
aoc_telemetry.run_agent_llm_call = mock_flaky_llm_call

if __name__ == "__main__":
    print("==================================================")
    print("  AUTONOMOUS HEALING LOOP INTEGRATION TEST        ")
    print("==================================================")
    
    demo_agent_id = "agent_healing_demo"
    demo_payload = {"prompt": "Run crucial agent workflow"}
    
    try:
        aoc_telemetry.execute_with_autonomous_healing(
            agent_id=demo_agent_id,
            payload=demo_payload,
            model="gpt-4",
            max_attempts=5
        )
    except Exception as err:
        print("\n==================================================")
        print(f"🛑 Execution Terminated cleanly by SDK: {err}")
        print("==================================================")