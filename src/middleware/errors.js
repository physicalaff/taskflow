export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'not_found' });
}

export function errorHandler(logger) {
  return (err, _req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, details: err.details });
    }
    logger.error('unhandled', err);
    res.status(500).json({ error: 'internal_error' });
  };
}
