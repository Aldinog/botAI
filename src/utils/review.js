const { fetchHistorical, analyzeProxyBrokerActivity } = require('./yahoofinance');
const { computeIndicators } = require('./indicators');
const { analyzeWithAI } = require('./ai');

/**
 * Identify Key Swing Points (Highs and Lows)
 * Basic Pivot Logic: High > prev & High > next (simplified for 200 candles)
 */
function getSwings(candles, period = 5) {
    const swings = [];
    for (let i = period; i < candles.length - period; i++) {
        const current = candles[i];
        const isHigh = candles.slice(i - period, i + period + 1).every(c => c.high <= current.high);
        const isLow = candles.slice(i - period, i + period + 1).every(c => c.low >= current.low);

        if (isHigh) swings.push({ type: 'HIGH', price: current.high, index: i, time: current.time });
        if (isLow) swings.push({ type: 'LOW', price: current.low, index: i, time: current.time });
    }
    return swings;
}

/**
 * Identify Nearest Resistance/Support from recent swings
 */
function getNearestLevel(price, swings, type) {
    // For Buy: Resistance is closest Swing High > Price
    // For Sell: Support is closest Swing Low < Price
    // Look at recent swings (e.g. last 50 candles approx, or just all identified swings)

    // Filter relevant swings
    let candidates = [];
    if (type === 'RESISTANCE') {
        candidates = swings.filter(s => s.type === 'HIGH' && s.price > price);
        candidates.sort((a, b) => a.price - b.price); // Lowest above price
    } else {
        candidates = swings.filter(s => s.type === 'LOW' && s.price < price);
        candidates.sort((a, b) => b.price - a.price); // Highest below price
    }

    return candidates.length > 0 ? candidates[0].price : null;
}

async function generateReview(action, symbol, entryPrice, slPrice = null) {
    try {
        action = action.toUpperCase(); // BUY or SELL
        entryPrice = parseFloat(entryPrice);
        slPrice = slPrice ? parseFloat(slPrice) : null;

        // 1. Fetch Data
        const candles = await fetchHistorical(symbol, { limit: 200 });
        if (!candles || candles.length < 50) return "❌ Data tidak cukup untuk analisis.";

        const indicators = computeIndicators(candles);
        const latest = indicators.latest;

        // 2. SCORING ENGINE
        let score = 0;
        let details = {};

        // A. TREND (15pts) - MA20 vs MA50
        if (latest.MA20 && latest.MA50) {
            if (action === 'BUY') {
                if (latest.MA20 > latest.MA50) { score += 15; details.trend = "Bullish (+15)"; }
                else if (latest.MA20 < latest.MA50) { score -= 15; details.trend = "Bearish (-15)"; }
                else { score += 5; details.trend = "Sideways (+5)"; }
            } else { // SELL
                if (latest.MA20 < latest.MA50) { score += 15; details.trend = "Bearish (+15)"; }
                else if (latest.MA20 > latest.MA50) { score -= 15; details.trend = "Bullish (-15)"; }
                else { score += 5; details.trend = "Sideways (+5)"; }
            }
        }

        // B. STRUCTURE (10pts) - Recent Swings
        const swings = getSwings(candles, 3);
        const recentHighs = swings.filter(s => s.type === 'HIGH').slice(-2);
        const recentLows = swings.filter(s => s.type === 'LOW').slice(-2);

        let structureScore = 0;
        // Simple logic: check if last High/Low is higher/lower than previous
        if (recentHighs.length === 2 && recentLows.length === 2) {
            const hh = recentHighs[1].price > recentHighs[0].price;
            const hl = recentLows[1].price > recentLows[0].price;
            const lh = recentHighs[1].price < recentHighs[0].price;
            const ll = recentLows[1].price < recentLows[0].price;

            if (action === 'BUY') {
                if (hh && hl) { structureScore = 10; details.structure = "Higher High/Low (+10)"; }
                else if (lh && ll) { structureScore = -10; details.structure = "Lower High/Low (-10)"; }
                else { structureScore = 3; details.structure = "Mixed/Sideways (+3)"; }
            } else { // SELL
                if (lh && ll) { structureScore = 10; details.structure = "Lower High/Low (+10)"; }
                else if (hh && hl) { structureScore = -10; details.structure = "Higher High/Low (-10)"; }
                else { structureScore = 3; details.structure = "Mixed/Sideways (+3)"; }
            }
        } else {
            structureScore = 3; details.structure = "Neutral (+3)"; // Not enough swings
        }
        score += structureScore;

        // C. RESISTANCE / SUPPORT DISTANCE (20pts)
        // For BUY: How close to Resistance? (Closer = Bad reward potential usually? Or does user mean 'breakout'?)
        // User Rule: "Jarak ke Resistance (BUY)... 2% -> +20". 
        // Logic: Unlike standard "don't buy at resistance", user rules imply buying NEAR support or FAR from resistance?
        // Wait, user rule: "Jarak ke Resistance (BUY)... >2% -> +20, 1-2% -> +5, <1% -> -20"
        // Meaning: We want ROOM to correct/profit. If resistance is too close (<1%), it's bad.

        const nearestRes = getNearestLevel(entryPrice, swings, 'RESISTANCE');
        const nearestSup = getNearestLevel(entryPrice, swings, 'SUPPORT');

        // Default levels if not found (using session high/low as proxy fallback)
        const effectiveRes = nearestRes || (Math.max(...candles.slice(-20).map(c => c.high)) * 1.05);
        const effectiveSup = nearestSup || (Math.min(...candles.slice(-20).map(c => c.low)) * 0.95);

        let distScore = 0;
        if (action === 'BUY') {
            const distToRes = ((effectiveRes - entryPrice) / entryPrice) * 100;
            if (distToRes > 2) { distScore = 20; details.distance = `>2% to Res (+20)`; }
            else if (distToRes >= 1) { distScore = 5; details.distance = `1-2% to Res (+5)`; }
            else { distScore = -20; details.distance = `<1% to Res (-20)`; }
        } else {
            const distToSup = ((entryPrice - effectiveSup) / entryPrice) * 100;
            if (distToSup > 2) { distScore = 20; details.distance = `>2% to Sup (+20)`; }
            else if (distToSup >= 1) { distScore = 5; details.distance = `1-2% to Sup (+5)`; }
            else { distScore = -20; details.distance = `<1% to Sup (-20)`; }
        }
        score += distScore;

        // D. SUPPORT VALID (10pts) - Are we buying at/above support? (safe)
        // User rule: Entry above support -> +10, Entry below/too close break -> -10
        // Wait, "Entry below / terlalu dekat [bawah]" implies breakdown risk?
        // Let's assume: Buy needs to be ABOVE support (holding).
        let supScore = 0;
        if (action === 'BUY') {
            if (entryPrice > effectiveSup) { supScore = 10; details.support = "Above Support (+10)"; }
            else { supScore = -10; details.support = "Broken Support (-10)"; }
        } else { // SELL
            if (entryPrice < effectiveRes) { supScore = 10; details.support = "Below Resistance (+10)"; }
            else { supScore = -10; details.support = "Breakout Resistance (-10)"; }
        }
        score += supScore;

        // E. MOMENTUM (20pts)
        const macd = latest.MACD;
        const stoch = latest.Stochastic;
        let momScore = 0;
        let momNote = "";

        if (macd && stoch) {
            const macdBullish = macd.histogram > 0;
            const stochSafe = action === 'BUY' ? stoch.k < 80 : stoch.k > 20; // Not Overbought for Buy, Not Oversold for Sell

            if (action === 'BUY') {
                if (macdBullish && stochSafe) { momScore = 20; momNote = "Strong (+20)"; }
                else if (macdBullish || stochSafe) { momScore = 8; momNote = "Neutral (+8)"; }
                else { momScore = -20; momNote = "Weak/OB (-20)"; }
            } else {
                if (!macdBullish && stochSafe) { momScore = 20; momNote = "Strong Bearish (+20)"; }
                else if (!macdBullish || stochSafe) { momScore = 8; momNote = "Neutral (+8)"; }
                else { momScore = -20; momNote = "Weak/OS (-20)"; }
            }
        }
        score += momScore;
        details.momentum = momNote;

        // F. PROXY FLOW (20pts)
        const proxyStats = analyzeProxyBrokerActivity(candles); // returns array of days with signals
        // We need a summary of the 'current' state. analyzeProxyBrokerActivity returns historical events.
        // Let's look at the last 5 days for dominant flow.
        const recentProxy = proxyStats.slice(-5);
        let accumCount = 0;
        let distribCount = 0;

        recentProxy.forEach(p => {
            p.signals.forEach(s => {
                if (s.includes("BUY") || s.includes("Buyer")) accumCount++;
                if (s.includes("SELL") || s.includes("Seller")) distribCount++;
            });
        });

        let proxyScore = 0;
        let proxyNote = "Neutral";
        if (accumCount > distribCount) {
            if (action === 'BUY') { proxyScore = 20; proxyNote = "Accumulation (+20)"; }
            else { proxyScore = -20; proxyNote = "Accumulation vs Sell (-20)"; }
        } else if (distribCount > accumCount) {
            if (action === 'SELL') { proxyScore = 20; proxyNote = "Distribution (+20)"; }
            else { proxyScore = -20; proxyNote = "Distribution vs Buy (-20)"; }
        } else {
            proxyScore = 5; proxyNote = "Neutral (+5)";
        }
        score += proxyScore;
        details.proxy = proxyNote;

        // HARD RULE: BUY + Distribution
        const hardWarning = (action === 'BUY' && distribCount > accumCount);

        // G. RISK / REWARD (15pts)
        let rrScore = 0;
        let rrValue = 0;
        if (slPrice) {
            if (action === 'BUY') {
                // Reward = Dist to Res
                const reward = effectiveRes - entryPrice;
                const risk = entryPrice - slPrice;
                if (risk > 0) {
                    rrValue = reward / risk;
                    if (rrValue >= 2) { rrScore = 15; details.rr = `R:R ${rrValue.toFixed(2)} (+15)`; }
                    else if (rrValue >= 1.5) { rrScore = 5; details.rr = `R:R ${rrValue.toFixed(2)} (+5)`; }
                    else { rrScore = -15; details.rr = `R:R ${rrValue.toFixed(2)} (-15)`; }
                } else {
                    details.rr = "Invalid SL (Risk<=0)";
                }
            } else {
                // Sell
                const reward = entryPrice - effectiveSup;
                const risk = slPrice - entryPrice;
                if (risk > 0) {
                    rrValue = reward / risk;
                    if (rrValue >= 2) { rrScore = 15; details.rr = `R:R ${rrValue.toFixed(2)} (+15)`; }
                    else if (rrValue >= 1.5) { rrScore = 5; details.rr = `R:R ${rrValue.toFixed(2)} (+5)`; }
                    else { rrScore = -15; details.rr = `R:R ${rrValue.toFixed(2)} (-15)`; }
                } else {
                    details.rr = "Invalid SL";
                }
            }
        } else {
            details.rr = "No SL Provided (0)";
        }
        score += rrScore;

        // 3. CATEGORIZE
        let category = "";
        let color = "";
        if (score >= 80) { category = "Entry Berkualitas"; color = "🟢"; }
        else if (score >= 60) { category = "Entry Cukup"; color = "🟡"; }
        else if (score >= 40) { category = "Entry Lemah"; color = "🟠"; }
        else { category = "Entry Buruk"; color = "🔴"; }

        // 4. GENERATE NARRATIVE (Gemini)
        const prompt = `
Role: Senior Certified Technical Analyst.
Task: Create a TRADING REVIEW NARRATIVE (Bahasa Indonesia) based on this scoring data.

User Entry: ${action} ${symbol} @ ${entryPrice} (SL: ${slPrice || 'N/A'})
Technical Data:
- Last Price: ${latest.latestClose}
- MA20/50: ${latest.MA20?.toFixed(0)}/${latest.MA50?.toFixed(0)}
- MACD Hist: ${latest.MACD?.histogram?.toFixed(2)}
- Stochastic: ${latest.Stochastic?.k?.toFixed(1)}
- Nearest Res: ${Math.round(effectiveRes)}
- Nearest Sup: ${Math.round(effectiveSup)}

Scoring Components (${score}/110):
- Trend: ${details.trend}
- Structure: ${details.structure}
- Distance to Level: ${details.distance}
- Support Validity: ${details.support}
- Momentum: ${details.momentum}
- Proxy Flow: ${details.proxy}
- R:R: ${details.rr}

Safety Check:
${hardWarning ? "CRITICAL WARNING: Buying into Distribution flow!" : "No critical warnings."}

Output Format:
🧠 TRADE REVIEW – ${symbol}

Entry: ${entryPrice}
Trend: [Text based on MA data]
Broker Flow: [Text based on Proxy]

Score: ${score} / 110 (${category})

❌ [Major negative factor if any]
⚠️ [Risk factor if any, especially Hard Warnings]
✅ [Positive factor]

Saran:
[1-2 sentences practical advice]

AI Review:
"[Short, educational, professional narrative explaining WHY the score is high/low using technical terms properly. Max 3-4 lines.]"
`;

        let aiResponse = await analyzeWithAI(prompt);
        // Fallback or cleanup if AI fails
        if (!aiResponse) aiResponse = "Analisa AI tidak tersedia saat ini.";

        // Strip markdown code blocks if any
        return aiResponse.replace(/```/g, '').trim();

    } catch (err) {
        console.error("Generate Review Error:", err);
        return `❌ Gagal memproses review. Error: ${err.message}`;
    }
}

module.exports = { generateReview };
