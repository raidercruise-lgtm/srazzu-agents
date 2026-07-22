// Express route for Digital Twin Canvas persistence
let enterpriseCanvasConfig = {
  activeIndustry: 'swarm',
  activeTheme: 'cyberpunk',
  customNodes: []
};

// GET current configuration
app.get('/api/canvas/config', (req, res) => {
  res.json({
    success: true,
    config: enterpriseCanvasConfig,
    timestamp: new Date().toISOString()
  });
});

// POST update configuration
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