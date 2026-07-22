import express from 'express';

const app = express();
app.use(express.json());

// In-memory failure tracking map (agentId -> { count, lastAlertTime })
const failureTracker = new Map();

// Alert Throttle Config (in milliseconds)
const ALERT_COOLDOWN_MS = 60000; // 1 minute per agent

async function sendDiscordIncidentAlert(trace, consecutiveCount) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    const payload = {
      username: "AOC Incident Sentinel",
      embeds: [
        {
          title: "🚨 CRITICAL: Persistent Agent Failure",
          color: 15158332, // Red
          fields: [
            { name: "Agent ID", value: String(trace?.agentId || 'Unknown'), inline: true },
            { name: "Consecutive Errors", value: `🔥 ${consecutiveCount} Failures`, inline: true },
            { name: "Failed Action", value: String(trace?.action || 'Unknown'), inline: true },
            { name: "Latency", value: String(trace?.latency || 'N/A'), inline: true },
            { name: "Error Reasoning", value: String(trace?.reasoning || 'Execution failure.') }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "AI Operations Center // Autonomous Defense" }
        }
      ]
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('❌ [Discord Dispatch Error]:', err.message);
  }
}

app.post('/api/v1/telemetry/webhook', async (req, res) => {
  try {
    const trace = req.body || {};
    const status = String(trace.status || '').toUpperCase();
    const agentId = trace.agentId || 'Unknown-Agent';

    if (status === 'FAILED' || status === 'ERROR') {
      const now = Date.now();
      const agentState = failureTracker.get(agentId) || { count: 0, lastAlertTime: 0 };

      agentState.count += 1;
      failureTracker.set(agentId, agentState);

      // Trigger Discord alert if consecutive failures >= 2 AND outside cooldown window
      const isCooldownPassed = (now - agentState.lastAlertTime) > ALERT_COOLDOWN_MS;

      if (agentState.count >= 2 && isCooldownPassed) {
        agentState.lastAlertTime = now;
        sendDiscordIncidentAlert(trace, agentState.count).catch(console.error);
      }
    } else if (status === 'SUCCESS') {
      // Reset failure counter on successful execution
      failureTracker.delete(agentId);
    }

    return res.status(200).json({
      success: true,
      message: 'Telemetry trace ingested',
      trace
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default app;