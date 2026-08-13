import time
import uuid
import os
from supabase import create_client, Client

# =====================================================================
# SUPABASE CONFIGURATION
# Set your environment variables or paste your credentials directly here
# =====================================================================
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ncndzycavosmxdajxuzp.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_vnJMKn-XawScyg-yU1FkyQ_2uXhv-10")

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"❌ Failed to initialize Supabase client: {e}")

# Global simulation counter
failure_counter = 0

def log_telemetry_event(agent_id, status, error_message, model, attempt, healing_action):
    """Directly pushes telemetry events to the Supabase database."""
    payload = {
        "event_id": str(uuid.uuid4()),
        "agent_id": agent_id,
        "status": status,
        "error_message": error_message,
        "model_used": model,
        "attempt_count": attempt,
        "healing_action": healing_action
    }
    
    try:
        res = supabase.table("telemetry").insert(payload).execute()
        print(f"  [Supabase Sync] Logged event: {status} | Action: {healing_action}")
    except Exception as err:
        print(f"  ❌ [Supabase Error] Failed to insert telemetry row: {err}")

def execute_with_autonomous_healing(agent_id, payload, initial_model="gpt-4", max_attempts=5):
    """
    Simulates the 3-Tier Policy Engine:
    1. Retry on same model
    2. Model swap (gpt-4 -> gpt-3.5-turbo)
    3. Circuit breaker trip
    """
    global failure_counter
    current_model = initial_model
    
    for attempt in range(1, max_attempts + 1):
        failure_counter += 1
        print(f"\n[Mock LLM Engine] Attempt #{attempt} (Total #{failure_counter}) using model: '{current_model}'")
        
        # Determine policy action based on escalation tier
        if attempt == 1:
            action = "Initial Attempt"
        elif attempt in [2, 3]:
            action = f"Retry Tier ({attempt}/3)"
        elif attempt == 4:
            current_model = "gpt-3.5-turbo"
            action = "Model Swap Tier (Escalating to gpt-3.5-turbo)"
        elif attempt >= 5:
            action = "Circuit Breaker Tripped (HALT)"
            
        error_msg = f"Simulated provider error (Outage #{failure_counter})"
        status = "CRITICAL" if attempt >= 5 else "WARNING"
        
        # Push to database
        log_telemetry_event(
            agent_id=agent_id,
            status=status,
            error_message=error_msg,
            model=current_model,
            attempt=attempt,
            healing_action=action
        )
        
        if attempt >= 5:
            raise RuntimeError("Circuit Breaker Tripped: Maximum consecutive failures reached.")
            
        time.sleep(1) # Brief delay to simulate network latency

if __name__ == "__main__":
    print("==================================================")
    print("   AUTONOMOUS HEALING LOOP INTEGRATION TEST       ")
    print("==================================================")
    
    # Ensure package dependencies are installed
    # pip install supabase
    
    demo_agent_id = "agent_healing_demo"
    demo_payload = {"prompt": "Run crucial agent workflow"}
    
    try:
        execute_with_autonomous_healing(
            agent_id=demo_agent_id,
            payload=demo_payload,
            initial_model="gpt-4",
            max_attempts=5
        )
    except Exception as err:
        print("\n==================================================")
        print(f"🛑 Execution Terminated cleanly by SDK: {err}")
        print("==================================================")