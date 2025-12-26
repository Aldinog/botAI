document.addEventListener('DOMContentLoaded', async () => {
    const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

    if (tg) {
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor('#0f172a');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#0f172a');
    }

    // --- State & Elements ---
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = urlParams.get('symbol')?.toUpperCase() || '';
    let sessionToken = localStorage.getItem('aston_session_token');

    const loader = document.getElementById('loader');
    const outputArea = document.getElementById('output-area');
    const activeTicker = document.getElementById('active-ticker');
    const marketPriceEl = document.getElementById('market-price');
    const currentPlEl = document.getElementById('current-pl');

    const inpP2 = document.getElementById('inp-p2');
    const btnCalculate = document.getElementById('btn-calculate');

    if (activeTicker) activeTicker.innerText = `Symbol: ${symbol || '--'}`;

    // --- Helpers ---
    const showLoader = (show) => {
        if (show) loader.classList.remove('hidden');
        else loader.classList.add('hidden');
    };

    const formatIDR = (num) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
    };

    // --- Initial Data Fetch ---
    const fetchMarketData = async () => {
        if (!symbol) return;
        showLoader(true);
        try {
            const response = await fetch('/api/web', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ action: 'profile', symbol })
            });
            const data = await response.json();

            // Sync theme if available
            if (data.active_theme && window.themeEngine) {
                window.themeEngine.applyTheme(data.active_theme);
            }

            if (data.success) {
                // Profile returns HTML, we need to extract price or use separate action.
                // For simplicity, we'll try a small historical fetch to get last close
                const priceRes = await fetch('/api/web', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionToken}`
                    },
                    body: JSON.stringify({ action: 'chart', symbol, interval: '1d' })
                });
                const pData = await priceRes.json();
                if (pData.success && pData.data.candles.length > 0) {
                    const lastPrice = pData.data.candles[pData.data.candles.length - 1].close;
                    marketPriceEl.innerText = lastPrice.toLocaleString('id-ID');
                    if (!inpP2.value) inpP2.value = lastPrice;

                    // Initial P/L if user already has data in localStorage or inputs?
                    // For now, it stays -- until simulation run.
                }
            }
        } catch (err) {
            console.error('Failed to fetch initial data:', err);
        } finally {
            showLoader(false);
        }
    };

    if (symbol) fetchMarketData();

    // --- Simulation Trigger ---
    btnCalculate.addEventListener('click', async () => {
        const p1 = document.getElementById('inp-p1').value;
        const l1 = document.getElementById('inp-l1').value;
        const p2 = document.getElementById('inp-p2').value;
        const target = document.getElementById('inp-target').value;
        const l2 = document.getElementById('inp-l2').value;
        const sl = document.getElementById('inp-sl').value;
        const tp = document.getElementById('inp-tp').value;
        const feeB = document.getElementById('inp-feebuy').value;
        const feeS = document.getElementById('inp-feesell').value;

        if (!p1 || !l1 || !p2) {
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
            return alert('Mohon isi Harga Beli Lama, Lot Lama, dan Harga Baru.');
        }

        outputArea.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

        try {
            const response = await fetch('/api/web', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({
                    action: 'avg',
                    symbol,
                    p1, l1, p2,
                    targetAvg: target,
                    l2Input: l2,
                    slPercent: sl,
                    tpPercent: tp,
                    feeBuy: feeB,
                    feeSell: feeS
                })
            });

            const data = await response.json();

            // Sync theme
            if (data.active_theme && window.themeEngine) {
                window.themeEngine.applyTheme(data.active_theme);
            }

            if (data.success) {
                // Convert simulation MD to HTML if needed or just display
                outputArea.innerHTML = data.data; // API now returns HTML formatted data
                if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            } else {
                outputArea.innerHTML = `<span style="color: #ef4444;">⚠ ${data.error}</span>`;
                if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            }
        } catch (error) {
            outputArea.innerHTML = '<span style="color: #ef4444;">⚠ Koneksi terputus.</span>';
        }
    });
});
