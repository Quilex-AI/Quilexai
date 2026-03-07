// ═══════════════════════════════════════════════════════
// QUILEX AI — Bulletproof AI Proxy /api/chat.js
// ✅ Works with ZERO setup (Pollinations fallback)
// ✅ + GROQ_API_KEY = fastest (Llama 70B, free)
// ✅ + OPENROUTER_API_KEY = premium models
// ═══════════════════════════════════════════════════════

const rateLimits = new Map();
function checkRate(ip) {
  const now = Date.now();
  const e = rateLimits.get(ip) || { count: 0, reset: now + 60000 };
  if (now > e.reset) { e.count = 0; e.reset = now + 60000; }
  e.count++;
  rateLimits.set(ip, e);
  return e.count <= 40;
}

async function tryGroq(messages, key) {
  const models = ['llama-3.3-70b-versatile','llama-3.1-8b-instant','llama3-70b-8192','gemma2-9b-it'];
  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model, messages, max_tokens: 2048, temperature: 0.7 }),
      });
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content && content.length > 10) return { content, model: `groq/${model}` };
    } catch (e) { continue; }
  }
  return null;
}

async function tryOpenRouter(messages, key) {
  const models = key
    ? ['anthropic/claude-3-haiku','openai/gpt-4o-mini','meta-llama/llama-3.3-70b-instruct:free']
    : ['meta-llama/llama-3.3-70b-instruct:free','meta-llama/llama-3.1-8b-instruct:free','mistralai/mistral-7b-instruct:free'];
  for (const model of models) {
    try {
      const headers = { 'Content-Type': 'application/json', 'HTTP-Referer': 'https://quilexai.vercel.app', 'X-Title': 'QUILEX AI' };
      if (key) headers['Authorization'] = `Bearer ${key}`;
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers,
        body: JSON.stringify({ model, messages, max_tokens: 2048 }),
      });
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content && content.length > 10) return { content, model };
    } catch (e) { continue; }
  }
  return null;
}

async function tryPollinations(messages) {
  // Pollinations is 100% free, no key, no signup
  const polModels = ['openai', 'openai-large', 'mistral'];
  const lastMsg = messages[messages.length - 1] || {};
  const sysMsg = messages.find(m => m.role === 'system') || { content: 'You are QUILEX AI, a helpful assistant.' };
  
  for (const model of polModels) {
    try {
      const res = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: sysMsg.content.substring(0, 400) },
            { role: 'user', content: (lastMsg.content || '').substring(0, 1200) }
          ],
          private: true,
          seed: Math.floor(Math.random() * 9999)
        }),
      });
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content && content.length > 10) return { content, model: `${model} (Pollinations)` };
    } catch (e) { continue; }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (!checkRate(ip)) return res.status(429).json({ error: 'Too many requests. Wait a minute.' });

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid request' });

    const GROQ_KEY = process.env.GROQ_API_KEY || '';
    const OR_KEY = process.env.OPENROUTER_API_KEY || '';

    // Priority 1: Groq (fastest, free, needs key)
    if (GROQ_KEY) {
      const r = await tryGroq(messages, GROQ_KEY);
      if (r) return res.status(200).json(r);
    }

    // Priority 2: OpenRouter
    const orResult = await tryOpenRouter(messages, OR_KEY);
    if (orResult) return res.status(200).json(orResult);

    // Priority 3: Pollinations (zero key, always free)
    const polResult = await tryPollinations(messages);
    if (polResult) return res.status(200).json(polResult);

    return res.status(200).json({ content: 'AI is temporarily busy. Please try again in a moment.', model: 'fallback' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
}
