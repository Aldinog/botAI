// api/webhook.js (Vercel - CommonJS Friendly)
const { Telegraf } = require("telegraf");
require("dotenv").config();
const axios = require("axios");

const { fetchHistorical } = require("../src/utils/goapi");
const { computeIndicators, formatIndicatorsForPrompt } = require("../src/utils/indicators");
const { analyzeWithGemini } = require("../src/utils/gemini");
const { analyzeStock } = require("../src/utils/analisys");
const { isAllowedGroup } = require("../src/utils/groupControl");
const { fetchHarga } = require('../src/utils/harga');

const DEFAULT_CANDLES = 50;
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// =========================
// Dynamic import "marked"
// =========================
let marked;
async function loadMarked() {
  if (!marked) marked = (await import("marked")).marked;
  return marked;
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

async function sendLongMessage(ctx, html) {
  const parts = splitMessageSafe(html);
  for (const part of parts) {
    await ctx.reply(part, { parse_mode: "HTML" });
  }
}

// =========================
// Sanitize Telegram HTML
// =========================
function sanitizeTelegramHTML(html) {
  let safe = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

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

  for (const [from, to] of Object.entries(allow)) {
    safe = safe.replace(new RegExp(from, "g"), to);
  }

  return safe;
}

// =========================
// Markdown → Telegram HTML
// =========================
async function markdownToTelegramHTML(md) {
  const markedFn = await loadMarked();
  let html = markedFn(md);

  html = html.replace(/<\/?(div|span|blockquote|a|img|h[1-6]|table|tr|td|th)[^>]*>/g, "");

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

  return sanitizeTelegramHTML(html);
}

// =========================
// VALIDASI GROUP
// =========================
bot.use((ctx, next) => {
  const chatId = ctx.chat.id;

  if (!isAllowedGroup(chatId)) {
    console.log(`❌ Grup tidak diizinkan: ${chatId}`);
    return ctx.reply("🚫 Grup ini tidak diizinkan menggunakan bot ini.");
  }

  return next();
});

// =========================
// COMMAND BASICS
// =========================
bot.start((ctx) => ctx.reply("🤖 Bot aktif"));
bot.help((ctx) =>
  ctx.reply(
    "📌 List command:\n" +
      " /start\n" +
      " /help\n" +
      " /harga <EMITEN>\n" +
      " /indikator <EMITEN>\n" +
      " /analisa <EMITEN>"
  )
);

// =========================
// COMMAND: INDIKATOR
// =========================
bot.command("indikator", async (ctx) => {
  const symbol = ctx.message.text.split(" ")[1]?.toUpperCase();

  if (!symbol) {
    return ctx.reply("⚠ Cara pakai:\n/indikator <SYMBOL>");
  }

  await ctx.reply("⏳ Wait...");

  const result = await analyzeStock(symbol);

  if (result.error) return ctx.reply(`❌ ${result.error}`);

  try {
    return ctx.reply(result.text, { parse_mode: "Markdown" });
  } catch {
    return ctx.reply(result.text.replace(/[*_]/g, ""));
  }
});

// ============================
// COMMAND: HARGA
// ============================
bot.command("harga", async (ctx) => {
  const symbol = ctx.message.text.split(" ")[1]?.toUpperCase();

  if (!symbol) {
    return ctx.reply("⚠ Format salah.\nGunakan: /harga BBCA");
  }

  try {
    const msg = await fetchHarga(symbol);
    return ctx.reply(msg, { parse_mode: "HTML" });
  } catch (err) {
    console.error(err);
    return ctx.reply(`❌ Gagal mengambil harga ${symbol}.`);
  }
});

// =========================
// COMMAND: BROKSUM
// =========================

bot.command("broksum", async (ctx) => {
  const text = ctx.message.text.split(" ");
  const symbol = text[1]?.toUpperCase();

  if (!symbol) {
    return ctx.reply("⚠ Cara pakai:\n/broksum <SYMBOL>\n\nContoh: /broksum BBCA");
  }

  await ctx.reply("📊 Mengambil data broker summary...");

  const results = await fetchBrokerSummary(symbol);

  if (results.error) {
    return ctx.reply(`❌ ${results.error}`);
  }

  if (results.length === 0) {
    return ctx.reply(`ℹ️ Tidak ada data broker summary untuk ${symbol} hari ini.`);
  }

  // Format broker summary
  let msg = `📈 <b>Broker Summary ${symbol}</b>\n\n`;

  results.forEach((item) => {
    msg += `🏦 <b>${item.broker}</b>\n`;
    msg += `• Buy: <b>${item.net_buy}</b>\n`;
    msg += `• Sell: <b>${item.net_sell}</b>\n`;
    msg += `• Freq: ${item.frequency}\n\n`;
  });

  return ctx.reply(msg.trim(), { parse_mode: "HTML" });
});




// ============================
// COMMAND: ANALISA
// ============================
bot.command("analisa", async (ctx) => {
  const text = ctx.message.text.split(" ");
  const symbol = text[1]?.toUpperCase();

  if (!symbol) {
    return ctx.reply("⚠ Format salah.\nGunakan: /analisa BBCA");
  }

  await ctx.reply(`🔎 Wait sedang menganalisa untuk <b>${symbol}</b>...`, {
    parse_mode: "HTML",
  });

  let candles;
  try {
    candles = await fetchHistorical(symbol, { limit: DEFAULT_CANDLES });
  } catch (err) {
    console.error("GoAPI Error:", err.message);
    return ctx.reply("❌ Gagal mengambil data API.");
  }

  if (!candles || candles.length === 0) {
    return ctx.reply(`❌ Data ${symbol} tidak tersedia.`);
  }

  const indicators = computeIndicators(candles);
  const prompt = formatIndicatorsForPrompt(symbol, indicators);

  let aiResponse;
  try {
    aiResponse = await analyzeWithGemini(prompt);
  } catch (err) {
    console.error("Gemini Error:", err.message);
    return ctx.reply("❌ Analisa AI gagal. Coba lagi nanti.");
  }

  const html = await markdownToTelegramHTML(aiResponse);
  const finalMsg = `📊 <b>Analisa ${symbol}</b>\n\n${html}`;

  await sendLongMessage(ctx, finalMsg);
});

// =========================
// WEBHOOK (Vercel Friendly)
// =========================
module.exports = async (req, res) => {
  if (req.method === "POST") {
    try {
      await bot.handleUpdate(req.body);
      return res.status(200).send("OK");
    } catch (err) {
      console.error("Webhook Error:", err);
      return res.status(500).send("ERR");
    }
  }

  res.status(200).send("Bot Running");
};
