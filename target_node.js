import WebSocket from 'ws';
import process from 'process';

// Grab runtime configurations
const nodeId = process.argv[2] || `NODE-${Math.floor(Math.random() * 900) + 100}`;
const nodeRole = process.argv[3] || 'Infiltrator';
const brokerUrl = process.env.BROKER_URL || 'ws://localhost:8080';

let ws = null;
let completedTasks = 0;
let reconnectAttempts = 0;
const maxDelay = 30000; // Cap backoff at 30 seconds

function connect() {
  console.log(`📡 Connecting to broker at ${brokerUrl}...`);
  ws = new WebSocket(brokerUrl);

  ws.on('open', () => {
    console.log(`🤖 Connection established. Handshaking as [${nodeId}]...`);
    reconnectAttempts = 0; // Reset backoff math on successful connection
    
    // Register with broker
    ws.send(JSON.stringify({
      type: 'IDENTIFY',
      identity: 'WORKER_NODE',
      id: nodeId,
      role: nodeRole
    }));

    // Send initialization confirmation telemetry
    sendFeedback(`Runtime core loaded and connected. Awaiting command matrix payloads.`, 'success');
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'EXECUTE') {
        console.log(`⚡ Received command payload from Control Deck:`, data.payload);
        
        sendFeedback(`Running routine: [${data.payload.routine || 'default-eval'}]. Locking targets...`, 'warning');

        setTimeout(() => {
          completedTasks++;
          sendFeedback(`Routine execution cleanly compiled. Buffers flushed.`, 'success', {
            packetsTransmitted: completedTasks,
            bandwidthLoad: Math.floor(Math.random() * 25) + 10
          });
        }, 1500);
      }
    } catch (err) {
      console.error('⚠️ Execution handler exception:', err.message);
    }
  });

  ws.on('close', () => {
    ws = null;
    reconnectAttempts++;
    // Calculate backoff: double the delay each attempt, add a little randomness (jitter), cap at maxDelay
    const calculatedDelay = Math.min(maxDelay, Math.pow(2, reconnectAttempts) * 1000);
    const jitter = Math.random() * 1000; 
    const finalDelay = calculatedDelay + jitter;

    console.warn(`❌ Lost link to broker cluster. Retrying connection in ${(finalDelay / 1000).toFixed(2)}s (Attempt #${reconnectAttempts})...`);
    
    setTimeout(connect, finalDelay);
  });

  ws.on('error', (err) => {
    // Suppress broad stack trace crashes; let the 'close' event take care of recycling the link
    console.error(`⚠️ Network connectivity fault: ${err.message}`);
  });
}

// Helper utility to safely push metrics pipeline events back to the broker if online
function sendFeedback(msg, logType = 'info', metrics = null) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'WORKER_FEEDBACK',
      id: nodeId,
      msg,
      logType,
      metrics: metrics || { packetsTransmitted: completedTasks, bandwidthLoad: Math.floor(Math.random() * 15) + 5 }
    }));
  }
}

// Kick off the initial loop connection
connect();