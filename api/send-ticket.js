// ── hoichoi Help Center — Send Ticket ────────────────────────────────────────
// POST /api/send-ticket
// Receives form data + optional base64 attachment
// Sends a formatted email via Brevo to support@hoichoi.tv
// Reply-To is set to the user's email so agents can reply directly

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    name, email, phone, category, subcategory,
    device, description, attachment,
  } = req.body || {};

  // Basic validation
  if (!name || !email || !phone || !category || !subcategory || !description) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    console.error('BREVO_API_KEY not set');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const timestamp = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // ── HTML Email Template ───────────────────────────────────────────────────
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F0F3FA;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F3FA;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#d20820,#6d0550);border-radius:14px 14px 0 0;padding:24px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:8px;width:32px;height:32px;text-align:center;line-height:32px;font-weight:800;font-size:14px;color:#fff;margin-bottom:10px;">h</div>
                <p style="margin:0;color:rgba(255,255,255,0.75);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;">hoichoi Help Center</p>
                <h1 style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:800;">New Support Ticket</h1>
              </td>
              <td align="right" valign="top">
                <p style="margin:0;color:rgba(255,255,255,0.7);font-size:12px;">${timestamp} IST</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;border-left:1px solid #E4E8F0;border-right:1px solid #E4E8F0;padding:28px;">

          <!-- User details -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E4E8F0;border-radius:10px;overflow:hidden;margin-bottom:20px;">
            <tr style="background:#F8FAFC;"><td colspan="2" style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94A3B8;">User Details</td></tr>
            ${[
              ['Name',        name],
              ['Email',       `<a href="mailto:${email}" style="color:#d20820;text-decoration:none;">${email}</a>`],
              ['Phone',       phone],
            ].map(([label, value], i, arr) => `
            <tr style="border-top:1px solid #E4E8F0;">
              <td style="padding:11px 16px;font-size:13px;font-weight:600;color:#475569;width:140px;">${label}</td>
              <td style="padding:11px 16px;font-size:13px;color:#0F172A;">${value}</td>
            </tr>`).join('')}
          </table>

          <!-- Issue details -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E4E8F0;border-radius:10px;overflow:hidden;margin-bottom:20px;">
            <tr style="background:#F8FAFC;"><td colspan="2" style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94A3B8;">Issue Details</td></tr>
            ${[
              ['Category',    `<span style="background:#EFF6FF;color:#2563EB;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;">${category}</span>`],
              ['Sub-category',subcategory],
              ...(device ? [['Device', `<span style="background:#F0FDF4;color:#16A34A;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;">${device}</span>`]] : []),
            ].map(([label, value]) => `
            <tr style="border-top:1px solid #E4E8F0;">
              <td style="padding:11px 16px;font-size:13px;font-weight:600;color:#475569;width:140px;">${label}</td>
              <td style="padding:11px 16px;font-size:13px;color:#0F172A;">${value}</td>
            </tr>`).join('')}
          </table>

          <!-- Description -->
          <div style="background:#F8FAFC;border:1px solid #E4E8F0;border-radius:10px;padding:16px;margin-bottom:20px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94A3B8;">Issue Description</p>
            <p style="margin:0;font-size:14px;color:#0F172A;line-height:1.7;white-space:pre-wrap;">${description.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
          </div>

          ${attachment ? `
          <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:14px;margin-bottom:20px;">
            <p style="margin:0;font-size:13px;color:#92400E;font-weight:600;">📎 Attachment included: ${attachment.name}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#B45309;">See attached file in this email.</p>
          </div>` : ''}

          <!-- Reply CTA -->
          <div style="background:linear-gradient(135deg,rgba(210,8,32,0.05),rgba(109,5,80,0.05));border:1px solid rgba(210,8,32,0.15);border-radius:10px;padding:16px;text-align:center;">
            <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0F172A;">Reply directly to this email to respond to the customer</p>
            <p style="margin:0;font-size:12px;color:#475569;">Reply-To is set to <strong>${email}</strong></p>
          </div>

        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F8FAFC;border:1px solid #E4E8F0;border-top:none;border-radius:0 0 14px 14px;padding:16px 28px;">
          <p style="margin:0;font-size:11px;color:#94A3B8;text-align:center;">
            Submitted via hoichoi Help Center &nbsp;•&nbsp; ${timestamp} IST &nbsp;•&nbsp;
            <a href="mailto:support@hoichoi.tv" style="color:#d20820;text-decoration:none;">support@hoichoi.tv</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // ── Brevo API payload ─────────────────────────────────────────────────────
  const brevoPayload = {
    sender:  { name: 'hoichoi Help Center', email: 'hoichoiqa@gmail.com' },
    to:      [{ email: 'support@hoichoi.tv', name: 'hoichoi Support' }],
    replyTo: { email, name },
    subject: `[Help Center] ${category} — ${subcategory}`,
    htmlContent: html,
  };

  // Attach file if present (Brevo accepts base64 content)
  if (attachment?.base64 && attachment?.name) {
    brevoPayload.attachment = [{ content: attachment.base64, name: attachment.name }];
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method:  'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify(brevoPayload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Brevo error:', response.status, errBody);
      return res.status(502).json({ error: 'Email delivery failed. Please try again.' });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('send-ticket error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
