// ── hoichoi Help Center — AI Search ──────────────────────────────────────────
// POST /api/ai-search
// Receives query + top matching articles from the frontend, calls GPT-4o Mini,
// returns a structured step-by-step answer with source indices.

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

  // Use top 3 articles, 500 chars each — enough context, fewer tokens = faster
  const articleContext = articles.slice(0, 3).map((a, i) => {
    const title   = lang === 'bn' ? (a.titleBn || a.title || '') : (a.title || '');
    const content = stripHtml(a.content).slice(0, 500);
    return `[${i}] ${title}\n${content}`;
  }).join('\n\n---\n\n');

  const systemPrompt = lang === 'bn'
    ? `আপনি hoichoi স্ট্রিমিং প্ল্যাটফর্মের সাপোর্ট অ্যাসিস্ট্যান্ট। শুধুমাত্র নিচের হেল্প আর্টিকেলের ভিত্তিতে উত্তর দিন।\n\nফরম্যাট নির্দেশিকা:\n- যদি ধাপে ধাপে করতে হয়: এক লাইনের ভূমিকা, তারপর ১. ২. ৩. নম্বরযুক্ত ধাপ\n- যদি তালিকা হয়: • বুলেট পয়েন্ট ব্যবহার করুন\n- প্রতিটি ধাপ সংক্ষিপ্ত রাখুন (১-২ লাইন)\n- লম্বা প্যারাগ্রাফ লিখবেন না\n- সর্বোচ্চ ৫টি ধাপ বা বুলেট\nJSON ফরম্যাটে রিটার্ন করুন: {"answer": "উত্তর", "sources": [ব্যবহৃত আর্টিকেলের ইন্ডেক্স তালিকা]}`
    : `You are a support assistant for hoichoi, a Bengali streaming platform. Answer based ONLY on the help articles provided.

Format rules:
- If the answer involves steps: write a short 1-line intro, then numbered steps (1. 2. 3.)
- If listing items or options: use bullet points starting with •
- Keep each step/point to 1-2 lines — scannable, not wordy
- Never write a single long paragraph
- Max 5 steps or bullets
- Be direct and friendly

Return JSON: {"answer": "your formatted answer", "sources": [list of article indices you used]}`;

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:           'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: `Question: ${query.trim()}\n\nHelp Articles:\n\n${articleContext}` },
        ],
        max_tokens:      500,
        temperature:     0.25,
        response_format: { type: 'json_object' },
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
