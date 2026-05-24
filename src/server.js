import { config } from './config.js';
import { openDatabase } from './db.js';
import { createLogger } from './logger.js';
import { createApp } from './app.js';

const logger = createLogger(config.logLevel);
const db = openDatabase(config.dbPath);
const app = createApp({ db, logger, authToken: config.authToken, staticDir: config.staticDir });

const server = app.listen(config.port, () => {
  logger.info(`TaskFlow listening on http://localhost:${config.port}`);
});

function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
