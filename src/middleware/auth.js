export function requireAuth(token) {
  if (!token) return (_req, _res, next) => next();
  return (req, res, next) => {
    const header = req.get('authorization') || '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (provided !== token) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  };
}
