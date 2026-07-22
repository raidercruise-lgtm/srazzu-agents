const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// In-memory failure tracking for Discord alerts
const failureTracker = new Map();

// Telemetry Ingestion Webhook
app.post('/api/v1/telemetry/webhook', async (req, res) => {
  try {
    const { agentId, action, status, latency, reasoning } = req.body;

    if (!agentId || !status) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: agentId and status are required." 
      });
    }

    const logEntry = {
      agent_id: agentId,
      action: action || 'N/A',
      status: status.toUpperCase(),
      latency: latency || '0ms',
      reasoning: reasoning || null,
      created_at: new Date().toISOString()
    };

    // 1. Persistence to Supabase (if configured)
    if (supabase) {
      const { error: dbError } = await supabase
        .from('telemetry_logs')
        .insert([logEntry]);

      if (dbError) {
        console.error('Supabase Insert Error:', dbError);
      }
    } else {
      console.warn('Supabase client unconfigured. Skipping DB persistence.');
    }

    // 2. Alert Logic (Discord Consecutive Failure Threshold)
    const normalizedStatus = status.toUpperCase();
    if (normalizedStatus === 'FAILED' || normalizedStatus === 'ERROR') {
      const currentFailures = (failureTracker.get(agentId) || 0) + 1;
      failureTracker.set(agentId, currentFailures);

      // Trigger Discord alert if 2 or more consecutive failures occur
      if (currentFailures >= 2 && process.env.DISCORD_WEBHOOK_URL) {
        try {
          await fetch(process.env.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `🚨 **AOC Alert: Agent Failure Threshold Reached**\n**Agent:** \`${agentId}\`\n**Action:** ${action}\n**Failures:** ${currentFailures} consecutive\n**Reason:** ${reasoning || 'Unspecified'}`
            })
          });
        } catch (discordErr) {
          console.error('Discord Webhook Delivery Error:', discordErr);
        }
      }
    } else {
      // Reset failure counter on success
      failureTracker.set(agentId, 0);
    }

    return res.status(200).json({ 
      success: true, 
      message: "Telemetry ingested successfully", 
      data: logEntry 
    });

  } catch (error) {
    console.error('Unhandled Telemetry Webhook Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Internal Server Error" 
    });
  }
});

// Telemetry History Endpoint
app.get('/api/v1/telemetry/history', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ 
        success: false, 
        error: "Database connection unconfigured. Verify SUPABASE_URL and SUPABASE_ANON_KEY." 
      });
    }

    const { data, error } = await supabase
      .from('telemetry_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return res.status(200).json({ success: true, logs: data || [] });
  } catch (error) {
    console.error('History Fetch Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = app;