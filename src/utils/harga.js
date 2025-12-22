// utils/harga.js
const moment = require('moment-timezone');
const { fetchQuote } = require('./yahoofinance');

/**
 * Format teks harga saham
 */
const fetchHarga = async (emiten) => {
  try {
    const data = await fetchQuote(emiten);
    if (!data) return `❌ Data untuk ${emiten.toUpperCase()} tidak ditemukan (atau error API).`;

    const updateTime = moment(data.regularMarketTime).tz("Asia/Jakarta").format("DD/MM HH:mm");
    const name = data.longName || data.shortName || emiten.toUpperCase();
    const symbol = data.symbol.replace('.JK', '');

    return `📊 ${name} (${symbol})
💰 Close: ${data.regularMarketPrice}
📈 High: ${data.regularMarketDayHigh}
📉 Low: ${data.regularMarketDayLow}
📊 Volume: ${data.regularMarketVolume.toLocaleString()}
🕒 Update: ${updateTime}

Bot limit 30 request/days (Legacy Note)

Next Update:
Menampilkan News,
Menampilkan Emiten yang sedang trend/ara,
Menampilkan Broker Summary`;
  } catch (err) {
    console.error("API Error:", err.message);
    return `❌ Gagal ambil data untuk ${emiten.toUpperCase()}.`;
  }
};

// Export semua fungsi
module.exports = {
  fetchHarga,
};
