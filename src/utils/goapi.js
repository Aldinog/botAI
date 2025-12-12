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

async function fetchBrokerSummary(symbol) {
  const API_KEY = process.env.GOAPI_KEY;
  const today = new Date().toISOString().split("T")[0]; // format YYYY-MM-DD

  const url = `https://api.goapi.io/stock/idx/${symbol}/broker_summary?date=${today}&investor=ALL&api_key=${API_KEY}`;

  try {
    const { data } = await axios.get(url);

    if (!data?.data?.results) {
      return { error: "Data broker summary tidak ditemukan." };
    }

    return data.data.results;
  } catch (err) {
    console.error("BrokerSummary Error:", err.response?.data || err.message);
    return { error: "Gagal mengambil data broker summary." };
  }
}

module.exports = {
  fetchHistorical,
  fetchBrokerSummary
};
