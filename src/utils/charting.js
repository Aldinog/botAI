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
    const rsi9 = RSI.calculate({ period: 9, values: closes });
    const atr14 = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
    const smaVol20 = SMA.calculate({ period: 20, values: volumes });

    const markers = [];
    let lastSignal = null;

    // Helper to align indicator values
    const getVal = (arr, candleIdx) => {
        const offset = candles.length - arr.length;
        const idx = candleIdx - offset;
        if (idx < 0 || idx >= arr.length) return null;
        return arr[idx];
    };

    // 4. Iterate and Generate Signals
    for (let i = 21; i < candles.length; i++) {
        const curr = candles[i];

        const e9 = getVal(ema9, i);
        const e21 = getVal(ema21, i);
        const rsi = getVal(rsi9, i);
        const vol20 = getVal(smaVol20, i);

        if (e9 === null || e21 === null || rsi === null || vol20 === null) continue;

        // --- FILTERS ---

        // A. Volume Spike Filter
        const isHighVol = curr.volume > vol20 * 1.2; // 20% higher than average

        // B. Candle Strength (Body >= 50% of Range)
        const range = curr.high - curr.low;
        const body = Math.abs(curr.close - curr.open);
        const isStrong = range > 0 && (body / range >= 0.5);

        // C. MTF Trend Filter (Only for Intraday)
        let trendOk = true;
        if (dailyTrend === 'bullish' && curr.close < e21) trendOk = false; // logic tweak: allow if above e21
        // Keep it simple as per plan: H1 signal must follow Daily trend
        const isBullishTrend = e9 > e21 && (interval !== '60m' || dailyTrend !== 'bearish');
        const isBearishTrend = e9 < e21 && (interval !== '60m' || dailyTrend !== 'bullish');

        // --- SIGNAL LOGIC ---

        // BUY Signal
        const buySignal = isBullishTrend &&
            rsi > 50 &&
            curr.close > curr.open &&
            isHighVol &&
            isStrong;

        // SELL Signal
        const sellSignal = isBearishTrend &&
            rsi < 50 &&
            curr.close < curr.open &&
            isHighVol &&
            isStrong;

        if (buySignal && lastSignal !== 'BUY') {
            markers.push({
                time: curr.time,
                position: 'belowBar',
                color: '#22c55e',
                shape: 'arrowUp',
                text: 'BUY'
            });
            lastSignal = 'BUY';
        } else if (sellSignal && lastSignal !== 'SELL') {
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

    return {
        candles,
        markers
    };
}

module.exports = { getChartData };
