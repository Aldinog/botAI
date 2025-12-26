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

    const initialModal = document.getElementById('initial-modal');
    const initP1 = document.getElementById('init-p1');
    const initL1 = document.getElementById('init-l1');
    const btnContinue = document.getElementById('btn-continue');

    const outputArea = document.getElementById('output-area');
    const symbolDisplay = document.getElementById('symbol-display');
    const marketPriceEl = document.getElementById('market-price');
    const currentPlEl = document.getElementById('current-pl');

    const inpP1 = document.getElementById('inp-p1');
    const inpL1 = document.getElementById('inp-l1');
    const inpP2 = document.getElementById('inp-p2');
    const btnCalculate = document.getElementById('btn-calculate');

    let currentMarketPrice = 0;

    if (symbolDisplay) symbolDisplay.innerText = `TICKER: ${symbol || '--'}`;

    // --- Helpers ---
    const formatIDR = (num) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
    };

    const updatePlDisplay = (p1, l1, currentPrice) => {
        if (!p1 || !l1 || !currentPrice) return;

        const modalAwal = Number(p1) * Number(l1) * 100;
        const nilaiSekarang = Number(currentPrice) * Number(l1) * 100;
        const plIdr = nilaiSekarang - modalAwal;
        const plPercent = ((Number(currentPrice) - Number(p1)) / Number(p1)) * 100;

        const isPositive = plIdr >= 0;
        const sign = isPositive ? '+' : '';

        currentPlEl.innerText = `${sign}${formatIDR(plIdr)} (${plPercent.toFixed(2)}%)`;
        currentPlEl.className = `stat-value ${isPositive ? 'positive' : 'negative'}`;

        marketPriceEl.innerText = Number(currentPrice).toLocaleString('id-ID');
        marketPriceEl.className = 'stat-value';
    };

    // --- Initial Entry Setup ---
    btnContinue.addEventListener('click', async () => {
        const p1 = initP1.value;
        const l1 = initL1.value;

        if (!p1 || !l1) {
            if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
            return alert('Harap isi Harga Beli dan Lot Lama.');
        }

        // Sync to main form
        inpP1.value = p1;
        inpL1.value = l1;

        // Hide modal and start fetching
        initialModal.style.display = 'none';

        if (symbol) {
            await fetchMarketData();
            updatePlDisplay(p1, l1, currentMarketPrice);
        }
    });

    // --- Data Fetching ---
    const fetchMarketData = async () => {
        if (!symbol) return;
        try {
            // Use chart action as it's more reliable for numerical price
            const priceRes = await fetch('/api/web', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ action: 'chart', symbol, interval: '1d' })
            });
            const pData = await priceRes.json();

            // Sync theme if available
            if (pData.active_theme && window.themeEngine) {
                window.themeEngine.applyTheme(pData.active_theme);
            }

            if (pData.success && pData.data.candles.length > 0) {
                currentMarketPrice = pData.data.candles[pData.data.candles.length - 1].close;
                if (!inpP2.value) inpP2.value = currentMarketPrice;
            }
        } catch (err) {
            console.error('Failed to fetch price:', err);
        }
    };

    // --- Simulation Logic ---
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

        outputArea.innerHTML = '<div class="spinner" style="margin: 60px auto;"></div>';
        if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');

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
                    feeBuy: Number(feeB) / 100, // API expects fraction
                    feeSell: Number(feeS) / 100
                })
            });

            const data = await response.json();

            if (data.active_theme && window.themeEngine) {
                window.themeEngine.applyTheme(data.active_theme);
            }

            if (data.success) {
                outputArea.innerHTML = `<div class="fade-in">${data.data}</div>`;
                // Update live P/L display as well
                updatePlDisplay(p1, l1, currentMarketPrice);
                if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            } else {
                outputArea.innerHTML = `<div style="color: #f87171; padding: 20px;">⚠ ${data.error}</div>`;
                if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            }
        } catch (error) {
            outputArea.innerHTML = '<div style="color: #f87171; padding: 20px;">⚠ Terjadi kesalahan koneksi.</div>';
        }
    });

    // Auto-update P/L display when P1 or L1 changes in the main form
    [inpP1, inpL1].forEach(input => {
        input.addEventListener('input', () => {
            updatePlDisplay(inpP1.value, inpL1.value, currentMarketPrice);
        });
    });
});
