// swarm_launcher.js
import { spawn } from 'child_process';
import path from 'path';

// Configuration parameters
const NUM_AGENTS = 10;
const roles = ['Infiltrator', 'Sentry', 'Logistics', 'Aggregator'];
const prefixes = ['ALPHA', 'OMEGA', 'VANGUARD', 'PHANTOM', 'SPECTER', 'TITAN', 'NEXUS'];

console.log(`🚀 SWARM ORCHESTRATOR: Spawning ${NUM_AGENTS} distributed multi-agent instances...`);
console.log(`------------------------------------------------------------------`);

const activeProcesses = [];

// Clean shutdown handler to kill all child processes if you hit Ctrl+C
process.on('SIGINT', () => {
  console.log(`\n🛑 Shutdown signal caught. Dismantling agent processes...`);
  activeProcesses.forEach(({ child, id }) => {
    console.log(`Shutting down [${id}]...`);
    child.kill();
  });
  process.exit(0);
});

for (let i = 1; i <= NUM_AGENTS; i++) {
  // Generate random metadata configurations
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const randomNum = Math.floor(Math.random() * 899) + 100;
  const nodeId = `${prefix}-${randomNum}`;
  const nodeRole = roles[Math.floor(Math.random() * roles.length)];

  // Spawn the child node process
  const child = spawn('node', ['target_node.js', nodeId, nodeRole], {
    stdio: 'pipe' // Capture stdout to read their startup details
  });

  activeProcesses.push({ child, id: nodeId });

  // Stream only the initialization line to avoid terminal log flooding
  child.stdout.once('data', (data) => {
    console.log(`[SPAWNED] Node Slot #${i.toString().padStart(2, '0')} -> ID: ${nodeId.padEnd(13)} | Role: ${nodeRole}`);
  });

  // Log if a specific node errors out or crashes
  child.on('error', (err) => {
    console.error(`❌ [ERROR] Node ${nodeId} encountered an initialization failure:`, err.message);
  });
}

console.log(`\n⚡ All instances spawned into active sub-threads.`);
console.log(`Press Ctrl + C to kill the entire cluster simultaneously.`);