const { Telegraf } = require('telegraf');
const { runScreener, getTopMovers } = require('../../src/utils/screener');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Helper safe send
async function sendSafe(chatId, text) {
    try {
        await bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (e) {
        console.error(`Failed to send to ${chatId}:`, e.message);
    }
}

module.exports = async (req, res) => {
    // 1. Validation (Optional but recommended for Cron)
    // if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    //    return res.status(401).send('Unauthorized');
    // }

    // 2. Run Screener
    let results = [];
    try {
        results = await runScreener();
    } catch (e) {
        console.error("Screener crashed:", e);
        return res.status(500).send("Screener Error");
    }

    // 3. Prepare Message 
    let message = "🤖 <b>Daily Market Screener</b> 🇮🇩\n";
    message += `📅 ${new Date().toLocaleDateString('id-ID')}\n\n`;

    // 4. If results found
    if (results.length > 0) {
        message += "🔍 <b>Pattern Detected:</b>\n\n";
        results.forEach(r => {
            message += `📌 <b>${r.symbol.replace('.JK', '')}</b> (${r.reason})\n`;
            message += `   • Price: ${r.price}\n`;
            message += `   • Pattern: ${r.pattern}\n`;
            message += `   • RSI: ${r.rsi} | EMA20: ${r.ema20.toLocaleString()}\n\n`;
        });
    } else {
        message += "ℹ <i>Tidak ada pola candlestick signifikan yang ditemukan hari ini pada watchlist utama.</i>\n\n";
    }

    // 5. Always Append Top Movers (Fallback/Add-on)
    try {
        message += "📊 <b>Market Snapshot</b>\n";
        const { gainers, losers } = await getTopMovers();

        if (gainers.length > 0) {
            message += "\n🚀 <b>Top Gainers:</b>\n";
            gainers.forEach(g => {
                message += `• ${g.symbol.replace('.JK', '')}: ${g.price} (${g.changePercent > 0 ? '+' : ''}${g.changePercent.toFixed(2)}%)\n`;
            });
        }

        if (losers.length > 0) {
            message += "\n🔻 <b>Top Losers:</b>\n";
            losers.forEach(l => {
                message += `• ${l.symbol.replace('.JK', '')}: ${l.price} (${l.changePercent > 0 ? '+' : ''}${l.changePercent.toFixed(2)}%)\n`;
            });
        }
    } catch (e) {
        console.error("Fallback error:", e);
    }

    message += "\n💡 <i>Disclaimer: Not a financial advice. Do your own research.</i>";

    // 6. Send to Group(s)
    // We need a target chat ID. Ideally this is configured in ENV or we broadcast to known groups.
    // For now, let's look for a BROADCAST_CHAT_ID or similar in env, or fail silently/log.
    const targetChatId = process.env.TELEGRAM_CHANNEL_ID || process.env.GROUP_ID_TEST; // Add this specific var to your .env

    if (targetChatId) {
        await sendSafe(targetChatId, message);
    } else {
        console.log("No TELEGRAM_CHANNEL_ID configured. Result:", message);
    }

    res.status(200).json({
        status: 'ok',
        scanned: 35,
        matches: results.length,
        messagePreview: message
    });
};
