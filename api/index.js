import express from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'aoc-enterprise-secret-key-2026';

// Supabase Integration (fallback to global memory if env vars not set)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Persistent Global Memory Fallback across warm invocations
global.telemetryLogs = global.telemetryLogs || [];
global.governanceState = global.governanceState || { systemStatus: "OPTIMAL", emergencyStop: false };

// Middleware: Verify JWT & Roles
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    req.user = { role: 'OPERATOR', username: 'Operator' };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired operational token' });
    req.user = user;
    next();
  });
}

// 1. Auth Endpoint
app.post('/api/auth/login', (req, res) => {
  const { username, role } = req.body;
  const userRole = role === 'ADMIN' ? 'ADMIN' : 'OPERATOR';
  const token = jwt.sign({ username: username || 'Operator', role: userRole }, JWT_SECRET, { expiresIn: '8h' });
  
  res.json({ success: true, token, role: userRole, username });
});

// 2. Telemetry Webhook Ingestion API
app.post('/api/v1/telemetry/webhook', async (req, res) => {
  const { agentId, action, status, latency, reasoning } = req.body;

  const tracePayload = {
    id: `TR-${Date.now()}`,
    agentId: agentId || 'External-LLM-Agent',
    action: action || 'LLM Tool Execution',
    status: status || 'COMPLETED',
    latency: latency || '85ms',
    reasoning: reasoning || 'Executed tool execution pipeline.',
    timestamp: new Date().toISOString()
  };

  // Push to global memory cache
  global.telemetryLogs.unshift(tracePayload);
  if (global.telemetryLogs.length > 100) global.telemetryLogs.pop();

  // Persist to Supabase if configured
  if (supabase) {
    try {
      await supabase.from('telemetry_logs').insert([tracePayload]);
    } catch (err) {
      console.error('Supabase write error:', err);
    }
  }

  res.json({ success: true, message: 'Telemetry trace ingested', trace: tracePayload });
});

app.get('/api/v1/telemetry/logs', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('telemetry_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(20);
      if (!error && data && data.length > 0) {
        return res.json({ success: true, logs: data });
      }
    } catch (err) {
      console.error('Supabase read error:', err);
    }
  }

  res.json({ success: true, logs: global.telemetryLogs });
});

// 3. Governance Endpoints
app.get('/api/governance/status', (req, res) => {
  res.json({ success: true, governance: global.governanceState });
});

app.post('/api/governance/killswitch', authenticateToken, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ 
      success: false, 
      error: 'ACCESS DENIED: Emergency Kill-Switch requires ADMIN privilege level.' 
    });
  }

  const { action } = req.body;
  if (action === 'FREEZE') {
    global.governanceState.systemStatus = "EMERGENCY_STOP";
    global.governanceState.emergencyStop = true;
  } else {
    global.governanceState.systemStatus = "OPTIMAL";
    global.governanceState.emergencyStop = false;
  }

  res.json({ success: true, governance: global.governanceState });
});

export default app;