import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json());

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// In-memory tracking for consecutive failures and cooldowns
const failureTracker = new Map();
const ALERT_COOLDOWN_MS = 60000; // 1-minute cooldown per agent to prevent spam

/**
 * Dispatches structured incident embeds to Discord
 */
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
            { name: "Agent ID", value: String(trace?.agentId || trace?.agent_id || 'Unknown'), inline: true },
            { name: "Consecutive Errors", value: `🔥 ${consecutiveCount} Failures`, inline: true },
            { name: "Failed Action", value: String(trace?.action || 'Unknown'), inline: true },
            { name: "Latency", value: String(trace?.latency || 'N/A'), inline: true },
            { name: "Error Reasoning", value: String(trace?.reasoning || 'Execution failure.') }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: "AI Operations Center // Autonomous Governance" }
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

/**
 * POST /api/v1/telemetry/webhook
 * Ingests swarm agent telemetry traces
 */
app.post('/api/v1/telemetry/webhook', async (req, res) => {
  try {
    const trace = req.body || {};
    const agentId = trace.agentId || trace.agent_id || 'Unknown-Agent';
    const status = String(trace.status || '').toUpperCase();
    const action = trace.action || 'Unknown Action';
    const latency = trace.latency || '0ms';
    const reasoning = trace.reasoning || null;

    // 1. Asynchronously persist to Supabase telemetry_logs table
    if (supabase) {
      supabase.from('telemetry_logs').insert([
        {
          agent_id: agentId,
          action: action,
          status: status,
          latency: latency,
          reasoning: reasoning
        }
      ]).then(({ error }) => {
        if (error) console.error('❌ [Supabase Write Error]:', error.message);
        else console.log(`💾 [Supabase] Logged trace for ${agentId}`);
      }).catch(err => console.error('❌ [Supabase Exception]:', err.message));
    } else {
      console.log('⚠️ [Supabase] Client skipped (Missing environment variables).');
    }

    // 2. Failure Tracking & Discord Incident Escalation
    if (status === 'FAILED' || status === 'ERROR') {
      const now = Date.now();
      const agentState = failureTracker.get(agentId) || { count: 0, lastAlertTime: 0 };

      agentState.count += 1;
      failureTracker.set(agentId, agentState);

      const isCooldownPassed = (now - agentState.lastAlertTime) > ALERT_COOLDOWN_MS;

      // Escalate to Discord on 2 or more consecutive failures
      if (agentState.count >= 2 && isCooldownPassed) {
        agentState.lastAlertTime = now;
        sendDiscordIncidentAlert(trace, agentState.count).catch(console.error);
      }
    } else if (status === 'SUCCESS') {
      // Reset failure counter on recovery
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

/**
 * GET /api/v1/telemetry/history
 * Returns the 50 most recent telemetry events for the frontend dashboard
 */
app.get('/api/v1/telemetry/history', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Database connection unconfigured. Verify SUPABASE_URL and SUPABASE_ANON_KEY.' 
      });
    }

    const { data, error } = await supabase
      .from('telemetry_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.status(200).json({ success: true, logs: data });
  } catch (error) {
    console.error('History fetch error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default app;