import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // POST: Ingest Telemetry & Apply Policy
  if (req.method === 'POST') {
    const telemetry = req.body;
    
    // 1. Log trace to Supabase
    const { data, error } = await supabase
      .from('telemetry_logs')
      .insert([{
        agent_id: telemetry.agentId,
        action: telemetry.action,
        status: telemetry.status,
        latency: telemetry.latency,
        reasoning: telemetry.reasoning,
        trace_id: telemetry.traceId,
        model: telemetry.model,
        prompt_version: telemetry.promptVersion,
        input_payload: telemetry.inputPayload,
        retrieved_context: telemetry.retrievedContext,
        tools_called: telemetry.toolsCalled,
        memory_snapshot: telemetry.memorySnapshot,
        prompt_tokens: telemetry.promptTokens,
        completion_tokens: telemetry.completionTokens,
        cost_usd: telemetry.costUsd
      }]);

    // 2. Query recent failures for Policy Decision
    const { data: failures } = await supabase
      .from('telemetry_logs')
      .select('id')
      .eq('agent_id', telemetry.agentId)
      .eq('status', 'FAILED');

    const failCount = failures ? failures.length : 1;

    let healingInstruction = { action: "NONE" };
    if (failCount === 1) {
      healingInstruction = { action: "RETRY_WITH_BACKOFF", backoffMs: 1000 };
    } else if (failCount === 2) {
      healingInstruction = { action: "SWAP_MODEL_FALLBACK", fallbackModel: "gpt-3.5-turbo" };
    } else if (failCount >= 3) {
      healingInstruction = { action: "CIRCUIT_BREAKER_TRIPPED", alertSent: true };
    }

    return res.status(200).json({ success: true, healingInstruction });
  }

  // GET: Return logs for dashboard
  if (req.method === 'GET') {
    const { data: logs, error } = await supabase
      .from('telemetry_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    return res.status(200).json({ success: true, logs: logs || [] });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}