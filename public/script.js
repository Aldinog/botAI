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

                // --- Seasonal Theme Logic ---
                // --- Seasonal Theme Logic ---
                const activeTheme = data.user.active_theme || 'default';
                localStorage.setItem('active_theme', activeTheme); // Persist theme

                // Clear previous theme first
                clearChristmasTheme();

                if (activeTheme !== 'default') {
                    document.body.classList.add(`theme-${activeTheme}`);
                    if (activeTheme === 'christmas') {
                        initSnowflakes();
                        const tree = document.getElementById('christmas-tree');
                        if (tree) tree.classList.remove('hidden');
                        const text = document.getElementById('christmas-text');
                        if (text) text.classList.remove('hidden');
                        if (authStatus) authStatus.innerText = 'Merry Christmas! Prossesing... 🎄';
                    } else if (activeTheme === 'newyear') {
                        initFireworks();
                        const text = document.getElementById('newyear-text');
                        if (text) text.classList.remove('hidden');
                        if (authStatus) authStatus.innerText = 'Happy New Year! Processing... 🎆';
                    }
                }

                // --- Maintenance & Admin Logic ---
                const user = data.user;
                const adminBtn = document.getElementById('admin-toggle-btn');
                const maintenanceOverlay = document.getElementById('maintenance-overlay');
                const mtStatusText = document.getElementById('mt-status-text');
                const toggleMtBtn = document.getElementById('toggle-mt-btn');
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

                // Initial Status
                updateStatusBadge(user.is_maintenance);

                // 1. Show admin button if admin
                if (user.is_admin) {
                    adminBtn.classList.remove('hidden');
                    adminBtn.onclick = () => {
                        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
                        window.location.href = 'admin.html';
                    };
                }

                // 2. Block if Maintenance is ON and NOT Admin
                if (user.is_maintenance && !user.is_admin) {
                    maintenanceOverlay.classList.remove('hidden');
                }

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

    // Load persisted theme immediately
    const persistedTheme = localStorage.getItem('active_theme');
    if (persistedTheme && persistedTheme !== 'default') {
        document.body.classList.add(`theme-${persistedTheme}`);
        if (persistedTheme === 'christmas') {
            initSnowflakes();
            // Show tree & text immediately
            const tree = document.getElementById('christmas-tree');
            if (tree) tree.classList.remove('hidden');
            const text = document.getElementById('christmas-text');
            if (text) text.classList.remove('hidden');
        } else if (persistedTheme === 'newyear') {
            initFireworks();
            const text = document.getElementById('newyear-text');
            if (text) text.classList.remove('hidden');
        }
    }

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

function initSnowflakes() {
    const container = document.getElementById('snow-container');
    if (!container) return;

    const count = 20; // Reduced number of flakes for subtle effect
    const symbols = ['❄', '❅', '❆', '✧'];

    for (let i = 0; i < count; i++) {
        const flake = document.createElement('div');
        flake.className = 'snowflake';
        flake.innerText = symbols[Math.floor(Math.random() * symbols.length)];
        flake.style.left = Math.random() * 100 + 'vw';
        flake.style.animationDuration = (Math.random() * 3 + 4) + 's';
        flake.style.opacity = Math.random();
        flake.style.fontSize = (Math.random() * 10 + 10) + 'px';
        flake.style.animationDelay = Math.random() * 5 + 's';
        container.appendChild(flake);
    }
}

function clearChristmasTheme() {
    document.body.classList.remove('theme-christmas');
    const tree = document.getElementById('christmas-tree');
    if (tree) tree.classList.add('hidden');
    const text = document.getElementById('christmas-text');
    if (text) text.classList.add('hidden');

    // Clear snowflakes
    const container = document.getElementById('snow-container');
    if (container) container.innerHTML = '';
}

function clearNewYearTheme() {
    document.body.classList.remove('theme-newyear');
    const text = document.getElementById('newyear-text');
    if (text) text.classList.add('hidden');
    stopFireworks();
}

let fireworksInterval;
let animationFrameId;

function initFireworks() {
    const canvas = document.getElementById('fireworks-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';

    let particles = [];
    const colors = ['#f00', '#0f0', '#00f', '#ff0', '#0ff', '#f0f', '#fff', '#FFA500'];

    function createParticle(x, y) {
        const particleCount = 30;
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: x,
                y: y,
                color: colors[Math.floor(Math.random() * colors.length)],
                radius: Math.random() * 3 + 1,
                velocity: {
                    x: (Math.random() - 0.5) * 6,
                    y: (Math.random() - 0.5) * 6
                },
                alpha: 1,
                decay: Math.random() * 0.015 + 0.01
            });
        }
    }

    function loop() {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // Trail effect
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'lighter';

        particles.forEach((p, index) => {
            if (p.alpha <= 0) {
                particles.splice(index, 1);
            } else {
                p.velocity.y += 0.05; // Gravity
                p.x += p.velocity.x;
                p.y += p.velocity.y;
                p.alpha -= p.decay;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2, false);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.fill();
            }
        });
        animationFrameId = requestAnimationFrame(loop);
    }

    loop();

    // Spawn fireworks randomly
    fireworksInterval = setInterval(() => {
        createParticle(Math.random() * canvas.width, Math.random() * canvas.height / 2);
    }, 800);
}

function stopFireworks() {
    clearInterval(fireworksInterval);
    cancelAnimationFrame(animationFrameId);
    const canvas = document.getElementById('fireworks-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
    }
}

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
