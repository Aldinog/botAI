// api/src/utils/indicators.js

const ti = require('technicalindicators');

function computeIndicators(candles) {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const ma5 = ti.SMA.calculate({ period: 5, values: closes });
  const ma20 = ti.SMA.calculate({ period: 20, values: closes });
  const ma50 = ti.SMA.calculate({ period: 50, values: closes });

  // Add EMA calculations
  const ema20 = ti.EMA.calculate({ period: 20, values: closes });
  const ema50 = ti.EMA.calculate({ period: 50, values: closes });

  const rsi = ti.RSI.calculate({ period: 14, values: closes });

  const macd = ti.MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });

  const stochastic = ti.Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14,
    signalPeriod: 3
  });

  const latest = {
    latestClose: closes[closes.length - 1],
    latestVolume: volumes[volumes.length - 1],
    MA5: ma5.length ? ma5[ma5.length - 1] : undefined,
    MA20: ma20.length ? ma20[ma20.length - 1] : undefined,
    MA50: ma50.length ? ma50[ma50.length - 1] : undefined,
    EMA20: ema20.length ? ema20[ema20.length - 1] : undefined,
    EMA50: ema50.length ? ema50[ema50.length - 1] : undefined,
    RSI: rsi.length ? rsi[rsi.length - 1] : undefined,
    MACD: macd.length ? macd[macd.length - 1] : undefined, // object {MACD, signal, histogram}
    Stochastic: stochastic.length ? stochastic[stochastic.length - 1] : undefined // object {k, d}
  };

  return {
    all: { ma5, ma20, ma50, ema20, ema50, rsi, macd, stochastic },
    latest
  };
}

function formatIndicatorsForPrompt(symbol, indicators) {
  const latest = indicators.latest;
  const lines = [];

  lines.push(`Analisa teknikal untuk ${symbol}:`);
  lines.push(`Harga terakhir: ${num(latest.latestClose)}`);
  lines.push(`Volume terakhir: ${num(latest.latestVolume)}`);
  lines.push(`MA5: ${num(latest.MA5)}`);
  lines.push(`MA20: ${num(latest.MA20)}`);
  lines.push(`MA50: ${num(latest.MA50)}`);
  lines.push(`RSI(14): ${num(latest.RSI)}`);
  if (latest.MACD) {
    lines.push(`MACD: macd=${num(latest.MACD.MACD)}, signal=${num(latest.MACD.signal)}, hist=${num(latest.MACD.histogram)}`);
  } else {
    lines.push('MACD: tidak tersedia');
  }
  if (latest.Stochastic) {
    lines.push(`Stochastic: %K=${num(latest.Stochastic.k)}, %D=${num(latest.Stochastic.d)}`);
  } else {
    lines.push('Stochastic: tidak tersedia');
  }

  lines.push('');
  lines.push('Instruksi untuk analis AI:');
  lines.push('Buat analisa teknikal lengkap dan terstruktur berdasarkan indikator di atas. Sertakan:');
  lines.push('1) Trend utama (long-term & short-term) — jelaskan dasar teknikalnya.');
  lines.push('2) Sinyal dari MA (golden/death cross jika ada), RSI (overbought/oversold), MACD (crossover/histogram), Stochastic (k/d).');
  lines.push('3) Level support dan resistance yang bisa diidentifikasi dari harga terakhir dan MA (sebisa mungkin berikan angka).');
  lines.push('4) Rekomendasi trading teknikal: entry zone, stoploss, dan take profit (sertakan rasio risiko/imbalan jika memungkinkan).');
  lines.push('5) Risiko utama yang harus diperhatikan.');
  lines.push('');
  lines.push('Format jawaban: gunakan sections, bullet points, dan ringkasan akhir. Singkat, jelas, dan teknikal.');

  return lines.join('\n');
}

function num(v) {
  return (v === undefined || v === null || Number.isNaN(v)) ? 'N/A' : (Math.round(v * 100) / 100).toString();
}

module.exports = { computeIndicators, formatIndicatorsForPrompt };
