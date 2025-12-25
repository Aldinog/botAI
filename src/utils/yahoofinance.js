const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });
// suppressNotices might not be available or needed on new instance, removing for now to be safe

/**
 * Fetch last N daily candles from Yahoo Finance
 */
async function fetchHistorical(symbol, opts = {}) {
    // Ensure .JK suffix if missing
    let query = symbol;
    if (!query.endsWith(".JK") && !query.includes(".")) {
        query = `${query}.JK`;
    }

    // Default options
    const limit = opts.limit || 100;
    let interval = opts.interval || '1d';

    // Normalize interval for chart endpoint (1h -> 60m is safer)
    if (interval === '1h') interval = '60m';

    // Date Logic
    // For chart endpoint, period1 is required.
    const fromDate = new Date();
    if (interval === '60m' || interval === '1h') {
        fromDate.setDate(fromDate.getDate() - 60); // 60 days
    } else {
        fromDate.setDate(fromDate.getDate() - 730); // 2 years
    }

    const queryOptions = {
        period1: fromDate,
        // period2: new Date(), // Optional, defaults to now
        interval: interval
    };

    try {
        // Use chart() instead of historical() for better support (Intraday)
        const result = await yahooFinance.chart(query, queryOptions);

        if (!result || !result.quotes || result.quotes.length === 0) return [];

        // Map to our format: { time, open, high, low, close, volume }
        const formatted = result.quotes.map(q => ({
            // Lightweight Charts expects seconds for intraday, or YYYY-MM-DD for daily
            // chart() returns q.date as Date object usually
            time: (interval === '1d' || interval === '1wk' || interval === '1mo')
                ? q.date.toISOString().split('T')[0]
                : Math.floor(new Date(q.date).getTime() / 1000),
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
            volume: q.volume
        })).filter(q => q.open != null && q.close != null); // Filter incomplete candles

        // Return sliced if limit requested
        if (opts.limit) return formatted.slice(-opts.limit);
        return formatted;

    } catch (err) {
        console.error(`YF Error for ${query}:`, err.message);
        return [];
    }
}

async function fetchBrokerSummaryWithFallback(symbol) {
    return {
        success: false,
        message: "Fitur Broksum tidak tersedia di Yahoo Finance."
    };
}

// ======================
// PROXY BROKER ACTIVITY
// ======================

// Simple moving average
function sma(values, length) {
    if (values.length < length) return null;
    const slice = values.slice(-length);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * Menganalisis aktivitas besar berdasarkan OHLC (Proxy Broker)
 */
function analyzeProxyBrokerActivity(candles) {
    if (!candles || candles.length === 0) return [];

    const result = [];
    const volumes = [];

    for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        volumes.push(c.volume);

        const avgVol = sma(volumes, 20);
        if (!avgVol) continue;

        let signals = [];

        const isBigActivity = c.volume > avgVol * 2;
        const strength = (c.close - c.open) / ((c.high - c.low) || 1);

        if (isBigActivity) {
            if (c.close > c.open) signals.push("BIG BUY (Akumulasi Besar)");
            else if (c.close < c.open) signals.push("BIG SELL (Distribusi Besar)");
        }

        if (strength > 0.6) signals.push("Buyer Dominan (Bull Strength)");
        if (strength < -0.6) signals.push("Seller Dominan (Bear Strength)");

        // Breakout volume
        const prevHighs = candles.slice(Math.max(0, i - 20), i).map(x => x.high);
        const highest20 = prevHighs.length ? Math.max(...prevHighs) : null;

        if (highest20 && c.close > highest20 && c.volume > avgVol * 1.5) {
            signals.push("Breakout Kuat (Volume Tinggi)");
        }

        if (signals.length > 0) {
            result.push({
                date: c.time,
                volume: c.volume,
                avgVol,
                strength,
                signals
            });
        }
    }

    return result;
}

/**
 * Format output siap kirim Telegram (HTML)
 */
function formatProxyBrokerActivity(symbol, activity) {
    if (!activity || activity.length === 0) {
        return `📊 <b>Proxy Broker Activity - ${symbol}</b>\n\nTidak ada aktivitas signifikan terdeteksi.`;
    }

    let text = `📊 <b>Proxy Broker Activity - ${symbol}</b>\n\n`;

    // Ambil 5 sinyal terbaru
    const latest = activity.slice(-5);

    latest.forEach(a => {
        text += `🕒 <b>${a.date}</b>\n`;
        text += `• Volume: ${a.volume.toLocaleString()} (Avg: ${Math.round(a.avgVol).toLocaleString()})\n`;
        text += `• Strength: ${a.strength.toFixed(2)}\n`;
        text += `• Signals:\n`;

        a.signals.forEach(sig => {
            text += `   - ${sig}\n`;
        });

        text += `\n`;
    });

    return text.trim();
}


async function fetchProfile(symbol) {
    let query = symbol;
    if (!query.endsWith(".JK") && !query.includes(".")) {
        query = `${query}.JK`;
    }

    try {
        const result = await yahooFinance.quoteSummary(query, {
            modules: ["assetProfile", "price", "summaryProfile"]
        });

        if (!result) return null;

        const profile = result.assetProfile || result.summaryProfile || {};
        const price = result.price || {};

        return {
            symbol: query,
            name: price.longName || price.shortName,
            sector: profile.sector,
            industry: profile.industry,
            summary: profile.longBusinessSummary || profile.description || "N/A",
            website: profile.website,
            city: profile.city,
            country: profile.country,
            employees: profile.fullTimeEmployees
        };
    } catch (err) {
        console.error(`YF Profile Error for ${query}:`, err.message);
        return null;
    }
}

function formatProfile(data) {
    if (!data) return "❌ Profil emiten tidak ditemukan.";

    return `🏢 <b>Profil Emiten: ${data.name} (${data.symbol.replace('.JK', '')})</b>\n\n` +
        `<b>Sektor:</b> ${data.sector || '-'}\n` +
        `<b>Industri:</b> ${data.industry || '-'}\n` +
        `<b>Lokasi:</b> ${data.city || '-'}, ${data.country || '-'}\n` +
        `<b>Karyawan:</b> ${data.employees ? data.employees.toLocaleString() : '-'}\n` +
        `<b>Website:</b> ${data.website || '-'}\n\n` +
        `<b>Tentang Perusahaan:</b>\n` +
        `<i>${data.summary.slice(0, 1000)}${data.summary.length > 1000 ? '...' : ''}</i>\n\n` +
        `<i>Data by Yahoo Finance</i>`;
}

module.exports = {
    fetchHistorical,
    fetchBrokerSummaryWithFallback,
    analyzeProxyBrokerActivity,
    formatProxyBrokerActivity,
    fetchQuote,
    fetchFundamentals,
    formatFundamentals,
    fetchProfile,
    formatProfile
};

async function fetchQuote(symbol) {
    let query = symbol;
    if (!query.endsWith(".JK") && !query.includes(".")) {
        query = `${query}.JK`;
    }

    try {
        const quote = await yahooFinance.quote(query);
        return quote;
    } catch (err) {
        console.error(`YF Quote Error for ${query}:`, err.message);
        return null;
    }
}

async function fetchFundamentals(symbol) {
    let query = symbol;
    if (!query.endsWith(".JK") && !query.includes(".")) {
        query = `${query}.JK`;
    }

    try {
        // Fetch valid modules for fundamentals
        const result = await yahooFinance.quoteSummary(query, {
            modules: ["summaryDetail", "defaultKeyStatistics", "financialData", "price"]
        });

        if (!result) return null;

        const summary = result.summaryDetail || {};
        const stats = result.defaultKeyStatistics || {};
        const fin = result.financialData || {};
        const price = result.price || {};

        return {
            symbol: query,
            name: price.longName || price.shortName,
            price: price.regularMarketPrice,
            marketCap: summary.marketCap,
            peRatio: summary.trailingPE,
            forwardPE: summary.forwardPE,
            pegRatio: stats.pegRatio,
            pbRatio: stats.priceToBook,
            roe: fin.returnOnEquity,
            divYield: summary.dividendYield,
            profitMargin: fin.profitMargins,
            revenue: fin.totalRevenue,
            beta: summary.beta,
            targetPrice: fin.targetMeanPrice
        };
    } catch (err) {
        console.error(`YF Fundamental Error for ${query}:`, err.message);
        return null;
    }
}

function formatFundamentals(data) {
    if (!data) return "❌ Data fundamental tidak ditemukan.";

    const fmtNum = (num) => num ? num.toLocaleString('id-ID') : '-';
    const fmtPct = (num) => num ? (num * 100).toFixed(2) + '%' : '-';
    // Helper for Trillion/Billion formatting (IDR usually)
    const fmtCap = (val) => {
        if (!val) return '-';
        if (val >= 1e12) return (val / 1e12).toFixed(2) + ' T';
        if (val >= 1e9) return (val / 1e9).toFixed(2) + ' M';
        return val.toLocaleString();
    };

    return `🏛 <b>Fundamental: ${data.name} (${data.symbol.replace('.JK', '')})</b>\n` +
        `Harga: ${fmtNum(data.price)}\n\n` +
        `<b>Valuation:</b>\n` +
        `• Market Cap: ${fmtCap(data.marketCap)}\n` +
        `• P/E Ratio: ${data.peRatio ? data.peRatio.toFixed(2) + 'x' : '-'}\n` +
        `• PBV Ratio: ${data.pbRatio ? data.pbRatio.toFixed(2) + 'x' : '-'}\n` +
        `• PEG Ratio: ${data.pegRatio ? data.pegRatio.toFixed(2) : '-'}\n\n` +
        `<b>Profitability:</b>\n` +
        `• ROE: ${fmtPct(data.roe)}\n` +
        `• Net Margin: ${fmtPct(data.profitMargin)}\n` +
        `• Dividend Yield: ${fmtPct(data.divYield)}\n\n` +
        `<b>Other:</b>\n` +
        `• Beta: ${data.beta ? data.beta.toFixed(2) : '-'}\n` +
        `• Target Price: ${fmtNum(data.targetPrice)}\n\n` +
        `<i>Data by Yahoo Finance</i>`;
}
