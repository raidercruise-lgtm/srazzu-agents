import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // CORS & Method Check
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { agentId, action, status, latency, reasoning } = req.body;

    // 1. Persist Telemetry Log to Supabase
    const { data: log, error } = await supabase
      .from('telemetry_logs')
      .insert([{
        agent_id: agentId,
        action: action,
        status: status.toUpperCase(),
        latency: latency,
        reasoning: reasoning,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) throw error;

    let healingInstruction = { action: 'NONE', details: 'Action succeeded' };

    // 2. SELF-HEALING ENGINE (Triggered on FAILED status)
    if (status.toUpperCase() === 'FAILED') {
      
      // Query past 5 recent logs for this specific agent to count consecutive failures
      const { data: history } = await supabase
        .from('telemetry_logs')
        .select('status')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(5);

      let consecutiveFailures = 0;
      if (history) {
        for (const entry of history) {
          if (entry.status === 'FAILED') consecutiveFailures++;
          else break;
        }
      }

      // Execute Policy Rules based on failure count
      if (consecutiveFailures === 1) {
        healingInstruction = {
          action: 'RETRY_WITH_BACKOFF',
          delay_ms: 1000,
          recommendation: 'Transient failure detected. Retry action with 1s exponential backoff.'
        };
      } else if (consecutiveFailures === 2) {
        healingInstruction = {
          action: 'SWAP_MODEL_FALLBACK',
          fallback_model: 'claude-3-5-sonnet',
          recommendation: 'Primary model failing. Route request to secondary provider.'
        };
      } else if (consecutiveFailures >= 3) {
        healingInstruction = {
          action: 'CIRCUIT_BREAKER_TRIPPED',
          restart_container: true,
          escalate_human: true,
          recommendation: 'Persistent failure. Circuit breaker tripped. Container restart requested & Human alerted.'
        };

        // Fire High-Priority Alert to Discord Webhook
        if (process.env.DISCORD_WEBHOOK_URL) {
          await fetch(process.env.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'SRAZZU AIOps Healing Engine',
              embeds: [{
                title: `🚨 CIRCUIT BREAKER: ${agentId}`,
                color: 15158332, // Red
                fields: [
                  { name: 'Agent', value: agentId, inline: true },
                  { name: 'Consecutive Failures', value: `${consecutiveFailures}`, inline: true },
                  { name: 'Reasoning', value: reasoning || 'No context provided' },
                  { name: 'Healing Action Executed', value: '`CIRCUIT_BREAKER_TRIPPED` -> Triggered Container Restart & Escalation' }
                ],
                timestamp: new Date().toISOString()
              }]
            })
          });
        }
      }
    }

    // Return status along with self-healing instruction
    return res.status(200).json({
      success: true,
      log: log[0],
      healingInstruction
    });

  } catch (err) {
    console.error('Telemetry Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}