import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createTaskRouter } from './routes/tasks.js';
import { createTagRouter } from './routes/tags.js';
import { createPortabilityRouter } from './routes/portability.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp({ db, logger, authToken, staticDir = 'public' }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.use((req, _res, next) => {
    logger.debug(req.method, req.url);
    next();
  });

  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  const api = express.Router();
  api.use(requireAuth(authToken));
  api.use('/tasks', createTaskRouter(db));
  api.use('/tags', createTagRouter(db));
  api.use('/', createPortabilityRouter(db));
  app.use('/api', api);

  const staticPath = join(__dirname, '..', staticDir);
  app.use(express.static(staticPath));

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
