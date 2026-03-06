// ═══════════════════════════════════════════════════════
// QUILEX AI — Secure Server Proxy  /api/chat.js
// Uses GROQ (FREE) + OpenRouter fallback
// Vercel Env Vars needed:
//   GROQ_API_KEY = gsk_...your groq key
//   OPENROUTER_API_KEY = sk-or-v1-...optional
// ═══════════════════════════════════════════════════════

const rateLimits = new Map();
const RATE_LIMIT = 30;
const WINDOW_MS = 60 * 1000;

function checkRate(ip) {
  const now = Date.now();
  const e = rateLimits.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > e.resetAt) { e.count = 0; e.resetAt = now + WINDOW_MS; }
  e.count++;
  rateLimits.set(ip, e);
  return e.count <= RATE_LIMIT;
}

// GROQ FREE MODELS — fastest AI, truly free
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];

// OPENROUTER FREE MODELS — fallback
const OR_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'deepseek/deepseek-chat:free',
];

async function tryGroq(model, messages, key) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 2000, temperature: 0.7 }),
    });
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return content && content.length > 5 ? content : null;
  } catch (e) { return null; }
}

async function tryOpenRouter(model, messages, key) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://quilexai.vercel.app',
      'X-Title': 'QUILEX AI',
    };
    if (key) headers['Authorization'] = `Bearer ${key}`;
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers,
      body: JSON.stringify({ model, messages, max_tokens: 2000 }),
    });
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return content && content.length > 5 ? content : null;
  } catch (e) { return null; }
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

    // STEP 1: Try Groq (fastest + truly free)
    if (GROQ_KEY) {
      for (const model of GROQ_MODELS) {
        const result = await tryGroq(model, messages, GROQ_KEY);
        if (result) return res.status(200).json({ content: result, model: `groq/${model}` });
      }
    }

    // STEP 2: Fallback to OpenRouter
    if (OR_KEY) {
      for (const model of OR_MODELS) {
        const result = await tryOpenRouter(model, messages, OR_KEY);
        if (result) return res.status(200).json({ content: result, model });
      }
    }

    return res.status(200).json({ error: 'All models are currently busy. Please try again in a moment.' });

  } catch (err) {
    console.error('QUILEX API Error:', err);
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
}
