const express = require('express');
const app = express();

// Enable JSON body parsing for incoming API requests
app.use(express.json());

// In-memory state for Phase 3 Digital Twin Canvas configuration
let enterpriseCanvasConfig = {
  activeIndustry: 'swarm',
  activeTheme: 'cyberpunk',
  customNodes: []
};

// Healthcheck & Base Route
app.get('/api', (req, res) => {
  res.json({
    status: 'online',
    system: 'AI Operations Center (AOC)',
    version: '3.0.0'
  });
});

// ==========================================
// PHASE 3: DIGITAL TWIN CONFIG ENDPOINTS
// ==========================================

// GET current Digital Twin layout and theme config
app.get('/api/canvas/config', (req, res) => {
  res.json({
    success: true,
    config: enterpriseCanvasConfig,
    timestamp: new Date().toISOString()
  });
});

// POST update Digital Twin layout and theme config
app.post('/api/canvas/config', (req, res) => {
  const { activeIndustry, activeTheme, customNodes } = req.body;

  if (activeIndustry) enterpriseCanvasConfig.activeIndustry = activeIndustry;
  if (activeTheme) enterpriseCanvasConfig.activeTheme = activeTheme;
  if (customNodes) enterpriseCanvasConfig.customNodes = customNodes;

  res.json({
    success: true,
    message: 'Digital Twin layout configuration updated successfully.',
    config: enterpriseCanvasConfig
  });
});

// Export the Express app for Vercel Serverless deployment
module.exports = app;