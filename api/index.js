const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'aoc-enterprise-secret-key-2026';
const DB_PATH = path.join('/tmp', 'aoc_db.json');

// Memory State with File Persistence Fallback
let db = {
  governanceState: { systemStatus: "OPTIMAL", emergencyStop: false },
  telemetryLogs: [],
  canvasConfig: { theme: 'cyberpunk', layout: 'swarms' }
};

// Load initial state from /tmp disk storage
if (fs.existsSync(DB_PATH)) {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    db = JSON.parse(raw);
  } catch (err) {
    console.error('Failed reading DB file, reinitializing', err);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Failed saving DB file', err);
  }
}

// Middleware: Verify JWT & Roles
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    // Default guest session for open dashboard view
    req.user = { role: 'OPERATOR', username: 'Operator' };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired operational token' });
    req.user = user;
    next();
  });
}

// 1. Auth Endpoint: Generate RBAC Tokens
app.post('/api/auth/login', (req, res) => {
  const { username, role } = req.body; // 'ADMIN' or 'OPERATOR'
  const userRole = role === 'ADMIN' ? 'ADMIN' : 'OPERATOR';
  const token = jwt.sign({ username: username || 'Operator', role: userRole }, JWT_SECRET, { expiresIn: '8h' });
  
  res.json({ success: true, token, role: userRole, username });
});

// 2. Real LLM Agent Webhook Ingestion API (LangChain / CrewAI / AutoGen)
app.post('/api/v1/telemetry/webhook', (req, res) => {
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

  db.telemetryLogs.unshift(tracePayload);
  if (db.telemetryLogs.length > 100) db.telemetryLogs.pop(); // Keep last 100 traces
  saveDb();

  res.json({ success: true, message: 'Telemetry trace ingested', trace: tracePayload });
});

app.get('/api/v1/telemetry/logs', (req, res) => {
  res.json({ success: true, logs: db.telemetryLogs });
});

// 3. Governance Endpoint with Admin Role Check
app.get('/api/governance/status', (req, res) => {
  res.json({ success: true, governance: db.governanceState });
});

app.post('/api/governance/killswitch', authenticateToken, (req, res) => {
  // Enforce ADMIN role for Kill-Switch actions
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ 
      success: false, 
      error: 'ACCESS DENIED: Emergency Kill-Switch requires ADMIN privilege level.' 
    });
  }

  const { action } = req.body;
  if (action === 'FREEZE') {
    db.governanceState.systemStatus = "EMERGENCY_STOP";
    db.governanceState.emergencyStop = true;
  } else {
    db.governanceState.systemStatus = "OPTIMAL";
    db.governanceState.emergencyStop = false;
  }

  saveDb();
  res.json({ success: true, governance: db.governanceState });
});

// Canvas Configuration Endpoint
app.get('/api/canvas/config', (req, res) => {
  res.json({ success: true, config: db.canvasConfig });
});

app.post('/api/canvas/config', (req, res) => {
  db.canvasConfig = { ...db.canvasConfig, ...req.body };
  saveDb();
  res.json({ success: true, config: db.canvasConfig });
});

module.exports = app;