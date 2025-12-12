// utils/indicators.js

// =========================
// Moving Average (Simple MA)
// =========================
function SMA(values, period) {
  if (!values || values.length < period) return null;

  const result = [];
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

// =========================
// RSI (Relative Strength Index)
// =========================
function RSI(values, period = 14) {
  if (!values || values.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  gains /= period;
  losses /= period;

  const rsi = [];

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    let gain = 0, loss = 0;

    if (diff >= 0) gain = diff;
    else loss = -diff;

    gains = (gains * (period - 1) + gain) / period;
    losses = (losses * (period - 1) + loss) / period;

    const rs = losses === 0 ? 100 : gains / losses;
    rsi.push(100 - 100 / (1 + rs));
  }

  return rsi;
}

// =========================
// MACD (12, 26, 9)
// =========================
function EMA(values, period) {
  const k = 2 / (period + 1);
  let ema = values[0];

  const result = [ema];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function MACD(values, fast = 12, slow = 26, signal = 9) {
  if (!values || values.length < slow) return null;

  const emaFast = EMA(values, fast);
  const emaSlow = EMA(values, slow);

  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);

  const signalLine = EMA(macdLine.slice(slow - 1), signal);
  const histogram = macdLine.slice(slow - 1).map((v, i) => v - signalLine[i]);

  return {
    macd: macdLine.slice(slow - 1),
    signal: signalLine,
    histogram,
  };
}

// =========================
// Stochastic Oscillator (14, 3, 3)
// =========================
function Stochastic(high, low, close, period = 14, smoothK = 3, smoothD = 3) {
  if (
    !high || !low || !close ||
    close.length < period
  ) return null;

  const kValues = [];

  for (let i = period - 1; i < close.length; i++) {
    const highestHigh = Math.max(...high.slice(i - period + 1, i + 1));
    const lowestLow = Math.min(...low.slice(i - period + 1, i + 1));

    const k =
      ((close[i] - lowestLow) / (highestHigh - lowestLow)) * 100;

    kValues.push(k);
  }

  // Smooth %K
  const smoothedK = SMA(kValues, smoothK);
  // Smooth %D
  const smoothedD = SMA(smoothedK, smoothD);

  return {
    k: smoothedK,
    d: smoothedD,
  };
}

module.exports = {
  SMA,
  RSI,
  MACD,
  Stochastic,
};
