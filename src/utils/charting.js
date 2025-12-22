const { fetchHistorical } = require('./yahoofinance');
const { SMA, EMA, RSI, ADX } = require('technicalindicators');

async function getChartData(symbol, interval = '1d') {
    console.log(`[CHART] Request: ${symbol} ${interval}`);
    // 1. Fetch Data 
    // Need more data for ADX/EMA stability (at least 200)
    const candles = await fetchHistorical(symbol, { interval, limit: 300 });
    console.log(`[CHART] Fetched ${candles ? candles.length : 0} candles for ${symbol}`);

    if (!candles || candles.length < 50) {
        console.warn(`[CHART] Insufficient data for ${symbol}`);
        return { candles: [], markers: [] };
    }

    // 2. Prepare Data for Indicators
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    // 3. Calculate Indicators
    // MA 50 (User asked for EMA50 in rule desc, but "MA 50" in text. I will use EMA as per first line "menggunakan indikator EMA50")
    const ema50 = EMA.calculate({ period: 50, values: closes });
    const rsi14 = RSI.calculate({ period: 14, values: closes });
    const adx14 = ADX.calculate({ period: 14, high: highs, low: lows, close: closes });

    const markers = [];

    // We iterate through candles. 
    // Need to align arrays.
    // EMA50 starts at index 49 (length = total - 49)
    // RSI14 starts at index 14
    // ADX14 starts at index ~27 (14 + 14? ADX usually needs 2x period to stabilize)

    let lastSignal = null; // To filter sequence (BUY -> BUY)

    // Helper to safely get indicator value at candle index
    // arr[0] matches candles[offset]. 
    // Offset = candles.length - arr.length
    const getVal = (arr, candleIdx) => {
        const offset = candles.length - arr.length;
        const idx = candleIdx - offset;
        if (idx < 0 || idx >= arr.length) return null;
        return arr[idx];
    };

    // Helper: Is Sideways? (ADX < 20)
    const isSideways = (idx) => {
        const adx = getVal(adx14, idx);
        // User rule: ADX < 20 -> No Signal
        if (adx && adx.adx < 20) return true;
        return false;
    };

    // Helper: Pattern Recognition
    const getPattern = (curr, prev) => {
        if (!curr || !prev) return null;

        const cBody = Math.abs(curr.close - curr.open);
        const cRange = curr.high - curr.low;
        const cBodyPct = cRange > 0 ? cBody / cRange : 0;

        const pBody = Math.abs(prev.close - prev.open);
        const pRange = prev.high - prev.low;

        const isBullish = curr.close > curr.open;
        const isBearish = curr.close < curr.open;
        const prevRed = prev.close < prev.open;
        const prevGreen = prev.close > prev.open;

        // "Jangan panah di candle kecil Body candle >= 60% range candle" 

        // 1. PIN BAR / HAMMER / HANGING MAN (Bullish Rejection)
        // Characteristic: Long lower wick, small body at top.
        const upperWick = curr.high - Math.max(curr.open, curr.close);
        const lowerWick = Math.min(curr.open, curr.close) - curr.low;

        // Bullish Pin Bar / Hammer (Lower wick >= 2 * body) & Body in upper half
        if (lowerWick >= 2 * cBody && upperWick < lowerWick * 0.5) {
            return 'BULL_PIN';
        }

        // 2. SHOOTING STAR / BEARISH PIN BAR (Bearish Rejection)
        // Characteristic: Long upper wick, small body at bottom.
        if (upperWick >= 2 * cBody && lowerWick < upperWick * 0.5) {
            return 'BEAR_PIN';
        }

        // 3. BULLISH ENGULFING
        // Prev Red, Curr Green. Strong Body?
        if (prevRed && isBullish) {
            if (curr.close > prev.open && curr.open < prev.close) {
                // Check strength: Body candle >= 60% range candle
                if (cBodyPct >= 0.6) return 'BULL_ENGULF';
            }
        }

        // 4. BEARISH ENGULFING
        // Prev Green, Curr Red.
        if (prevGreen && isBearish) {
            if (curr.close < prev.open && curr.open > prev.close) {
                if (cBodyPct >= 0.6) return 'BEAR_ENGULF';
            }
        }

        return null;
    };


    // Iterate
    // Start from index 50 to ensure we have EMA50
    for (let i = 50; i < candles.length; i++) {
        const curr = candles[i];
        const prev = candles[i - 1];

        const ema = getVal(ema50, i);
        const rsi = getVal(rsi14, i);

        if (ema === null || rsi === null) continue;

        // Filter: Sideways
        if (isSideways(i)) continue;

        const pattern = getPattern(curr, prev);
        if (!pattern) continue;

        // RULE BUY
        // 1. Close > EMA50
        // 2. RSI > 50
        // 3. Pattern: Bull Engulf / Bull Pin
        const buySignal = (curr.close > ema) && (rsi > 50) && (pattern === 'BULL_ENGULF' || pattern === 'BULL_PIN');

        // RULE SELL
        // 1. Close < EMA50
        // 2. RSI < 50
        // 3. Pattern: Bear Engulf / Bear Pin
        const sellSignal = (curr.close < ema) && (rsi < 50) && (pattern === 'BEAR_ENGULF' || pattern === 'BEAR_PIN');

        // Filter: Sequence (No BUY -> BUY)
        if (buySignal) {
            if (lastSignal !== 'BUY') {
                markers.push({
                    time: curr.time,
                    position: 'belowBar',
                    color: '#22c55e',
                    shape: 'arrowUp',
                    text: 'BUY'
                });
                lastSignal = 'BUY';
            }
        } else if (sellSignal) {
            if (lastSignal !== 'SELL') {
                markers.push({
                    time: curr.time,
                    position: 'aboveBar',
                    color: '#ef4444',
                    shape: 'arrowDown',
                    text: 'SELL'
                });
                lastSignal = 'SELL';
            }
        }
    }

    return {
        candles,
        markers
    };
}

module.exports = { getChartData };
