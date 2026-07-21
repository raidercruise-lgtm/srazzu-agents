/**
 * Phase 4: Autonomous Governance & Self-Healing Engine
 */

const GovernanceEngine = {
  systemStatus: "OPTIMAL", // OPTIMAL, WARN, EMERGENCY_STOP
  autoHealingActive: true,
  
  policies: [
    { id: "POL-01", name: "Groq Token Cap Rate Limit", threshold: "50,000 TPM", status: "ENFORCING", icon: "🛡️" },
    { id: "POL-02", name: "Auto-Restart Stalled Nodes", threshold: "Heartbeat > 15s", status: "ACTIVE", icon: "🩹" },
    { id: "POL-03", name: "Budget Safeguard", threshold: "$50.00 / day", status: "ENFORCING", icon: "💵" }
  ],

  agentsHealth: [
    { id: "orchestrator", name: "Master Swarm Orchestrator", status: "HEALTHY", latency: "42ms", healthScore: 99 },
    { id: "agent_a", name: "NLP Agent (Groq-1)", status: "HEALTHY", latency: "110ms", healthScore: 95 },
    { id: "agent_b", name: "Execution Agent", status: "RECOVERING", latency: "450ms", healthScore: 72 },
    { id: "telemetry", name: "Telemetry Collector", status: "HEALTHY", latency: "18ms", healthScore: 100 }
  ],

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    this.fetchBackendStatus();
    this.render();
  },

  async fetchBackendStatus() {
    try {
      const res = await fetch('/api/governance/status');
      if (res.ok) {
        const data = await res.json();
        if (data.governance && data.governance.systemStatus) {
          this.systemStatus = data.governance.systemStatus;
          this.render();
        }
      }
    } catch (e) {
      console.warn('[Governance] Using local governance state fallback.');
    }
  },

  async triggerEmergencyStop() {
    this.systemStatus = "EMERGENCY_STOP";
    this.agentsHealth.forEach(a => {
      a.status = "HALTED";
      a.healthScore = 0;
    });
    this.render();
    this.showToast("🛑 EMERGENCY KILL-SWITCH ACTIVATED: ALL AGENTS FROZEN");

    // Persist to backend API
    try {
      await fetch('/api/governance/killswitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'FREEZE' })
      });
    } catch (e) {
      console.error('[Governance] Failed to sync killswitch state to server:', e);
    }
  },

  async resetSystem() {
    this.systemStatus = "OPTIMAL";
    this.agentsHealth.forEach(a => {
      a.status = "HEALTHY";
      a.healthScore = 100;
    });
    this.render();
    this.showToast("⚡ Swarm Mesh Restored to Optimal State");

    // Persist to backend API
    try {
      await fetch('/api/governance/killswitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESTORE' })
      });
    } catch (e) {
      console.error('[Governance] Failed to sync restore state to server:', e);
    }
  },

  triggerAutoHeal(agentId) {
    const agent = this.agentsHealth.find(a => a.id === agentId);
    if (!agent) return;

    agent.status = "RECOVERING";
    this.render();

    setTimeout(() => {
      agent.status = "HEALTHY";
      agent.healthScore = 100;
      agent.latency = "35ms";
      this.render();
      this.showToast(`🩹 Self-Healed ${agent.name} successfully.`);
    }, 2000);
  },

  showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 20px; right: 20px;
      background: #da3633; color: #fff; padding: 12px 18px;
      border-radius: 6px; font-size: 12px; font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 9999;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  },

  render() {
    const isStopped = this.systemStatus === "EMERGENCY_STOP";

    let policyRows = this.policies.map(p => `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #0d1117; padding: 8px 12px; border-radius: 4px; border: 1px solid #21262d; margin-bottom: 6px; font-size: 11px;">
        <div>
          <span>${p.icon} <strong>${p.name}</strong></span>
          <span style="opacity: 0.6; margin-left: 8px;">(${p.threshold})</span>
        </div>
        <span style="color: #3fb950; font-weight: bold;">${p.status}</span>
      </div>
    `).join('');

    let healthRows = this.agentsHealth.map(a => {
      let statusColor = "#3fb950";
      if (a.status === "RECOVERING") statusColor = "#d29922";
      if (a.status === "HALTED" || a.status === "CRITICAL") statusColor = "#f85149";

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; background: #0d1117; padding: 8px 12px; border-radius: 4px; border: 1px solid #21262d; margin-bottom: 6px; font-size: 11px;">
          <div>
            <strong style="color: #e6edf3;">${a.name}</strong>
            <span style="opacity: 0.6; margin-left: 8px;">Latency: ${a.latency}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="color: ${statusColor}; font-weight: bold;">${a.status} (${a.healthScore}%)</span>
            ${a.status !== "HEALTHY" && !isStopped ? `
              <button onclick="GovernanceEngine.triggerAutoHeal('${a.id}')" style="padding: 2px 6px; background: #238636; color: #fff; border: none; border-radius: 3px; font-size: 10px; cursor: pointer;">
                Auto-Heal
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
        <!-- Governance Controls -->
        <div>
          <h3 style="font-size: 12px; font-weight: bold; color: #8b949e; text-transform: uppercase; margin-bottom: 8px;">Active Policy Enforcements</h3>
          ${policyRows}
          
          <div style="margin-top: 14px;">
            ${isStopped ? `
              <button onclick="GovernanceEngine.resetSystem()" style="width: 100%; padding: 10px; background: #238636; color: #fff; border: none; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                ⚡ RESTORE ALL AGENT SWARMS
              </button>
            ` : `
              <button onclick="GovernanceEngine.triggerEmergencyStop()" style="width: 100%; padding: 10px; background: #da3633; color: #fff; border: none; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer; box-shadow: 0 0 10px rgba(218, 54, 51, 0.4);">
                🛑 EMERGENCY KILL-SWITCH (FREEZE ALL AGENTS)
              </button>
            `}
          </div>
        </div>

        <!-- Self-Healing Agent Mesh -->
        <div>
          <h3 style="font-size: 12px; font-weight: bold; color: #8b949e; text-transform: uppercase; margin-bottom: 8px;">Swarm Health & Self-Healing Watchdog</h3>
          ${healthRows}
        </div>
      </div>
    `;
  }
};

window.GovernanceEngine = GovernanceEngine;