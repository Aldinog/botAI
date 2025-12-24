// src/utils/indicators.js
const ti = require('technicalindicators');

/**
 * Computes all technical indicators for a set of candles
 */
function computeIndicators(candles) {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const ma5 = ti.SMA.calculate({ period: 5, values: closes });
  const ma20 = ti.SMA.calculate({ period: 20, values: closes });
  const ma50 = ti.SMA.calculate({ period: 50, values: closes });

  const ema9 = ti.EMA.calculate({ period: 9, values: closes });
  const ema21 = ti.EMA.calculate({ period: 21, values: closes });
  const ema10 = ti.EMA.calculate({ period: 10, values: closes });
  const ema20 = ti.EMA.calculate({ period: 20, values: closes });

  const rsi9 = ti.RSI.calculate({ period: 9, values: closes });
  const rsi14 = ti.RSI.calculate({ period: 14, values: closes });

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

  const atr14 = ti.ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
  const smaVol20 = ti.SMA.calculate({ period: 20, values: volumes });

  const latest = {
    latestClose: closes[closes.length - 1],
    latestVolume: volumes[volumes.length - 1],
    MA5: ma5.length ? ma5[ma5.length - 1] : undefined,
    MA20: ma20.length ? ma20[ma20.length - 1] : undefined,
    MA50: ma50.length ? ma50[ma50.length - 1] : undefined,
    EMA9: ema9.length ? ema9[ema9.length - 1] : undefined,
    EMA21: ema21.length ? ema21[ema21.length - 1] : undefined,
    EMA10: ema10.length ? ema10[ema10.length - 1] : undefined,
    EMA20: ema20.length ? ema20[ema20.length - 1] : undefined,
    RSI9: rsi9.length ? rsi9[rsi9.length - 1] : undefined,
    RSI: rsi14.length ? rsi14[rsi14.length - 1] : undefined,
    MACD: macd.length ? macd[macd.length - 1] : undefined,
    Stochastic: stochastic.length ? stochastic[stochastic.length - 1] : undefined,
    ATR: atr14.length ? atr14[atr14.length - 1] : undefined,
    SMAVol20: smaVol20.length ? smaVol20[smaVol20.length - 1] : undefined
  };

  return {
    all: { ma5, ma20, ma50, ema9, ema21, ema10, ema20, rsi9, rsi14, macd, stochastic, atr14, smaVol20 },
    latest
  };
}

/**
 * Advanced Signal Logic (Matching Smart Chart)
 * @param {Array} candles All candles
 * @param {Object} allIndicators Pre-computed indicator arrays
 * @param {number} i Index to check
 * @param {Array} levels S/R levels
 */
function detectAdvancedSignal(candles, allIndicators, i, levels = []) {
  if (i < 21) return { action: 'WAIT', reason: null };

  const curr = candles[i];
  const ind = allIndicators; // Reference for readability

  const e9 = ind.ema9[i - (candles.length - ind.ema9.length)];
  const e21 = ind.ema21[i - (candles.length - ind.ema21.length)];
  const e10 = ind.ema10[i - (candles.length - ind.ema10.length)];
  const e20 = ind.ema20[i - (candles.length - ind.ema20.length)];

  const e10prev = ind.ema10[i - 1 - (candles.length - ind.ema10.length)];
  const e20prev = ind.ema20[i - 1 - (candles.length - ind.ema20.length)];

  const rsi = ind.rsi9[i - (candles.length - ind.rsi9.length)];
  const vol20 = ind.smaVol20[i - (candles.length - ind.smaVol20.length)];
  const atr = ind.atr14[i - (candles.length - ind.atr14.length)];

  if (!e9 || !e21 || !e10 || !e20 || !rsi || !vol20 || !atr || !e10prev || !e20prev) {
    return { action: 'WAIT', reason: null };
  }

  // Filters
  const isHighVol = curr.volume > vol20 * 1.2;
  const range = curr.high - curr.low;
  const body = Math.abs(curr.close - curr.open);
  const isStrong = range > 0 && (body / range >= 0.5);
  const distFromEMA21 = Math.abs(curr.close - e21);
  const isTooFar = distFromEMA21 > (atr * 1.5);

  // Logic 1: Trend Following
  const l1Buy = (e9 > e21) && (rsi > 50 && rsi < 70) && !isTooFar && isHighVol && isStrong && (curr.close > curr.open);
  const l1Sell = (e9 < e21) && (rsi < 50 && rsi > 30) && !isTooFar && isHighVol && isStrong && (curr.close < curr.open);

  // Logic 2: SNR + MA Cross
  let nearSupport = false;
  let nearResistance = false;
  const snrTolerance = atr * 0.5;
  levels.forEach(lvl => {
    if (lvl.type === 'support' && curr.low <= lvl.price + snrTolerance) nearSupport = true;
    if (lvl.type === 'resistance' && curr.high >= lvl.price - snrTolerance) nearResistance = true;
  });

  const goldenCross = e10prev <= e20prev && e10 > e20;
  const deathCross = e10prev >= e20prev && e10 < e20;

  const l2Buy = nearSupport && goldenCross;
  const l2Sell = nearResistance && deathCross;

  // Logic 3: Pure MA Cross
  const l3Buy = goldenCross;
  const l3Sell = deathCross;

  if (l1Buy) return { action: 'BUY', reason: 'Trend Following (+Volume)', probability: isHighVol ? 'High' : 'Medium' };
  if (l2Buy) return { action: 'BUY', reason: 'SNR Rebound + MA Cross', probability: 'High' };
  if (l3Buy) return { action: 'BUY', reason: 'MA Goldencross (E10/20)', probability: 'Medium' };

  if (l1Sell) return { action: 'SELL', reason: 'Trend (Bearish) + Vol', probability: isHighVol ? 'High' : 'Medium' };
  if (l2Sell) return { action: 'SELL', reason: 'SNR Resistance + MA Cross', probability: 'High' };
  if (l3Sell) return { action: 'SELL', reason: 'MA Deathcross (E10/20)', probability: 'Medium' };

  return { action: 'WAIT', reason: null };
}

/**
 * Helper for latest signal only
 */
function getLatestSignal(candles, levels = []) {
  const indicators = computeIndicators(candles);
  return detectAdvancedSignal(candles, indicators.all, candles.length - 1, levels);
}

function formatIndicatorsForPrompt(symbol, indicators) {
  const latest = indicators.latest;
  const lines = [`Analisa teknikal untuk ${symbol}:`];
  lines.push(`Harga terakhir: ${num(latest.latestClose)}`);
  lines.push(`Volume terakhir: ${num(latest.latestVolume)}`);
  lines.push(`MA5: ${num(latest.MA5)}, MA20: ${num(latest.MA20)}, MA50: ${num(latest.MA50)}`);
  lines.push(`RSI(14): ${num(latest.RSI)}`);

  if (latest.MACD) lines.push(`MACD: ${num(latest.MACD.MACD)}, signal=${num(latest.MACD.signal)}`);
  if (latest.Stochastic) lines.push(`Stochastic: %K=${num(latest.Stochastic.k)}, %D=${num(latest.Stochastic.d)}`);

  return lines.join('\n');
}

function num(v) {
  return (v === undefined || v === null || Number.isNaN(v)) ? 'N/A' : (Math.round(v * 100) / 100).toString();
}

module.exports = { computeIndicators, formatIndicatorsForPrompt, detectAdvancedSignal, getLatestSignal };
