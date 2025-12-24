// api/cron/scanner.js
const { supabase } = require('../../src/utils/supabase');
const { fetchHistorical } = require('../../src/utils/yahoofinance');
const { computeIndicators, detectAdvancedSignal } = require('../../src/utils/indicators');
const { getChartData } = require('../../src/utils/charting');
const axios = require('axios');
const moment = require('moment-timezone');

module.exports = async (req, res) => {
    // 1. Time & Day Check (WIB: UTC+7)
    const now = moment().tz('Asia/Jakarta');
    const day = now.day(); // 0 (Sun) to 6 (Sat)
    const hour = now.hour();

    if (day === 0 || day === 6) {
        return res.status(200).json({ status: 'Weekend, skipping scan.' });
    }

    if (hour < 8 || hour > 16) {
        return res.status(200).json({ status: `Outside market hours (${hour}:00), skipping scan.` });
    }

    try {
        // 2. Fetch Symbols to Scan
        const { data: symbols, error: symError } = await supabase
            .from('monitor_symbols')
            .select('symbol')
            .eq('is_active', true);

        if (symError || !symbols) throw new Error('Failed to fetch monitor_symbols');

        // 3. Batching Logic: Get 10 symbols not scanned this hour
        const startOfHour = now.clone().startOf('hour');

        const { data: states, error: stateError } = await supabase
            .from('scan_state')
            .select('*');

        const scannedThisHour = states
            .filter(s => moment(s.last_scanned_at).isAfter(startOfHour))
            .map(s => s.symbol);

        const targetSymbols = symbols
            .filter(s => !scannedThisHour.includes(s.symbol))
            .slice(0, 10);

        if (targetSymbols.length === 0) {
            return res.status(200).json({ status: 'All symbols scanned for this hour.' });
        }

        console.log(`[SCANNER] Rotating: ${targetSymbols.map(s => s.symbol).join(', ')}`);

        let notificationsSent = 0;

        for (const { symbol } of targetSymbols) {
            try {
                // 4. Fetch Data (1h for precise signal, 1d for trend)
                // We use getChartData as it already has SR detection logic
                const chartData = await getChartData(symbol, '1h');
                if (!chartData.candles || chartData.candles.length < 30) continue;

                // 5. Detect Signal
                const indicators = computeIndicators(chartData.candles);
                const signal = detectAdvancedSignal(chartData.candles, indicators, chartData.levels);

                // 6. Record Scanned State
                await supabase.from('scan_state').upsert({
                    symbol,
                    last_scanned_at: now.toISOString(),
                    last_signal_action: signal.action,
                    last_signal_reason: signal.reason
                });

                // 7. Notify if Signal is valid and NEW
                const prevState = states.find(s => s.symbol === symbol);
                const isNewSignal = signal.action !== 'WAIT' && (!prevState || prevState.last_signal_action !== signal.action);

                if (isNewSignal) {
                    await sendTelegramNotification(symbol, signal, chartData);
                    notificationsSent++;

                    // Update sent timestamp
                    await supabase.from('scan_state').update({
                        last_signal_sent_at: now.toISOString()
                    }).eq('symbol', symbol);
                }

            } catch (err) {
                console.error(`Error scanning ${symbol}:`, err.message);
            }
        }

        res.status(200).json({
            success: true,
            scannedCount: targetSymbols.length,
            notificationsSent
        });

    } catch (error) {
        console.error('Scanner Cron Error:', error);
        res.status(500).json({ error: error.message });
    }
};

async function sendTelegramNotification(symbol, signal, chartData) {
    const token = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.CHAT_NOTIF || (process.env.GROUP_NOTIF ? process.env.GROUP_NOTIF.split(',')[0] : null);

    if (!token || !chatId) {
        console.warn('Telegram token or chat ID missing, skipping notification');
        return;
    }

    const price = chartData.candles[chartData.candles.length - 1].close;
    const MINI_APP_URL = `https://t.me/astonaicbot/astonmology?startapp=${symbol.replace('.JK', '')}`;

    // Find nearest Support for SL and Resistance for TP
    let sl = 'N/A';
    let tp = 'N/A';

    if (chartData.levels) {
        const sortedLevels = chartData.levels.sort((a, b) => a.price - b.price);
        const supportLevels = sortedLevels.filter(l => l.price < price).reverse();
        const resistanceLevels = sortedLevels.filter(l => l.price > price);

        if (supportLevels.length > 0) sl = Math.round(supportLevels[0].price);
        if (resistanceLevels.length > 0) tp = Math.round(resistanceLevels[0].price);
    }

    const message = `
🚀 <b>SIGNAL ${signal.action} DETECTED!</b>

🔹 <b>Emiten:</b> <code>${symbol.replace('.JK', '')}</code>
🔹 <b>Alasan:</b> ${signal.reason}
🔹 <b>Harga:</b> ${price}
🔹 <b>Suggested SL:</b> ${sl}
🔹 <b>Suggested TP:</b> ${tp}
🔹 <b>Strength:</b> ${signal.probability || 'Medium'}

📊 <b>Saran:</b> Cek chart selengkapnya di App.
    `;

    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🚀 Buka App", url: MINI_APP_URL }]
                ]
            }
        });
    } catch (err) {
        console.error('Telegram Notify Error:', err.response?.data || err.message);
    }
}
