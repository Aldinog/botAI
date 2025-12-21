const { runScreener, getTopMovers } = require('./src/utils/screener');

async function test() {
    console.log("🚀 Starting Screener Test (35 Stocks)...");
    console.time("Screener Execution Time");

    try {
        const results = await runScreener();
        console.timeEnd("Screener Execution Time");

        console.log("\n🔍 Screening Results:");
        if (results.length === 0) {
            console.log("No patterns detected.");
        } else {
            results.forEach(r => {
                console.log(`[${r.symbol}] ${r.pattern} | RSI:${r.rsi} EMA20:${r.ema20}`);
            });
        }

        console.log("\n📊 Testing Top Movers Fallback...");
        const movers = await getTopMovers();
        console.log("Top Gainers:", movers.gainers ? movers.gainers.length : 0);
        console.log("Top Losers:", movers.losers ? movers.losers.length : 0);

    } catch (err) {
        console.error("Test Failed:", err);
    }
}

test();
