import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const {
      agentId,
      action = 'EXECUTE_WORKFLOW',
      status,
      latency = 0,
      reasoning = '',
      traceId,
      model = 'gpt-4',
      inputPayload = {},
      tenantId = 'default_tenant',
      totalTokens = 0,
      costUsd = 0.000000
    } = req.body;

    if (!agentId || !status) {
      return res.status(400).json({ error: 'Missing required fields: agentId and status' });
    }

    const currentTraceId = traceId || `tr_${Math.random().toString(36).substring(2, 10)}`;

    // 1. Fetch recent failure history for this agent BEFORE inserting current trace
    let consecutiveFailures = 0;

    if (status === 'FAILED') {
      const { data: recentTraces } = await supabase
        .from('telemetry')
        .select('status')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(10);

      // Start at 1 for current incoming failure
      consecutiveFailures = 1;
      
      if (recentTraces && recentTraces.length > 0) {
        for (const trace of recentTraces) {
          if (trace.status === 'FAILED') {
            consecutiveFailures++;
          } else {
            break; // Stop counting as soon as a SUCCESS is encountered
          }
        }
      }
    }

    // 2. Determine Healing Action based on consecutive failures
    let healingAction = 'NONE';
    let healingInstruction = { action: 'NONE' };

    if (status === 'FAILED') {
      if (consecutiveFailures === 1) {
        healingAction = 'RETRY_WITH_BACKOFF';
        healingInstruction = {
          action: 'RETRY_WITH_BACKOFF',
          backoffMs: 1000,
          retryAttempt: 1,
          message: 'First execution failure detected. Retrying with exponential backoff.'
        };
      } else if (consecutiveFailures === 2) {
        healingAction = 'SWAP_MODEL_FALLBACK';
        healingInstruction = {
          action: 'SWAP_MODEL_FALLBACK',
          fallbackModel: 'gpt-3.5-turbo',
          retryAttempt: 2,
          message: 'Primary model failed twice. Swapping model to fallback option.'
        };
      } else if (consecutiveFailures >= 3) {
        healingAction = 'CIRCUIT_BREAKER_TRIPPED';
        healingInstruction = {
          action: 'CIRCUIT_BREAKER_TRIPPED',
          circuitState: 'OPEN',
          message: 'Threshold exceeded (3+ consecutive failures). Circuit breaker tripped.'
        };
      }
    }

    // 3. Persist trace to Supabase
    const { error: dbError } = await supabase.from('telemetry').insert([
      {
        agent_id: agentId,
        tenant_id: tenantId,
        action: action,
        status: status,
        latency: Number(latency),
        reasoning: reasoning,
        trace_id: currentTraceId,
        model: model,
        input_payload: inputPayload,
        healing_action: healingAction,
        retry_count: status === 'FAILED' ? consecutiveFailures : 0,
        total_tokens: Number(totalTokens),
        cost_usd: Number(costUsd)
      }
    ]);

    if (dbError) {
      console.error('Supabase write error:', dbError);
    }

    return res.status(200).json({
      success: true,
      traceId: currentTraceId,
      agentId,
      status,
      consecutiveFailures,
      healingInstruction
    });

  } catch (error) {
    console.error('Telemetry Handler Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}