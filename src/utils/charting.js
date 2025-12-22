const { fetchHistorical } = require('./yahoofinance');
const { SMA } = require('technicalindicators');

async function getChartData(symbol, interval = '1d') {
    // 1. Fetch Data (Get ~200 candles for ample indicator calc)
    const candles = await fetchHistorical(symbol, { interval, limit: 300 });

    if (!candles || candles.length < 50) {
        return { candles: [], markers: [] };
    }

    // 2. Prepare Data for Indicators
    const closes = candles.map(c => c.close);

    // 3. Calculate Indicators
    const ma20 = SMA.calculate({ period: 20, values: closes });
    const ma50 = SMA.calculate({ period: 50, values: closes });

    // Align Arrays:
    // SMA result is shorter than input by (period - 1).
    // We need to match index i of SMA result with index j of candles.
    // Index 0 of ma20 corresponds to index 19 of candles.

    const markers = [];
    const minLen = Math.min(ma20.length, ma50.length);

    // Loop through the intersection of data
    // We compare [i] and [i-1] to detect crossover.
    // Offset for candles index
    const ma20Offset = 20 - 1;
    const ma50Offset = 50 - 1;

    // Because MA50 defines the valid range starting point
    // We start loop from 1 (to check i-1) relative to the SHORTEST array (ma50)
    for (let i = 1; i < ma50.length; i++) {
        const currMsg50 = ma50[i];
        const prevMsg50 = ma50[i - 1];

        // Find corresponding MA20 values.
        // Identify the candle index for ma50[i]:
        const candleIdx = i + ma50Offset;

        // Identify corresponding index in ma20 array:
        // candleIdx = k + ma20Offset => k = candleIdx - ma20Offset
        const ma20Idx = candleIdx - ma20Offset;

        const currMsg20 = ma20[ma20Idx];
        const prevMsg20 = ma20[ma20Idx - 1];

        if (!currMsg20 || !prevMsg20) continue;

        // Logic: Golden Cross (20 crosses above 50)
        const isGoldenCross = (prevMsg20 <= prevMsg50) && (currMsg20 > currMsg50);
        // Logic: Death Cross (20 crosses below 50)
        const isDeathCross = (prevMsg20 >= prevMsg50) && (currMsg20 < currMsg50);

        if (isGoldenCross) {
            markers.push({
                time: candles[candleIdx].time,
                position: 'belowBar',
                color: '#22c55e', // Green
                shape: 'arrowUp',
                text: 'BUY'
            });
        } else if (isDeathCross) {
            markers.push({
                time: candles[candleIdx].time,
                position: 'aboveBar',
                color: '#ef4444', // Red
                shape: 'arrowDown',
                text: 'SELL'
            });
        }
    }

    // Return Candles (all of them, or maybe trim purely empty indicator ones? No keep all for context)
    return {
        candles,
        markers,
        // Optional: Return MA lines too if we want to draw them later
        // lines: { ma20, ma50 }
    };
}

module.exports = { getChartData };
