document.addEventListener('DOMContentLoaded', async () => {
    const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

    if (tg) {
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor('#0f172a');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#0f172a');
    }

    // --- State & Elements ---
    let urlParams = new URLSearchParams(window.location.search);
    let symbol = urlParams.get('symbol')?.toUpperCase() || '';
    let sessionToken = localStorage.getItem('aston_session_token');

    const initialModal = document.getElementById('initial-modal');
    const initP1 = document.getElementById('init-p1');
    const initL1 = document.getElementById('init-l1');
    const btnContinue = document.getElementById('btn-continue');
    const tickerSwitch = document.getElementById('ticker-switch');

    const outputArea = document.getElementById('output-area');
    const marketPriceEl = document.getElementById('market-price');
    const currentPlEl = document.getElementById('current-pl');
    const currentPlPercentEl = document.getElementById('current-pl-percent');
    const marketInfo = document.getElementById('market-info');

    const inpP1 = document.getElementById('inp-p1');
    const inpL1 = document.getElementById('inp-l1');
    const inpP2 = document.getElementById('inp-p2');
    const btnCalculate = document.getElementById('btn-calculate');

    let currentMarketPrice = 0;
    let chart, candleSeries;
    let priceLines = { p1: null, p2: null, avg: null };

    if (tickerSwitch) tickerSwitch.value = symbol;

    const formatIDR = (num) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
    };

    // --- Chart Initialization ---
    const initChart = () => {
        const container = document.getElementById('chart-container');
        if (!container || chart) return;

        chart = LightweightCharts.createChart(container, {
            layout: {
                background: { color: 'transparent' },
                textColor: 'rgba(255, 255, 255, 0.7)',
                fontSize: 10,
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
            },
            timeScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                timeVisible: true,
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { color: '#fbbf24', labelBackgroundColor: '#fbbf24' },
                horzLine: { color: '#fbbf24', labelBackgroundColor: '#fbbf24' },
            }
        });

        candleSeries = chart.addCandlestickSeries({
            upColor: '#34d399',
            downColor: '#f87171',
            borderVisible: false,
            wickUpColor: '#34d399',
            wickDownColor: '#f87171',
        });

        window.addEventListener('resize', () => {
            chart.applyOptions({ width: container.clientWidth });
        });
    };

    const fetchCandles = async (sym) => {
        if (!sym) return false;
        const loader = document.getElementById('chart-loading');
        if (loader) {
            loader.style.display = 'flex';
            loader.innerText = `Loading ${sym}...`;
            loader.style.color = '#fbbf24';
        }

        console.log(`[CHART] Fetching data for ${sym}...`);

        try {
            const response = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'chart', symbol: sym, interval: '1h', limit: 100 })
            });
            const data = await response.json();

            if (data.success && data.data && data.data.candles && data.data.candles.length > 0) {
                console.log(`[CHART] Data received: ${data.data.candles.length} candles`);

                // 1. Prepare and deduplicate candles (Lightweight Charts requirement)
                let lastTime = 0;
                const formatted = data.data.candles
                    .map(c => ({
                        time: Number(c.time),
                        open: Number(c.open),
                        high: Number(c.high),
                        low: Number(c.low),
                        close: Number(c.close)
                    }))
                    .sort((a, b) => a.time - b.time)
                    .filter(c => {
                        if (c.time > lastTime) {
                            lastTime = c.time;
                            return true;
                        }
                        return false;
                    });

                console.log(`[CHART] Formatted & unique candles: ${formatted.length}`);

                if (candleSeries) {
                    try {
                        candleSeries.setData(formatted);
                    } catch (chartErr) {
                        console.error('[CHART] setData Error:', chartErr);
                        if (loader) loader.innerText = "Error rendering chart";
                        return false;
                    }
                } else {
                    console.warn('[CHART] candleSeries not initialized!');
                }

                currentMarketPrice = formatted[formatted.length - 1].close;
                marketPriceEl.innerText = currentMarketPrice.toLocaleString('id-ID');
                marketInfo.innerText = "Realtime H1 (7 Days)";

                if (!inpP2.value) inpP2.value = currentMarketPrice;

                // Crucial: Update P/L display once market price is received
                updatePlDisplay(inpP1.value, inpL1.value, currentMarketPrice);

                if (chart) chart.timeScale().fitContent();

                if (loader) loader.style.display = 'none';
                return true;
            } else {
                console.warn('[CHART] Empty or unsuccessful data:', data);
            }
        } catch (err) {
            console.error('[CHART] Fetch/Process Error:', err);
        }

        if (loader) {
            loader.innerText = "Failed to load data";
            loader.style.color = "#f87171";
        }
        return false;
    };

    const clearPriceLines = () => {
        Object.keys(priceLines).forEach(key => {
            if (priceLines[key]) {
                candleSeries.removePriceLine(priceLines[key]);
                priceLines[key] = null;
            }
        });
    };

    const updatePriceLines = (p1, l1, p2, l2, avg) => {
        clearPriceLines();

        if (p1) {
            priceLines.p1 = candleSeries.createPriceLine({
                price: Number(p1),
                color: '#3b82f6',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Solid,
                axisLabelVisible: true,
                title: `P1: ${p1} (${l1} Lot)`,
            });
        }

        if (p2 && l2 > 0) {
            priceLines.p2 = candleSeries.createPriceLine({
                price: Number(p2),
                color: '#fbbf24',
                lineWidth: 2,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                axisLabelVisible: true,
                title: `P2: ${p2} (${l2} Lot)`,
            });
        }

        if (avg) {
            priceLines.avg = candleSeries.createPriceLine({
                price: Number(avg),
                color: '#fff',
                lineWidth: 3,
                lineStyle: LightweightCharts.LineStyle.Solid,
                axisLabelVisible: true,
                title: `AVG: ${avg}`,
            });
        }
    };

    const updatePlDisplay = (p1, l1, currentPrice) => {
        if (!p1 || !l1 || !currentPrice) return;

        const modalAwal = Number(p1) * Number(l1) * 100;
        const nilaiSekarang = Number(currentPrice) * Number(l1) * 100;
        const plIdr = nilaiSekarang - modalAwal;
        const plPercent = ((Number(currentPrice) - Number(p1)) / Number(p1)) * 100;

        const isPositive = plIdr >= 0;
        const sign = isPositive ? '+' : '';

        currentPlEl.innerText = `${sign}${formatIDR(plIdr)}`;
        currentPlEl.className = `stat-value ${isPositive ? 'positive' : 'negative'}`;

        if (currentPlPercentEl) {
            currentPlPercentEl.innerText = `${sign}${plPercent.toFixed(2)}%`;
            currentPlPercentEl.className = `stat-sub ${isPositive ? 'positive' : 'negative'}`;
        }
    };

    // --- Ticker Switch Logic ---
    const switchSymbol = async (newSym) => {
        if (!newSym || newSym === symbol) return;
        symbol = newSym.toUpperCase();

        // Update URL
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('symbol', symbol);
        window.history.pushState({}, '', newUrl);

        // Reset UI
        tickerSwitch.value = symbol;
        outputArea.innerHTML = '<div style="text-align: center; opacity: 0.4; padding: 40px 0;">Menunggu data...</div>';
        initialModal.style.display = 'flex';
        clearPriceLines();

        if (chart) {
            await fetchCandles(symbol);
        }
    };

    tickerSwitch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            switchSymbol(tickerSwitch.value.trim());
        }
    });

    // --- Initial Setup Modal ---
    btnContinue.addEventListener('click', async () => {
        const p1 = initP1.value;
        const l1 = initL1.value;

        if (!p1 || !l1) {
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
            return alert('Harap isi Harga Beli dan Lot Lama.');
        }

        // Fix if symbol is missing (not in URL)
        if (!symbol) symbol = tickerSwitch.value.trim().toUpperCase();
        if (!symbol) {
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
            return alert('Silakan isi Market Ticker terlebih dahulu.');
        }

        inpP1.value = p1;
        inpL1.value = l1;
        initialModal.style.display = 'none';

        console.log(`[INIT] Fetching data for ${symbol}...`);
        await fetchCandles(symbol);
        updatePlDisplay(p1, l1, currentMarketPrice);
        updatePriceLines(p1, l1, 0, 0, 0); // Show only P1 initially
    });

    // --- Simulation Trigger ---
    btnCalculate.addEventListener('click', async () => {
        const p1 = inpP1.value;
        const l1 = inpL1.value;
        const p2 = inpP2.value;
        const target = document.getElementById('inp-target').value;
        const l2 = document.getElementById('inp-l2').value;
        const sl = document.getElementById('inp-sl').value;
        const tp = document.getElementById('inp-tp').value;
        const feeB = document.getElementById('inp-feebuy').value;
        const feeS = document.getElementById('inp-feesell').value;

        if (!p1 || !l1 || !p2) {
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
            return alert('Mohon isi data Harga dan Lot yang diperlukan.');
        }

        outputArea.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');

        try {
            const response = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({
                    action: 'avg',
                    symbol,
                    p1, l1, p2,
                    targetAvg: target,
                    l2Input: l2,
                    slPercent: sl,
                    tpPercent: tp,
                    feeBuy: Number(feeB) / 100,
                    feeSell: Number(feeS) / 100
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[SIMULATE] API Error:', response.status, errorText);
                throw new Error(`API returned ${response.status}: ${errorText.slice(0, 50)}`);
            }

            const data = await response.json();

            if (data.success) {
                outputArea.innerHTML = `<div class="fade-in">${data.data}</div>`;

                // Use the raw data from API for accurate chart lines
                if (data.raw) {
                    const r = data.raw;
                    updatePriceLines(r.p1, r.l1, r.p2, r.l2, r.avgBaru);
                }

                if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            } else {
                outputArea.innerHTML = `<div style="color: #f87171; padding: 20px;">⚠ ${data.error}</div>`;
                if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            }
        } catch (error) {
            outputArea.innerHTML = '<div style="color: #f87171; padding: 20px;">⚠ Koneksi terputus.</div>';
        }
    });

    // --- Real-time P/L Updates ---
    const triggerPlUpdate = () => {
        const p1 = inpP1.value;
        const l1 = inpL1.value;
        if (p1 && l1 && currentMarketPrice) {
            updatePlDisplay(p1, l1, currentMarketPrice);
        }
    };

    inpP1.addEventListener('input', triggerPlUpdate);
    inpL1.addEventListener('input', triggerPlUpdate);

    // Init components
    initChart();
    if (symbol) {
        // We wait for the modal to be submitted before full fetch to avoid redundant calls
    } else {
        initialModal.style.display = 'flex';
    }
});
