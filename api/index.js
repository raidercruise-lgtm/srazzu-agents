const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Client safely
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Global in-memory failure tracker for Discord alerts
const failureTracker = global.failureTracker || new Map();
global.failureTracker = failureTracker;

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  // ROUTE 1: GET /api/v1/telemetry/history
  if (req.method === 'GET' && pathname.includes('/telemetry/history')) {
    try {
      if (!supabase) {
        return res.status(500).json({ success: false, error: "Database connection unconfigured." });
      }

      const { data, error } = await supabase
        .from('telemetry_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, logs: data || [] });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ROUTE 2: POST /api/v1/telemetry/webhook
  if (req.method === 'POST' && pathname.includes('/telemetry/webhook')) {
    try {
      // Handle potential stringified body
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      }
      body = body || {};

      const agentId = body.agentId || body.agent_id;
      const action = body.action || 'N/A';
      const status = String(body.status || '').toUpperCase();
      const latency = body.latency || '0ms';
      const reasoning = body.reasoning || null;

      if (!agentId || !status) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required fields: agentId and status are required." 
        });
      }

      const logEntry = {
        agent_id: agentId,
        action: action,
        status: status,
        latency: latency,
        created_at: new Date().toISOString()
      };

      // Optional: Add reasoning if provided
      if (reasoning) {
        logEntry.reasoning = reasoning;
      }

      // 1. Supabase Persistence
      if (supabase) {
        const { error: dbError } = await supabase
          .from('telemetry_logs')
          .insert([logEntry]);

        if (dbError) {
          console.error("Supabase insert error:", dbError.message);
        }
      }

      // 2. Alert Logic (Discord)
      if (status === 'FAILED' || status === 'ERROR') {
        const currentFailures = (failureTracker.get(agentId) || 0) + 1;
        failureTracker.set(agentId, currentFailures);

        if (currentFailures >= 2 && process.env.DISCORD_WEBHOOK_URL) {
          try {
            await fetch(process.env.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: `🚨 **AOC Alert: Agent Failure Threshold Reached**\n**Agent:** \`${agentId}\`\n**Action:** ${action}\n**Failures:** ${currentFailures} consecutive\n**Reason:** ${reasoning || 'Unspecified'}`
              })
            });
          } catch (dErr) {
            console.error("Discord alert error:", dErr);
          }
        }
      } else {
        failureTracker.set(agentId, 0);
      }

      return res.status(200).json({ 
        success: true, 
        message: "Telemetry ingested successfully", 
        data: logEntry 
      });

    } catch (err) {
      console.error("Webhook processing error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Catch-all for undefined routes
  return res.status(444).json({ success: false, error: "Route not found" });
};