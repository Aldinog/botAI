// Initialize Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
if (tg.setHeaderColor) tg.setHeaderColor('#0f172a');
if (tg.setBackgroundColor) tg.setBackgroundColor('#0f172a');

// Global Functions for Tab Switching
window.openTab = function (tabId) {
    // Hide all contents
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // Show target content
    document.getElementById(tabId).classList.add('active');

    // Update button states if needed (optional visual feedback)
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // simplistic finding of button by onclick attribute or text matching is hard, 
    // relying on user just clicking.
}

// Generic API Call Helper
async function callApi(action, symbol, outputId) {
    const outputDiv = document.getElementById(outputId);

    if (!symbol) {
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
        return alert('Masukkan kode saham!');
    }

    // Loading State
    outputDiv.innerHTML = `
        <div class="loading-pulse">
            <div class="spinner"></div>
            <span>Analyzing ${symbol}...</span>
        </div>
    `;

    if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

    try {
        const response = await fetch('/api/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, symbol })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Render Result
            outputDiv.innerHTML = `<div class="result-content">${data.data}</div>`;
            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        } else {
            outputDiv.innerHTML = `<div class="error-msg">❌ ${data.error || 'Terjadi kesalahan'}</div>`;
            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        }
    } catch (err) {
        console.error(err);
        outputDiv.innerHTML = `<div class="error-msg">❌ Network Error</div>`;
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    }
}

// Specific Button Handlers
window.getPrice = function () {
    const symbol = document.getElementById('symbol-price').value.toUpperCase();
    callApi('price', symbol, 'result-price');
}

window.getIndicators = function () {
    const symbol = document.getElementById('symbol-indicators').value.toUpperCase();
    callApi('indicators', symbol, 'result-indicators');
}

window.getAnalysis = function () {
    const symbol = document.getElementById('symbol-analysis').value.toUpperCase();
    callApi('analysis', symbol, 'result-analysis');
}

window.getProxy = function () {
    const symbol = document.getElementById('symbol-proxy').value.toUpperCase();
    callApi('proxy', symbol, 'result-proxy');
}

window.getSignal = function () {
    const symbol = document.getElementById('symbol-signal').value.toUpperCase();
    callApi('signal', symbol, 'result-signal');
}
