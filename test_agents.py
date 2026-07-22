import time
from aoc_logger import AOCLogger

# Initialize loggers for two distinct Python agents
finance_agent = AOCLogger(agent_id="CrewAI-Financial-Analyst")
research_agent = AOCLogger(agent_id="LangChain-Web-Researcher")

print("🚀 Simulating external LLM Agent tasks...")

# 1. Test Decorator Tracking on Finance Agent
@finance_agent.trace_tool(action_name="Analyze Portfolio Risk")
def analyze_risk(portfolio_id):
    time.sleep(0.18)  # Simulate network/API latency
    return f"Portfolio {portfolio_id} risk score: LOW"

result = analyze_risk("PORT-2026-X")
print(f"  [1] Executed tool: {result}")

# 2. Test Manual Log Dispatch on Research Agent
research_agent.log(
    action="Scrape Financial News",
    status="COMPLETED",
    latency_ms=94,
    reasoning="Extracted Q2 market insights from top 5 sources."
)
print("  [2] Dispatched manual trace for LangChain Research Agent.")

print("\n✅ Traces dispatched! Flushing background network threads...")

# Ensure both loggers finish sending their requests before exit
finance_agent.flush()
research_agent.flush()

print("✨ Done! Check your dashboard now.")