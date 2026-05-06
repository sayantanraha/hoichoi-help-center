// ── hoichoi Help Center — Create Nugget Ticket ───────────────────────────────
// POST /api/create-ticket
// Receives form data from the Help Center ticket modal and creates a ticket
// directly in Nugget via their external ticketing API.
// Auth token is stored as NUGGET_BASIC_AUTH environment variable in Vercel.

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

  const NUGGET_BASIC_AUTH = process.env.NUGGET_BASIC_AUTH;
  if (!NUGGET_BASIC_AUTH) {
    console.error('NUGGET_BASIC_AUTH env var not set');
    return res.status(500).json({ error: 'Ticket service not configured' });
  }

  // Build a structured description
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
    ...(attachment?.name ? [``, `[Attachment included: ${attachment.name}]`] : []),
  ];

  const nuggetPayload = {
    source:               'SOURCE_EMAIL',
    title:                `[${category}] ${subcategory}`,
    description:          descLines.join('\n'),
    requester_id:         email,
    requester_client_id:  1,
    created_by_id:        email,
    created_by_client_id: 1,
    priority:             'MEDIUM',
    channel_handle:       'Support hoichoi',
    userInfo:             { phoneNumber: phone },
  };

  try {
    const response = await fetch(
      'https://api.nugget.com/unifiedsupport/api/v1/ticketing/external/tickets',
      {
        method:  'POST',
        headers: {
          'Authorization': `Basic ${NUGGET_BASIC_AUTH}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(nuggetPayload),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Nugget API error:', response.status, errBody);
      return res.status(502).json({ error: 'Ticket creation failed. Please try again.' });
    }

    const data = await response.json();
    return res.status(200).json({ ok: true, ticket_id: data.ticket_id });

  } catch (err) {
    console.error('create-ticket error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
