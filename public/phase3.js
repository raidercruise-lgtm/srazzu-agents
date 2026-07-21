/**
 * Phase 3: Digital Twin Canvas & Enterprise Theme Engine
 */

const DigitalTwinCanvas = {
  activeIndustry: 'swarm',
  activeTheme: 'cyberpunk',

  // Industry-Specific Digital Twin Node Layouts
  industryLayouts: {
    swarm: {
      title: "AI Agent Swarm Mesh",
      nodes: [
        { id: "orchestrator", label: "Master Swarm Orchestrator", status: "online", x: 50, y: 20, icon: "🤖" },
        { id: "agent_a", label: "NLP Agent (Groq-1)", status: "active", x: 25, y: 50, icon: "⚡" },
        { id: "agent_b", label: "Execution Agent", status: "active", x: 75, y: 50, icon: "⚙️" },
        { id: "telemetry", label: "Telemetry Collector", status: "syncing", x: 50, y: 80, icon: "📊" }
      ],
      connections: [
        { from: "orchestrator", to: "agent_a" },
        { from: "orchestrator", to: "agent_b" },
        { from: "agent_a", to: "telemetry" },
        { from: "agent_b", to: "telemetry" }
      ]
    },
    supply_chain: {
      title: "Global Supply Chain Twin",
      nodes: [
        { id: "supplier", label: "Raw Material Hub", status: "online", x: 20, y: 30, icon: "🏭" },
        { id: "transit_1", label: "Freight Route Alpha", status: "active", x: 50, y: 30, icon: "🚢" },
        { id: "distribution", label: "Distribution Center", status: "online", x: 80, y: 30, icon: "📦" },
        { id: "last_mile", label: "Last Mile Fleet", status: "active", x: 80, y: 70, icon: "🚚" }
      ],
      connections: [
        { from: "supplier", to: "transit_1" },
        { from: "transit_1", to: "distribution" },
        { from: "distribution", to: "last_mile" }
      ]
    },
    iot_infrastructure: {
      title: "Smart Facility & IoT Infrastructure",
      nodes: [
        { id: "gateway", label: "Edge Gateway Node", status: "online", x: 50, y: 20, icon: "📡" },
        { id: "sensor_grid", label: "Facility Thermal Grid", status: "active", x: 25, y: 60, icon: "🌡️" },
        { id: "power_grid", label: "Primary Power Node", status: "online", x: 75, y: 60, icon: "⚡" }
      ],
      connections: [
        { from: "gateway", to: "sensor_grid" },
        { from: "gateway", to: "power_grid" }
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
    this.renderControls();
    this.renderCanvas();
    this.applyTheme(this.activeTheme);
  },

  setTheme(themeKey) {
    if (!this.themes[themeKey]) return;
    this.activeTheme = themeKey;
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
    this.renderCanvas();
  },

  renderControls() {
    const controlsHtml = `
      <div class="dt-controls" style="display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap;">
        <div>
          <label style="color: var(--dt-text, #fff); font-size: 12px; font-weight: bold;">INDUSTRY LAYOUT:</label>
          <select id="dt-industry-select" onchange="DigitalTwinCanvas.setIndustry(this.value)" style="padding: 6px 10px; background: var(--dt-card-bg, #161b22); color: var(--dt-text, #fff); border: 1px solid var(--dt-border, #30363d); border-radius: 4px;">
            <option value="swarm">AI Agent Swarm</option>
            <option value="supply_chain">Supply Chain & Logistics</option>
            <option value="iot_infrastructure">IoT / Smart Infrastructure</option>
          </select>
        </div>
        <div>
          <label style="color: var(--dt-text, #fff); font-size: 12px; font-weight: bold;">ENTERPRISE THEME:</label>
          <select id="dt-theme-select" onchange="DigitalTwinCanvas.setTheme(this.value)" style="padding: 6px 10px; background: var(--dt-card-bg, #161b22); color: var(--dt-text, #fff); border: 1px solid var(--dt-border, #30363d); border-radius: 4px;">
            <option value="cyberpunk">Cyberpunk / Neon</option>
            <option value="blueprint">Blueprint</option>
            <option value="dark_industrial">Dark Industrial</option>
            <option value="matrix">Matrix Phosphor</option>
          </select>
        </div>
      </div>
    `;
    this.container.insertAdjacentHTML('beforebegin', controlsHtml);
  },

  renderCanvas() {
    const layout = this.industryLayouts[this.activeIndustry];
    let nodesHtml = layout.nodes.map(node => `
      <div class="dt-node" style="position: absolute; left: ${node.x}%; top: ${node.y}%; transform: translate(-50%, -50%); background: var(--dt-card-bg, #161b22); border: 2px solid var(--dt-accent, #58a6ff); padding: 12px 18px; border-radius: 8px; color: var(--dt-text, #fff); box-shadow: 0 4px 12px rgba(0,0,0,0.5); text-align: center; min-width: 140px;">
        <div style="font-size: 20px;">${node.icon}</div>
        <div style="font-weight: bold; font-size: 13px; margin-top: 4px;">${node.label}</div>
        <div style="font-size: 10px; opacity: 0.8; text-transform: uppercase; margin-top: 2px; color: var(--dt-accent, #58a6ff);">${node.status}</div>
      </div>
    `).join('');

    this.container.innerHTML = `
      <div style="position: relative; width: 100%; height: 400px; background: var(--dt-bg, #0d1117); border: 1px solid var(--dt-border, #30363d); border-radius: 8px; overflow: hidden;">
        <div style="position: absolute; top: 10px; left: 15px; font-size: 11px; font-weight: bold; color: var(--dt-accent, #58a6ff); letter-spacing: 1px;">
          DIGITAL TWIN CANVAS // ${layout.title.toUpperCase()}
        </div>
        ${nodesHtml}
      </div>
    `;
  }
};

window.DigitalTwinCanvas = DigitalTwinCanvas;