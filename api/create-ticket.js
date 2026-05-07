// ── hoichoi Help Center — Create Ticket ──────────────────────────────────────
// POST /api/create-ticket
// Tries Nugget external ticketing API first. If Nugget is unavailable or
// returns an error, falls back to sending an email via Brevo.
// All credentials are stored as Vercel environment variables.

const NUGGET_URL = 'https://api.nugget.com/unified-support/api/v1/ticketing/external/tickets';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    name, email, phone, category, subcategory,
    device, description, attachment,
  } = req.body || {};

  // Validation
  if (!name || !email || !phone || !category || !subcategory || !description) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  // Build structured description — Nugget renders description as HTML so use <br> for line breaks
  const descLines = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `Category: ${category}`,
    `Sub-category: ${subcategory}`,
    ...(device ? [`Device: ${device}`] : []),
    ``,
    `Description:`,
    description.trim(),
  ];
  const descText = descLines.join('<br>');

  // ── 1. Try Nugget ──────────────────────────────────────────────────────────
  const NUGGET_BASIC_AUTH = process.env.NUGGET_BASIC_AUTH;

  if (NUGGET_BASIC_AUTH) {
    try {
      let nuggetRes;

      if (attachment?.base64 && attachment?.name) {
        // ── Multipart/form-data — required when sending attachment_files[] ──
        const buffer = Buffer.from(attachment.base64, 'base64');
        const blob   = new Blob([buffer], { type: attachment.type || 'application/octet-stream' });

        const fd = new FormData();
        fd.append('source',               'SOURCE_EMAIL');
        fd.append('title',                `[${category}] ${subcategory}`);
        fd.append('description',          descText);
        fd.append('email',                email);
        fd.append('channel',              '3');
        fd.append('created_by_id',        'hoichoi@nugget.com');
        fd.append('created_by_client_id', '1');
        fd.append('priority',             'MEDIUM');
        fd.append('attachment_files[]',   blob, attachment.name);

        nuggetRes = await fetch(NUGGET_URL, {
          method:  'POST',
          headers: { 'Authorization': `Basic ${NUGGET_BASIC_AUTH}` },
          // Do NOT set Content-Type — fetch sets it with the correct multipart boundary
          body:    fd,
          redirect: 'follow',
        });

      } else {
        // ── JSON — no attachment ───────────────────────────────────────────
        const nuggetPayload = {
          source:               'SOURCE_EMAIL',
          title:                `[${category}] ${subcategory}`,
          description:          descText,
          email:                email,
          channel:              3,
          created_by_id:        'hoichoi@nugget.com',
          created_by_client_id: 1,
          priority:             'MEDIUM',
        };

        nuggetRes = await fetch(NUGGET_URL, {
          method:  'POST',
          headers: {
            'Authorization': `Basic ${NUGGET_BASIC_AUTH}`,
            'Content-Type':  'application/json',
          },
          body:    JSON.stringify(nuggetPayload),
          redirect: 'follow',
        });
      }

      const nuggetText = await nuggetRes.text();

      if (nuggetRes.ok) {
        let data = {};
        try { data = JSON.parse(nuggetText); } catch (_) {}
        console.log('Ticket created via Nugget:', data.ticket_id);
        return res.status(200).json({ ok: true, ticket_id: data.ticket_id, via: 'nugget' });
      }

      if (nuggetRes.status >= 400 && nuggetRes.status < 500) {
        // Client-side error (bad input) — surface to the user, don't silently fall through
        let nuggetMsg = '';
        try { nuggetMsg = JSON.parse(nuggetText)?.error?.message || ''; } catch (_) {}
        console.warn('Nugget rejected (4xx):', nuggetRes.status, nuggetText);
        return res.status(400).json({
          error: nuggetMsg || 'Your submission could not be processed. Please check your details and try again.',
        });
      }

      // 5xx / unexpected — log and fall through to Brevo
      console.warn('Nugget server error, falling back to Brevo. Status:', nuggetRes.status, nuggetText);

    } catch (err) {
      // Network/parse error — fall through to Brevo
      console.warn('Nugget request threw, falling back to Brevo:', err.message);
    }
  } else {
    console.warn('NUGGET_BASIC_AUTH not set, skipping Nugget');
  }

  // ── 2. Brevo email fallback ────────────────────────────────────────────────
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    console.error('Both Nugget and Brevo are unavailable');
    return res.status(500).json({ error: 'Ticket service not configured' });
  }

  try {
    const htmlBody = descLines
      .map(l => l === '' ? '<br>' : `<p style="margin:2px 0">${l.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`)
      .join('');

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key':      BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender:  { name: 'hoichoi Help Center', email: 'noreply@hoichoi.tv' },
        to:      [{ email: 'support@hoichoi.tv', name: 'hoichoi Support' }],
        replyTo: { email: email, name: name },
        subject: `[Support Request] [${category}] ${subcategory}`,
        htmlContent: `<div style="font-family:sans-serif;font-size:14px">${htmlBody}</div>`,
      }),
    });

    if (!brevoRes.ok) {
      const brevoErr = await brevoRes.text();
      console.error('Brevo error:', brevoRes.status, brevoErr);
      return res.status(502).json({ error: 'Could not send support request. Please email support@hoichoi.tv directly.' });
    }

    console.log('Ticket sent via Brevo email fallback');
    return res.status(200).json({ ok: true, via: 'email' });

  } catch (err) {
    console.error('Brevo request threw:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};
