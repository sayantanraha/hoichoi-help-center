// POST /api/translate
// Translates text via Langbly (Google Translate v2 compatible)
// Body: { text: string, target: string }
// Returns: { translated: string }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, target = 'bn' } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Translation service not configured' });

  try {
    const response = await fetch('https://api.langbly.com/language/translate/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: text, target, format: 'text' }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Langbly error:', response.status, err);
      return res.status(502).json({ error: 'Translation failed' });
    }

    const data = await response.json();
    const translated = data.data?.translations?.[0]?.translatedText;
    if (!translated) return res.status(502).json({ error: 'No translation returned' });

    return res.status(200).json({ translated });
  } catch (err) {
    console.error('translate error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
