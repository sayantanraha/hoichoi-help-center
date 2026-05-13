// ── Help Center API — shared security middleware ──────────────────────────────
// Used by all /api/* handlers. Provides:
//   setCors(req, res)         — origin whitelist, Vary header
//   checkSecret(req, res)     — shared secret validation (X-HC-Secret header)
//   rateLimit(req, res, ...)  — per-IP in-memory token bucket

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://help.hoichoi.tv',
  'https://hoichoi-help-center.vercel.app',
];

function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed =
    ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-HC-Secret');
  res.setHeader('Vary', 'Origin');
}

// ── Shared secret ─────────────────────────────────────────────────────────────
// Set HC_API_SECRET in Vercel env vars. The same value must be set as
// HC_API_SECRET in the Help Center HTML (const HC_API_SECRET = '...').
// If the env var is not set, validation is skipped (safe rollout).
function checkSecret(req, res) {
  const secret = process.env.HC_API_SECRET;
  if (!secret) return true; // env var not configured yet — allow through
  const sent = req.headers['x-hc-secret'];
  if (sent !== secret) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

// ── Per-IP rate limiting (in-memory) ─────────────────────────────────────────
// Works within a warm Lambda instance. Stops casual bots and abuse.
// Default: 30 requests per 5-minute window per IP.
const _ipWindows = new Map();

function rateLimit(req, res, limit = 30, windowMs = 5 * 60 * 1000) {
  const ip =
    ((req.headers['x-forwarded-for'] || '').split(',')[0].trim()) ||
    req.socket?.remoteAddress ||
    'unknown';
  const now = Date.now();
  let entry = _ipWindows.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    _ipWindows.set(ip, entry);
  }
  entry.count++;
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    return false;
  }
  return true;
}

module.exports = { setCors, checkSecret, rateLimit };
