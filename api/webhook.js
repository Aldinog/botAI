// api/webhook.js (Vercel - CommonJS Compatible)
require("dotenv").config();
const axios = require("axios");
const { fetchHistorical } = require("../src/utils/goapi");
const { computeIndicators, formatIndicatorsForPrompt } = require("../src/utils/indicators");
const { analyzeWithGemini } = require("../src/utils/gemini");

const DEFAULT_CANDLES = 200;

// Load marked dynamically (karena ESM)
let marked;
async function loadMarked() {
  if (!marked) {
    marked = (await import("marked")).marked;
  }
  return marked;
}

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

// ===== Split message =====
function splitMessage(text, maxLength = 4000) {
  const parts = [];
  for (let i = 0; i < text.length; i += maxLength) {
    parts.push(text.substring(i, i + maxLength));
  }
  return parts;
}

async function sendLongMessage(chatId, text, opts = {}) {
  for (const part of splitMessage(text)) {
    await sendTelegramMessage(chatId, part, opts);
  }
}

// ===== Markdown → HTML Telegram =====
async function markdownToTelegramHTML(md) {
  const markedFn = await loadMarked();
  let html = markedFn(md);

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
  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
    await axios.post(url, { chat_id: chatId, text, ...opts });
  } catch (err) {
    console.error("SendMessage Error:", err.response?.data || err.message);
  }
}

// ===== Webhook Handler (CommonJS for Vercel) =====
module.exports = async (req, res) => {
  try {
    const update = req.body;

    if (!update?.message?.text) {
      return res.status(200).send("OK");
    }

    const chatId = update.message.chat.id.toString();
    const text = update.message.text.trim();

    // Restrict to allowed groups
    if (!isAllowed(chatId)) {
      await sendTelegramMessage(chatId, "❌ Bot ini hanya bisa digunakan di grup resmi.");
      return res.status(200).send("BLOCKED");
    }

    // ===== Command: /analisa SYMBOL =====
    const match = text.match(/^\/analisa\s+(.+)/i);

    if (match) {
      const symbol = match[1].trim().toUpperCase();

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

      const cleanHtml = await markdownToTelegramHTML(aiResponse);

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
