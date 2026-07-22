const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const url = require('url');

const app = express();
app.use(express.json());

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// In-memory failure tracker
const failureTracker = new Map();

// Helper to post to Discord without relying on global fetch
function sendDiscordAlert(webhookUrl, message) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = url.parse(webhookUrl);
      const postData = JSON.stringify({ content: message });

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => resolve(true));
      req.on('error', (err) => {
        console.error('Discord Webhook Error:', err);
        resolve(false);
      });
      req.write(postData);
      req.end();
    } catch (e) {
      console.error('Discord dispatch error:', e);
      resolve(false);
    }
  });
}

// Telemetry Ingestion Webhook
app.post('/api/v1/telemetry/webhook', async (req, res) => {
  try {
    const { agentId, action, status, latency, reasoning } = req.body || {};

    if (!agentId || !status) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: agentId and status are required." 
      });
    }

    const logEntry = {
      agent_id: agentId,
      action: action || 'N/A',
      status: String(status).toUpperCase(),
      latency: latency || '0ms',
      reasoning: reasoning || null,
      created_at: new Date().toISOString()
    };

    // 1. Supabase Persistence
    if (supabase) {
      const { error: dbError } = await supabase
        .from('telemetry_logs')
        .insert([logEntry]);

      if (dbError) {
        console.error('Supabase Insert Error:', dbError.message);
      }
    }

    // 2. Alert Logic
    const normalizedStatus = logEntry.status;
    if (normalizedStatus === 'FAILED' || normalizedStatus === 'ERROR') {
      const currentFailures = (failureTracker.get(agentId) || 0) + 1;
      failureTracker.set(agentId, currentFailures);

      if (currentFailures >= 2 && process.env.DISCORD_WEBHOOK_URL) {
        await sendDiscordAlert(
          process.env.DISCORD_WEBHOOK_URL,
          `🚨 **AOC Alert: Agent Failure Threshold Reached**\n**Agent:** \`${agentId}\`\n**Action:** ${action}\n**Failures:** ${currentFailures} consecutive\n**Reason:** ${reasoning || 'Unspecified'}`
        );
      }
    } else {
      failureTracker.set(agentId, 0);
    }

    return res.status(200).json({ 
      success: true, 
      message: "Telemetry ingested successfully", 
      data: logEntry 
    });

  } catch (error) {
    console.error('Webhook execution error:', error);
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
        error: "Database connection unconfigured." 
      });
    }

    const { data, error } = await supabase
      .from('telemetry_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.status(200).json({ success: true, logs: data || [] });
  } catch (error) {
    console.error('History Fetch Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = app;