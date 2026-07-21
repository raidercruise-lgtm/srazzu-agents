// broker.js
import { WebSocketServer } from 'ws';
import http from 'http';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

// --- PERSISTENCE STORAGE MATRIX INITIALIZATION ---
const dbFile = process.env.DB_PATH || path.resolve('./swarm_telemetry.db');

const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('❌ Database storage initialization failed:', err.message);
  } else {
    console.log(`🗄️ Database linked securely at: ${dbFile}`);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      source TEXT,
      message TEXT,
      log_type TEXT
    )
  `);
});

function saveLogToMatrix(source, message, logType) {
  const stmt = db.prepare(`INSERT INTO system_logs (source, message, log_type) VALUES (?, ?, ?)`);
  stmt.run(source, message, logType, (err) => {
    if (err) console.error('❌ Disk write fault:', err.message);
  });
  stmt.finalize();
}

// --- CENTRAL COMMunications NETWORK HUB ---
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    // Serve the Control Deck UI
    fs.readFile(path.resolve('./index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading Control Deck interface.');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      }
    });
  } else {
    // Basic fallback for ping requests
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Swarm Broker API Active\n');
  }
});
const wss = new WebSocketServer({ server });

let controlDeckClient = null;
const workerNodes = new Map(); // id -> socket

wss.on('connection', (ws) => {
  console.log('📡 New network channel linked to broker.');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'IDENTIFY') {
        if (data.identity === 'CONTROL_DECK') {
          controlDeckClient = ws;
          console.log('💻 Swarm Control Deck dashboard connected successfully.');
          broadcastWorkerSync();
        } else if (data.identity === 'WORKER_NODE') {
          workerNodes.set(data.id, ws);
          ws.nodeId = data.id;
          ws.nodeRole = data.role;
          console.log(`🤖 Target Node Registered: [${data.id}] (${data.role})`);
          broadcastWorkerSync();
        }
      }

      if (data.type === 'DISPATCH_PAYLOAD') {
        const targetSocket = workerNodes.get(data.targetId);
        if (targetSocket) {
          console.log(`⚡ Routing isolated payload from deck to Node [${data.targetId}]`);
          targetSocket.send(JSON.stringify({
            type: 'EXECUTE',
            payload: data.payload
          }));
        }
      }

      if (data.type === 'WORKER_FEEDBACK') {
        saveLogToMatrix(data.id, data.msg, data.logType || 'info');

        if (controlDeckClient) {
          controlDeckClient.send(JSON.stringify({
            type: 'LOG',
            source: data.id,
            msg: data.msg,
            logType: data.logType || 'info',
            metricsUpdate: data.metrics
          }));
        }
      }

    } catch (err) {
      console.error('⚠️ Direct transmission parse failure:', err.message);
    }
  });

  ws.on('close', () => {
    if (ws === controlDeckClient) {
      controlDeckClient = null;
      console.log('💻 Swarm Control Deck detached.');
    } else if (ws.nodeId) {
      workerNodes.delete(ws.nodeId);
      console.log(`❌ Target Node Offline: [${ws.nodeId}]`);
      broadcastWorkerSync();
    }
  });
});

function broadcastWorkerSync() {
  if (!controlDeckClient) return;
  const currentNodes = [];
  workerNodes.forEach((socket, id) => {
    currentNodes.push({ id: id, role: socket.nodeRole, connected: true });
  });
  controlDeckClient.send(JSON.stringify({
    type: 'SYNC_WORKERS',
    nodes: currentNodes
  }));
}

// --- AUTONOMOUS DYNAMIC TASK ENGINE ---
// Every 12 seconds, the broker automatically dispatches a routine check to connected nodes
setInterval(() => {
  if (workerNodes.size === 0) return;

  console.log(`🤖 Autonomous Engine: Initiating dynamic health & balancing sweep across active grid...`);
  
  workerNodes.forEach((socket, id) => {
    const autonomousRoutines = [
      { routine: "auto-telemetry-heartbeat", buffer_size_mb: 128, stealth_mode: true },
      { routine: "dynamic-load-rebalance", buffer_size_mb: 256, stealth_mode: false },
      { routine: "isolated-surface-sweep", buffer_size_mb: 64, stealth_mode: true }
    ];

    // Pick a random routine from the pool
    const selectedRoutine = autonomousRoutines[Math.floor(Math.random() * autonomousRoutines.length)];

    console.log(`🤖 [AUTONOMOUS] -> Distributing task payload to [${id}]`);
    socket.send(JSON.stringify({
      type: 'EXECUTE',
      payload: selectedRoutine
    }));
  });
}, 12000);

server.listen(8080, () => {
  console.log('🚀 Swarm Core Broker running live on ws://localhost:8080');
});