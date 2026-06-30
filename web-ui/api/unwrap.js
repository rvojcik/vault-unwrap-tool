const { validateToken, unwrap } = require('../lib/vault');

// Best-effort, per-instance rate limiter. Serverless instances are ephemeral
// and there can be many of them, so this is only a basic speed bump against a
// single warm instance being hammered. For real protection enable Vercel's
// platform rate limiting / WAF (see README).
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;
const hits = new Map();

function rateLimited(key) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(key, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  if (rateLimited(clientIp(req))) {
    res.status(429).json({ success: false, error: 'Too many requests, slow down' });
    return;
  }

  const token = req.body && req.body.token;
  const check = validateToken(token);
  if (!check.ok) {
    res.status(400).json({ success: false, error: check.error });
    return;
  }

  const result = await unwrap(token);
  res.status(result.success ? 200 : 400).json(result);
};
