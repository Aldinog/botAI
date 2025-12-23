const { fetchHistorical } = require('./yahoofinance');
const { EMA, RSI, ATR, SMA } = require('technicalindicators');

async function getChartData(symbol, interval = '1d') {
    console.log(`[CHART] Request: ${symbol} ${interval}`);

    // 1. Fetch Primary Data
    const candles = await fetchHistorical(symbol, { interval, limit: 300 });
    if (!candles || candles.length < 30) {
        return { candles: [], markers: [] };
    }

    // 2. Fetch Daily Trend Data (if current interval is intraday)
    let dailyTrend = 'neutral';
    if (interval === '1h' || interval === '60m') {
        const dCandles = await fetchHistorical(symbol, { interval: '1d', limit: 50 });
        if (dCandles && dCandles.length >= 21) {
            const dCloses = dCandles.map(c => c.close);
            const dEma21 = EMA.calculate({ period: 21, values: dCloses });
            const lastD = dCandles[dCandles.length - 1];
            const lastEma = dEma21[dEma21.length - 1];
            if (lastD.close > lastEma) dailyTrend = 'bullish';
            else if (lastD.close < lastEma) dailyTrend = 'bearish';
        }
    }

    // 3. Prepare Primary Indicators
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    const ema9 = EMA.calculate({ period: 9, values: closes });
    const ema21 = EMA.calculate({ period: 21, values: closes });
    const ema10 = EMA.calculate({ period: 10, values: closes });
    const ema20 = EMA.calculate({ period: 20, values: closes });
    const rsi9 = RSI.calculate({ period: 9, values: closes });
    const atr14 = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
    const smaVol20 = SMA.calculate({ period: 20, values: volumes });

    // 4. Detect S/R Levels for SNR-based logic
    const { levels, trendlines } = detectSRandTrendlines(candles);

    const markers = [];
    let lastSignal = null;
    let lastSignalIndex = 0;
    let consecutiveCount = 0;

    // Helper to align indicator values
    const getVal = (arr, candleIdx) => {
        const offset = candles.length - arr.length;
        const idx = candleIdx - offset;
        if (idx < 0 || idx >= arr.length) return null;
        return arr[idx];
    };

    // 5. Iterate and Generate Signals
    for (let i = 21; i < candles.length; i++) {
        const curr = candles[i];

        // Indicators for Logic 1
        const e9 = getVal(ema9, i);
        const e21 = getVal(ema21, i);
        // Indicators for Logic 2
        const e10 = getVal(ema10, i);
        const e10prev = getVal(ema10, i - 1);
        const e20 = getVal(ema20, i);
        const e20prev = getVal(ema20, i - 1);
        // Shared Indicators
        const rsi = getVal(rsi9, i);
        const vol20 = getVal(smaVol20, i);
        const atr = getVal(atr14, i);

        if (e9 === null || e21 === null || e10 === null || e20 === null || rsi === null || vol20 === null || atr === null || e10prev === null || e20prev === null) continue;

        // --- COMMON FILTERS ---
        const isHighVol = curr.volume > vol20 * 1.2;
        const range = curr.high - curr.low;
        const body = Math.abs(curr.close - curr.open);
        const isStrong = range > 0 && (body / range >= 0.5);
        const distFromEMA21 = Math.abs(curr.close - e21);
        const isTooFar = distFromEMA21 > (atr * 1.5);

        // --- LOGIC 1: TREND FOLLOWING (The Complex Logic) ---
        const logic1Buy = (e9 > e21) && (rsi > 50 && rsi < 70) && !isTooFar && isHighVol && isStrong && (curr.close > curr.open);
        const logic1Sell = (e9 < e21) && (rsi < 50 && rsi > 30) && !isTooFar && isHighVol && isStrong && (curr.close < curr.open);

        // --- LOGIC 2: SNR + MA CROSS (The Specific Logic) ---
        let nearSupport = false;
        let nearResistance = false;
        const snrTolerance = atr * 0.5;

        for (let j = Math.max(0, i - 10); j <= i; j++) {
            levels.forEach(lvl => {
                if (lvl.type === 'support' && candles[j].low <= lvl.price + snrTolerance) nearSupport = true;
                if (lvl.type === 'resistance' && candles[j].high >= lvl.price - snrTolerance) nearResistance = true;
            });
        }

        const goldenCross = e10prev <= e20prev && e10 > e20;
        const deathCross = e10prev >= e20prev && e10 < e20;

        const logic2Buy = nearSupport && goldenCross;
        const logic2Sell = nearResistance && deathCross;

        // --- COMBINED FINAL TRIGGER ---
        const buySignal = logic1Buy || logic2Buy;
        const sellSignal = logic1Sell || logic2Sell;

        // Adaptive Cooldown Logic
        if (buySignal) {
            let canSignal = false;
            if (lastSignal !== 'BUY') {
                canSignal = true;
                consecutiveCount = 1;
            } else if (consecutiveCount === 1 && (i - lastSignalIndex > 8)) {
                canSignal = true;
                consecutiveCount = 2;
            } else if (consecutiveCount === 2 && (i - lastSignalIndex > 16)) {
                canSignal = true;
                consecutiveCount = 3;
            }

            if (canSignal) {
                markers.push({
                    time: curr.time,
                    position: 'belowBar',
                    color: '#22c55e',
                    shape: 'arrowUp',
                    text: 'BUY'
                });
                lastSignal = 'BUY';
                lastSignalIndex = i;
            }
        } else if (sellSignal) {
            let canSignal = false;
            if (lastSignal !== 'SELL') {
                canSignal = true;
                consecutiveCount = 1;
            } else if (consecutiveCount === 1 && (i - lastSignalIndex > 8)) {
                canSignal = true;
                consecutiveCount = 2;
            } else if (consecutiveCount === 2 && (i - lastSignalIndex > 16)) {
                canSignal = true;
                consecutiveCount = 3;
            }

            if (canSignal) {
                markers.push({
                    time: curr.time,
                    position: 'aboveBar',
                    color: '#ef4444',
                    shape: 'arrowDown',
                    text: 'SELL'
                });
                lastSignal = 'SELL';
                lastSignalIndex = i;
            }
        }
    }

    return {
        candles,
        markers,
        levels,
        trendlines
    };
}

/**
 * Detects Support/Resistance levels and Trendlines
 */
function detectSRandTrendlines(candles) {
    if (candles.length < 50) return { levels: [], trendlines: [] };

    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const pivotPeriod = 5; // Search within 5 candles left/right

    const highPivots = [];
    const lowPivots = [];

    // Pivot detection based on Candle Bodies (as requested)
    const bodiesHigh = candles.map(c => Math.max(c.open, c.close));
    const bodiesLow = candles.map(c => Math.min(c.open, c.close));

    for (let i = pivotPeriod; i < candles.length - pivotPeriod; i++) {
        let isHigh = true;
        let isLow = true;
        for (let j = 1; j <= pivotPeriod; j++) {
            if (bodiesHigh[i] <= bodiesHigh[i - j] || bodiesHigh[i] <= bodiesHigh[i + j]) isHigh = false;
            if (bodiesLow[i] >= bodiesLow[i - j] || bodiesLow[i] >= bodiesLow[i + j]) isLow = false;
        }
        if (isHigh) highPivots.push({ index: i, price: bodiesHigh[i], time: candles[i].time });
        if (isLow) lowPivots.push({ index: i, price: bodiesLow[i], time: candles[i].time });
    }

    // Support / Resistance Levels (Clustering pivots)
    const levels = [];
    const allPivots = [...highPivots, ...lowPivots].sort((a, b) => b.price - a.price);
    const threshold = candles[candles.length - 1].close * 0.015; // 1.5% threshold for Jakarta market usually works

    const clusters = [];
    allPivots.forEach(p => {
        let added = false;
        for (const cluster of clusters) {
            const avg = cluster.reduce((sum, cp) => sum + cp.price, 0) / cluster.length;
            if (Math.abs(p.price - avg) < threshold) {
                cluster.push(p);
                added = true;
                break;
            }
        }
        if (!added) clusters.push([p]);
    });

    clusters.forEach(cluster => {
        if (cluster.length >= 2) {
            const avgPrice = cluster.reduce((sum, p) => sum + p.price, 0) / cluster.length;
            const currentPrice = candles[candles.length - 1].close;

            // Check for recent breaches (last 30 candles)
            const recentHistory = candles.slice(-30);
            let isBroken = false;

            // A level is "broken" if more than 2 candles in the recent history have 
            // completely crossed it (Low > level for resistance, or High < level for support)
            // or if the current price has crossed it from the previous candle.

            let crosses = 0;
            recentHistory.forEach((c, idx) => {
                if (c.low < avgPrice && c.high > avgPrice) crosses++;

                // If it's resistance, and price closed above it
                if (avgPrice > candles[candles.length - 10].close && c.close > avgPrice * 1.01) isBroken = true;
                // If it's support, and price closed below it
                if (avgPrice < candles[candles.length - 10].close && c.close < avgPrice * 0.99) isBroken = true;
            });

            if (isBroken || crosses > 5) return;

            // Immediate breach check (last 2 candles)
            const prevPrice = candles[candles.length - 2].close;
            if ((prevPrice < avgPrice && currentPrice > avgPrice) ||
                (prevPrice > avgPrice && currentPrice < avgPrice)) {
                return;
            }

            levels.push({
                price: avgPrice,
                strength: cluster.length,
                type: avgPrice > currentPrice ? 'resistance' : 'support'
            });
        }
    });

    // Trendlines (Simplified: Connect recent major pivots and extend to last candle)
    const trendlines = [];
    const lastCandle = candles[candles.length - 1];

    if (highPivots.length >= 2) {
        const p1 = highPivots[highPivots.length - 2];
        const p2 = highPivots[highPivots.length - 1];

        // Calculate slope: (y2 - y1) / (x2 - x1)
        const slope = (p2.price - p1.price) / (p2.index - p1.index);
        // Extend to last candle index
        const extPrice = p2.price + slope * (candles.length - 1 - p2.index);

        trendlines.push({
            p1: { time: p1.time, price: p1.price },
            p2: { time: lastCandle.time, price: extPrice },
            type: 'resistance'
        });
    }
    if (lowPivots.length >= 2) {
        const p1 = lowPivots[lowPivots.length - 2];
        const p2 = lowPivots[lowPivots.length - 1];

        const slope = (p2.price - p1.price) / (p2.index - p1.index);
        const extPrice = p2.price + slope * (candles.length - 1 - p2.index);

        trendlines.push({
            p1: { time: p1.time, price: p1.price },
            p2: { time: lastCandle.time, price: extPrice },
            type: 'support'
        });
    }

    return { levels, trendlines };
}

module.exports = { getChartData };
