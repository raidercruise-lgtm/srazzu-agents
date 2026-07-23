import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Enable CORS & disable edge caching
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: Fetch history logs for the Dashboard
  if (req.method === 'GET') {
    try {
      const limit = parseInt(req.query.limit) || 30;
      const { data: logs, error } = await supabase
        .from('telemetry_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return res.status(200).json({ success: true, logs });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST: Ingest Telemetry & Enforce Self-Healing Policy
  if (req.method === 'POST') {
    try {
      const {
        agentId,
        action,
        status,
        latency,
        reasoning,
        traceId,
        model,
        promptVersion,
        inputPayload,
        retrievedContext,
        toolsCalled,
        memorySnapshot,
        promptTokens,
        completionTokens,
        costUsd
      } = req.body;

      const generatedTraceId = traceId || `tr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      // 1. Insert Enriched Execution State into Supabase
      const { data: log, error } = await supabase
        .from('telemetry_logs')
        .insert([{
          agent_id: agentId,
          action: action,
          status: status.toUpperCase(),
          latency: latency,
          reasoning: reasoning,
          trace_id: generatedTraceId,
          model: model || 'gpt-4o',
          prompt_version: promptVersion || 'v1.0.0',
          input_payload: inputPayload || {},
          retrieved_context: retrievedContext || [],
          tools_called: toolsCalled || [],
          memory_snapshot: memorySnapshot || {},
          prompt_tokens: promptTokens || 0,
          completion_tokens: completionTokens || 0,
          cost_usd: costUsd || 0.0,
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;

      let healingInstruction = { action: 'NONE', details: 'Action succeeded' };

      // 2. Self-Healing Evaluation on Failure
      if (status.toUpperCase() === 'FAILED') {
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

        if (consecutiveFailures === 1) {
          healingInstruction = {
            action: 'RETRY_WITH_BACKOFF',
            delay_ms: 1000,
            recommendation: 'Transient failure detected. Retry action with backoff.'
          };
        } else if (consecutiveFailures === 2) {
          healingInstruction = {
            action: 'SWAP_MODEL_FALLBACK',
            fallback_model: 'claude-3-5-sonnet',
            recommendation: 'Primary model failing. Routing to secondary model.'
          };
        } else if (consecutiveFailures >= 3) {
          healingInstruction = {
            action: 'CIRCUIT_BREAKER_TRIPPED',
            restart_container: true,
            escalate_human: true,
            recommendation: 'Persistent failure. Circuit breaker tripped.'
          };

          if (process.env.DISCORD_WEBHOOK_URL) {
            await fetch(process.env.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: 'SRAZZU AIOps Healing Engine',
                embeds: [{
                  title: `🚨 CIRCUIT BREAKER: ${agentId}`,
                  color: 15158332,
                  fields: [
                    { name: 'Trace ID', value: generatedTraceId, inline: true },
                    { name: 'Agent', value: agentId, inline: true },
                    { name: 'Action', value: action, inline: true },
                    { name: 'Reasoning', value: reasoning || 'No context' },
                    { name: 'Status', value: '`CIRCUIT_BREAKER_TRIPPED`' }
                  ],
                  timestamp: new Date().toISOString()
                }]
              })
            })
            .catch(err => console.error('Discord Alert Error:', err));
          }
        }
      }

      return res.status(200).json({
        success: true,
        traceId: generatedTraceId,
        log: log[0],
        healingInstruction
      });

    } catch (err) {
      console.error('Telemetry Error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}