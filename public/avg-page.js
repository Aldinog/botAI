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

        // Verify library existence
        if (typeof LightweightCharts === 'undefined') {
            console.error('[CHART] LightweightCharts library not loaded!');
            const loader = document.getElementById('chart-loading');
            if (loader) {
                loader.innerText = "Error: Library Chart tidak terminat (Cek Koneksi)";
                loader.style.color = "#f87171";
            }
            return;
        }

        try {
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
            // Resize Handler
            const resizeObserver = new ResizeObserver(entries => {
                for (const entry of entries) {
                    if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                        if (chart) {
                            chart.resize(entry.contentRect.width, entry.contentRect.height);
                            chart.timeScale().fitContent();
                        }
                    }
                }
            });
            resizeObserver.observe(container);
        } catch (e) {
            console.error('[CHART] Initialization failed:', e);
        }
    };

    /**
     * Helper to convert Lightweight Charts time to numerical timestamp
     */
    const toTimestamp = (time) => {
        if (typeof time === 'number') return time;
        if (typeof time === 'string') return new Date(time).getTime() / 1000;
        if (time && time.year) return new Date(time.year, time.month - 1, time.day).getTime() / 1000;
        return 0;
    };

    const fetchCandles = async (sym, interval = '1h') => {
        if (!sym) return false;
        const loader = document.getElementById('chart-loading');
        if (loader) {
            loader.style.display = 'flex';
            loader.innerText = `Loading ${sym} (${interval})...`;
            loader.style.color = '#fbbf24';
        }

        console.log(`[CHART] Fetching data for ${sym} [${interval}]...`);

        try {
            const response = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'chart', symbol: sym, interval: interval, limit: interval === '1h' ? 100 : 300 })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`API Error ${response.status}: ${text.slice(0, 50)}`);
            }

            const data = await response.json();

            if (data.success && data.data && data.data.candles && data.data.candles.length > 0) {
                const uniqueCandles = [];
                const times = new Set();
                const sorted = data.data.candles.sort((a, b) => toTimestamp(a.time) - toTimestamp(b.time));

                sorted.forEach(c => {
                    const ts = toTimestamp(c.time);
                    if (ts > 0 && !times.has(ts)) {
                        times.add(ts);
                        uniqueCandles.push({
                            time: ts,
                            open: Number(c.open),
                            high: Number(c.high),
                            low: Number(c.low),
                            close: Number(c.close)
                        });
                    }
                });

                if (candleSeries) {
                    candleSeries.setData(uniqueCandles);
                    if (chart) chart.timeScale().fitContent();
                }

                currentMarketPrice = uniqueCandles[uniqueCandles.length - 1].close;
                marketPriceEl.innerText = currentMarketPrice.toLocaleString('id-ID');
                marketInfo.innerText = `Realtime ${interval.toUpperCase()} (Success)`;

                if (!inpP2.value) inpP2.value = currentMarketPrice;
                updatePlDisplay(inpP1.value, inpL1.value, currentMarketPrice);

                if (loader) loader.style.display = 'none';
                return true;
            } else if (interval === '1h') {
                console.warn('[CHART] H1 data empty, trying D1 fallback...');
                return await fetchCandles(sym, '1d');
            } else {
                throw new Error('No historical data available for this ticker.');
            }
        } catch (err) {
            console.error('[CHART] Error:', err);
            if (loader) {
                loader.innerText = err.message.includes('API Error') ? err.message : "Connection Refused / CORS Issue";
                loader.style.color = "#f87171";
            }
        }
        return false;
    };

    const clearPriceLines = () => {
        if (!candleSeries) return;
        Object.keys(priceLines).forEach(key => {
            if (priceLines[key]) {
                try {
                    candleSeries.removePriceLine(priceLines[key]);
                } catch (e) { }
                priceLines[key] = null;
            }
        });
    };

    const updatePriceLines = (p1, l1, p2, l2, avg) => {
        if (!candleSeries) {
            console.warn('[CHART] Cannot update lines: candleSeries not initialized.');
            return;
        }
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

        if (!sessionToken) {
            console.error('[SIMULATE] Session token missing!');
            outputArea.innerHTML = '<div style="color: #f87171; padding: 20px; text-align: center;">⚠ Sesi tidak ditemukan. Silakan buka kembali aplikasi dari bot.</div>';
            return;
        }

        const payload = {
            action: 'avg',
            symbol,
            p1, l1, p2,
            targetAvg: target,
            l2Input: l2,
            slPercent: sl,
            tpPercent: tp,
            feeBuy: Number(feeB) / 100,
            feeSell: Number(feeS) / 100
        };

        console.log('[SIMULATE] Sending request:', payload);
        outputArea.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div><div style="text-align:center; font-size: 0.7rem; opacity: 0.5;">Memproses simulasi...</div>';

        try {
            const response = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify(payload)
            });

            console.log('[SIMULATE] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                let errMsg = `Server Error ${response.status}`;
                try {
                    const errJson = JSON.parse(errorText);
                    errMsg = errJson.message || errJson.error || errMsg;
                } catch (e) { }
                throw new Error(errMsg);
            }

            const data = await response.json();
            console.log('[SIMULATE] Data received:', data);

            if (data.success) {
                outputArea.innerHTML = `<div class="fade-in">${data.data}</div>`;
                if (data.raw) {
                    updatePriceLines(data.raw.p1, data.raw.l1, data.raw.p2, data.raw.l2, data.raw.avgBaru);
                }
                if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            } else {
                throw new Error(data.error || 'Gagal menghitung data.');
            }
        } catch (error) {
            console.error('[SIMULATE] Catch Error:', error);
            outputArea.innerHTML = `
                <div style="color: #f87171; padding: 20px; text-align: center;">
                    <div style="font-size: 1.5rem; margin-bottom: 8px;">⚠️</div>
                    <div style="font-weight: 600;">Gagal Simulasi</div>
                    <div style="font-size: 0.8rem; opacity: 0.8;">${error.message || 'Koneksi terputus.'}</div>
                </div>
            `;
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
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
