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
bot.help((ctx) => {
  const user = ctx.from?.username || ctx.from?.first_name || "Unknown";
  console.log(`${user} menggunakan help`);
  return ctx.reply(
    "📌 <b>List Command Bot Saham</b>\n\n" +
    "🔹 <b>/start</b>\n" +
    "   Mengaktifkan bot dan memastikan bot responsif.\n\n" +

    "🔹 <b>/help</b>\n" +
    "   Menampilkan daftar perintah dan fungsinya.\n\n" +

    "🔹 <b>/harga &lt;EMITEN&gt;</b>\n" +
    "   Melihat harga terbaru suatu saham.\n" +
    "   Contoh: <code>/harga BBCA</code>\n\n" +

    "🔹 <b>/indikator &lt;EMITEN&gt;</b>\n" +
    "   Menampilkan indikator teknikal (MA, RSI, dll).\n" +
    "   Contoh: <code>/indikator BBRI</code>\n\n" +

    "🔹 <b>/analisa &lt;EMITEN&gt;</b>\n" +
    "   Analisa otomatis berbasis AI menggunakan data OHLC.\n" +
    "   Contoh: <code>/analisa TLKM</code>\n\n" +

    "🔹 <b>/proxy &lt;EMITEN&gt;</b>\n" +
    "   Proxy broker activity → deteksi akumulasi/distribusi dari volume & price action.\n" +
    "   Contoh: <code>/proxy ASII</code>\n\n" +

    "🔹 <b>/signal &lt;EMITEN&gt;</b>\n" +
    "   Dapatkan signal trading lengkap (Entry, SL, TP) berbasis AI.\n" +
    "   Contoh: <code>/signal BBCA</code>\n\n" +

    "🔹 <b>/review &lt;BUY/SELL&gt; &lt;SYMBOL&gt; &lt;ENTRY&gt; [SL]</b>\n" +
    "   Review kualitas setup trading kamu.\n" +
    "   Contoh: <code>/review BUY BBCA 1260</code> atau <code>/review BUY BBCA entry=1260 sl=1200</code>\n\n" +

    "🔹 <b>/fundamental &lt;EMITEN&gt;</b>\n" +
    "   Dapatkan fundamental suatu saham\n" +
    "   Contoh: <code>/fundamental BBCA</code>\n\n" +

    "📈 Gunakan command di atas untuk membantumu analisa saham dengan cepat." +
    "Nantikan update menarik selanjutnya!!",
    { parse_mode: "HTML" }
  );
});


// =========================
// COMMAND: INDIKATOR
// =========================
bot.command("indikator", async (ctx) => {
  const user = ctx.from?.username || ctx.from?.first_name || "Unknown";
  console.log(`${user} menggunakan indikator`);
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
  const user = ctx.from?.username || ctx.from?.first_name || "Unknown";
  console.log(`${user} menggunakan harga`);
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
  const user = ctx.from?.username || ctx.from?.first_name || "Unknown";
  console.log(`${user} menggunakan broksum`);
  const input = ctx.message.text.split(" ");
  const symbol = input[1]?.toUpperCase();

  if (!symbol) {
    return ctx.reply(
      "⚠ Format salah.\nGunakan: `/broksum BBCA`",
      { parse_mode: "Markdown" }
    );
  }

  await ctx.reply("❌ fitur sudah ada tetapi tidak bisa digunakan (data tidak tersedia/BERBAYAR)");

  const result = await fetchBrokerSummaryWithFallback(symbol);

  if (!result.success) {
    return ctx.reply(`❌ ${result.message}`);
  }

  // Format output broksum
  const rows = result.data
    .map(
      (x, i) =>
        `${i + 1}. Broker: *${x.broker_code}*\n   Buy: ${x.buy_value}\n   Sell: ${x.sell_value}`
    )
    .join("\n\n");

  ctx.reply(
    `📊 *Broker Summary ${symbol}*\nTanggal: *${result.date}*\n\n${rows}`,
    { parse_mode: "Markdown" }
  );
});

// ============================
// COMMAND: proxy
// ============================

bot.command("proxy", async (ctx) => {
  const user = ctx.from?.username || ctx.from?.first_name || "Unknown";
  console.log(`${user} menggunakan proxy`);
  const text = ctx.message.text.split(" ");
  const symbol = text[1]?.toUpperCase();

  if (!symbol) {
    return ctx.reply("⚠ Cara pakai:\n /proxy BBCA");
  }

  ctx.reply(`⏳ Mengambil data ${symbol}...`);

  try {
    const candles = await fetchHistorical(symbol, { limit: 120 });
    console.log(`[Proxy] Fetched ${candles.length} candles for ${symbol}`);

    const activity = analyzeProxyBrokerActivity(candles);
    console.log(`[Proxy] Analysis result length: ${activity.length}`);

    const msg = formatProxyBrokerActivity(symbol, activity);
    console.log(`[Proxy] Message to send: ${msg.substring(0, 50)}...`);

    await ctx.reply(msg, { parse_mode: "HTML" });

  } catch (err) {
    console.error("Proxy error:", err);
    ctx.reply(`❌ Gagal memproses ${symbol}`);
  }
});


// ============================
// COMMAND: REVIEW
// ============================
bot.command("review", async (ctx) => {
  const user = ctx.from?.username || ctx.from?.first_name || "Unknown";
  console.log(`${user} menggunakan review`);
  // Parsing more robustly using regex to handle "entry=" or plain numbers
  // Format: /review BUY BBCA 1260 OR /review BUY BBCA entry=1260
  const input = ctx.message.text;
  const match = input.match(/\/review\s+(BUY|SELL)\s+([A-Z0-9.-]+)\s+?(?:entry=)?(\d+)(?:\s+?(?:sl=)?(\d+))?/i);

  if (!match) {
    return ctx.reply("⚠ Format salah.\nGunakan: `/review BUY BBCA 1260` atau `/review BUY BBCA entry=1260 sl=1200`", { parse_mode: "Markdown" });
  }

  const action = match[1].toUpperCase();
  const symbol = match[2].toUpperCase();
  const entryPrice = match[3];
  const slPrice = match[4] || null;

  await ctx.reply(`🧠 Reviewing Trade Setup: ${action} ${symbol} @ ${entryPrice}...`);

  try {
    const reviewResult = await generateReview(action, symbol, entryPrice, slPrice);

    // Convert Markdown to Telegram HTML
    const html = await markdownToTelegramHTML(reviewResult);
    await sendLongMessage(ctx, html);

  } catch (err) {
    console.error("Review Error:", err);
    ctx.reply(`❌ Gagal memproses review untuk ${symbol}. Hubungi admin jika error berlanjut.`);
  }
});

// ============================
// COMMAND: SIGNAL
// ============================
bot.command("signal", async (ctx) => {
  const user = ctx.from?.username || ctx.from?.first_name || "Unknown";
  console.log(`${user} menggunakan signal`);
  const text = ctx.message.text.split(" ");
  const symbol = text[1]?.toUpperCase();

  if (!symbol) {
    return ctx.reply("⚠ Cara pakai:\n /signal BBCA");
  }

  await ctx.reply(`🧠 Menganalisa Signal untuk ${symbol}...`);

  try {
    // Dynamic import if needed, or require at top if possible. 
    // using require at top is better for standard usage but if following pattern:
    const { generateSignal } = require('../src/utils/signal.js');

    const signalResult = await generateSignal(symbol);

    // Convert Markdown to Telegram HTML if needed
    const html = await markdownToTelegramHTML(signalResult);
    const finalMsg = `🚀 <b>Sinyal Trading ${symbol}</b>\n\n${html}`;

    await sendLongMessage(ctx, finalMsg);

  } catch (err) {
    console.error("Signal Error:", err);
    ctx.reply(`❌ Gagal menghasilkan signal untuk ${symbol}`);
  }
});



// ============================
// COMMAND: ANALISA
// ============================
bot.command("analisa", async (ctx) => {
  const user = ctx.from?.username || ctx.from?.first_name || "Unknown";
  console.log(`${user} menggunakan analisa`);
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
    aiResponse = await analyzeWithAI(prompt);
  } catch (err) {
    console.error("Gemini Error:", err.message);
    return ctx.reply("❌ Analisa AI gagal. Coba lagi nanti.");
  }

  const html = await markdownToTelegramHTML(aiResponse);
  const finalMsg = `📊 <b>Analisa ${symbol}</b>\n\n${html}`;

  await sendLongMessage(ctx, finalMsg);
});

// ============================
// COMMAND: FUNDAMENTAL
// ============================
bot.command(["fundamental", "profile"], async (ctx) => {
  const user = ctx.from?.username || ctx.from?.first_name || "Unknown";
  console.log(`${user} menggunakan fundamental`);
  const text = ctx.message.text.split(" ");
  const symbol = text[1]?.toUpperCase();

  if (!symbol) {
    return ctx.reply("⚠ Format salah.\nGunakan: /fundamental BBCA");
  }

  await ctx.reply(`🔎 Mengambil data fundamental <b>${symbol}</b>...`, {
    parse_mode: "HTML",
  });

  try {
    const data = await fetchFundamentals(symbol);
    const msg = formatFundamentals(data);
    await ctx.reply(msg, { parse_mode: "HTML" });
  } catch (err) {
    console.error("Fundamental Error:", err);
    ctx.reply(`❌ Gagal mengambil data fundamental ${symbol}`);
  }
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
      // Selalu kembalikan 200 OK agar Vercel/Telegram tidak melakukan retry 
      // untuk error yang bersifat permanen (misal 403 Forbidden)
      return res.status(200).send("OK_WITH_ERROR");
    }
  }

  res.status(200).send("Bot Running");
};
