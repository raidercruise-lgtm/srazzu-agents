import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Load environment variables immediately on startup
dotenv.config();

// 2. Log API key status on startup so you know immediately if .env is working
const groqKey = process.env.GROQ_API_KEY;
if (!groqKey) {
  console.warn('⚠️  WARNING: GROQ_API_KEY is missing from environment variables!');
} else {
  console.log(`✅ GROQ_API_KEY detected: ${groqKey.substring(0, 7)}...`);
}

// Fix for __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Import your ingress webhook handler
import webhookHandler from './api/ingress/webhook.js';

// Health Check Route (helpful for Vercel / server monitoring)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGroqKey: !!process.env.GROQ_API_KEY
  });
});

// Route the API webhook
app.post('/api/ingress/webhook', webhookHandler);

// Fallback error handler to prevent server crashing
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(500).json({ error: { message: err.message || 'Internal Server Error' } });
});

app.listen(PORT, () => {
  console.log(`🚀 Srazzu Server running in ESM mode on http://localhost:${PORT}`);
});