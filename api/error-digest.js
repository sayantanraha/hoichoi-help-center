// ── hoichoi Help Center — Daily Error Digest ─────────────────────────────────
// GET /api/error-digest — triggered daily by Vercel cron (6 AM UTC = 11:30 AM IST)
// Reads clientErrors collection from last 24h, sends email via Brevo if any found.
// Manual trigger: POST with X-HC-Secret header (uses same secret as other API routes).
//
// Required Vercel env vars:
//   BREVO_API_KEY   — already set (used by create-ticket.js)
//   CRON_SECRET     — Vercel auto-injects into cron requests as Authorization: Bearer <secret>
//   ALERT_EMAIL     — (optional) override recipient; defaults to sayantan.raha@hoichoi.tv

const FIRESTORE_URL =
  'https://firestore.googleapis.com/v1/projects/hoichoi-help-center/databases/(default)/documents:runQuery';
// Firebase Web API key — public (same value embedded in index.html)
const FIREBASE_API_KEY = 'AIzaSyDbaSdfHpLbcKFLu0gP6Ftji6PXW1VJ5Jk';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth: Vercel cron sends Authorization: Bearer <CRON_SECRET>
  // Manual POST allowed with X-HC-Secret (same middleware used elsewhere)
  const cronSecret = process.env.CRON_SECRET;
  const hcSecret   = process.env.HC_API_SECRET;
  const authHeader = (req.headers.authorization || '').trim();
  const sentHcSec  = req.headers['x-hc-secret'];

  const isCron   = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isManual = hcSecret   && sentHcSec  === hcSecret;
  const noAuth   = !cronSecret && !hcSecret;

  if (!isCron && !isManual && !noAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── Query Firestore ───────────────────────────────────────────────────────
  const since = Date.now() - 24 * 60 * 60 * 1000;

  let docs;
  try {
    const r = await fetch(`${FIRESTORE_URL}?key=${FIREBASE_API_KEY}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from:  [{ collectionId: 'clientErrors' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'timestamp' },
              op:    'GREATER_THAN_OR_EQUAL',
              value: { integerValue: String(since) },
            },
          },
          orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'DESCENDING' }],
          limit: 200,
        },
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Firestore ${r.status}: ${txt.slice(0, 200)}`);
    }

    const rows = await r.json();
    docs = rows
      .filter(row => row.document)
      .map(row => {
        const f = row.document.fields || {};
        return {
          type:    f.type?.stringValue    || '',
          message: f.message?.stringValue || '',
          source:  f.source?.stringValue  || '',
          status:  Number(f.status?.integerValue || f.status?.doubleValue || 0),
          browser: f.browser?.stringValue || '',
          url:     f.url?.stringValue     || '',
          ts:      Number(f.timestamp?.integerValue || f.timestamp?.doubleValue || 0),
        };
      });
  } catch (err) {
    console.error('[error-digest] Firestore read failed:', err.message);
    return res.status(500).json({ error: err.message });
  }

  if (docs.length === 0) {
    console.log('[error-digest] No errors in last 24h — skipping email');
    return res.status(200).json({ ok: true, count: 0 });
  }

  // ── Group by type + source + status ──────────────────────────────────────
  const groupMap = {};
  docs.forEach(d => {
    const key = `${d.type}|${d.source}|${d.status}`;
    if (!groupMap[key]) groupMap[key] = { ...d, count: 0, firstTs: d.ts };
    groupMap[key].count++;
    if (d.ts < groupMap[key].firstTs) groupMap[key].firstTs = d.ts;
  });
  const groups = Object.values(groupMap).sort((a, b) => b.count - a.count);

  // ── Build email ───────────────────────────────────────────────────────────
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const alertEmail    = process.env.ALERT_EMAIL || 'sayantan.raha@hoichoi.tv';

  if (!BREVO_API_KEY) {
    console.warn('[error-digest] BREVO_API_KEY not set — digest not sent');
    return res.status(200).json({ ok: true, count: docs.length, groups: groups.length, sent: false });
  }

  const typeLabel = t =>
    t === 'api_error'          ? '🔴 API Error'
    : t === 'js_error'         ? '🟡 JS Error'
    : t === 'promise_rejection' ? '🟠 Promise Rejection'
    : `⚪ ${t}`;

  const tableRows = groups.map(g => {
    const time = new Date(g.firstTs).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    return `
      <tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;white-space:nowrap">${typeLabel(g.type)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:12px;color:#c0392b">${g.source || '—'}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-family:monospace">${g.status || '—'}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.message.slice(0, 90)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:700;color:${g.count >= 10 ? '#c0392b' : '#555'}">${g.count}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#999;white-space:nowrap">${time}</td>
      </tr>`;
  }).join('');

  const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;max-width:720px;margin:0 auto;color:#222">
  <div style="background:#d20820;color:#fff;padding:18px 22px;border-radius:8px 8px 0 0">
    <h2 style="margin:0;font-size:17px;font-weight:700">⚠️ hoichoi Help Center — Error Digest</h2>
    <p style="margin:5px 0 0;opacity:0.85;font-size:12px">
      Last 24 hours &nbsp;·&nbsp; <strong>${docs.length}</strong> error${docs.length !== 1 ? 's' : ''}
      &nbsp;·&nbsp; <strong>${groups.length}</strong> unique issue${groups.length !== 1 ? 's' : ''}
    </p>
  </div>
  <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee;border-top:none;border-radius:0 0 6px 6px">
    <thead>
      <tr style="background:#fafafa;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.04em">
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #eee">Type</th>
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #eee">Endpoint / Source</th>
        <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #eee">Status</th>
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #eee">Message</th>
        <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #eee">Count</th>
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #eee">First seen</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <p style="font-size:12px;color:#aaa;margin:14px 0 0;padding:0 4px">
    Daily digest · runs at 06:00 UTC · check Firestore <code>clientErrors</code> collection for full details.
  </p>
</div>`;

  try {
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender:      { name: 'hoichoi Help Center Monitor', email: 'noreply@hoichoi.tv' },
        to:          [{ email: alertEmail }],
        subject:     `[Help Center Alert] ${docs.length} error${docs.length !== 1 ? 's' : ''} in last 24h`,
        htmlContent: htmlBody,
      }),
    });

    if (!brevoRes.ok) {
      const txt = await brevoRes.text();
      console.error('[error-digest] Brevo send failed:', brevoRes.status, txt.slice(0, 200));
      return res.status(502).json({ error: 'Email send failed', count: docs.length });
    }

    console.log(`[error-digest] Sent to ${alertEmail}: ${docs.length} errors, ${groups.length} groups`);
    return res.status(200).json({ ok: true, count: docs.length, groups: groups.length, sentTo: alertEmail });

  } catch (err) {
    console.error('[error-digest] Brevo threw:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
