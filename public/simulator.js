/**
 * AOC Autonomous Swarm Simulator
 * Simulates real-time telemetry traffic across multi-agent clusters.
 */

const SWARM_AGENTS = [
  { id: "CrewAI-Financial-Analyst", actions: ["Analyze Portfolio Risk", "Fetch 10-K Filings", "Audit Tax Liability"] },
  { id: "LangChain-Web-Researcher", actions: ["Scrape Market News", "Extract Competitor Pricing", "Summarize Press Release"] },
  { id: "AutoGen-Code-Architect", actions: ["Run Unit Tests", "Refactor Express Controller", "Analyze AST Coverage"] },
  { id: "LlamaIndex-Doc-RAG", actions: ["Query Vector Store", "Generate Embeddings", "Re-rank Search Results"] }
];

let simulatorInterval = null;

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTracePayload() {
  const agent = getRandomItem(SWARM_AGENTS);
  const action = getRandomItem(agent.actions);
  const isFailure = Math.random() < 0.15; // 15% simulated failure rate
  const latency = Math.floor(Math.random() * 450) + 40; // 40ms - 490ms

  return {
    agentId: agent.id,
    action: action,
    status: isFailure ? "FAILED" : "COMPLETED",
    latency: `${latency}ms`,
    reasoning: isFailure 
      ? `Simulated execution error in step: ${action}`
      : `Successfully processed step: ${action}`
  };
}

async function sendSimulatedTrace() {
  const payload = generateTracePayload();
  try {
    const res = await fetch('/api/v1/telemetry/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log('[Swarm Simulator] Trace dispatched:', data);
  } catch (err) {
    console.error('[Swarm Simulator] Dispatch error:', err);
  }
}

window.startSwarmSimulation = function(intervalMs = 4000) {
  if (simulatorInterval) return;
  console.log('🚀 [AOC Swarm Simulator] Started.');
  sendSimulatedTrace(); // Immediate initial ping
  simulatorInterval = setInterval(sendSimulatedTrace, intervalMs);
};

window.stopSwarmSimulation = function() {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    simulatorInterval = null;
    console.log('🛑 [AOC Swarm Simulator] Stopped.');
  }
};