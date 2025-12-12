// api/src/utils/goapi.js

const axios = require('axios');
const GOAPI_KEY = process.env.GOAPI_API_KEY;

/**
 * Fetch last N daily candles from GoAPI
 * GoAPI provides date range (max 1 year).
 */
async function fetchHistorical(symbol, opts = {}) {
  if (!GOAPI_KEY) throw new Error("GOAPI_API_KEY missing in environment variables");

  const limit = opts.limit || 50;

  // Generate date range: today → (today - 365 days)
  const today = new Date();
  const past = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);

  const to = today.toISOString().split("T")[0];
  const from = past.toISOString().split("T")[0];

  const url = `https://api.goapi.io/stock/idx/${symbol}/historical`;

  try {
    const resp = await axios.get(url, {
      params: {
        from,
        to,
        api_key: GOAPI_KEY
      }
    });

    const results = resp.data?.data?.results;
    if (!Array.isArray(results) || results.length === 0) {
      return [];
    }

    // GoAPI returns newest → oldest, so reverse
    const sorted = results
      .map(c => ({
        time: c.date,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume)
      }))
      .reverse(); // oldest → newest

    // return last N candles
    return sorted.slice(-limit);

  } catch (err) {
    console.error("fetchHistorical error:", err.response?.data || err.message);
    throw new Error("Gagal mengambil data dari GoAPI");
  }
}

//broksum ---------------------------------------------------

async function fetchBrokerSummaryWithFallback(symbol) {
  const API_KEY = process.env.GOAPI_KEY;

  let current = new Date();
  current.setDate(current.getDate() - 1); // mulai dari kemarin

  let attempts = 0;
  let lastCheckedDates = [];

  while (attempts < 0) {
    const date = current.toISOString().split("T")[0];
    lastCheckedDates.push(date);

    const url = `https://api.goapi.io/stock/idx/${symbol}/broker_summary?date=${date}&investor=ALL&api_key=${API_KEY}`;

    try {
      const res = await axios.get(url);

      // Jika data ada → return langsung
      if (res?.data?.data?.results?.length > 0) {
        return {
          success: true,
          date,
          data: res.data.data.results
        };
      }

    } catch (err) {
      console.error("GoAPI broker summary error:", err.message);
      // lanjut fallback
    }

    // Mundur 1 hari lagi
    current.setDate(current.getDate() - 1);
    attempts++;
  }

  // Jika sampai sini → fallback 3x gagal
  return {
    success: false,
    message: `
    )}) tidak ada data broksum untuk ${symbol}.`
  };
}


// ======================
// PROXY BROKER ACTIVITY
// ======================

// Simple moving average
function sma(values, length) {
  if (values.length < length) return null;
  const slice = values.slice(-length);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * Menganalisis aktivitas besar berdasarkan OHLC (Proxy Broker)
 * candles harus format:
 * { time, open, high, low, close, volume }
 */
function analyzeProxyBrokerActivity(candles) {
  if (!candles || candles.length === 0) return [];

  const result = [];
  const volumes = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    volumes.push(c.volume);

    const avgVol = sma(volumes, 20);
    if (!avgVol) continue;

    let signals = [];

    const isBigActivity = c.volume > avgVol * 2;
    const strength = (c.close - c.open) / ((c.high - c.low) || 1);

    if (isBigActivity) {
      if (c.close > c.open) signals.push("BIG BUY (Akumulasi Besar)");
      else if (c.close < c.open) signals.push("BIG SELL (Distribusi Besar)");
    }

    if (strength > 0.6) signals.push("Buyer Dominan (Bull Strength)");
    if (strength < -0.6) signals.push("Seller Dominan (Bear Strength)");

    // Breakout volume
    const prevHighs = candles.slice(Math.max(0, i - 20), i).map(x => x.high);
    const highest20 = prevHighs.length ? Math.max(...prevHighs) : null;

    if (highest20 && c.close > highest20 && c.volume > avgVol * 1.5) {
      signals.push("Breakout Kuat (Volume Tinggi)");
    }

    if (signals.length > 0) {
      result.push({
        date: c.time,
        volume: c.volume,
        avgVol,
        strength,
        signals
      });
    }
  }

  return result;
}

/**
 * Format output siap kirim Telegram (HTML)
 */
function formatProxyBrokerActivity(symbol, activity) {
  if (!activity || activity.length === 0) {
    return `📊 <b>Proxy Broker Activity - ${symbol}</b>\n\nTidak ada aktivitas signifikan terdeteksi.`;
  }

  let text = `📊 <b>Proxy Broker Activity - ${symbol}</b>\n\n`;

  // Ambil 5 sinyal terbaru
  const latest = activity.slice(-5);

  latest.forEach(a => {
    text += `🕒 <b>${a.date}</b>\n`;
    text += `• Volume: ${a.volume.toLocaleString()} (Avg: ${Math.round(a.avgVol).toLocaleString()})\n`;
    text += `• Strength: ${a.strength.toFixed(2)}\n`;
    text += `• Signals:\n`;

    a.signals.forEach(sig => {
      text += `   - ${sig}\n`;
    });

    text += `\n`;
  });

  return text.trim();
}


module.exports = {
  fetchHistorical,
  fetchBrokerSummaryWithFallback,
  analyzeProxyBrokerActivity,
  formatProxyBrokerActivity
};

