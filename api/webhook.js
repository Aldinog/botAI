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
const { isAllowedGroup, allowedGroups } = require("../src/utils/groupControl");
const { fetchHarga } = require('../src/utils/harga');
const { generateReview } = require('../src/utils/review');
const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
if (!TELEGRAM_TOKEN) {
  console.error("CRITICAL: TELEGRAM_TOKEN is missing in environment variables!");
}
const bot = new Telegraf(TELEGRAM_TOKEN || "dummy_token");

const {
  markdownToTelegramHTML,
  splitMessageSafe
} = require("../src/utils/telegram");

async function sendLongMessage(ctx, html) {
  const parts = splitMessageSafe(html);
  for (const part of parts) {
    await ctx.reply(part, { parse_mode: "HTML" });
  }
}

// =========================
// REDIRECT LOGIC
// =========================
const MINI_APP_URL = "https://t.me/astonaicbot/astonmology";

const bot_reply_redirect = async (ctx) => {
  return ctx.reply("<b>Halo,,,Silahkan buka App AstonAI untuk menggunakan bot ini.</b>", {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🚀 Buka App", url: MINI_APP_URL }]
      ]
    }
  });
};

// =========================
// VALIDASI GROUP
// =========================
bot.use(async (ctx, next) => {
  const chatId = ctx.chat?.id;
  const chatType = ctx.chat?.type;
  const chatUser = ctx.from?.username || ctx.from?.first_name || "Unknown";

  if (!chatId) return next();

  // 🔹 ALLOW PRIVATE CHATS (Direct Message)
  if (chatType === 'private') {
    return next();
  }

  // 🔹 CHECK ALLOWED GROUPS
  if (!isAllowedGroup(chatId)) {
    console.log(`🚫 Unauthorized Group/Channel: ${chatId} (User: ${chatUser})`);

    // Only reply to actual messages/commands
    if (ctx.message && ctx.message.text) {
      try {
        return bot_reply_redirect(ctx);
      } catch (err) {
        console.error("Gagal mengirim pesan penolakan group:", err.message);
      }
    }
    return; // Block
  }

  return next();
});

// =========================
// COMMAND BASICS
// =========================
bot.start((ctx) => {
  const user = ctx.from?.username || ctx.from?.first_name || "Unknown";
  console.log(`${user} menggunakan start`);
  return bot_reply_redirect(ctx);
});

bot.command("cekchatid", (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  return ctx.reply(`🆔 <b>Chat Info</b>\n\n• Chat ID: <code>${chatId}</code>\n• User ID: <code>${userId}</code>`, { parse_mode: "HTML" });
});

bot.help((ctx) => {
  const user = ctx.from?.username || ctx.from?.first_name || "Unknown";
  console.log(`${user} menggunakan help`);
  return ctx.reply(
    "📌 <b>List Command Bot Saham</b>\n\n" +
    "🔹 <b>Semua Fitur Pindah Ke App!</b>\n" +
    "   Sekarang Anda bisa melakukan Analisa, Cek Harga, Signal, dan Review Setup " +
    "lebih mudah melalui Mini App kami.\n\n" +
    "🚀 <b>Buka App untuk fitu lengkap:</b>\n" +
    "• /harga, /avg, /analisa\n" +
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
// COMMAND: AVG (Custom)
// =========================
bot.command("avg", (ctx) => {
  const user = ctx.from?.username || ctx.from?.first_name || "Unknown";
  console.log(`${user} menggunakan /avg`);

  const usageText =
    "📊 <b>Kalkulator Average Up/Down</b>\n\n" +
    "Fitur ini dirancang untuk membantu Anda merencanakan transaksi saham dengan menghitung harga rata-rata baru setelah melakukan penambahan posisi (Average Up) atau penurunan harga rata-rata (Average Down).\n\n" +
    "📈 <b>Fungsi Utama:</b>\n" +
    "• Menghitung berapa lot yang perlu dibeli untuk mencapai target harga rata-rata tertentu.\n" +
    "• Mensimulasikan harga rata-rata baru jika Anda membeli sejumlah lot tertentu.\n" +
    "• Mengetahui estimasi total modal yang dibutuhkan.\n\n" +
    "💡 <b>Cara Penggunaan:</b>\n" +
    "1. Klik tombol <b>🚀 Buka App</b> di bawah.\n" +
    "2. Masukkan <b>Ticker Saham</b> (contoh: BBCA) di kolom pencarian utama.\n" +
    "3. Klik tombol <b>📊 KalkulatorAvg UP/DOWN</b>.\n" +
    "4. Isi data: <i>Harga Beli Lama, Jumlah Lot Lama,</i> dan <i>Harga Beli Baru</i>.\n" +
    "5. Masukkan <b>Target Rata-rata</b> (untuk mencari jumlah lot) ATAU <b>Lot Baru</b> (untuk mencari rata-rata).\n\n" +
    "🚀 <b>Klik tombol di bawah untuk mulai simulasi:</b>";

  return ctx.reply(usageText, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🚀 Buka App", url: MINI_APP_URL }]
      ]
    }
  });
});

// =========================
// COMMAND: REDIRECTS
// =========================
bot.command(["harga", "broksum", "proxy", "review", "signal", "analisa", "fundamental", "profile"], bot_reply_redirect);

// =========================
// CATCH-ALL LOGGING
// =========================
bot.on('text', (ctx) => {
  console.log(`🤖 Bot received text: "${ctx.message.text}" from @${ctx.from?.username || ctx.from?.first_name || 'unknown'}`);
});

// =========================
// WEBHOOK (Vercel Friendly)
// =========================
module.exports = async (req, res) => {
  console.log(`🌐 Incoming Request: ${req.method} ${req.url}`);

  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['host'];
  const fullUrl = `${protocol}://${host}${req.url.split('?')[0]}`;

  // 🔹 Diagnostic for GET requests
  if (req.method === "GET") {
    const { set } = req.query;
    console.log("🔍 Diagnostic GET triggered");

    let webhookInfo = null;
    if (TELEGRAM_TOKEN) {
      try {
        const infoUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getWebhookInfo`;
        const infoRes = await axios.get(infoUrl);
        webhookInfo = infoRes.data;
      } catch (e) {
        webhookInfo = { error: e.message };
      }
    }

    // Optional: Auto-set webhook if ?set=true is passed
    if (set === "true" && TELEGRAM_TOKEN) {
      try {
        const setUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${fullUrl}`;
        console.log(`🛰 Setting webhook to: ${fullUrl}`);
        const setRes = await axios.get(setUrl);

        // Re-fetch info to show current state
        const infoUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getWebhookInfo`;
        const infoRes = await axios.get(infoUrl);

        return res.status(200).json({
          message: "Webhook set attempt finished",
          telegram_response: setRes.data,
          target_url: fullUrl,
          webhook_info_now: infoRes.data
        });
      } catch (err) {
        console.error("❌ setWebhook Error:", err.message);
        return res.status(500).json({ error: "Failed to set webhook", detail: err.message });
      }
    }

    return res.status(200).json({
      status: "Bot Running",
      token_configured: !!TELEGRAM_TOKEN,
      allowed_groups_count: allowedGroups.length,
      full_webhook_url: fullUrl,
      telegram_webhook_info: webhookInfo,
      tip: "If 'last_error_message' is present in 'telegram_webhook_info', that is why the bot isn't responding. Visit with ?set=true to fix it."
    });
  }

  // 🔹 Handle POST from Telegram
  if (req.method === "POST") {
    try {
      if (!req.body || Object.keys(req.body).length === 0) {
        console.warn("⚠️ Webhook received empty body");
        return res.status(200).send("EMPTY_BODY");
      }

      const updateId = req.body.update_id;
      const type = Object.keys(req.body).find(k => k !== 'update_id');
      const text = req.body.message?.text || "non-text";
      const from = req.body.message?.from?.username || "unknown";

      console.log(`📩 [Update ${updateId}] From: @${from} | Type: ${type} | Text: "${text}"`);

      // Telegraf handleUpdate
      await bot.handleUpdate(req.body);

      console.log(`✅ [Update ${updateId}] Handled successfully`);
      return res.status(200).send("OK");
    } catch (err) {
      console.error(`❌ [Update ${req.body?.update_id}] Error:`, err.message);
      return res.status(200).send("OK_WITH_ERROR");
    }
  }

  res.status(405).send("Method Not Allowed");
};
