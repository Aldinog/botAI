document.addEventListener('DOMContentLoaded', () => {
    // Initialize Telegram Web App
    const tg = window.Telegram.WebApp;
    tg.expand();

    if (tg.setHeaderColor) tg.setHeaderColor('#050505');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#050505');

    // UI Elements
    const tickerInput = document.getElementById('ticker-input');
    const terminalCard = document.getElementById('terminal-card');
    const terminalOutput = document.getElementById('terminal-output');
    const closeTerminalBtn = document.getElementById('close-terminal');
    const buttons = document.querySelectorAll('.action-btn');

    // Helper: Show Terminal with loading text
    const showLoading = (action) => {
        terminalCard.classList.remove('hidden');
        terminalOutput.innerHTML = `<span class="blink">> CACHING DATA...</span><br>> EXECUTING ${action.toUpperCase()} PROTOCOL...`;

        // Haptic feedback
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    };

    // Helper: Show Result
    const showResult = (html) => {
        terminalOutput.innerHTML = html;
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    };

    // Helper: Show Error
    const showError = (msg) => {
        terminalOutput.innerHTML = `<span style="color: #ff5555;">> ERROR: ${msg}</span>`;
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    };

    // Action Buttons Logic
    buttons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const action = btn.dataset.action;
            const symbol = tickerInput.value.trim().toUpperCase();

            if (!symbol) {
                // Shake input or show visual cue
                tickerInput.style.borderColor = '#ff5555';
                setTimeout(() => tickerInput.style.borderColor = '#ff00ff', 500);
                if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
                return;
            }

            showLoading(action);

            try {
                const response = await fetch('/api/web', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, symbol })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showResult(data.data);
                } else {
                    showError(data.error || 'Unknown System Error');
                }
            } catch (err) {
                showError('Network Connectivity Lost');
                console.error(err);
            }
        });
    });

    // Close Terminal
    closeTerminalBtn.addEventListener('click', () => {
        terminalCard.classList.add('hidden');
    });

    // Input interaction
    tickerInput.addEventListener('input', () => {
        tickerInput.style.borderColor = '#ff00ff';
    });
});
