// api/src/bot-polling.js

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { fetchHistorical } = require('./utils/yahoofinance');
const { computeIndicators, formatIndicatorsForPrompt } = require('./utils/indicators');
const { analyzeWithAI } = require('./utils/ai');
const { marked } = require("marked");
const { generateReview } = require('./utils/review');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const DEFAULT_CANDLES = parseInt(process.env.DEFAULT_CANDLES || '50', 10);

// ===== Allowed groups =====
const ALLOWED_GROUPS = process.env.ALLOWED_GROUP_IDS
  ? process.env.ALLOWED_GROUP_IDS.split(",").map(id => id.trim())
  : process.env.ALLOWED_GROUP_ID
    ? [process.env.ALLOWED_GROUP_ID.trim()]
    : [];

// Helper: cek apakah chat diperbolehkan
function isAllowed(chatId) {
  if (ALLOWED_GROUPS.length === 0) return true; // jika tidak didefinisikan, bot bebas
  return ALLOWED_GROUPS.includes(chatId.toString());
}

// ----------- fungsi untuk mengirim pesan panjang -----------
function splitMessage(text, maxLength = 4000) {
  const parts = [];
  for (let i = 0; i < text.length; i += maxLength) {
    parts.push(text.substring(i, i + maxLength));
  }
  return parts;
}

async function sendLongMessage(bot, chatId, text) {
  const parts = splitMessage(text);
  for (const part of parts) {
    await bot.sendMessage(chatId, part, { parse_mode: "HTML" });
  }
}

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

// ----------------------------------------------------------------

const MINI_APP_URL = "https://t.me/astonaicbot/astonmology";

const bot_reply_redirect = (bot, chatId) => {
  return bot.sendMessage(chatId, "🤖 <b>Silakan gunakan App AstonAI untuk fitur ini.</b>", {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🚀 Buka App", url: MINI_APP_URL }]
      ]
    }
  });
};

function startPollingBot() {
  if (!TELEGRAM_TOKEN) throw new Error('TELEGRAM_TOKEN missing in env');
  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  console.log('Telegram bot polling started.');

  // ====== Redirect All Major Commands ======
  const redirectCommands = ['/analisa', '/review', '/harga', '/indikator', '/proxy', '/signal', '/fundamental'];

  bot.on('message', (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id.toString();
    const command = msg.text.split(' ')[0].toLowerCase();

    if (redirectCommands.some(cmd => command.startsWith(cmd))) {
      if (!isAllowed(chatId)) {
        return bot.sendMessage(chatId, "❌ Bot ini hanya bisa digunakan di grup resmi.");
      }
      return bot_reply_redirect(bot, chatId);
    }
  });

  // ====== /help command ======
  bot.onText(/\/help/i, async (msg) => {
    const chatId = msg.chat.id.toString();
    if (!isAllowed(chatId)) return;

    const helpMsg = `
<b>Panduan Penggunaan Aston AI Bot</b>

🚀 <b>Semua Fitur Pindah Ke App!</b>
Sekarang Anda bisa melakukan Analisa, Cek Harga, Signal, dan Review Setup lebih mudah melalui Mini App kami.

🤖 <b>Fitur Utama di Mini App:</b>
• /harga, /indikator, /analisa
• /proxy, /signal, /review
• /fundamental

<i>Mulai sekarang dengan klik tombol di bawah!</i>
    `;
    await bot.sendMessage(chatId, helpMsg, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Buka App", url: MINI_APP_URL }]
        ]
      }
    });
  });

  // ====== /start command ======
  bot.on('message', (msg) => {
    const chatId = msg.chat.id.toString();

    // Restrict groups
    if (!isAllowed(chatId)) {
      return bot.sendMessage(chatId, "❌ Bot ini hanya bisa digunakan di grup resmi.");
    }

    if (msg.text && msg.text.toLowerCase().startsWith('/start')) {
      bot.sendMessage(chatId, 'Halo! Kirim perintah /analisa <TICKER>. Contoh: /analisa BBCA');
    }
  });
}

module.exports = { startPollingBot };
