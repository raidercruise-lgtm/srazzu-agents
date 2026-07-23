import time
from aoc_telemetry import trace_agent_action

# Decorate a success workflow
@trace_agent_action(agent_id="CrewAI-Sales-Agent", action_name="Qualify Lead")
def run_sales_pipeline():
    time.sleep(0.15)
    return "Qualified 5 leads successfully."

# Decorate a failing workflow
@trace_agent_action(agent_id="LangChain-SQL-Agent", action_name="Run Query")
def run_sql_query():
    time.sleep(0.1)
    raise TimeoutError("Database query timed out after 100ms")

if __name__ == "__main__":
    print("Executing decorated agent workflows...")
    
    # Run success test
    run_sales_pipeline()
    print("✓ Sales Agent completed.")
    
    # Run failure test
    try:
        run_sql_query()
    except TimeoutError:
        print("✓ Caught intended SQL failure. Telemetry dispatched.")