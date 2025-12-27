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
        // 1. Check Cache in Supabase
        const { supabase } = require('./supabase');
        const { data: cache } = await supabase
            .from('stock_fundamentals')
            .select('*')
            .eq('symbol', query)
            .single();

        const CACHE_HOURS = 24;
        if (cache && cache.last_updated) {
            const lastUpdate = new Date(cache.last_updated);
            const now = new Date();
            const ageHours = (now - lastUpdate) / (1000 * 60 * 60);

            if (ageHours < CACHE_HOURS && cache.full_data) {
                console.log(`[CACHE HIT] Fundamental data for ${query} is ${Math.round(ageHours)}h old.`);
                return cache.full_data;
            }
        }

        console.log(`[CACHE MISS/EXPIRED] Fetching new fundamental data for ${query} from Yahoo Finance...`);

        // 2. Fetch from Yahoo Finance (Comprehensive Modules)
        const modules = [
            "assetProfile",
            "summaryProfile",
            "summaryDetail",
            "price",
            "defaultKeyStatistics",
            "financialData",
            "majorHoldersBreakdown",
            "insiderHolders",
            "earningsHistory",
            "earnings"
        ];

        const result = await yahooFinance.quoteSummary(query, { modules });
        if (!result) return null;

        // Structured extraction for easier handling
        const summary = result.summaryDetail || {};
        const stats = result.defaultKeyStatistics || {};
        const fin = result.financialData || {};
        const price = result.price || {};
        const profile = result.assetProfile || result.summaryProfile || {};

        const fullData = {
            symbol: query,
            name: price.longName || price.shortName,
            price: price.regularMarketPrice,
            currency: price.currency,
            profile: {
                sector: profile.sector,
                industry: profile.industry,
                summary: profile.longBusinessSummary || profile.description || "N/A",
                website: profile.website,
                city: profile.city,
                country: profile.country,
                employees: profile.fullTimeEmployees
            },
            valuation: {
                marketCap: summary.marketCap,
                peRatio: summary.trailingPE,
                forwardPE: summary.forwardPE,
                pegRatio: stats.pegRatio,
                pbRatio: stats.priceToBook,
                enterpriceValue: stats.enterpriseValue,
                evToRevenue: stats.enterpriseToRevenue,
                evToEbitda: stats.enterpriseToEbitda
            },
            growth: {
                revenueGrowth: fin.revenueGrowth,
                earningsGrowth: fin.earningsGrowth,
                revenueGrowthQuarterly: fin.revenueGrowth, // Note: Often same in this module, but we mark it
                earningsGrowthQuarterly: fin.earningsGrowth
            },
            profitability: {
                roe: fin.returnOnEquity,
                roa: fin.returnOnAssets,
                grossMargin: fin.grossMargins,
                operatingMargin: fin.operatingMargins,
                profitMargin: fin.profitMargins
            },
            cashflow: {
                totalCash: fin.totalCash,
                totalDebt: fin.totalDebt,
                operatingCashflow: fin.operatingCashflow,
                freeCashflow: fin.freeCashflow,
                quickRatio: fin.quickRatio,
                currentRatio: fin.currentRatio
            },
            holders: result.majorHoldersBreakdown || {},
            earnings: result.earningsHistory || {},
            quarterly: result.earnings && result.earnings.financialsChart ? result.earnings.financialsChart.quarterly : [],
            target: {
                mean: fin.targetMeanPrice,
                median: fin.targetMedianPrice,
                rec: fin.recommendationKey
            }
        };

        // 3. Update Cache in Supabase
        await supabase.from('stock_fundamentals').upsert({
            symbol: query,
            name: fullData.name,
            sector: fullData.profile.sector,
            industry: fullData.profile.industry,
            summary: fullData.profile.summary,
            full_data: fullData,
            last_updated: new Date().toISOString()
        });

        return fullData;
    } catch (err) {
        console.error(`YF Fundamental Error for ${query}:`, err.message);
        return null;
    }
}

function formatFundamentals(data) {
    if (!data) return "❌ Data fundamental tidak ditemukan.";

    // Check if it's returning the full object (new version) or old version
    // If it has 'valuation' key, it's the new full data
    if (data.valuation) {
        // For the bot response, we'll keep it concise but improved.
        // Detailed data will be on the NEW PAGE.

        const fmtNum = (num) => num != null ? num.toLocaleString('id-ID') : '-';
        const fmtPct = (num) => num != null ? (num * 100).toFixed(2) + '%' : '-';
        const fmtCap = (val) => {
            if (val == null) return '-';
            if (val >= 1e12) return (val / 1e12).toFixed(2) + ' T';
            if (val >= 1e9) return (val / 1e9).toFixed(2) + ' M';
            return val.toLocaleString();
        };

        return `🏛 <b>Fundamental: ${data.name} (${data.symbol.replace('.JK', '')})</b>\n` +
            `Harga: ${fmtNum(data.price)} ${data.currency || ''}\n\n` +
            `<b>Valuation:</b>\n` +
            `• Market Cap: ${fmtCap(data.valuation.marketCap)}\n` +
            `• P/E Ratio: ${data.valuation.peRatio ? data.valuation.peRatio.toFixed(2) + 'x' : '-'}\n` +
            `• PBV Ratio: ${data.valuation.pbRatio ? data.valuation.pbRatio.toFixed(2) + 'x' : '-'}\n\n` +
            `<b>Profitability:</b>\n` +
            `• ROE: ${fmtPct(data.profitability.roe)}\n` +
            `• Net Margin: ${fmtPct(data.profitability.profitMargin)}\n\n` +
            `<b>Cash Flow:</b>\n` +
            `• Operating CF: ${fmtCap(data.cashflow.operatingCashflow)}\n\n` +
            `<i>Data lebih lengkap tersedia di halaman Fundamental.</i>`;
    }

    // Fallback for old data structure if any
    return "❌ Format data tidak valid.";
}
