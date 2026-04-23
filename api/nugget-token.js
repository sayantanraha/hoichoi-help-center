// GET /api/nugget-token?uid=<session-uid>
// Server-side proxy — calls Nugget S2S API with Basic Auth credentials.
// Never exposes credentials to the frontend.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const uid = req.query.uid;
  if (!uid) return res.status(400).json({ error: 'Missing uid' });

  const BASIC_AUTH  = process.env.NUGGET_BASIC_AUTH;
  const CLIENT_ID   = parseInt(process.env.NUGGET_CLIENT_ID, 10);

  if (!BASIC_AUTH || !CLIENT_ID) {
    return res.status(500).json({ error: 'Nugget not configured' });
  }

  try {
    const response = await fetch(
      'https://api.nugget.com/unified-support/auth/users/getAccessToken',
      {
        method: 'POST',
        headers: {
          'Authorization': BASIC_AUTH,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid,
          clientId: CLIENT_ID,
          platform: 'desktop',
          displayName: 'Guest',
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Nugget token error:', response.status, err);
      return res.status(502).json({ error: 'Token request failed' });
    }

    const data = await response.json();
    if (!data.accessToken) {
      return res.status(502).json({ error: 'No token in response' });
    }

    return res.status(200).json({ accessToken: data.accessToken });
  } catch (err) {
    console.error('nugget-token error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
