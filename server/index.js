import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import apiRouter from './routes/api.js';
import { sseHandler, getClientCount } from './routes/sse.js';
import { startBackgroundWorker } from './services/cronWorker.js';
import { loadStateFromDisk, persistStateToDisk } from './services/realtimeState.js';
import { startTelegramCommandPoller, stopTelegramCommandPoller } from './services/telegramBot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Keep-Alive / Health Endpoint for Render Free-Tier and Uptime Monitors
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'HEALTHY',
    service: 'Aureus Pro Institutional Gold Terminal',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    sseClients: getClientCount(),
    memory: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`
    }
  });
});

// Server-Sent Events real-time stream
app.get('/api/stream', sseHandler);

// REST API Endpoints
app.use('/api', apiRouter);

// Serve Static Frontend in Production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// SPA fallback for HTML5 History routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/healthz') {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Aureus Pro Starting...</title><meta http-equiv="refresh" content="3"></head>
          <body style="background:#07080b; color:#fbbf24; font-family:sans-serif; text-align:center; padding:100px;">
            <h2>Aureus Pro Terminal Initializing...</h2>
            <p style="color:#94a3b8;">Frontend is compiling or building. Refreshing shortly.</p>
          </body>
        </html>
      `);
    }
  });
});

const server = app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`  AUREUS PRO - INSTITUTIONAL XAU/USD ENGINE ONLINE     `);
  console.log(`  Port: http://localhost:${config.port}                `);
  console.log(`  Environment: ${config.nodeEnv}                       `);
  console.log(`  Keep-Alive Heartbeat: /healthz                       `);
  if (!config.fredApiKey) {
    console.log(`  WARNING: FRED_API_KEY is not set. Real yields will use `);
    console.log(`  the CSV fallback tier. Add it in .env and re-deploy.  `);
  } else {
    console.log(`  FRED API tier: ENABLED (real yields DGS10 - T10YIE)   `);
  }
  console.log(`=======================================================`);

  // Restore series + siren state across restarts (crash-safe: never throws).
  loadStateFromDisk();

  // Start background worker for cron tasks & live broadcasting
  startBackgroundWorker();

  // Telegram interactive command poller (getUpdates) — enabled only when a
  // token + chatId are configured in Settings.
  startTelegramCommandPoller();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Shutting down Aureus Pro...');
  stopTelegramCommandPoller();
  persistStateToDisk();
  server.close(() => {
    console.log('Http server closed.');
    process.exit(0);
  });
});
