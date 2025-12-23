document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Telegram Web App with safety checks
    const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

    if (tg) {
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor('#0f172a');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#0f172a');
    }

    // --- Authentication Flow ---
    const authOverlay = document.getElementById('auth-overlay');
    const authStatus = document.getElementById('auth-status');
    let sessionToken = localStorage.getItem('aston_session_token');

    const login = async () => {
        if (!tg || !tg.initData) {
            authStatus.innerHTML = '<span style="color: #ef4444;">Please open this app inside Telegram.</span>';
            console.error('Telegram WebApp SDK not found or initData missing');
            return;
        }

        try {
            authStatus.innerText = 'Loading bentar...';
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                sessionToken = data.token;
                localStorage.setItem('aston_session_token', sessionToken);
                authOverlay.classList.add('hidden');
                if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
            } else {
                if (data.code === 'NOT_MEMBER') {
                    authStatus.innerHTML = `
                        <div style="color: #ef4444; margin-bottom: 15px; font-weight: 600;">${data.error}</div>
                        <a href="https://t.me/astongrup" target="_blank" class="glass-btn primary-btn" style="text-decoration: none; padding: 12px 24px; display: inline-block;">
                            🚀 Join Grup
                        </a>
                    `;
                } else {
                    authStatus.innerHTML = `
                        <div style="color: #ef4444; margin-bottom: 10px;">${data.error || 'Authentication Failed'}</div>
                        <button class="glass-btn" onclick="location.reload()" style="padding: 10px 20px; font-size: 0.8rem;">Retry</button>
                    `;
                }
                if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            }
        } catch (err) {
            console.error('Login error:', err);
            authStatus.innerHTML = `
                <div style="color: #ef4444; margin-bottom: 10px;">Network or Server Error</div>
                <button class="glass-btn" onclick="location.reload()" style="padding: 10px 20px; font-size: 0.8rem;">Retry</button>
            `;
        }
    };

    // Auto-login on start
    await login();

    // UI Elements
    const tickerInput = document.getElementById('ticker-input');
    const terminalCard = document.getElementById('terminal-card');
    const terminalOutput = document.getElementById('terminal-output');
    const closeTerminalBtn = document.getElementById('close-terminal');
    const buttons = document.querySelectorAll('.glass-btn[data-action]');

    // Review Modal Elements
    const reviewModal = document.getElementById('review-modal');
    const closeReviewBtn = document.getElementById('close-review');
    const submitReviewBtn = document.getElementById('submit-review');
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    let reviewAction = 'BUY'; // Default

    // --- Helper Functions ---

    const showLoading = (text) => {
        terminalCard.classList.remove('hidden');
        terminalOutput.innerHTML = `
            <div class="loading-pulse">
                <div class="spinner"></div>
                <span>${text}...</span>
            </div>
        `;
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    };

    const showResult = (html) => {
        const contentDiv = document.createElement('div');
        contentDiv.style.animation = 'fadeInUp 0.3s ease-out';
        contentDiv.innerHTML = html;
        terminalOutput.innerHTML = '';
        terminalOutput.appendChild(contentDiv);
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    };

    const showError = (msg) => {
        terminalOutput.innerHTML = `<span style="color: #ef4444; font-weight: 500;">⚠ Error: ${msg}</span>`;
        terminalCard.classList.remove('hidden'); // Ensure terminal is visible for error
        if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    };

    // --- Review Modal Logic ---

    // Toggle Action (BUY/SELL)
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            reviewAction = btn.dataset.value;
        });
    });

    const closeReview = () => {
        reviewModal.classList.add('hidden');
    };

    if (closeReviewBtn) closeReviewBtn.addEventListener('click', closeReview);
    if (reviewModal) reviewModal.addEventListener('click', (e) => {
        if (e.target === reviewModal) closeReview();
    });

    if (submitReviewBtn) {
        submitReviewBtn.addEventListener('click', async () => {
            const symbol = tickerInput.value.trim().toUpperCase();
            const entry = document.getElementById('review-entry').value;
            const sl = document.getElementById('review-sl').value;

            if (!symbol) {
                if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
                return alert('Please enter a Stock Ticker in the main input first!');
            }
            if (!entry) {
                if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
                return alert('Entry Price is required!');
            }

            closeReview();
            showLoading(`Reviewing ${reviewAction} ${symbol}`);

            try {
                const response = await fetch('/api/web', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionToken}`
                    },
                    body: JSON.stringify({
                        action: 'review',
                        symbol,
                        entry,
                        sl,
                        mode: reviewAction
                    })
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    showResult(data.data);
                } else {
                    showError(data.error || 'Review Failed');
                }
            } catch (err) {
                console.error(err);
                showError('Network Connectivity Error');
            }
        });
    }

    // --- Main Action Buttons Logic ---
    buttons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const action = btn.dataset.action;
            const symbol = tickerInput.value.trim().toUpperCase();

            // Special Handler: Review Modal
            if (action === 'review-modal') {
                if (!symbol) {
                    // Shake Animation
                    tickerInput.style.borderColor = '#ef4444';
                    tickerInput.focus();
                    setTimeout(() => tickerInput.style.borderColor = 'rgba(255, 255, 255, 0.1)', 1000);
                    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
                    return;
                }
                reviewModal.classList.remove('hidden');
                if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
                return;
            }

            // Special Handler: Smart Chart Page
            if (action === 'smart-chart') {
                if (!symbol) {
                    tickerInput.style.borderColor = '#ef4444';
                    tickerInput.focus();
                    setTimeout(() => tickerInput.style.borderColor = 'rgba(255, 255, 255, 0.1)', 1000);
                    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');
                    return;
                }
                if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
                // Redirect to Chart Page
                window.location.href = `chart.html?symbol=${symbol}`;
                return;
            }

            // Standard Actions
            if (!symbol) {
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
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionToken}`
                    },
                    body: JSON.stringify({ action, symbol })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showResult(data.data);
                } else {
                    showError(data.error || 'Unknown System Error');
                }
            } catch (err) {
                console.error(err);
                showError('Network Connectivity Lost');
            }
        });
    });

    // Close Terminal Logic - REMOVED as requested
    // closeTerminalBtn.addEventListener('click', () => {
    //     terminalCard.classList.add('hidden');
    // });


    // Input Focus Effect
    tickerInput.addEventListener('input', () => {
        tickerInput.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    });
});
