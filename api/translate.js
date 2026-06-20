// POST /api/translate
// Translates article content to Bengali via GPT-4o Mini
// Body: { text: string, target: string }
// Returns: { translated: string }

const { setCors, checkSecret, rateLimit } = require('./_shared');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkSecret(req, res)) return;
  if (!rateLimit(req, res, 60, 5 * 60 * 1000)) return; // 60 req / 5 min per IP

  const { text, target = 'bn' } = req.body || {};
  if (!text)                         return res.status(400).json({ error: 'Missing text' });
  if (String(text).length > 4000)    return res.status(400).json({ error: 'Text too long' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Translation service not configured' });

  const langName = target === 'bn' ? 'Bengali' : target;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following help center article content to ${langName}.
Rules:
- Preserve all formatting markers exactly: **, 1., -, ---, ![alt](url), [!info], [!warning], [!tip]
- Keep brand names, app names, and technical terms in English (e.g. hoichoi, Smart TV, bKash, UPI, OTP, Google, Apple)
- Keep URLs unchanged
- Return ONLY the translated text, nothing else`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI translate error:', response.status, err);
      return res.status(502).json({ error: 'Translation failed' });
    }

    const data = await response.json();
    const translated = data.choices?.[0]?.message?.content?.trim();
    if (!translated) return res.status(502).json({ error: 'No translation returned' });

    return res.status(200).json({ translated });
  } catch (err) {
    console.error('translate error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
