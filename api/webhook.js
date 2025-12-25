// api/webhook.js (Vercel - CommonJS Friendly)
const { Telegraf } = require("telegraf");
require("dotenv").config();


const { fetchHistorical } = require("../src/utils/yahoofinance");
const { fetchBrokerSummaryWithFallback } = require("../src/utils/yahoofinance");
const { analyzeProxyBrokerActivity } = require("../src/utils/yahoofinance");
const { formatProxyBrokerActivity } = require("../src/utils/yahoofinance");
const { fetchFundamentals, formatFundamentals } = require("../src/utils/yahoofinance");
const { computeIndicators, formatIndicatorsForPrompt } = require("../src/utils/indicators");
const { analyzeWithAI } = require("../src/utils/ai");
const { analyzeStock } = require("../src/utils/analisys");
const { isAllowedGroup } = require("../src/utils/groupControl");
const { fetchHarga } = require('../src/utils/harga');
const { generateReview } = require('../src/utils/review');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
if (!TELEGRAM_TOKEN) {
  console.error("CRITICAL: TELEGRAM_TOKEN is missing in environment variables!");
}
const bot = new Telegraf(TELEGRAM_TOKEN || "dummy_token");

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
function splitMessageSafe(text, maxLength = 4000) {
  const parts = [];
  let currentPart = "";
  const openTags = [];

  // Helper to close tags in reverse order
  const closeTags = (tags) => tags.slice().reverse().map(t => `</${t}>`).join("");
  // Helper to re-open tags
  const reopenTags = (tags) => tags.map(t => `<${t}>`).join("");

  // Split by words to avoid breaking words, but we need character-level control for tags if needed.
  // Using a regex to find tags and words.
  // This is a simplified parser. For strict Telegram HTML, we care about <b>, <i>, <code>, <pre>.
  // We'll iterate by tokens (tags or text).

  const regex = /(<\/?(?:b|i|code|pre)>)|([^<]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const token = match[0];
    const isTag = !!match[1];

    // Calculate potential length if we add this token
    // We must also account for the closing tags we might need to add if we split here
    const closingOverhead = closeTags(openTags).length;

    if (currentPart.length + token.length + closingOverhead > maxLength) {
      // Must split now
      parts.push(currentPart + closeTags(openTags));
      currentPart = reopenTags(openTags);
    }

    currentPart += token;

    if (isTag) {
      if (token.startsWith("</")) {
        // Closing tag - remove from stack
        const tagName = token.replace(/<\/?|>/g, "");
        // Only pop if it matches the last opened (simple validation)
        if (openTags.length > 0 && openTags[openTags.length - 1] === tagName) {
          openTags.pop();
        }
      } else {
        // Opening tag - add to stack
        const tagName = token.replace(/<|>/g, "");
        openTags.push(tagName);
      }
    }
  }

  if (currentPart.trim()) {
    parts.push(currentPart + closeTags(openTags));
  }

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
bot.use(async (ctx, next) => {
  const chatId = ctx.chat?.id;
  const chatUser = ctx.chat?.username;
  if (!chatId) return next();

  if (!isAllowedGroup(chatId)) {
    console.log(`❌User pakai Bot ${chatId} (${chatUser})`);
    // Hanya balas jika itu adalah pesan teks/perintah dari user
    // Jangan balas update membership (misal bot dikick) karena akan 403
    if (ctx.message) {
      try {
        await ctx.reply("Halo,,,Silahkan buka App AstonAI untuk menggunakan bot ini.");
      } catch (err) {
        console.error("Gagal mengirim pesan penolakan group:", err.message);
      }
    }
    return; // Berhenti di sini, jangan lanjut ke next()
  }

  return next();
});

// =========================
// COMMAND BASICS
// =========================
bot.start((ctx) => {
  const user = ctx.from?.username || ctx.from?.first_name || "Unknown";
  console.log(`${user} menggunakan start`);
  return ctx.reply("🤖 Bot aktif");
});

bot.command("cekchatid", (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  return ctx.reply(`🆔 <b>Chat Info</b>\n\n• Chat ID: <code>${chatId}</code>\n• User ID: <code>${userId}</code>`, { parse_mode: "HTML" });
});
const MINI_APP_URL = "https://t.me/astonaicbot/astonmology";

const bot_reply_redirect = async (ctx) => {
  return ctx.reply("🤖 <b>Silakan gunakan App Astonmology untuk fitur ini.</b>", {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🚀 Buka App", url: MINI_APP_URL }]
      ]
    }
  });
};

bot.help((ctx) => {
  const user = ctx.from?.username || ctx.from?.first_name || "Unknown";
  console.log(`${user} menggunakan help`);
  return ctx.reply(
    "📌 <b>List Command Bot Saham</b>\n\n" +
    "🔹 <b>Semua Fitur Pindah Ke App!</b>\n" +
    "   Sekarang Anda bisa melakukan Analisa, Cek Harga, Signal, dan Review Setup " +
    "lebih mudah melalui Mini App kami.\n\n" +
    "🚀 <b>Buka App untuk fitu lengkap:</b>\n" +
    "• /harga, /indikator, /analisa\n" +
    "• /proxy, /signal, /review\n" +
    "• /fundamental\n\n" +
    "Mulai sekarang dengan klik tombol di bawah!",
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Buka App", url: MINI_APP_URL }]
        ]
      }
    }
  );
});

// =========================
// COMMAND: REDIRECTS
// =========================
bot.command(["indikator", "harga", "broksum", "proxy", "review", "signal", "analisa", "fundamental", "profile"], bot_reply_redirect);

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
      // Selalu kembalikan 200 OK agar Vercel/Telegram tidak melakukan retry 
      // untuk error yang bersifat permanen (misal 403 Forbidden)
      return res.status(200).send("OK_WITH_ERROR");
    }
  }

  res.status(200).send("Bot Running");
};
