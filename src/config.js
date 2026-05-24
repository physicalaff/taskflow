export const config = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || './data/tasks.db',
  authToken: process.env.AUTH_TOKEN || null,
  logLevel: process.env.LOG_LEVEL || 'info',
  staticDir: process.env.STATIC_DIR || 'public',
};
