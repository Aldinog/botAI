document.addEventListener('DOMContentLoaded', () => {
    // Initialize Telegram Web App
    const tg = window.Telegram.WebApp;
    tg.expand();

    // Set colors for Telegram Header to match our premium dark theme
    if (tg.setHeaderColor) tg.setHeaderColor('#0f172a');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#0f172a');

    // UI Elements
    const tickerInput = document.getElementById('ticker-input');
    const terminalCard = document.getElementById('terminal-card');
    const terminalOutput = document.getElementById('terminal-output');
    const closeTerminalBtn = document.getElementById('close-terminal');
    const buttons = document.querySelectorAll('.glass-btn');

    // Helper: Show Terminal with loading pulse
    const showLoading = (action) => {
        terminalCard.classList.remove('hidden');
        terminalOutput.innerHTML = `
            <div class="loading-pulse">
                <div class="spinner"></div>
                <span>Processing ${action}...</span>
            </div>
        `;

        // Haptic feedback
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    };

    // Helper: Show Result
    const showResult = (html) => {
        // Add fade-in animation class to content
        const contentDiv = document.createElement('div');
        contentDiv.style.animation = 'fadeInUp 0.3s ease-out';
        contentDiv.innerHTML = html;

        terminalOutput.innerHTML = '';
        terminalOutput.appendChild(contentDiv);

        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    };

    // Helper: Show Error
    const showError = (msg) => {
        terminalOutput.innerHTML = `<span style="color: #ef4444; font-weight: 500;">⚠ Error: ${msg}</span>`;
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    };

    // Action Buttons Logic
    buttons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const action = btn.dataset.action;
            const symbol = tickerInput.value.trim().toUpperCase();

            if (!symbol) {
                // Shake input visual cue
                tickerInput.style.borderColor = '#ef4444';
                tickerInput.focus();
                setTimeout(() => tickerInput.style.borderColor = 'rgba(255, 255, 255, 0.1)', 1000);

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
        // Add slide out animation if desired, for now just hide
        terminalCard.classList.add('hidden');
    });

    // Input interaction
    tickerInput.addEventListener('input', () => {
        tickerInput.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    });
});
