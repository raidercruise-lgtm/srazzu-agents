import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Import ingress webhook handler
import webhookHandler from './api/ingress/webhook.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static frontend assets from root public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Health Check Endpoint
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'ok',
    hasGroqKey: !!process.env.GROQ_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// Webhook Route
app.post(['/api/ingress/webhook', '/ingress/webhook'], webhookHandler);

// Catch-all: Serve index.html for any frontend dashboard UI route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start local server if not on Vercel
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Srazzu Server running on http://localhost:${PORT}`);
  });
}

export default app;