// api/webhook.js (Vercel)
require('dotenv').config();
const axios = require('axios');
const { fetchHistorical } = require('../src/utils/goapi');
const { computeIndicators, formatIndicatorsForPrompt } = require('../src/utils/indicators');
const { analyzeWithGemini } = require('../src/utils/gemini');
const { marked } = require("marked");

// ===== Allowed groups =====
const ALLOWED_GROUPS = process.env.ALLOWED_GROUP_IDS
  ? process.env.ALLOWED_GROUP_IDS.split(",").map(id => id.trim())
  : process.env.ALLOWED_GROUP_ID
    ? [process.env.ALLOWED_GROUP_ID.trim()]
    : [];

function isAllowed(chatId) {
  if (ALLOWED_GROUPS.length === 0) return true;
  return ALLOWED_GROUPS.includes(chatId.toString());
}

// ===== Message splitter =====
function splitMessage(text, maxLength = 4000) {
  const parts = [];
  for (let i = 0; i < text.length; i += maxLength) {
    parts.push(text.substring(i, i + maxLength));
  }
  return parts;
}

async function sendLongMessage(chatId, text, opts = {}) {
  const parts = splitMessage(text);
  for (const part of parts) {
    await sendTelegramMessage(chatId, part, opts);
  }
}

// ===== Markdown → Telegram HTML =====
function markdownToTelegramHTML(md) {
  let html = marked(md);

  html = html
    .replace(/<h[1-6]>/g, "<b>")
    .replace(/<\/h[1-6]>/g, "</b>\n\n")
    .replace(/<strong>/g, "<b>")
    .replace(/<\/strong>/g, "</b>")
    .replace(/<em>/g, "<i>")
    .replace(/<\/em>/g, "</i>")
    .replace(/<p>/g, "")
    .replace(/<\/p>/g, "\n\n")
    .replace(/<ul>/g, "")
    .replace(/<\/ul>/g, "")
    .replace(/<ol>/g, "")
    .replace(/<\/ol>/g, "")
    .replace(/<li>/g, "• ")
    .replace(/<\/li>/g, "\n")
    .replace(/<hr\s*\/?>/g, "────────────\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  return html.trim();
}

// ===== Telegram Sender =====
async function sendTelegramMessage(chatId, text, opts = {}) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
  await axios.post(url, { chat_id: chatId, text, ...opts });
}

// ===== Webhook handler =====
module.exports = async (req, res) => {
  try {
    const update = req.body;

    if (!update?.message?.text) {
      return res.status(200).send("OK");
    }

    const chatId = update.message.chat.id.toString();

    // Restrict groups
    if (!isAllowed(chatId)) {
      await sendTelegramMessage(chatId, "❌ Bot ini hanya bisa digunakan di grup resmi.");
      return res.status(200).send("BLOCKED");
    }

    const text = update.message.text.trim();

    // ===== ANALISA COMMAND =====
    if (/^\/analisa\s+(.+)/i.test(text)) {
      const symbol = text.match(/^\/analisa\s+(.+)/i)[1].trim().toUpperCase();

      await sendTelegramMessage(
        chatId,
        `🔎 Menerima permintaan analisa untuk <b>${symbol}</b>...`,
        { parse_mode: "HTML" }
      );

      const candles = await fetchHistorical(symbol, { limit: DEFAULT_CANDLES });

      if (!candles || candles.length === 0) {
        await sendTelegramMessage(chatId, `❌ Gagal mengambil data untuk ${symbol}.`);
        return res.status(200).send("OK");
      }

      const indicators = computeIndicators(candles);
      const prompt = formatIndicatorsForPrompt(symbol, indicators);

      const aiResponse = await analyzeWithGemini(prompt);
      const cleanHtml = markdownToTelegramHTML(aiResponse);

      const reply = `📊 <b>Analisa ${symbol}</b>\n\n${cleanHtml}`;

      await sendLongMessage(chatId, reply, { parse_mode: "HTML" });
      return res.status(200).send("OK");
    }

    return res.status(200).send("OK");

  } catch (err) {
    console.error("Webhook Error:", err.response?.data || err.message);
    return res.status(500).send("error");
  }
};
