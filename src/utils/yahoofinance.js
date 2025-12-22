const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
// suppressNotices might not be available or needed on new instance, removing for now to be safe

/**
 * Fetch last N daily candles from Yahoo Finance
 */
async function fetchHistorical(symbol, opts = {}) {
    // Ensure .JK suffix if missing and not 4 chars (simple heuristic, or better: just ensure it has it)
    // Most users type 'BBCA', we need 'BBCA.JK'
    let query = symbol;
    if (!query.endsWith(".JK") && !query.includes(".")) {
        query = `${query}.JK`;
    }

    const limit = opts.limit || 50;

    // Yahoo Finance historical query options
    const today = new Date().toISOString().split('T')[0];
    const queryOptions = {
        period1: '2023-01-01',
        period2: today,
        interval: '1d',
    };

    try {
        // We suppress warnings to keep logs clean
        const result = await yahooFinance.historical(query, queryOptions);

        if (!result || result.length === 0) return [];

        // Map to our format: { time: 'YYYY-MM-DD', open, high, low, close, volume }
        const formatted = result.map(q => ({
            time: q.date.toISOString().split('T')[0],
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
            volume: q.volume
        }));

        // Yahoo Finance usually returns Oldest -> Newest. 
        // We confirm this: index 0 is old.
        // Return last N
        return formatted.slice(-limit);

    } catch (err) {
        console.error(`YF Error for ${query}:`, err.message);
        return [];
    }
}

async function fetchBrokerSummaryWithFallback(symbol) {
    return {
        success: false,
        message: "Fitur Broksum tidak tersedia di Yahoo Finance."
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
    formatProxyBrokerActivity,
    fetchQuote
};

async function fetchQuote(symbol) {
    let query = symbol;
    if (!query.endsWith(".JK") && !query.includes(".")) {
        query = `${query}.JK`;
    }

    try {
        const quote = await yahooFinance.quote(query);
        return quote;
    } catch (err) {
        console.error(`YF Quote Error for ${query}:`, err.message);
        return null;
    }
}
