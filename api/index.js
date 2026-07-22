import express from 'express';

const app = express();

// Middleware to parse incoming JSON payloads
app.use(express.json());

// Safe Discord Incident Alert Dispatcher
async function sendDiscordIncidentAlert(trace) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      console.log('⚠️ [Discord Alert] DISCORD_WEBHOOK_URL is not configured.');
      return;
    }

    const payload = {
      username: "AOC Incident Sentinel",
      embeds: [
        {
          title: "🚨 Agent Execution Failure Detected",
          color: 15158332,
          fields: [
            { name: "Agent ID", value: String(trace?.agentId || 'Unknown'), inline: true },
            { name: "Action", value: String(trace?.action || 'Unknown'), inline: true },
            { name: "Latency", value: String(trace?.latency || 'N/A'), inline: true },
            { name: "Reasoning", value: String(trace?.reasoning || 'Execution error reported.') }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "AI Operations Center // Autonomous Governance" }
        }
      ]
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ [Discord] Discord API error ${res.status}: ${errText}`);
    } else {
      console.log('✅ [Discord] Incident alert posted.');
    }
  } catch (err) {
    console.error('❌ [Discord] Non-blocking dispatch error:', err.message);
  }
}

// Telemetry Webhook Endpoint
app.post('/api/v1/telemetry/webhook', async (req, res) => {
  try {
    const trace = req.body || {};
    const status = String(trace.status || '').toUpperCase();

    // Fire Discord alert asynchronously for failures
    if (status === 'FAILED' || status === 'ERROR') {
      sendDiscordIncidentAlert(trace).catch(err => console.error(err));
    }

    return res.status(200).json({
      success: true,
      message: 'Telemetry trace ingested',
      trace
    });
  } catch (error) {
    console.error('❌ [Webhook Handler Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default app;