// api/webhook.js (Vercel - CommonJS Friendly)
const { Telegraf } = require('telegraf');
require("dotenv").config();
const axios = require("axios");
const { fetchHistorical } = require("../src/utils/goapi");
const { computeIndicators, formatIndicatorsForPrompt } = require("../src/utils/indicators");
const { analyzeWithGemini } = require("../src/utils/gemini");
const { analyzeStock } = require("../src/utils/analisys");

const DEFAULT_CANDLES = 50;
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// =========================
// Dynamic import "marked"
// =========================
let marked;
async function loadMarked() {
  if (!marked) {
    marked = (await import("marked")).marked;
  }
  return marked;
}

// =========================
// Allowed Groups
// =========================
const ALLOWED_GROUPS = process.env.ALLOWED_GROUP_IDS
  ? process.env.ALLOWED_GROUP_IDS.split(",").map(id => id.trim())
  : process.env.ALLOWED_GROUP_ID
    ? [process.env.ALLOWED_GROUP_ID.trim()]
    : [];

function isAllowed(chatId) {
  if (ALLOWED_GROUPS.length === 0) return true;
  return ALLOWED_GROUPS.includes(chatId.toString());
}

// =========================
// Split Message Safely
// =========================
function splitMessageSafe(text, maxLength = 3500) {
  const parts = [];
  let buffer = "";

  for (let word of text.split(" ")) {
    if ((buffer + word).length > maxLength) {
      parts.push(buffer);
      buffer = "";
    }
    buffer += word + " ";
  }

  if (buffer.trim()) parts.push(buffer.trim());
  return parts;
}

async function sendLongMessage(chatId, text, opts = {}) {
  const parts = splitMessageSafe(text);
  for (const part of parts) {
    await sendTelegramMessage(chatId, part, opts);
  }
}

// =========================
// Sanitize Telegram HTML
// (Whitelist only <b>, <i>, <code>, <pre>)
// =========================
function sanitizeTelegramHTML(html) {
  // Escape everything first
  let safe = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Restore allowed tags only
  const allow = {
    "&lt;b&gt;": "<b>",
    "&lt;/b&gt;": "</b>",
    "&lt;i&gt;": "<i>",
    "&lt;/i&gt;": "</i>",
    "&lt;code&gt;": "<code>",
    "&lt;/code&gt;": "</code>",
    "&lt;pre&gt;": "<pre>",
    "&lt;/pre&gt;": "</pre>"
  };

  Object.entries(allow).forEach(([from, to]) => {
    safe = safe.replace(new RegExp(from, "g"), to);
  });

  return safe;
}

// =========================
// Markdown → Telegram HTML (Refactor Safety)
// =========================
async function markdownToTelegramHTML(md) {
  const markedFn = await loadMarked();
  let html = markedFn(md);

  // Remove unsupported HTML tags from Gemini
  html = html.replace(/<\/?(div|span|blockquote|a|img|h[1-6]|table|tr|td|th)[^>]*>/g, "");

  // Convert basic Markdown to telegram-friendly HTML
  html = html
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
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Escape unexpected HTML
  return sanitizeTelegramHTML(html);
}

// =========================
// Telegram Sender
// =========================
async function sendTelegramMessage(chatId, text, opts = {}) {
  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
    await axios.post(url, { chat_id: chatId, text, ...opts });
  } catch (err) {
    console.error("SendMessage Error:", err.response?.data || err.message);
  }
}

// =========================
// MAIN WEBHOOK HANDLER
// =========================
module.exports = async (req, res) => {
  try {
    const update = req.body;

    if (!update?.message?.text) {
      return res.status(200).send("OK");
    }

    const chatId = update.message.chat.id.toString();
    const text = update.message.text.trim();

    // Restrict group
    if (!isAllowed(chatId)) {
      await sendTelegramMessage(chatId, "❌ Bot ini hanya untuk grup resmi.");
      return res.status(200).send("OK");
    }

    // Handle /analisa
    const match = text.match(/^\/analisa\s+(.+)/i);

    if (match) {
      const symbol = match[1].trim().toUpperCase();

      await sendTelegramMessage(
        chatId,
        `🔎 Wait sedang menganalisa untuk <b>${symbol}</b>...`,
        { parse_mode: "HTML" }
      );

      // Fetch data
      let candles;
      try {
        candles = await fetchHistorical(symbol, { limit: DEFAULT_CANDLES });
      } catch (err) {
        console.error("GoAPI Error:", err.message);
        await sendTelegramMessage(chatId, "❌ Gagal mengambil data API. Coba lagi nanti.");
        return res.status(200).send("OK");
      }

      if (!candles || candles.length === 0) {
        await sendTelegramMessage(chatId, `❌ Data ${symbol} tidak tersedia.`);
        return res.status(200).send("OK");
      }

      // Compute
      const indicators = computeIndicators(candles);
      const prompt = formatIndicatorsForPrompt(symbol, indicators);

      let aiResponse;
      try {
        aiResponse = await analyzeWithGemini(prompt);
      } catch (err) {
        console.error("Gemini Error:", err.message);
        await sendTelegramMessage(chatId, "❌ Analisa AI gagal. Coba lagi nanti.");
        return res.status(200).send("OK");
      }

      // Convert markdown to safe Telegram HTML
      const content = await markdownToTelegramHTML(aiResponse);
      const reply = `📊 <b>Analisa ${symbol}</b>\n\n${content}`;

      await sendLongMessage(chatId, reply, { parse_mode: "HTML" });

      return res.status(200).send("OK");
    }

    return res.status(200).send("OK");

  } catch (err) {
    console.error("Webhook Fatal:", err.message);
    return res.status(200).send("OK");
  }
};

bot.command("indikator", async (ctx) => {
  const text = ctx.message.text.split(" ");
  const symbol = text[1]?.toUpperCase();

  if (!symbol) {
    return ctx.reply("⚠ Cara pakai:\n/indikator <SYMBOL>\n\nContoh: /indikator BBCA");
  }

  await ctx.reply("⏳ Wait..");

  const result = await analyzeStock(symbol);

  if (result.error) {
    return ctx.reply(`❌ ${result.error}`);
  }

  try {
    await ctx.reply(result.text, { parse_mode: "Markdown" });
  } catch (e) {
    await ctx.reply(result.text.replace(/[*_]/g, ""), { parse_mode: "Markdown" });
  }
});

// Webhook Handler
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Error');
    }
  } else {
    res.status(200).send('Bot Running');
  }
};