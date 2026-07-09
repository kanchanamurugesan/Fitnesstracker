import jwt from 'jsonwebtoken';

// In production set JWT_SECRET; the dev fallback keeps local runs working.
export const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-in-production';

export function signToken(accountId) {
  return jwt.sign({ sub: accountId }, SECRET, { expiresIn: '30d' });
}

// Requires a valid token. Accepts `Authorization: Bearer <t>` or `?token=<t>`
// (the query form lets <img> tags load protected photos).
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  try {
    req.accountId = jwt.verify(token, SECRET).sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired — please sign in again.' });
  }
}
