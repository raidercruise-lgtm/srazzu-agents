from aoc_telemetry import log_telemetry

agent = "order-processing-agent"

print("--- Test 1: First Failure (Should trigger RETRY_WITH_BACKOFF) ---")
log_telemetry(
    agent_id=agent,
    action="Process Payment",
    status="FAILED",
    latency=1.2,
    reasoning="Gateway timeout while contacting payment processor.",
    input_payload={"order_id": "ORD-9901", "amount": 149.99}
)

print("\n--- Test 2: Second Failure (Should trigger SWAP_MODEL_FALLBACK) ---")
log_telemetry(
    agent_id=agent,
    action="Process Payment",
    status="FAILED",
    latency=2.1,
    reasoning="Fallback gateway also timed out.",
    input_payload={"order_id": "ORD-9901", "amount": 149.99}
)

print("\n--- Test 3: Third Failure (Should trigger CIRCUIT_BREAKER_TRIPPED) ---")
log_telemetry(
    agent_id=agent,
    action="Process Payment",
    status="FAILED",
    latency=0.05,
    reasoning="Persistent connection refusal.",
    input_payload={"order_id": "ORD-9901", "amount": 149.99}
)