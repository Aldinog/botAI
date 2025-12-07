// api/src/bot-polling.js

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { fetchHistorical } = require('./utils/goapi');
const { computeIndicators, formatIndicatorsForPrompt } = require('./utils/indicators');
const { analyzeWithGemini } = require('./utils/gemini');
const { marked } = require("marked");

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

function startPollingBot() {
  if (!TELEGRAM_TOKEN) throw new Error('TELEGRAM_TOKEN missing in env');
  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  console.log('Telegram bot polling started.');

  // ====== /analisa command ======
  bot.onText(/\/analisa\s+(.+)/i, async (msg, match) => {
    const chatId = msg.chat.id.toString();

    // Restrict groups
    if (!isAllowed(chatId)) {
      return bot.sendMessage(chatId, "❌ Bot ini hanya bisa digunakan di grup resmi.");
    }

    const symbol = match[1].trim().toUpperCase();
    await bot.sendMessage(chatId, `🔎 Menerima permintaan analisa untuk *${symbol}*...`, { parse_mode: 'Markdown' });

    try {
      const candles = await fetchHistorical(symbol, { limit: DEFAULT_CANDLES });

      if (!candles || candles.length === 0) {
        return bot.sendMessage(chatId, `❌ Gagal mengambil data untuk ${symbol}. Periksa symbol atau API key GoAPI.`);
      }

      const indicators = computeIndicators(candles);
      const prompt = formatIndicatorsForPrompt(symbol, indicators);

      const aiResponse = await analyzeWithGemini(prompt);

      const cleanHtml = markdownToTelegramHTML(aiResponse);
      const reply = `📊 <b>Analisa ${symbol}</b>\n\n${cleanHtml}`;

      await sendLongMessage(bot, chatId, reply);

    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, `⚠️ Terjadi error: ${err.message}`);
    }
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
