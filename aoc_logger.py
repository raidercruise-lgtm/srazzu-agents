import time
import requests
import threading
from functools import wraps

class AOCLogger:
    def __init__(self, endpoint="https://srazzu-sync-agents.vercel.app/api/v1/telemetry/webhook", agent_id="Default-Agent"):
        self.endpoint = endpoint
        self.agent_id = agent_id
        self._threads = []
        self._lock = threading.Lock()

    def _send_payload_async(self, action, status, latency_ms, reasoning):
        payload = {
            "agentId": self.agent_id,
            "action": action,
            "status": status,
            "latency": f"{int(latency_ms)}ms",
            "reasoning": reasoning
        }
        
        def _post():
            try:
                requests.post(self.endpoint, json=payload, timeout=3)
            except Exception as e:
                print(f"[AOC Logger Warning] Failed to dispatch trace: {e}")

        # Non-daemon thread so short-lived scripts won't kill HTTP connection abruptly
        t = threading.Thread(target=_post, daemon=False)
        with self._lock:
            self._threads.append(t)
        t.start()

    def flush(self):
        """Wait for all pending telemetry threads to complete sending and clear queue"""
        with self._lock:
            active_threads = list(self._threads)

        for t in active_threads:
            if t.is_alive():
                t.join(timeout=2.0)

        with self._lock:
            # Clean out finished threads
            self._threads = [t for t in self._threads if t.is_alive()]

    def log(self, action, status="COMPLETED", latency_ms=100, reasoning=""):
        """Manual telemetry logger"""
        self._send_payload_async(action, status, latency_ms, reasoning)

    def trace_tool(self, action_name=None):
        """Decorator for automatic function timing and error tracing"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                start_time = time.time()
                action = action_name or func.__name__
                try:
                    result = func(*args, **kwargs)
                    elapsed_ms = (time.time() - start_time) * 1000
                    self._send_payload_async(
                        action=action,
                        status="COMPLETED",
                        latency_ms=elapsed_ms,
                        reasoning=f"Successfully executed function `{func.__name__}`."
                    )
                    return result
                except Exception as err:
                    elapsed_ms = (time.time() - start_time) * 1000
                    self._send_payload_async(
                        action=action,
                        status="FAILED",
                        latency_ms=elapsed_ms,
                        reasoning=f"Execution error: {str(err)}"
                    )
                    raise err
            return wrapper
        return decorator