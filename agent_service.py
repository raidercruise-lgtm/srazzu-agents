import os
import time
from aoc_telemetry import observe_agent

# =====================================================================
# AGENT WORKFLOW DEFINITIONS
# Wrapped with @observe_agent for automated telemetry, latency, token, 
# and cost streaming to the Autonomous Operations Center (AOC).
# =====================================================================

@observe_agent(agent_id="customer_support_agent")
def handle_customer_query(user_message):
    """
    Sample Customer Support Agent workflow.
    Replace the internal block with your live OpenAI, LangChain, or CrewAI logic.
    """
    print(f"\n[Customer Support Agent] Processing query: '{user_message}'...")
    
    # Simulate execution processing time
    time.sleep(0.4)
    
    # Return response payload alongside token consumption metrics
    return {
        "response": "Hello! How can I help you today?",
        "prompt_tokens": 120,
        "completion_tokens": 45,
        "model": "gpt-4o"
    }


# =====================================================================
# EXECUTION TEST HARNESS
# =====================================================================
if __name__ == "__main__":
    print("==================================================")
    print("   RUNNING PRODUCTION AGENT TELEMETRY TEST        ")
    print("==================================================")
    
    # Execute agent task
    response = handle_customer_query("I need help resetting my password.")
    
    print("\n--- Agent Execution Output ---")
    print(f"Response: {response['response']}")
    print("==================================================")