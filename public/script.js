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

            // 1. Maintenance Check (Priority)
            if (response.status === 503) {
                let endTime = null;
                try {
                    const data = await response.json();
                    if (data.end_time) endTime = data.end_time;
                } catch (e) {
                    console.warn('Maintenance 503 received but not JSON. Using default overlay.');
                }

                authOverlay.classList.add('hidden'); // HIDE LOADING SCREEN
                maintenanceOverlay.classList.remove('hidden');

                // Countdown Logic if end_time is provided
                if (endTime) {
                    const statusParams = document.getElementById('mt-status-params');
                    if (statusParams) {
                        const targetTime = new Date(endTime).getTime();

                        // Render Premium Countdown HTML structure - GOLD THEME
                        statusParams.innerHTML = `
                            <div style="text-align:center; animation: fadeIn 1s ease;">
                                <div style="margin-bottom:20px;">
                                    <h2 style="font-size:1.8em; font-weight:800; color:#fbbf24; text-transform:uppercase; letter-spacing:2px; margin:0; text-shadow:0 0 20px rgba(251,191,36,0.3);">
                                        System Upgrade
                                    </h2>
                                    <p style="color:#94a3b8; font-size:0.9em; margin-top:5px;">We are improving your experience</p>
                                </div>

                                <div id="mt-countdown" style="
                                    display: inline-flex; gap: 15px; justify-content: center; 
                                    background: rgba(15, 23, 42, 0.6); padding: 20px 30px; border-radius: 20px;
                                    border: 1px solid rgba(251, 191, 36, 0.2); backdrop-filter: blur(10px);
                                    margin-bottom: 25px; box-shadow: 0 4px 30px rgba(0,0,0,0.3);
                                ">
                                    <div class="mt-unit">
                                        <span id="mt-h" style="font-size:2.5em; font-weight:700; color:#fff; line-height:1;">00</span>
                                        <span style="font-size:0.7em; color:#fbbf24; text-transform:uppercase; letter-spacing:1px; display:block; margin-top:5px;">Hours</span>
                                    </div>
                                    <div style="font-size:2.5em; color:#fbbf24; padding-top:0px; opacity:0.5;">:</div>
                                    <div class="mt-unit">
                                        <span id="mt-m" style="font-size:2.5em; font-weight:700; color:#fff; line-height:1;">00</span>
                                        <span style="font-size:0.7em; color:#fbbf24; text-transform:uppercase; letter-spacing:1px; display:block; margin-top:5px;">Mins</span>
                                    </div>
                                    <div style="font-size:2.5em; color:#fbbf24; padding-top:0px; opacity:0.5;">:</div>
                                    <div class="mt-unit">
                                        <span id="mt-s" style="font-size:2.5em; font-weight:700; color:#fff; line-height:1;">00</span>
                                        <span style="font-size:0.7em; color:#fbbf24; text-transform:uppercase; letter-spacing:1px; display:block; margin-top:5px;">Secs</span>
                                    </div>
                                </div>
                                <div style="font-size: 0.9em; color: rgba(255,255,255,0.5); font-style:italic;">Estimated completion time.</div>
                            </div>
                        `;

                        // Start Interval
                        const interval = setInterval(() => {
                            const now = new Date().getTime();
                            const distance = targetTime - now;

                            if (distance < 0) {
                                clearInterval(interval);
                                statusParams.innerHTML = '<div style="color:#10b981; font-weight:bold; font-size:1.5em; animation:fadeIn 0.5s;">System Online! Reloading...</div>';
                                setTimeout(() => location.reload(), 2000);
                                return;
                            }

                            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                            document.getElementById('mt-h').innerText = String(hours).padStart(2, '0');
                            document.getElementById('mt-m').innerText = String(minutes).padStart(2, '0');
                            document.getElementById('mt-s').innerText = String(seconds).padStart(2, '0');
                        }, 1000);
                    }
                }

                // Do NOT apply custom theme. Force Default.
                if (window.themeEngine) window.themeEngine.applyTheme('default');
                document.querySelector('.container').style.filter = 'blur(10px)';
                document.querySelector('.container').style.pointerEvents = 'none';
                return; // Stop execution
            }

            // Valid JSON check for success/other errors
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                throw new Error(`Server Error (${response.status})`);
            }

            const data = await response.json();

            // 2. Success Check
            if (response.ok && data.success) {
                // Initialize Session & UI Variables
                sessionToken = data.token;
                localStorage.setItem('aston_session_token', sessionToken);
                authOverlay.classList.add('hidden');

                const user = data.user;
                const maintenanceOverlay = document.getElementById('maintenance-overlay'); // Ensure this is defined or already global

                // Status Badge Logic
                const statusBadge = document.getElementById('app-status-badge');
                const statusText = document.getElementById('status-text');

                const updateStatusBadge = (isMt) => {
                    if (isMt) {
                        statusBadge.classList.add('maintenance-active');
                        statusText.innerText = 'Maintenance';
                    } else {
                        statusBadge.classList.remove('maintenance-active');
                        statusText.innerText = 'Online';
                    }
                };
                updateStatusBadge(user.is_maintenance);

                // 2. Normal Access (Admin or Maintenance OFF)
                const adminBtn = document.getElementById('admin-toggle-btn');
                if (user.is_admin === true) {
                    console.log('Admin Access Granted');
                    adminBtn.classList.remove('hidden');
                    adminBtn.onclick = () => {
                        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
                        window.location.href = 'admin.html';
                    };
                } else {
                    // Ensure hidden if not admin
                    adminBtn.classList.add('hidden');
                    adminBtn.onclick = null;
                }

                // Apply Seasonal Theme for authorized users
                const activeTheme = data.user.active_theme || 'default';
                if (window.themeEngine) {
                    await window.themeEngine.applyTheme(activeTheme);
                } else {
                    console.warn('ThemeEngine not loaded');
                }

                if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
            } else {
                if (data.code === 'NOT_MEMBER') {
                    authStatus.innerHTML = `
                        <div style="color: #ef4444; margin-bottom: 15px; font-weight: 600;">${data.error}</div>
                        <div style="margin-bottom: 20px; font-size: 0.9em; opacity: 0.8;">Jika sudah join silahkan buka ulang App</div>
                        <a href="https://t.me/astongrup" target="_blank" class="glass-btn primary-btn" style="text-decoration: none; padding: 12px 24px; display: inline-block;">
                            🚀 Masuk Grup
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
                <div style="color: #ef4444; margin-bottom: 10px; font-size:0.85em;">Error: ${err.message}</div>
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

    // Input Focus Effect
    tickerInput.addEventListener('input', () => {
        tickerInput.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    });
});

// Simple Confetti for Analysis Success
function triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';

    let confetti = [];
    const colors = ['#fde132', '#009bde', '#ff6b00'];

    for (let i = 0; i < 100; i++) {
        confetti.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 10 + 5,
            speed: Math.random() * 5 + 2,
            angle: Math.random() * 6.2
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;
        confetti.forEach(c => {
            c.y += c.speed;
            c.angle += 0.1;
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.angle);
            ctx.fillStyle = c.color;
            ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size);
            ctx.restore();
            if (c.y < canvas.height) active = true;
        });

        if (active) requestAnimationFrame(animate);
        else canvas.style.display = 'none';
    }
    animate();
}
