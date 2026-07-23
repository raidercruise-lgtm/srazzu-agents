import { sendTelemetry } from './aocTelemetry.js';

async function executeRouterAgent() {
  const start = Date.now();
  console.log("Routing incoming query...");

  // Simulate execution
  await new Promise(resolve => setTimeout(resolve, 150));

  await sendTelemetry({
    agentId: 'Node-Router-Agent',
    action: 'Classify User Prompt',
    status: 'SUCCESS',
    latencyMs: Date.now() - start,
    reasoning: 'Routed to Customer Support pipeline with 0.94 confidence score.'
  });
}

executeRouterAgent();