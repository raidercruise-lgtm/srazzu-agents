import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT || 8080;
const ENGINE_URL = process.env.ENGINE_URL || 'http://aoc_engine:8000';
const wss = new WebSocketServer({ port: PORT });

// Worker Pool: node_id -> { ws, capabilities, max_jobs, active_jobs, status, last_heartbeat }
const workerPool = new Map();

// Active Leases: workflow_id -> { node_id, task_data, retry_count, timeout_handle }
const activeLeases = new Map();

const LEASE_TIMEOUT_MS = 15000; // 15 seconds lease limit
const MAX_RETRIES = 3;

console.log(`🚀 Swarm Broker listening on ws://0.0.0.0:${PORT}`);
console.log(`🔗 Target Engine URL for Callbacks: ${ENGINE_URL}`);

// --- Heartbeat & Worker Eviction Monitor ---
setInterval(() => {
    const now = Date.now();
    for (const [nodeId, worker] of workerPool.entries()) {
        if (now - worker.last_heartbeat > 15000) {
            console.warn(`⚠️ [EVICTION] Node ${nodeId} timed out. Removing from pool.`);
            worker.status = 'OFFLINE';
            if (worker.ws && worker.ws.readyState === WebSocket.OPEN) {
                worker.ws.close();
            }
            workerPool.delete(nodeId);
        }
    }
}, 5000);

// Helper function to send Completion callbacks to Engine
async function notifyEngineSuccess(workflowId, nodeId, result) {
    const payload = JSON.stringify({
        status: 'COMPLETED',
        node_id: nodeId,
        result: result || {}
    });

    const targetEndpoints = [
        `${ENGINE_URL}/workflows/${workflowId}/callback`,
        `http://localhost:8000/workflows/${workflowId}/callback`
    ];

    for (const url of targetEndpoints) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            });
            if (res.ok) {
                console.log(`📡 [SUCCESS CALLBACK] Notified Engine at ${url} (Status: ${res.status})`);
                return;
            } else {
                console.warn(`⚠️ [SUCCESS CALLBACK WARN] Engine at ${url} returned ${res.status}`);
            }
        } catch (err) {
            console.warn(`⚠️ [SUCCESS CALLBACK RETRY] Could not reach Engine at ${url}: ${err.message}`);
        }
    }
    console.error(`❌ [SUCCESS CALLBACK CRITICAL] Failed to notify Engine for completed task ${workflowId}`);
}

// Helper function to send DLQ/Failure callbacks to Engine
async function notifyEngineDlq(workflowId, nodeId, errorMessage) {
    const payload = JSON.stringify({
        status: 'FAILED',
        node_id: nodeId,
        error: errorMessage || 'Exceeded maximum retries'
    });

    const targetEndpoints = [
        `${ENGINE_URL}/workflows/${workflowId}/callback`,
        `http://localhost:8000/workflows/${workflowId}/callback`
    ];

    for (const url of targetEndpoints) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            });
            if (res.ok) {
                console.log(`📡 [DLQ CALLBACK SUCCESS] Notified Engine at ${url} (Status: ${res.status})`);
                return;
            } else {
                console.warn(`⚠️ [DLQ CALLBACK WARN] Engine at ${url} returned ${res.status}`);
            }
        } catch (err) {
            console.warn(`⚠️ [DLQ CALLBACK RETRY] Could not reach Engine at ${url}: ${err.message}`);
        }
    }
    console.error(`❌ [DLQ CALLBACK CRITICAL] Failed to notify Engine for ${workflowId} across all endpoints.`);
}

function dispatchTask(taskData) {
    const { workflow_id, action, required_capability, target_node, payload } = taskData;
    
    // Server-side retry tracking in activeLeases
    let lease = activeLeases.get(workflow_id);
    let currentRetryCount = lease ? lease.retry_count : 0;

    let selectedWorker = null;

    // Option A: Direct target node routing
    if (target_node && workerPool.has(target_node)) {
        const node = workerPool.get(target_node);
        if (node.status === 'ONLINE' && node.active_jobs < node.max_jobs) {
            selectedWorker = node;
        }
    }

    // Option B: Capability-based load balancing
    if (!selectedWorker) {
        const eligibleNodes = Array.from(workerPool.values()).filter(w =>
            w.status === 'ONLINE' &&
            w.active_jobs < w.max_jobs &&
            (w.capabilities.includes(required_capability || 'general') || w.capabilities.includes('general'))
        );

        eligibleNodes.sort((a, b) => a.active_jobs - b.active_jobs);
        if (eligibleNodes.length > 0) {
            selectedWorker = eligibleNodes[0];
        }
    }

    if (selectedWorker) {
        selectedWorker.active_jobs++;

        // Clear existing timeout handle if re-dispatching
        if (lease && lease.timeout_handle) {
            clearTimeout(lease.timeout_handle);
        }

        // Set Execution Lease
        const timeoutHandle = setTimeout(() => {
            console.error(`⏰ [LEASE EXPIRED] Workflow ${workflow_id} timed out on ${selectedWorker.node_id}!`);
            handleTaskFailure(workflow_id, selectedWorker.node_id, 'Execution Lease Expired');
        }, LEASE_TIMEOUT_MS);

        activeLeases.set(workflow_id, {
            node_id: selectedWorker.node_id,
            task_data: taskData,
            retry_count: currentRetryCount,
            timeout_handle: timeoutHandle
        });

        selectedWorker.ws.send(JSON.stringify({
            type: 'EXECUTE_TASK',
            workflow_id,
            action,
            payload,
            assigned_node: selectedWorker.node_id
        }));

        console.log(`✅ [DISPATCH] Sent ${workflow_id} to ${selectedWorker.node_id} (Attempt: ${currentRetryCount + 1}/${MAX_RETRIES})`);
    } else {
        console.error(`❌ [DISPATCH FAILED] No available workers for workflow: ${workflow_id}`);
    }
}

function handleTaskFailure(workflowId, nodeId, errorMessage) {
    const lease = activeLeases.get(workflowId);
    
    // Decrement active worker load
    if (nodeId && workerPool.has(nodeId)) {
        const worker = workerPool.get(nodeId);
        worker.active_jobs = Math.max(0, worker.active_jobs - 1);
    }

    if (!lease) {
        console.warn(`⚠️ No active lease found for workflow ${workflowId}`);
        return;
    }

    // Clear lease timer
    if (lease.timeout_handle) {
        clearTimeout(lease.timeout_handle);
    }

    const currentRetry = lease.retry_count;

    if (currentRetry < MAX_RETRIES - 1) {
        const nextRetry = currentRetry + 1;
        lease.retry_count = nextRetry;
        console.warn(`🔄 [RETRYING] Workflow ${workflowId} failed on ${nodeId}. Delaying retry #${nextRetry + 1}...`);

        setTimeout(() => {
            dispatchTask(lease.task_data);
        }, 2000 * nextRetry); // Exponential backoff
    } else {
        console.error(`🚨 [DLQ TRIGGERED] Workflow ${workflowId} exceeded max retries (${MAX_RETRIES}). Error: ${errorMessage}`);
        activeLeases.delete(workflowId);
        
        // Notify Engine of DLQ state transition
        notifyEngineDlq(workflowId, nodeId, errorMessage);
    }
}

wss.on('connection', (ws) => {
    let registeredNodeId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'REGISTER_WORKER': {
                    registeredNodeId = data.node_id;
                    workerPool.set(registeredNodeId, {
                        ws,
                        node_id: registeredNodeId,
                        capabilities: data.capabilities || ['general'],
                        max_jobs: data.max_jobs || 5,
                        active_jobs: 0,
                        status: 'ONLINE',
                        last_heartbeat: Date.now()
                    });
                    console.log(`🤖 [REGISTERED] Worker ${registeredNodeId}`);
                    ws.send(JSON.stringify({ type: 'REGISTER_ACK', status: 'SUCCESS' }));
                    break;
                }

                case 'HEARTBEAT': {
                    if (registeredNodeId && workerPool.has(registeredNodeId)) {
                        const worker = workerPool.get(registeredNodeId);
                        worker.last_heartbeat = Date.now();
                        worker.status = 'ONLINE';
                    }
                    break;
                }

                case 'EXECUTE_TASK': {
                    dispatchTask(data);
                    break;
                }

                case 'TASK_COMPLETED': {
                    if (registeredNodeId && workerPool.has(registeredNodeId)) {
                        const worker = workerPool.get(registeredNodeId);
                        worker.active_jobs = Math.max(0, worker.active_jobs - 1);
                    }

                    if (activeLeases.has(data.workflow_id)) {
                        clearTimeout(activeLeases.get(data.workflow_id).timeout_handle);
                        activeLeases.delete(data.workflow_id);
                        console.log(`🏁 [LEASE CLEARED] Workflow ${data.workflow_id} completed successfully.`);
                    }

                    // Notify Engine of state transition to COMPLETED
                    notifyEngineSuccess(data.workflow_id, registeredNodeId, data.result);
                    break;
                }

                case 'TASK_FAILED': {
                    handleTaskFailure(
                        data.workflow_id,
                        registeredNodeId,
                        data.error || 'Worker execution failed'
                    );
                    break;
                }
            }
        } catch (err) {
            console.error(`❌ Parse Error: ${err.message}`);
        }
    });

    ws.on('close', () => {
        if (registeredNodeId && workerPool.has(registeredNodeId)) {
            console.warn(`🔌 Worker ${registeredNodeId} disconnected.`);
            workerPool.delete(registeredNodeId);
        }
    });
});