// src/bot-polling.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { fetchHistorical } = require('./utils/yahoofinance');
const { computeIndicators, formatIndicatorsForPrompt } = require('./utils/indicators');
const { analyzeWithAI } = require('./utils/ai');
const { marked } = require("marked");
const { generateReview } = require('./utils/review');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ALLOWED_GROUP_IDS = process.env.ALLOWED_GROUP_IDS ? process.env.ALLOWED_GROUP_IDS.split(',') : [];
const DEFAULT_CANDLES = 50;

// Helper to check if chat is allowed
function isAllowed(chatId) {
  if (ALLOWED_GROUP_IDS.length === 0) return true;
  return ALLOWED_GROUP_IDS.includes(chatId);
}

// Convert Markdown to Telegram-safe HTML
function markdownToTelegramHTML(md) {
  let html = marked.parse(md);

  // Simple tag conversions for Telegram HTML
  html = html
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '\n\n')
    .replace(/<strong>/g, '<b>')
    .replace(/<\/strong>/g, '</b>')
    .replace(/<em>/g, '<i>')
    .replace(/<\/em>/g, '</i>')
    .replace(/<ul>/g, '')
    .replace(/<\/ul>/g, '')
    .replace(/<li>/g, '• ')
    .replace(/<\/li>/g, '\n')
    .replace(/<h[1-6]>/g, '<b>')
    .replace(/<\/h[1-6]>/g, '</b>\n')
    .replace(/<br\s*\/?>/g, '\n')
    .trim();

  return html;
}

// Helper for long messages
async function sendLongMessage(bot, chatId, text) {
  if (text.length <= 4000) {
    return bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  }
  const chunks = text.match(/[\s\S]{1,4000}/g) || [];
  for (const chunk of chunks) {
    await bot.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
  }
}

// ----------------------------------------------------------------

const MINI_APP_URL = "https://t.me/astonaicbot/astonmology";

const bot_reply_redirect = (bot, chatId) => {
  return bot.sendMessage(chatId, "🤖 <b>Silakan gunakan App Astonmology untuk fitur ini.</b>", {
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

    // Check /cekchatid first
    if (command === '/cekchatid') {
      return bot.sendMessage(chatId, `🆔 <b>Chat Info</b>\n\n• Chat ID: <code>${chatId}</code>\n• User ID: <code>${msg.from.id}</code>`, { parse_mode: "HTML" });
    }

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
  bot.onText(/\/start/i, (msg) => {
    bot.sendMessage(msg.chat.id, "🤖 Bot aktif. Silakan gunakan perintah /help untuk panduan.");
  });
}

if (require.main === module) {
  startPollingBot();
}

module.exports = { startPollingBot };
