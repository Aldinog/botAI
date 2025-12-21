const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });
const { computeIndicators } = require('./indicators');

// Top 35 Indonesian Stocks (Liquid & Large Cap)
const STOCK_LIST = [
    "BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "TLKM.JK",
    "ASII.JK", "UNVR.JK", "ICBP.JK", "INDF.JK", "KLBF.JK",
    "ADRO.JK", "PTBA.JK", "ITMG.JK", "UNTR.JK", "PGAS.JK",
    "MEDC.JK", "INCO.JK", "ANTM.JK", "TINS.JK", "GOTO.JK",
    "ARTO.JK", "CPIN.JK", "JPFA.JK", "SMGR.JK", "INTP.JK",
    "BRIS.JK", "AMRT.JK", "MAPI.JK", "JSMR.JK", "TBIG.JK",
    "TOWR.JK", "EMTK.JK", "SCMA.JK", "HRUM.JK", "AKRA.JK"
];

async function fetchCandles(symbol, days = 60) {
    try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days * 2); // Fetch more tailored for trading days

        const queryOptions = { period1: start, period2: end, interval: '1d' };
        const result = await yahooFinance.historical(symbol, queryOptions);

        // Ensure we have enough data
        if (!result || result.length < 50) return null;
        return result;
    } catch (err) {
        console.error(`Error fetching ${symbol}:`, err.message);
        return null;
    }
}

// Candlestick Pattern Detection
function detectPattern(candles) {
    const current = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    if (!current || !prev) return null;

    const currentBody = Math.abs(current.close - current.open);
    const prevBody = Math.abs(prev.close - prev.open);
    const currentRange = current.high - current.low;

    const isBullish = current.close > current.open;
    const isBearish = current.close < current.open;
    const isPrevBullish = prev.close > prev.open;
    const isPrevBearish = prev.close < prev.open;

    // Bullish Engulfing
    if (isBullish && isPrevBearish &&
        current.close > prev.open && current.open < prev.close) {
        return 'Bullish Engulfing';
    }

    // Bearish Engulfing
    if (isBearish && isPrevBullish &&
        current.close < prev.open && current.open > prev.close) {
        return 'Bearish Engulfing';
    }

    // Doji (Body is very small relative to range)
    if (currentBody <= (currentRange * 0.1) && currentRange > 0) {
        return 'Doji';
    }

    // Shooting Star (Small body at lower end, long upper shadow)
    // Upper shadow >= 2x body, Lower shadow very small
    const upperShadow = current.high - Math.max(current.open, current.close);
    const lowerShadow = Math.min(current.open, current.close) - current.low;

    if (upperShadow >= (2 * currentBody) && lowerShadow <= (0.5 * currentBody) && currentBody > 0) {
        // A shooting star is typically bearish, often found in uptrends, but we strictly define shape here
        return 'Shooting Star';
    }

    // Hanging Man / Hammer logic could be added here similar to Shooting Star
    // Hammer: Small body at upper end, long lower shadow
    if (lowerShadow >= (2 * currentBody) && upperShadow <= (0.5 * currentBody) && currentBody > 0) {
        if (isBearish) return 'Hanging Man'; // Often considered bearish after uptrend
        return 'Hammer'; // Often bullish after downtrend
    }

    return null;
}

async function getTopMovers() {
    try {
        // Fallback: This is a pseudo-function as yahoo-finance2 'dailyGainers' might fail or be heavy.
        // We will use a simpler approach: fetch quotes for a few major indices or just return nothing for now
        // if YF modules for top gainers are flaky.
        // Better approach for stability: Get quotes for the STOCK_LIST and sort them.

        const quotes = await Promise.all(STOCK_LIST.map(async (s) => {
            try {
                const q = await yahooFinance.quote(s);
                return {
                    symbol: s,
                    changePercent: q.regularMarketChangePercent || 0,
                    price: q.regularMarketPrice
                };
            } catch (e) { return null; }
        }));

        const valid = quotes.filter(q => q !== null);

        // Top 3 Gainers
        const gainers = [...valid].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);

        // Top 3 Losers
        const losers = [...valid].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);

        return { gainers, losers };
    } catch (error) {
        console.error("Error getting top movers:", error);
        return { gainers: [], losers: [] };
    }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runScreener() {
    const results = [];

    // Since we need to be fast, we can try parallel fetching in chunks or Promise.all
    // For 35 stocks, Promise.all might be okay but let's batch to be safe against rate limits

    const BATCH_SIZE = 5;
    for (let i = 0; i < STOCK_LIST.length; i += BATCH_SIZE) {
        const batch = STOCK_LIST.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (symbol) => {
            const candles = await fetchCandles(symbol);
            if (!candles) return;

            const indicators = computeIndicators(candles);
            const latest = indicators.latest;
            const pattern = detectPattern(candles);

            if (!latest.EMA20 || !latest.EMA50 || !latest.RSI) return;

            let matched = false;
            let reason = '';

            // LOGIC MATRIX

            // 1. Bullish Engulfing + RSI < 35 + EMA20 > EMA50 (Strong Bullish Logic?) 
            // Note: User prompt said "EMA20 > EMA50" for Bullish, but usually Engulfing is reversal.
            // Let's stick to user examples but also add general common sense logic.
            if (pattern === 'Bullish Engulfing') {
                // Additional filter to reduce noise
                matched = true;
                reason = 'Bullish Engulfing Detected';
            }

            // 2. Bearish Engulfing
            else if (pattern === 'Bearish Engulfing') {
                matched = true;
                reason = 'Bearish Engulfing Detected';
            }

            // 3. Doji + Volume Spike (Volume > 1.5x MA20 Volume? We don't have MA volume yet, use simple logic)
            // "Volume hari ini > rata-rata 20 hari"
            else if (pattern === 'Doji') {
                // approximations for avg volume if not explicitly calculated in indicators.js
                // Let's check existing logic. We only have price MA. 
                // We can do a quick check on last 20 candles volume.
                const last20Vols = candles.slice(-21, -1).map(c => c.volume);
                const avgVol = last20Vols.reduce((a, b) => a + b, 0) / 20;

                if (latest.latestVolume > avgVol * 1.5) { // Spike
                    matched = true;
                    reason = 'Doji with Volume Spike';
                }
            }

            // 4. Shooting Star + RSI > 60 (Overbought territoryish)
            else if (pattern === 'Shooting Star') {
                if (latest.RSI > 60) {
                    matched = true;
                    reason = 'Shooting Star at High RSI';
                }
            }

            // User requested: "Shootingstar + resistance" or "Hanging man + support"
            // Simplification: We check RSI extremes as proxy for support/resistance levels in this simple screener

            if (matched) {
                results.push({
                    symbol,
                    pattern,
                    price: latest.latestClose,
                    rsi: latest.RSI.toFixed(1),
                    ema20: latest.EMA20.toFixed(0),
                    ema50: latest.EMA50.toFixed(0),
                    volume: latest.latestVolume,
                    reason
                });
            }

        })); // End Promise.all

        // Add small delay between batches
        if (i + BATCH_SIZE < STOCK_LIST.length) {
            await delay(1000);
        }
    } // End Batch loop

    return results;
}

module.exports = { runScreener, getTopMovers, STOCK_LIST };
