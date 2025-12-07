// api/src/utils/deepseek.js
const OpenAI = require('openai').default;

const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const apiKey = process.env.DEEPSEEK_API_KEY;
const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

if (!apiKey) {
  console.warn('DEEPSEEK_API_KEY not set. Set in .env to use DeepSeek.');
}

const client = new OpenAI({
  apiKey,
  baseURL
});

/**
 * prompt: string (system/user prompt already prepared)
 * returns: string (AI response)
 */
async function analyzeWithDeepseek(prompt) {
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY missing');

  // We send a system message that instructs the assistant as technical analyst
  const messages = [
    {
      role: 'system',
      content: 'You are a professional Indonesian technical stock analyst. Use technical indicators and provide actionable recommendations. Use Indonesian language.'
    },
    {
      role: 'user',
      content: prompt
    }
  ];

  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      // max_tokens: 1000, // optional
      // temperature: 0.0
    });

    // Adapt different response shapes
    const text = completion?.choices?.[0]?.message?.content;
    if (text) return text;

    // fallback
    if (completion?.output) {
      if (typeof completion.output === 'string') return completion.output;
      if (completion.output?.[0]?.content?.[0]?.text) return completion.output[0].content[0].text;
    }

    return JSON.stringify(completion).slice(0, 4000);
  } catch (err) {
    console.error('Deepseek error:', err?.response?.data || err.message);
    throw new Error('Gagal memanggil DeepSeek API: ' + (err?.response?.data?.message || err.message));
  }
}

module.exports = { analyzeWithDeepseek };
