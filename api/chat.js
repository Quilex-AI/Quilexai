// ═══════════════════════════════════════════════════════
// QUILEX AI — Secure Server Proxy  /api/chat.js
// API key stored in Vercel env vars — NEVER in frontend
// ═══════════════════════════════════════════════════════

const rateLimits = new Map();
const RATE_LIMIT = 25;
const WINDOW_MS = 60 * 1000;

function checkRate(ip) {
  const now = Date.now();
  const e = rateLimits.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > e.resetAt) { e.count = 0; e.resetAt = now + WINDOW_MS; }
  e.count++;
  rateLimits.set(ip, e);
  return e.count <= RATE_LIMIT;
}

// ── ALL FREE MODELS — tries each until one works ──
const FREE_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-chat:free',
  'google/gemma-3-12b-it:free',
  'microsoft/phi-4:free',
  'qwen/qwen-2.5-coder-32b-instruct:free',
  'deepseek/deepseek-r1:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'liquid/lfm-40b:free',
];

async function tryModel(model, messages, KEY) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://quilexai.vercel.app',
      'X-Title': 'QUILEX AI',
    };
    if (KEY) headers['Authorization'] = `Bearer ${KEY}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      const content = data.choices[0].message.content;
      if (content && content.length > 5) return content;
    }
    return null;
  } catch (e) {
    return null;
  }
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
    const { messages, model } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid request' });

    const KEY = process.env.OPENROUTER_API_KEY || '';

    // Build model list: requested model first, then all others as fallback
    let modelOrder = [...FREE_MODELS];
    if (model && FREE_MODELS.includes(model)) {
      modelOrder = [model, ...FREE_MODELS.filter(m => m !== model)];
    }

    // Try each model until one works
    for (const m of modelOrder) {
      const result = await tryModel(m, messages, KEY);
      if (result) {
        return res.status(200).json({ content: result, model: m });
      }
    }

    return res.status(200).json({ error: 'All models are currently busy. Please try again in a moment.' });

  } catch (err) {
    console.error('QUILEX API Error:', err);
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
}
