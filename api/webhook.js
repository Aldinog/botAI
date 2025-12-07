// api/webhook.js (Vercel - CommonJS Friendly)
require("dotenv").config();
const axios = require("axios");
const { fetchHistorical } = require("../src/utils/goapi");
const { computeIndicators, formatIndicatorsForPrompt } = require("../src/utils/indicators");
const { analyzeWithGemini } = require("../src/utils/gemini");

const DEFAULT_CANDLES = 200;

// ===== Dynamic import "marked" (ESM) =====
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

// ===== Split Long Message =====
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

// ===== Markdown → Telegram HTML =====
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

// ===================================================================
//  MAIN WEBHOOK HANDLER — FIXED VERSION (ANTI LOOPING & ANTI SPAM)
// ===================================================================

module.exports = async (req, res) => {

  // ALWAYS return 200 no matter what → prevent Vercel retry loops
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
      return res.status(200).send("OK");
    }

    // =========== Handle /analisa ===========
    const match = text.match(/^\/analisa\s+(.+)/i);

    if (match) {
      const symbol = match[1].trim().toUpperCase();

      // Kirim 1x pesan "Wait"
      await sendTelegramMessage(
        chatId,
        `🔎 Wait sedang menganalisa untuk <b>${symbol}</b>...`,
        { parse_mode: "HTML" }
      );

      // ============ Cegah SPAM: Jika GoAPI error → STOP ============
      let candles;
      try {
        candles = await fetchHistorical(symbol, { limit: DEFAULT_CANDLES });
      } catch (err) {
        console.error("GoAPI Error:", err.message);

        await sendTelegramMessage(
          chatId,
          "❌ Gagal mengambil data dari API (limit harian habis / server error). Silakan coba lagi nanti."
        );

        // PENTING → return 200 agar tidak looping
        return res.status(200).send("OK");
      }

      if (!candles || candles.length === 0) {
        await sendTelegramMessage(chatId, `❌ Data ${symbol} tidak tersedia.`);
        return res.status(200).send("OK");
      }

      // Compute indikator
      const indicators = computeIndicators(candles);
      const prompt = formatIndicatorsForPrompt(symbol, indicators);

      let aiResponse;
      try {
        aiResponse = await analyzeWithGemini(prompt);
      } catch (err) {
        console.error("Gemini Error:", err.message);

        await sendTelegramMessage(
          chatId,
          "❌ Analisa AI gagal diproses. Silakan coba beberapa menit lagi."
        );

        return res.status(200).send("OK");
      }

      // Convert AI Markdown → Telegram HTML
      const cleanHtml = await markdownToTelegramHTML(aiResponse);

      const reply = `📊 <b>Analisa ${symbol}</b>\n\n${cleanHtml}`;

      await sendLongMessage(chatId, reply, { parse_mode: "HTML" });

      return res.status(200).send("OK");
    }

    return res.status(200).send("OK");

  } catch (err) {
    console.error("Webhook Error Fatal:", err.message);
    // return 200 agar Vercel tidak retry
    return res.status(200).send("OK");
  }
};
