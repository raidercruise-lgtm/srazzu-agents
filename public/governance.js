/**
 * Phase 4: Autonomous Governance, RBAC & Webhook Log Engine
 */

const GovernanceEngine = {
  systemStatus: "OPTIMAL",
  userRole: localStorage.getItem('aoc_role') || "OPERATOR",
  authToken: localStorage.getItem('aoc_token') || "",

  policies: [
    { id: "POL-01", name: "Groq Token Cap Rate Limit", threshold: "50,000 TPM", status: "ENFORCING", icon: "🛡️" },
    { id: "POL-02", name: "Auto-Restart Stalled Nodes", threshold: "Heartbeat > 15s", status: "ACTIVE", icon: "🩹" },
    { id: "POL-03", name: "Budget Safeguard", threshold: "$50.00 / day", status: "ENFORCING", icon: "💵" }
  ],

  agentsHealth: [
    { id: "orchestrator", name: "Master Swarm Orchestrator", status: "HEALTHY", latency: "42ms", healthScore: 99 },
    { id: "agent_a", name: "NLP Agent (Groq-1)", status: "HEALTHY", latency: "110ms", healthScore: 95 },
    { id: "agent_b", name: "Execution Agent", status: "RECOVERING", latency: "450ms", healthScore: 72 }
  ],

  telemetryTraces: [],

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    this.fetchBackendStatus();
    this.fetchWebhookLogs();
    this.render();
  },

  async loginAs(role) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: `${role}-User`, role })
      });
      const data = await res.json();
      if (data.success) {
        this.userRole = data.role;
        this.authToken = data.token;
        localStorage.setItem('aoc_role', data.role);
        localStorage.setItem('aoc_token', data.token);
        this.showToast(`🔑 Switched Role to ${data.role}`);
        this.render();
      }
    } catch (e) {
      console.error('Login failed', e);
    }
  },

  async fetchBackendStatus() {
    try {
      const res = await fetch('/api/governance/status');
      if (res.ok) {
        const data = await res.json();
        if (data.governance) {
          this.systemStatus = data.governance.systemStatus;
          this.render();
        }
      }
    } catch (e) {
      console.warn('Backend fallback active');
    }
  },

  async fetchWebhookLogs() {
    try {
      const res = await fetch('/api/v1/telemetry/logs');
      if (res.ok) {
        const data = await res.json();
        this.telemetryTraces = data.logs || [];
        this.render();
      }
    } catch (e) {
      console.warn('Webhook trace fallback active');
    }
  },

  async triggerEmergencyStop() {
    if (this.userRole !== 'ADMIN') {
      this.showToast("❌ ACCESS DENIED: Switch to ADMIN role to execute Kill-Switch.");
      return;
    }

    this.systemStatus = "EMERGENCY_STOP";
    this.render();

    try {
      const res = await fetch('/api/governance/killswitch', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({ action: 'FREEZE' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      this.showToast("🛑 EMERGENCY KILL-SWITCH ACTIVATED: ALL AGENTS FROZEN");
    } catch (e) {
      this.showToast(`❌ ${e.message}`);
    }
  },

  async resetSystem() {
    if (this.userRole !== 'ADMIN') {
      this.showToast("❌ ACCESS DENIED: Switch to ADMIN role to restore swarms.");
      return;
    }

    this.systemStatus = "OPTIMAL";
    this.render();

    try {
      const res = await fetch('/api/governance/killswitch', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({ action: 'RESTORE' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      this.showToast("⚡ Swarm Mesh Restored to Optimal State");
    } catch (e) {
      this.showToast(`❌ ${e.message}`);
    }
  },

  showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 20px; right: 20px;
      background: #1f6feb; color: #fff; padding: 12px 18px;
      border-radius: 6px; font-size: 12px; font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 9999;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  },

  render() {
    const isStopped = this.systemStatus === "EMERGENCY_STOP";

    let tracesHtml = this.telemetryTraces.length === 0 ? `
      <div style="font-size: 11px; color: #8b949e; font-style: italic;">No external webhook telemetry received yet. Send POST requests to <code>/api/v1/telemetry/webhook</code></div>
    ` : this.telemetryTraces.slice(0, 3).map(t => `
      <div style="background: #0d1117; padding: 6px 10px; border-radius: 4px; border: 1px solid #21262d; margin-bottom: 4px; font-size: 11px;">
        <span style="color: #58a6ff; font-weight: bold;">[${t.agentId}]</span> ${t.action} — <span style="color: #3fb950;">${t.latency}</span>
      </div>
    `).join('');

    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #0d1117; padding: 10px 14px; border-radius: 6px; border: 1px solid #21262d; margin-bottom: 16px;">
        <div style="font-size: 12px;">
          <span>Current Session Privilege: <strong style="color: #58a6ff;">${this.userRole}</strong></span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button onclick="GovernanceEngine.loginAs('OPERATOR')" style="padding: 4px 10px; background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 4px; font-size: 11px; cursor: pointer;">Set OPERATOR Role</button>
          <button onclick="GovernanceEngine.loginAs('ADMIN')" style="padding: 4px 10px; background: #238636; color: #fff; border: none; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer;">Set ADMIN Role</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
        <div>
          <h3 style="font-size: 12px; font-weight: bold; color: #8b949e; text-transform: uppercase; margin-bottom: 8px;">Governance & Kill-Switch</h3>
          <div style="margin-top: 10px;">
            ${isStopped ? `
              <button onclick="GovernanceEngine.resetSystem()" style="width: 100%; padding: 10px; background: #238636; color: #fff; border: none; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                ⚡ RESTORE ALL AGENT SWARMS (ADMIN REQUIRED)
              </button>
            ` : `
              <button onclick="GovernanceEngine.triggerEmergencyStop()" style="width: 100%; padding: 10px; background: #da3633; color: #fff; border: none; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
                🛑 EMERGENCY KILL-SWITCH (ADMIN REQUIRED)
              </button>
            `}
          </div>
        </div>

        <div>
          <h3 style="font-size: 12px; font-weight: bold; color: #8b949e; text-transform: uppercase; margin-bottom: 8px;">Live Webhook Ingestion Stream</h3>
          ${tracesHtml}
        </div>
      </div>
    `;
  }
};

window.GovernanceEngine = GovernanceEngine;