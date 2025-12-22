// utils/analysis.js

const { SMA, RSI, MACD, Stochastic } = require("../utils/indikator");
const { fetchHistorical } = require("../utils/yahoofinance");

// Use fetchHistorical from yahoofinance instead of internal implementation
// Removed axios and internal getHistorical


function safeNum(v, digits = 2) {
    if (v === null || v === undefined || Number.isNaN(v)) return null;
    return Number(Number(v).toFixed(digits));
}
function fmt(v) {
    if (v === null || v === undefined) return "-";
    if (Number.isInteger(v)) return v.toLocaleString('id-ID');
    return Number(v).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function analyzeStock(symbol) {
    // Replacement for getHistorical: use fetchHistorical with limit ~80
    const candles = await fetchHistorical(symbol, { limit: 80 });
    if (!candles || candles.length < 20) {
        return { error: "Data tidak cukup untuk analisa (butuh minimal ~20 candle)." };
    }

    // fetchHistorical already returns oldest -> newest. 
    // GoAPI logic had a reverse check, but fetchHistorical guarantees order.
    let c = [...candles];

    // Safety check just in case logic changes
    if (new Date(c[0].time) > new Date(c[c.length - 1].time)) c = c.reverse();

    // Map fields (YF fetchHistorical returns open/high/low/close as numbers, time as string)
    // Existing code uses 'date' possibly? fetchHistorical returns 'time'.
    // See line 72 original: new Date(c[0].date). 
    // fetchHistorical returns object with 'time' key. I should normalize this or adapt usage.
    // Let's adapt usage here.

    const close = c.map(x => Number(x.close));
    const high = c.map(x => Number(x.high));
    const low = c.map(x => Number(x.low));

    // Hitung indikator (beberapa fungsi mengembalikan arrays)
    const ma5Arr = SMA(close, 5);
    const ma20Arr = SMA(close, 20);
    const ma50Arr = SMA(close, 50);

    const ma5 = ma5Arr && ma5Arr.length ? safeNum(ma5Arr[ma5Arr.length - 1], 2) : null;
    const ma20 = ma20Arr && ma20Arr.length ? safeNum(ma20Arr[ma20Arr.length - 1], 2) : null;
    const ma50 = ma50Arr && ma50Arr.length ? safeNum(ma50Arr[ma50Arr.length - 1], 2) : null;

    const rsiArr = RSI(close, 14);
    const rsi14 = rsiArr && rsiArr.length ? safeNum(rsiArr[rsiArr.length - 1], 2) : null;

    const macdObj = MACD(close, 12, 26, 9);
    const macdLineLast = macdObj && macdObj.macd && macdObj.macd.length ? safeNum(macdObj.macd[macdObj.macd.length - 1], 4) : null;
    const macdSignalLast = macdObj && macdObj.signal && macdObj.signal.length ? safeNum(macdObj.signal[macdObj.signal.length - 1], 4) : null;
    const macdHistoLast = macdObj && macdObj.histogram && macdObj.histogram.length ? safeNum(macdObj.histogram[macdObj.histogram.length - 1], 4) : null;

    const stochObj = Stochastic(high, low, close, 14, 3, 3);
    const stochK = stochObj && stochObj.k && stochObj.k.length ? safeNum(stochObj.k[stochObj.k.length - 1], 2) : null;
    const stochD = stochObj && stochObj.d && stochObj.d.length ? safeNum(stochObj.d[stochObj.d.length - 1], 2) : null;

    const lastClose = safeNum(close[close.length - 1], 0);

    // Interpretasi trend / momentum (fallback jika indikator null)
    let trend = "Sideways";
    if (ma5 !== null && ma20 !== null && ma50 !== null) {
        if (ma5 > ma20 && ma20 > ma50) trend = "Uptrend kuat";
        else if (ma5 > ma20) trend = "Mulai uptrend (awal reversal)";
        else if (ma5 < ma20 && ma20 < ma50) trend = "Downtrend";
    } else if (ma5 !== null && ma20 !== null) {
        trend = ma5 > ma20 ? "Mulai uptrend (awal reversal)" : "Sideways";
    }

    let momentum = "Normal";
    if (rsi14 !== null) {
        if (rsi14 > 70) momentum = "Overbought (wajib hati-hati)";
        else if (rsi14 < 30) momentum = "Oversold (peluang reversal)";
    }

    let macdSignal = "Neutral";
    if (macdLineLast !== null && macdSignalLast !== null && macdHistoLast !== null) {
        macdSignal = macdLineLast > macdSignalLast && macdHistoLast > 0 ? "Bullish" :
            macdLineLast < macdSignalLast && macdHistoLast < 0 ? "Bearish" : "Neutral";
    }

    let stochSignal = "Normal";
    if (stochK !== null) {
        stochSignal = stochK > 80 ? "Overbought" : stochK < 20 ? "Oversold" : "Normal";
    }

    // Zona Buy / SL / TP: gunakan fallback jika ma20/ma50 null
    // BUY zone dari MA20 & MA50 (fallback ke harga terakhir)
    const zBase1 = ma20 ?? lastClose;
    const zBase2 = ma50 ?? lastClose;

    const buyZone = Math.round((zBase1 + zBase2) / 2);

    // Stop Loss = 3% di bawah zona BUY
    let stopLoss = Math.round(buyZone * 0.97);

    // Jika SL tidak logis (lebih tinggi dari BUY), paksa minimal 2% di bawah BUY
    if (stopLoss >= buyZone) {
        stopLoss = buyZone - Math.round(buyZone * 0.97);
    }

    // Take Profit dihitung dari BUY zone
    const tp1 = Math.round(buyZone * 1.05);
    const tp2 = Math.round(buyZone * 1.03);
    const tp3 = Math.round(buyZone * 1.03);


    // Format message (gunakan fmt helper)
    const output = `
📊 *Indikator ${symbol} (Intraday)*

💹 *Harga terakhir:* ${fmt(lastClose)}

📈 *Moving Average*
- MA5: ${fmt(ma5)}
- MA20: ${fmt(ma20)}
- MA50: ${fmt(ma50)}

🔍 *Trend:* ${trend}

📊 *Momentum*
- RSI14: ${fmt(rsi14)} → ${momentum}

📉 *MACD*
- MACD: ${fmt(macdLineLast)}
- Signal: ${fmt(macdSignalLast)}
- Histogram: ${fmt(macdHistoLast)}
→ *${macdSignal}*

🎯 *Stochastic*
- %K: ${fmt(stochK)}
- %D: ${fmt(stochD)}
→ *${stochSignal}*

_Bot limit 30 request/days_

*Next Update:*
_Menampilkan News,_
_Menampilkan Emiten yang sedang trend/ara,_
_Menampilkan Broker Summary_


`.trim();

    return { text: output };
}

module.exports = { analyzeStock };
