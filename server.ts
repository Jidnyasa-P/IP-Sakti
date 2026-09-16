import express from 'express';
import path from 'path';
import 'dotenv/config';
import { apiRouter } from './server/routes.js';

const app = express();
const PORT = 3000;
const isProduction = process.env.NODE_ENV === 'production';
const rootDir = process.cwd();

// Parse incoming JSON requests
app.use(express.json({ limit: '10mb' }));

// Mount all /api routes
app.use('/api', apiRouter);

// Frontend static serving / Vite dev middleware
async function setupServer() {
  if (!isProduction) {
    // Development mode: attach Vite middleware
    try {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: rootDir,
      });
      app.use(vite.middlewares);
      console.log('[Server] Vite dev server middleware attached.');
    } catch (err) {
      console.error('[Server] Failed to initialize Vite dev middleware:', err);
      // Fallback to static if dist exists
      const distPath = path.resolve(rootDir, 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  } else {
    // Production mode: serve built assets from dist/
    const distPath = path.resolve(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log('[Server] Production static server configured for dist/.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] IP-SAKTI Sahayak server running at http://0.0.0.0:${PORT}`);
  });
}

setupServer();
