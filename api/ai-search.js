// ── hoichoi Help Center — AI Search ──────────────────────────────────────────
// POST /api/ai-search
// Receives query + top matching articles from the frontend, calls GPT-4o Mini,
// returns a concise answer with source indices and token usage for cost tracking.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, lang = 'en', articles = [] } = req.body || {};
  if (!query || query.trim().length < 3) return res.status(400).json({ error: 'Query too short' });
  if (articles.length === 0) return res.status(400).json({ error: 'No articles provided' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'AI not configured' });

  // Strip HTML tags and limit content per article to keep token count low
  const stripHtml = (str) => (str || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const articleContext = articles.slice(0, 5).map((a, i) => {
    const title   = lang === 'bn' ? (a.titleBn || a.title || '') : (a.title || '');
    const content = stripHtml(a.content).slice(0, 800);
    return `[${i}] ${title}\n${content}`;
  }).join('\n\n---\n\n');

  const systemPrompt = lang === 'bn'
    ? `আপনি hoichoi স্ট্রিমিং প্ল্যাটফর্মের একজন সহায়ক। শুধুমাত্র নিচের হেল্প আর্টিকেলগুলির উপর ভিত্তি করে সংক্ষিপ্তভাবে উত্তর দিন (২-৩ বাক্য)। বাংলায় উত্তর দিন। JSON ফরম্যাটে রিটার্ন করুন: {"answer": "উত্তর", "sources": [ব্যবহৃত আর্টিকেলের ইন্ডেক্স তালিকা]}`
    : `You are a helpful assistant for hoichoi, a streaming platform. Answer the user's question concisely (2-3 sentences) based ONLY on the help articles provided. Be direct and friendly. If the answer isn't covered, say so briefly. Return JSON: {"answer": "your answer", "sources": [list of article indices you used]}`;

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: `Question: ${query.trim()}\n\nHelp Articles:\n\n${articleContext}` },
        ],
        max_tokens:        350,
        temperature:       0.3,
        response_format:   { type: 'json_object' },
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      console.error('OpenAI error:', openaiRes.status, err);
      return res.status(502).json({ error: 'AI service unavailable' });
    }

    const openaiData = await openaiRes.json();
    const raw        = openaiData.choices?.[0]?.message?.content || '{}';
    const inputTokens  = openaiData.usage?.prompt_tokens     || 0;
    const outputTokens = openaiData.usage?.completion_tokens || 0;

    // GPT-4o Mini pricing: $0.150/1M input · $0.600/1M output
    const cost = (inputTokens * 0.00000015) + (outputTokens * 0.0000006);

    let parsed = {};
    try { parsed = JSON.parse(raw); } catch (_) { parsed = { answer: raw, sources: [] }; }

    const answer  = parsed.answer  || '';
    const sources = (parsed.sources || []).filter(i => typeof i === 'number' && i < articles.length).map(i => articles[i]?.id).filter(Boolean);

    return res.status(200).json({ answer, sources, inputTokens, outputTokens, cost });

  } catch (err) {
    console.error('ai-search error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
