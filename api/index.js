// Helper function to dispatch Discord Alerts
async function sendDiscordIncidentAlert(trace) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[Discord Alert] DISCORD_WEBHOOK_URL not configured. Skipping alert.');
    return;
  }

  // Discord Rich Embed Payload
  const embedPayload = {
    username: "AOC Incident Sentinel",
    avatar_url: "https://i.imgur.com/4M34hi2.png",
    embeds: [
      {
        title: "🚨 Agent Execution Failure Detected",
        color: 15158332, // Red hex code
        fields: [
          { name: "Agent ID", value: `\`${trace.agentId || 'Unknown Agent'}\``, inline: true },
          { name: "Action", value: `\`${trace.action || 'Unknown Action'}\``, inline: true },
          { name: "Latency", value: `\`${trace.latency || 'N/A'}\``, inline: true },
          { name: "Failure Reason", value: trace.reasoning || "No error details provided." }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "AI Operations Center // Autonomous Governance"
        }
      }
    ]
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embedPayload)
    });
    if (!res.ok) {
      console.error('[Discord Alert] Failed to post alert to Discord:', res.statusText);
    } else {
      console.log('⚡ [Discord Alert] Incident notification dispatched successfully!');
    }
  } catch (err) {
    console.error('[Discord Alert] Network error while sending alert:', err);
  }
}

// In your /api/v1/telemetry/webhook POST handler:
app.post('/api/v1/telemetry/webhook', async (req, res) => {
  try {
    const trace = req.body;

    // 1. Existing Supabase insertion logic here...
    // await supabase.from('telemetry').insert([trace]);

    // 2. Trigger Discord Incident Alert on FAILED status
    if (trace && trace.status === 'FAILED') {
      // Non-blocking trigger so response latency isn't delayed
      sendDiscordIncidentAlert(trace);
    }

    return res.status(200).json({
      success: true,
      message: 'Telemetry trace ingested',
      trace
    });
  } catch (error) {
    console.error('Webhook ingestion error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});