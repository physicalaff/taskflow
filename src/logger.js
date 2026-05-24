const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(level = 'info') {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const log = (lvl, ...args) => {
    if (LEVELS[lvl] < threshold) return;
    const ts = new Date().toISOString();
    const stream = lvl === 'error' ? console.error : console.log;
    stream(`${ts} [${lvl.toUpperCase()}]`, ...args);
  };
  return {
    debug: (...a) => log('debug', ...a),
    info:  (...a) => log('info', ...a),
    warn:  (...a) => log('warn', ...a),
    error: (...a) => log('error', ...a),
  };
}
