// Safe Discord Dispatcher (won't crash the serverless function)
async function sendDiscordIncidentAlert(trace) {
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.log('⚠️ [Discord Alert] DISCORD_WEBHOOK_URL is not defined in environment variables.');
      return;
    }

    const payload = {
      username: "AOC Incident Sentinel",
      embeds: [
        {
          title: "🚨 Agent Execution Failure Detected",
          color: 15158332, // Red
          fields: [
            { name: "Agent ID", value: String(trace.agentId || trace.agent_id || 'Unknown'), inline: true },
            { name: "Action", value: String(trace.action || 'Unknown'), inline: true },
            { name: "Latency", value: String(trace.latency || 'N/A'), inline: true },
            { name: "Failure Reason", value: String(trace.reasoning || trace.error || 'Execution failure reported.') }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "AI Operations Center // Autonomous Defense" }
        }
      ]
    };

    // Use global fetch (built-in for Node 18+)
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('✅ [Discord Alert] Alert posted successfully.');
    } else {
      const errBody = await response.text();
      console.error(`❌ [Discord Alert] Discord API error (${response.status}):`, errBody);
    }
  } catch (err) {
    console.error('❌ [Discord Alert] Error dispatching alert:', err.message);
  }
}

// In your webhook handler
app.post('/api/v1/telemetry/webhook', async (req, res) => {
  try {
    const trace = req.body || {};
    const status = String(trace.status || '').toUpperCase();

    // Trigger alert if failed (awaited safely inside try-catch)
    if (status === 'FAILED' || status === 'ERROR') {
      await sendDiscordIncidentAlert(trace);
    }

    return res.status(200).json({
      success: true,
      message: 'Telemetry trace ingested',
      trace
    });
  } catch (error) {
    console.error('Webhook route error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});