import fetch from 'node-fetch'; // Standard fetch works out of the box in Node 18+

const AOC_ENDPOINT = 'https://srazzu-sync-agents.vercel.app/api/v1/telemetry/webhook';

export async function sendTelemetry({ agentId, action, status, latencyMs, reasoning = null }) {
  try {
    const res = await fetch(AOC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        action,
        status: status.toUpperCase(),
        latency: `${latencyMs}ms`,
        reasoning
      })
    });
    return res.ok;
  } catch (err) {
    console.error('[AOC Telemetry] Delivery failed:', err.message);
    return false;
  }
}

export function traceAgent(agentId, actionName) {
  return function (targetFunc) {
    return async function (...args) {
      const startTime = Date.now();
      try {
        const result = await targetFunc(...args);
        const latencyMs = Date.now() - startTime;
        
        await sendTelemetry({
          agentId,
          action: actionName,
          status: 'SUCCESS',
          latencyMs,
          reasoning: typeof result === 'string' ? result.substring(0, 250) : 'Execution complete'
        });
        
        return result;
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        
        await sendTelemetry({
          agentId,
          action: actionName,
          status: 'FAILED',
          latencyMs,
          reasoning: error.message
        });
        
        throw error;
      }
    };
  };
}