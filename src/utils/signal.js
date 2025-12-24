const { fetchHistorical, analyzeProxyBrokerActivity } = require('./yahoofinance');
const { computeIndicators } = require('./indicators');
const { analyzeWithAI } = require('./ai');

/**
 * Generate a trading signal for a given symbol
 * @param {string} symbol
 * @returns {Promise<string>} HTML/Markdown response from Gemini
 */
async function generateSignal(symbol) {
    try {
        // 1. Fetch Data (200 candles for better indicator accuracy)
        const candles = await fetchHistorical(symbol, { limit: 200 });

        if (!candles || candles.length === 0) {
            return `❌ Data untuk ${symbol} tidak ditemukan atau pasar sedang tutup/gangguan.`;
        }

        // 2. Compute Indicators
        const indicators = computeIndicators(candles);

        // 3. Analyze Proxy Broker Activity
        // Use a subset of candles for proxy activity if needed, or pass all
        // analyzeProxyBrokerActivity uses internal logic (e.g. SMA 20) so 200 is fine
        const proxyActivity = analyzeProxyBrokerActivity(candles);

        // 4. Construct Prompt
        const latest = indicators.latest;

        // Format Proxy Summary for Prompt
        let proxySummary = "Tidak ada aktivitas signifikan.";
        const significantProxy = proxyActivity.filter(p => p.signals.length > 0);
        if (significantProxy.length > 0) {
            const recent = significantProxy.slice(-3); // Last 3 significant days
            proxySummary = recent.map(r =>
                `- Tgl ${r.date}: Volume ${r.volume}, Signals: ${r.signals.join(', ')}`
            ).join('\n');
        }

        const prompt = `
Role: Anda adalah AI Trading Assistant berpengalaman (Certified Technical Analyst).
Tugas: Analisa data berikut dan berikan SIGNAL TRADING yang actionable.

Data Saham: ${symbol}
Harga Terakhir: ${latest.latestClose}
Volume Terakhir: ${latest.latestVolume}

Indikator Teknikal:
- MA5: ${latest.MA5?.toFixed(2)}
- MA20: ${latest.MA20?.toFixed(2)}
- MA50: ${latest.MA50?.toFixed(2)}
- RSI(14): ${latest.RSI?.toFixed(2)}
- MACD: ${latest.MACD ? `Line ${latest.MACD.MACD?.toFixed(2)}, Signal ${latest.MACD.signal?.toFixed(2)}, Hist ${latest.MACD.histogram?.toFixed(2)}` : 'N/A'}
- Stochastic: ${latest.Stochastic ? `K ${latest.Stochastic.k?.toFixed(2)}, D ${latest.Stochastic.d?.toFixed(2)}` : 'N/A'}

Aktivitas Broker/Bandar (Proxy):
${proxySummary}

Instruksi Output:
Berikan output dalam format yang bersih dan tegas (Markdown/HTML friendly).
Struktur Wajib:

1. **KEPUTUSAN**: [BUY / SELL / WAIT] 
   (Pilih satu yang paling kuat berdasarkan data)

2. **SETUP TRADING** (Jika Buy/Sell):
   - **Entry Area**: [Range Harga]
   - **Stop Loss**: [Harga] (Wajib < entry untuk Buy)
   - **Take Profit 1**: [Harga] (RR min 1:1)
   - **Take Profit 2**: [Harga] (RR min 1:2)

3. **CONFIDENCE SCORE**: [0-100]%
   (Seberapa yakin anda dengan setup ini?)

4. **ANALISIS SINGKAT**:
   - Trend: [Bullish/Bearish/Sideways]
   - Validasi: Jelaskan alasan teknikal & bandarmologi singkat (max 3 poin).

PENTING:
- Jangan bertele-tele.
- Jika data tidak mendukung Entry (misal trend tidak jelas atau risiko tinggi), pilih WAIT.
- Validasi logika: Jangan sarankan BUY jika harga di bawah MA besar dan RSI Overbought, kecuali ada divergensi kuat.
- Tambahkan Disclaimer singkat agar trader tidak menerima mentah mentah dari AI tanpa validasi.
`;

        // 5. Call Gemini
        const result = await analyzeWithAI(prompt);
        return result;

    } catch (error) {
        console.error("Signal Generation Error:", error);
        return `❌ Gagal membuat signal untuk ${symbol}. Error: ${error.message}`;
    }
}

module.exports = { generateSignal };
