/**
 * Phase 3: Digital Twin Canvas & Enterprise Theme Engine
 * Enhanced with Node Telemetry Inspection & Local Persistence
 */

const DigitalTwinCanvas = {
  activeIndustry: 'swarm',
  activeTheme: 'cyberpunk',
  selectedNode: null,

  // Industry-Specific Digital Twin Node Layouts
  industryLayouts: {
    swarm: {
      title: "AI Agent Swarm Mesh",
      nodes: [
        { id: "orchestrator", label: "Master Swarm Orchestrator", status: "online", x: 50, y: 20, icon: "🤖", type: "Orchestrator Node", telemetry: { cpu: "14%", memory: "1.2 GB", model: "Groq Llama-3-70b", statusText: "Orchestrating active agent swarm jobs." } },
        { id: "agent_a", label: "NLP Agent (Groq-1)", status: "active", x: 25, y: 50, icon: "⚡", type: "Execution Agent", telemetry: { cpu: "42%", memory: "512 MB", model: "Groq Mixtral-8x7b", statusText: "Processing real-time user intent streams." } },
        { id: "agent_b", label: "Execution Agent", status: "active", x: 75, y: 50, icon: "⚙️", type: "Worker Node", telemetry: { cpu: "28%", memory: "768 MB", model: "Tool Runner v2", statusText: "Executing automated workflow tasks." } },
        { id: "telemetry", label: "Telemetry Collector", status: "syncing", x: 50, y: 80, icon: "📊", type: "Monitoring Node", telemetry: { cpu: "8%", memory: "256 MB", model: "Metrics Engine", statusText: "Collecting agent execution metrics." } }
      ]
    },
    supply_chain: {
      title: "Global Supply Chain Twin",
      nodes: [
        { id: "supplier", label: "Raw Material Hub", status: "online", x: 20, y: 30, icon: "🏭", type: "Inbound Logistics", telemetry: { throughput: "1,200 units/hr", capacity: "88%", region: "US-East", statusText: "Raw material inbound feed steady." } },
        { id: "transit_1", label: "Freight Route Alpha", status: "active", x: 50, y: 30, icon: "🚢", type: "Transit Link", telemetry: { ETA: "4 hrs", speed: "22 knots", load: "94%", statusText: "Vessel en route to distribution center." } },
        { id: "distribution", label: "Distribution Center", status: "online", x: 80, y: 30, icon: "📦", type: "Fulfillment Hub", telemetry: { processing: "450 pkgs/min", queue: "Low", statusText: "Fulfillment automation operational." } },
        { id: "last_mile", label: "Last Mile Fleet", status: "active", x: 80, y: 70, icon: "🚚", type: "Delivery Fleet", telemetry: { activeVehicles: 42, batteryAvg: "81%", statusText: "Local dispatch delivery active." } }
      ]
    },
    iot_infrastructure: {
      title: "Smart Facility & IoT Infrastructure",
      nodes: [
        { id: "gateway", label: "Edge Gateway Node", status: "online", x: 50, y: 20, icon: "📡", type: "Gateway", telemetry: { connectedDevices: 128, bandwidth: "45 Mbps", statusText: "Routing telemetry to central API." } },
        { id: "sensor_grid", label: "Facility Thermal Grid", status: "active", x: 25, y: 60, icon: "🌡️", type: "Sensor Matrix", telemetry: { tempAvg: "21.4°C", humidity: "45%", statusText: "All zones within normal thresholds." } },
        { id: "power_grid", label: "Primary Power Node", status: "online", x: 75, y: 60, icon: "⚡", type: "Infrastructure", telemetry: { load: "340 kW", solarContrib: "42%", statusText: "Power grid stable with solar assist." } }
      ]
    }
  },

  // Enterprise Visualization Themes
  themes: {
    cyberpunk: { bg: "#0d1117", cardBg: "#161b22", accent: "#58a6ff", text: "#c9d1d9", border: "#30363d" },
    blueprint: { bg: "#002b36", cardBg: "#073642", accent: "#268bd2", text: "#93a1a1", border: "#2aa198" },
    dark_industrial: { bg: "#121212", cardBg: "#1e1e1e", accent: "#ff9800", text: "#e0e0e0", border: "#333333" },
    matrix: { bg: "#001100", cardBg: "#002200", accent: "#00ff00", text: "#00dd00", border: "#005500" }
  },

  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    // Load saved settings if present
    const savedTheme = localStorage.getItem('dt_theme');
    const savedIndustry = localStorage.getItem('dt_industry');
    if (savedTheme && this.themes[savedTheme]) this.activeTheme = savedTheme;
    if (savedIndustry && this.industryLayouts[savedIndustry]) this.activeIndustry = savedIndustry;

    this.renderControls();
    this.renderCanvas();
    this.applyTheme(this.activeTheme);
  },

  setTheme(themeKey) {
    if (!this.themes[themeKey]) return;
    this.activeTheme = themeKey;
    localStorage.setItem('dt_theme', themeKey);
    this.applyTheme(themeKey);
  },

  applyTheme(themeKey) {
    const t = this.themes[themeKey];
    document.documentElement.style.setProperty('--dt-bg', t.bg);
    document.documentElement.style.setProperty('--dt-card-bg', t.cardBg);
    document.documentElement.style.setProperty('--dt-accent', t.accent);
    document.documentElement.style.setProperty('--dt-text', t.text);
    document.documentElement.style.setProperty('--dt-border', t.border);
  },

  setIndustry(industryKey) {
    if (!this.industryLayouts[industryKey]) return;
    this.activeIndustry = industryKey;
    this.selectedNode = null;
    localStorage.setItem('dt_industry', industryKey);
    this.renderCanvas();
  },

  inspectNode(nodeId) {
    const layout = this.industryLayouts[this.activeIndustry];
    const node = layout.nodes.find(n => n.id === nodeId);
    if (!node) return;
    this.selectedNode = node;
    this.renderCanvas();
  },

  toggleNodeStatus(nodeId) {
    const layout = this.industryLayouts[this.activeIndustry];
    const node = layout.nodes.find(n => n.id === nodeId);
    if (!node) return;

    node.status = node.status === 'online' || node.status === 'active' ? 'offline' : 'online';
    this.renderCanvas();
  },

  renderControls() {
    const controlsHtml = `
      <div class="dt-controls" style="display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap; align-items: center;">
        <div>
          <label style="color: var(--dt-text, #fff); font-size: 11px; font-weight: bold; margin-right: 6px;">INDUSTRY LAYOUT:</label>
          <select id="dt-industry-select" onchange="DigitalTwinCanvas.setIndustry(this.value)" style="padding: 6px 10px; background: var(--dt-card-bg, #161b22); color: var(--dt-text, #fff); border: 1px solid var(--dt-border, #30363d); border-radius: 4px; cursor: pointer;">
            <option value="swarm" ${this.activeIndustry === 'swarm' ? 'selected' : ''}>AI Agent Swarm</option>
            <option value="supply_chain" ${this.activeIndustry === 'supply_chain' ? 'selected' : ''}>Supply Chain & Logistics</option>
            <option value="iot_infrastructure" ${this.activeIndustry === 'iot_infrastructure' ? 'selected' : ''}>IoT / Smart Infrastructure</option>
          </select>
        </div>
        <div>
          <label style="color: var(--dt-text, #fff); font-size: 11px; font-weight: bold; margin-right: 6px;">ENTERPRISE THEME:</label>
          <select id="dt-theme-select" onchange="DigitalTwinCanvas.setTheme(this.value)" style="padding: 6px 10px; background: var(--dt-card-bg, #161b22); color: var(--dt-text, #fff); border: 1px solid var(--dt-border, #30363d); border-radius: 4px; cursor: pointer;">
            <option value="cyberpunk" ${this.activeTheme === 'cyberpunk' ? 'selected' : ''}>Cyberpunk / Neon</option>
            <option value="blueprint" ${this.activeTheme === 'blueprint' ? 'selected' : ''}>Blueprint</option>
            <option value="dark_industrial" ${this.activeTheme === 'dark_industrial' ? 'selected' : ''}>Dark Industrial</option>
            <option value="matrix" ${this.activeTheme === 'matrix' ? 'selected' : ''}>Matrix Phosphor</option>
          </select>
        </div>
        <div style="margin-left: auto; font-size: 11px; opacity: 0.7; color: var(--dt-text, #fff);">
          💡 <i>Click any canvas node to inspect telemetry</i>
        </div>
      </div>
    `;
    this.container.insertAdjacentHTML('beforebegin', controlsHtml);
  },

  renderCanvas() {
    const layout = this.industryLayouts[this.activeIndustry];

    let nodesHtml = layout.nodes.map(node => {
      const isSelected = this.selectedNode && this.selectedNode.id === node.id;
      const isOffline = node.status === 'offline';
      const statusColor = isOffline ? '#f85149' : 'var(--dt-accent, #58a6ff)';

      return `
        <div class="dt-node" onclick="DigitalTwinCanvas.inspectNode('${node.id}')" style="position: absolute; left: ${node.x}%; top: ${node.y}%; transform: translate(-50%, -50%); background: var(--dt-card-bg, #161b22); border: 2px solid ${isSelected ? '#3fb950' : statusColor}; padding: 12px 18px; border-radius: 8px; color: var(--dt-text, #fff); box-shadow: ${isSelected ? '0 0 15px rgba(63, 185, 80, 0.6)' : '0 4px 12px rgba(0,0,0,0.5)'}; text-align: center; min-width: 140px; cursor: pointer; transition: all 0.2s ease;">
          <div style="font-size: 20px;">${node.icon}</div>
          <div style="font-weight: bold; font-size: 13px; margin-top: 4px;">${node.label}</div>
          <div style="font-size: 10px; opacity: 0.8; text-transform: uppercase; margin-top: 2px; color: ${statusColor}; font-weight: bold;">
            ${node.status} ${isSelected ? '🔍' : ''}
          </div>
        </div>
      `;
    }).join('');

    // Telemetry Panel Drawer
    let drawerHtml = '';
    if (this.selectedNode) {
      const sn = this.selectedNode;
      const telemKeys = Object.keys(sn.telemetry);
      const telemRows = telemKeys.map(k => `
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; border-bottom: 1px dotted var(--dt-border, #30363d); padding-bottom: 4px;">
          <span style="opacity: 0.7; text-transform: uppercase;">${k}:</span>
          <span style="font-weight: bold; color: var(--dt-accent, #58a6ff);">${sn.telemetry[k]}</span>
        </div>
      `).join('');

      drawerHtml = `
        <div style="background: var(--dt-card-bg, #161b22); border-left: 2px solid var(--dt-accent, #58a6ff); padding: 16px; width: 280px; height: 100%; position: absolute; right: 0; top: 0; box-shadow: -4px 0 15px rgba(0,0,0,0.4); display: flex; flex-direction: column; justify-space-between; z-index: 10;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-size: 14px; font-weight: bold; color: var(--dt-accent, #58a6ff);">${sn.icon} TELEMETRY</span>
              <button onclick="DigitalTwinCanvas.selectedNode = null; DigitalTwinCanvas.renderCanvas();" style="background: transparent; border: none; color: var(--dt-text, #fff); font-size: 16px; cursor: pointer;">✕</button>
            </div>
            <h4 style="font-size: 13px; margin-bottom: 4px;">${sn.label}</h4>
            <div style="font-size: 10px; opacity: 0.6; text-transform: uppercase; margin-bottom: 12px;">${sn.type}</div>
            
            <div style="margin-top: 10px;">
              ${telemRows}
            </div>
          </div>

          <div style="margin-top: 16px;">
            <button onclick="DigitalTwinCanvas.toggleNodeStatus('${sn.id}')" style="width: 100%; padding: 8px; background: ${sn.status === 'offline' ? '#238636' : '#da3633'}; color: #fff; border: none; border-radius: 4px; font-weight: bold; font-size: 11px; cursor: pointer;">
              ${sn.status === 'offline' ? '⚡ RESTART NODE' : '🛑 TOGGLE OFFLINE'}
            </button>
          </div>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div style="position: relative; width: 100%; height: 420px; background: var(--dt-bg, #0d1117); border: 1px solid var(--dt-border, #30363d); border-radius: 8px; overflow: hidden;">
        <div style="position: absolute; top: 10px; left: 15px; font-size: 11px; font-weight: bold; color: var(--dt-accent, #58a6ff); letter-spacing: 1px;">
          DIGITAL TWIN CANVAS // ${layout.title.toUpperCase()}
        </div>
        ${nodesHtml}
        ${drawerHtml}
      </div>
    `;
  }
};

window.DigitalTwinCanvas = DigitalTwinCanvas;