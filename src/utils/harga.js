const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');

const GOAPI_URL = 'https://api.goapi.io/stock/idx/prices';

/**
 * Mengambil data saham berdasarkan kode (symbol)
 */
const getStockData = async (symbol) => {
  try {
    const response = await axios.get(GOAPI_URL, {
      params: {
        symbols: symbol.toUpperCase(), // WAJIB pakai "symbols"
        api_key: process.env.GOAPI_API_KEY
      }
    });

    return response.data?.data?.results?.[0] || null;
  } catch (error) {
    console.error("Error fetch stock data:", error?.response?.data || error.message);
    return null;
  }
};

/**
 * Format teks harga saham
 */
const fetchHarga = async (emiten) => {
  try {
    const data = await getStockData(emiten);
    if (!data) return `❌ Data untuk ${emiten.toUpperCase()} tidak ditemukan / limit harian.`;

    const updateTime = moment().tz("Asia/Jakarta").format("DD/MM HH:mm");

    return `📊 ${data.company.name} (${data.symbol})
💰 Close: ${data.close}
📈 High: ${data.high}
📉 Low: ${data.low}
📊 Volume: ${data.volume.toLocaleString()}
🕒 Update: ${updateTime}

*Bot limit 30 request/days*

*Next Update:*
_Menampilkan News,_
_Menampilkan Emiten yang sedang trend/ara,_
_Menampilkan Broker Summary_`;
  } catch (err) {
    console.error("API Error:", err.response?.data || err.message);
    return `❌ Gagal ambil data untuk ${emiten.toUpperCase()}.`;
  }
};

/**
 * Kirim pesan Telegram via HTTP API
 */
const sendTelegramMessage = async (chatId, text) => {
  try {
    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "Markdown"
    });
  } catch (error) {
    console.error("Error send message:", error?.response?.data || error.message);
  }
};




// Export semua fungsi
module.exports = {
  getStockData,
  fetchHarga,
};
