import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Diagnostic Logging Middleware (Tracks how Vercel rewrites incoming URLs)
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url} | originalUrl: ${req.originalUrl}`);
  next();
});

// Serve static assets from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Health Check Endpoint (Catch-all for all routing variants)
app.get(['/api/health', '/health', '/healthcheck'], (req, res) => {
  res.json({
    status: 'ok',
    receivedUrl: req.url,
    originalUrl: req.originalUrl,
    hasGroqKey: !!process.env.GROQ_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// Fallback route for SPA frontend navigation
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({
        error: 'Frontend index.html not found in public/ directory',
        pathRequested: req.url,
        originalUrl: req.originalUrl
      });
    }
  });
});

// Start local server when not running inside Vercel serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 AOC Server running on http://localhost:${PORT}`);
  });
}

export default app;