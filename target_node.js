import WebSocket from 'ws';

const BROKER_URL = process.env.BROKER_URL || 'ws://localhost:8080';
const NODE_ID = process.env.NODE_ID || 'NODE-999';
const CAPABILITIES = ['general', 'data_processing'];
const MAX_JOBS = 5;

let ws = null;
let heartbeatInterval = null;

function connect() {
    console.log(`📡 Connecting to Swarm Broker at ${BROKER_URL}...`);
    ws = new WebSocket(BROKER_URL);

    ws.on('open', () => {
        console.log(`✅ Connected to Broker. Registering node: ${NODE_ID}`);
        
        // Register Worker Node with Capabilities
        ws.send(JSON.stringify({
            type: 'REGISTER_WORKER',
            node_id: NODE_ID,
            capabilities: CAPABILITIES,
            max_jobs: MAX_JOBS
        }));

        // Start Heartbeat Loop (every 5s)
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'HEARTBEAT',
                    node_id: NODE_ID
                }));
            }
        }, 5000);
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'REGISTER_ACK': {
                    console.log(`🤖 [REGISTERED] Broker acknowledged registration for ${NODE_ID}`);
                    break;
                }

                case 'EXECUTE_TASK': {
                    console.log(`📥 Received task: ${message.workflow_id} [Action: ${message.action}]`);

                    // 1. REPLAY RESOLUTION CHECK: If payload indicates the issue was fixed by operator
                    if (message.payload && message.payload.fixed === true) {
                        console.log(`✅ [RESOLVED] Task ${message.workflow_id} payload fixed! Processing success...`);
                        
                        setTimeout(() => {
                            ws.send(JSON.stringify({
                                type: 'TASK_COMPLETED',
                                workflow_id: message.workflow_id,
                                node_id: NODE_ID,
                                result: {
                                    status: 'SUCCESS',
                                    details: 'Payload issue resolved by operator replay',
                                    processed_at: new Date().toISOString()
                                }
                            }));
                        }, 1000);
                        break;
                    }

                    // 2. SIMULATED FAILURE: Trigger failure path for failure testing
                    if (message.action === 'fail-test') {
                        console.error(`💥 [SIMULATED FAILURE] Task ${message.workflow_id} failed as instructed by action.`);
                        
                        setTimeout(() => {
                            ws.send(JSON.stringify({
                                type: 'TASK_FAILED',
                                workflow_id: message.workflow_id,
                                node_id: NODE_ID,
                                error: 'Simulated task failure on worker node'
                            }));
                        }, 1000);
                        break;
                    }

                    // 3. DEFAULT SUCCESS: Standard task execution path
                    console.log(`⚙️ Executing regular task ${message.workflow_id}...`);
                    setTimeout(() => {
                        ws.send(JSON.stringify({
                            type: 'TASK_COMPLETED',
                            workflow_id: message.workflow_id,
                            node_id: NODE_ID,
                            result: {
                                status: 'SUCCESS',
                                executed_by: NODE_ID,
                                completed_at: new Date().toISOString()
                            }
                        }));
                    }, 1500);
                    break;
                }

                default: {
                    console.log(`ℹ️ Received unhandled event: ${message.type}`);
                }
            }
        } catch (err) {
            console.error(`❌ Error parsing message: ${err.message}`);
        }
    });

    ws.on('close', () => {
        console.warn(`🔌 Connection lost. Attempting reconnect in 3s...`);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        setTimeout(connect, 3000);
    });

    ws.on('error', (err) => {
        console.error(`⚠️ WebSocket Error: ${err.message}`);
    });
}

// Start Worker Process
connect();