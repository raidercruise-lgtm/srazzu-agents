/**
 * Human-in-the-Loop Approval Workflow Engine
 */

const ApprovalEngine = {
  // Simulated incoming pending high-stakes actions
  pendingRequests: [
    {
      id: "REQ-8092",
      agentId: "NLP-Agent-Groq1",
      mission: "Supply Chain Re-routing",
      action: "Execute Cargo Diverting Order",
      target: "Warehouse Hub Delta",
      riskLevel: "HIGH",
      reasoning: "Detected 4-hour traffic delay on Route Alpha. Rerouting via Hub Delta saves 3.2 hours.",
      timestamp: new Date().toISOString()
    },
    {
      id: "REQ-8093",
      agentId: "Execution-Worker-02",
      mission: "Infrastructure Self-Correction",
      action: "Scale Cloud Capacity (+12 Nodes)",
      target: "US-East Cluster",
      riskLevel: "MEDIUM",
      reasoning: "Traffic spike exceeds 85% threshold. Adding capacity to prevent latency.",
      timestamp: new Date().toISOString()
    }
  ],

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    this.render();
  },

  handleDecision(reqId, decision) {
    const idx = this.pendingRequests.findIndex(r => r.id === reqId);
    if (idx === -1) return;

    const req = this.pendingRequests[idx];
    
    // Remove from queue
    this.pendingRequests.splice(idx, 1);
    
    // Re-render approval panel
    this.render();

    // Broadcast decision event to console/stream
    console.log(`[Human Approval] ${decision.toUpperCase()} for ${req.id} by Human Operator.`);
    
    // Optional feedback notification
    this.showToast(`Action ${req.id} was ${decision.toUpperCase()}ED`);
  },

  showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 20px; right: 20px;
      background: #1f6feb; color: #fff; padding: 10px 16px;
      border-radius: 6px; font-size: 12px; font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 9999;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  render() {
    if (this.pendingRequests.length === 0) {
      this.container.innerHTML = `
        <div style="background: #161b22; border: 1px dashed #30363d; border-radius: 8px; padding: 24px; text-align: center; color: #8b949e;">
          <span style="font-size: 20px;">✅</span>
          <div style="font-size: 13px; font-weight: bold; margin-top: 6px; color: #3fb950;">ALL QUEUES CLEAR</div>
          <div style="font-size: 11px; margin-top: 2px;">No high-risk agent actions currently require human intervention.</div>
        </div>
      `;
      return;
    }

    const cardsHtml = this.pendingRequests.map(req => {
      const isHighRisk = req.riskLevel === 'HIGH';
      const badgeColor = isHighRisk ? '#f85149' : '#d29922';
      const badgeBg = isHighRisk ? 'rgba(248,81,73,0.15)' : 'rgba(210,153,34,0.15)';

      return `
        <div style="background: #161b22; border: 1px solid #30363d; border-left: 4px solid ${badgeColor}; border-radius: 6px; padding: 14px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: bold; font-size: 13px; color: #e6edf3;">${req.id}</span>
              <span style="font-size: 10px; background: ${badgeBg}; color: ${badgeColor}; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${req.riskLevel} RISK</span>
            </div>
            <span style="font-size: 11px; color: #8b949e;">Agent: <strong style="color: #58a6ff;">${req.agentId}</strong></span>
          </div>

          <div style="font-size: 12px; margin-bottom: 6px;">
            <strong style="color: #8b949e;">Action:</strong> <span style="color: #fff; font-weight: 600;">${req.action}</span> → <em>${req.target}</em>
          </div>

          <div style="background: #0d1117; padding: 8px 10px; border-radius: 4px; font-size: 11px; color: #8b949e; margin-bottom: 12px; border: 1px solid #21262d;">
            🧠 <strong>Agent Reasoning:</strong> "${req.reasoning}"
          </div>

          <div style="display: flex; gap: 8px;">
            <button onclick="ApprovalEngine.handleDecision('${req.id}', 'approve')" style="flex: 1; padding: 6px 12px; background: #238636; color: #fff; border: none; border-radius: 4px; font-weight: bold; font-size: 11px; cursor: pointer;">
              ✓ APPROVE ACTION
            </button>
            <button onclick="ApprovalEngine.handleDecision('${req.id}', 'reject')" style="flex: 1; padding: 6px 12px; background: #da3633; color: #fff; border: none; border-radius: 4px; font-weight: bold; font-size: 11px; cursor: pointer;">
              ✕ REJECT & ABORT
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = cardsHtml;
  }
};

window.ApprovalEngine = ApprovalEngine;