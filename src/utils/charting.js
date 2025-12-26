const { fetchHistorical, fetchProfile } = require('./yahoofinance');
const { EMA } = require('technicalindicators');
const { computeIndicators, detectAdvancedSignal } = require('./indicators');

async function getChartData(symbol, interval = '1d', limit = 300) {
    console.log(`[CHART] Request: ${symbol} ${interval} Limit: ${limit}`);

    // 1. Fetch Primary Data
    const candles = await fetchHistorical(symbol, { interval, limit });

    // Fetch profile for name synchronously to keep response unified
    const profile = await fetchProfile(symbol);
    const companyName = profile ? profile.name : symbol;

    if (!candles || candles.length < 30) {
        return { candles: [], markers: [], levels: [], companyName };
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

    // 3. Prepare Indicators & S/R Levels
    const indicators = computeIndicators(candles);
    const { levels, trendlines } = detectSRandTrendlines(candles);

    // 4. Generate Markers
    const markers = [];
    let lastSignal = null;
    let lastSignalIndex = 0;
    let consecutiveCount = 0;

    for (let i = 21; i < candles.length; i++) {
        const signal = detectAdvancedSignal(candles, indicators.all, i, levels);

        if (signal.action === 'BUY') {
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
                    time: candles[i].time,
                    position: 'belowBar',
                    color: '#22c55e',
                    shape: 'arrowUp',
                    text: 'BUY'
                });
                lastSignal = 'BUY';
                lastSignalIndex = i;
            }
        } else if (signal.action === 'SELL') {
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
                    time: candles[i].time,
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

    return { candles, markers, levels, dailyTrend, trendlines, companyName };
}

/**
 * Detects Support/Resistance levels and Trendlines
 */
function detectSRandTrendlines(candles) {
    if (candles.length < 50) return { levels: [], trendlines: [] };

    const pivotPeriod = 5;
    const highPivots = [];
    const lowPivots = [];

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

    const levels = [];
    const allPivots = [...highPivots, ...lowPivots].sort((a, b) => b.price - a.price);
    const lastClose = candles[candles.length - 1].close;
    const threshold = lastClose * 0.015;

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

            // Breach check
            const recentHistory = candles.slice(-30);
            let isBroken = false;
            let crosses = 0;

            recentHistory.forEach(c => {
                if (c.low < avgPrice && c.high > avgPrice) crosses++;
                if (avgPrice > lastClose && c.close > avgPrice * 1.01) isBroken = true;
                if (avgPrice < lastClose && c.close < avgPrice * 0.99) isBroken = true;
            });

            if (isBroken || crosses > 8) return;

            levels.push({
                price: avgPrice,
                strength: cluster.length,
                type: avgPrice > lastClose ? 'resistance' : 'support'
            });
        }
    });

    const trendlines = [];
    if (highPivots.length >= 2) {
        const p1 = highPivots[highPivots.length - 2];
        const p2 = highPivots[highPivots.length - 1];
        const slope = (p2.price - p1.price) / (p2.index - p1.index);
        const extPrice = p2.price + slope * (candles.length - 1 - p2.index);
        trendlines.push({
            p1: { time: p1.time, price: p1.price },
            p2: { time: candles[candles.length - 1].time, price: extPrice },
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
            p2: { time: candles[candles.length - 1].time, price: extPrice },
            type: 'support'
        });
    }

    return { levels, trendlines };
}

module.exports = { getChartData };
