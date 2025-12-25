document.addEventListener('DOMContentLoaded', async () => {
    const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
    let sessionToken = localStorage.getItem('aston_session_token');

    const authOverlay = document.getElementById('auth-overlay');
    const authStatus = document.getElementById('auth-status');
    const watchlistBody = document.getElementById('watchlist-body');
    const statusBadge = document.getElementById('app-status-badge');
    const statusText = document.getElementById('status-text');
    const mtBtnText = document.getElementById('mt-btn-text');
    const toggleMtBtn = document.getElementById('toggle-mt-btn');

    // --- 1. Admin Verification ---
    const verifyAdmin = async () => {
        if (!sessionToken) {
            window.location.href = 'index.html';
            return;
        }

        try {
            // Re-fetch login or a simple verify endpoint to check is_admin
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData })
            });
            const data = await res.json();

            if (res.ok && data.user && data.user.is_admin) {
                authOverlay.classList.add('hidden');

                // Seasonal Theme
                const activeTheme = data.user.active_theme || 'default';
                if (activeTheme !== 'default') {
                    document.body.classList.add(`theme-${activeTheme}`);
                    if (activeTheme === 'christmas') initSnowflakes();
                    if (activeTheme === 'newyear') initFireworks();
                }

                updateMTUI(data.user.is_maintenance);
                document.getElementById('theme-selector').value = activeTheme;
                loadWatchlist();
            } else {
                authStatus.innerHTML = '<span style="color:#ef4444">Akses Ditolak: Khusus Admin</span>';
                setTimeout(() => window.location.href = 'index.html', 2000);
            }
        } catch (err) {
            console.error(err);
            authStatus.innerText = 'Gagal verifikasi admin.';
        }
    };

    // --- 2. Watchlist Management ---
    const loadWatchlist = async () => {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ action: 'watchlist/list' })
            });
            const data = await res.json();
            if (data.success) {
                renderWatchlist(data.data);
            }
        } catch (err) {
            console.error('Load Watchlist Error:', err);
        }
    };

    const renderWatchlist = (list) => {
        watchlistBody.innerHTML = list.map(item => `
            <tr>
                <td style="font-weight: 600;">${item.symbol.replace('.JK', '')}</td>
                <td>
                    <span class="status-pill ${item.is_active ? 'status-active' : 'status-inactive'}">
                        ${item.is_active ? 'Active' : 'Paused'}
                    </span>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="icon-btn" onclick="toggleSymbol('${item.symbol}', ${!item.is_active})">
                            <i class="fas ${item.is_active ? 'fa-pause' : 'fa-play'}"></i>
                        </button>
                        <button class="icon-btn delete" onclick="deleteSymbol('${item.symbol}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    };

    window.toggleSymbol = async (symbol, newState) => {
        const res = await fetch('/api/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
            body: JSON.stringify({ action: 'watchlist/toggle', symbol, is_active: newState })
        });
        if (res.ok) loadWatchlist();
    };

    window.deleteSymbol = async (symbol) => {
        if (!confirm(`Hapus ${symbol} dari watchlist?`)) return;
        const res = await fetch('/api/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
            body: JSON.stringify({ action: 'watchlist/delete', symbol })
        });
        if (res.ok) loadWatchlist();
    };

    document.getElementById('add-symbol-btn').onclick = async () => {
        const input = document.getElementById('new-symbol-input');
        const symbol = input.value.trim();
        if (!symbol) return;

        const res = await fetch('/api/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
            body: JSON.stringify({ action: 'watchlist/add', symbol })
        });
        if (res.ok) {
            input.value = '';
            loadWatchlist();
        } else {
            const data = await res.json();
            alert(data.error || 'Gagal menambah emiten');
        }
    };

    // --- 3. System Actions ---
    const updateMTUI = (isOn) => {
        statusBadge.classList.toggle('maintenance-active', isOn);
        statusText.innerText = isOn ? 'Maintenance' : 'Online';
        mtBtnText.innerText = `Maintenance: ${isOn ? 'ON' : 'OFF'}`;
        toggleMtBtn.classList.toggle('active', isOn);
    };

    toggleMtBtn.onclick = async () => {
        const res = await fetch('/api/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
            body: JSON.stringify({ action: 'toggle-maintenance' })
        });
        const data = await res.json();
        if (data.success) updateMTUI(data.is_maintenance);
    };

    document.getElementById('update-theme-btn').onclick = async () => {
        const theme = document.getElementById('theme-selector').value;
        const res = await fetch('/api/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
            body: JSON.stringify({ action: 'admin/update-theme', theme })
        });
        if (res.ok) {
            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            alert('Tema berhasil diubah! Silakan reload aplikasi.');
            // Optional: reload page to see effect immediately in admin
            // location.reload(); 
        }
    };

    document.getElementById('force-scan-btn').onclick = async () => {
        const btn = document.getElementById('force-scan-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';

        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'admin/force-scan' })
            });
            if (res.ok) {
                if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                alert('Scanner berhasil dijalankan di background!');
            }
        } catch (e) { console.error(e); }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-satellite-dish"></i> Force Scan';
    };

    verifyAdmin();
});

function initSnowflakes() {
    const container = document.getElementById('snow-container');
    if (!container) return;

    const count = 30; // Slightly less for admin page
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
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'lighter';

        particles.forEach((p, index) => {
            if (p.alpha <= 0) {
                particles.splice(index, 1);
            } else {
                p.velocity.y += 0.05;
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

    fireworksInterval = setInterval(() => {
        createParticle(Math.random() * canvas.width, Math.random() * canvas.height / 2);
    }, 800);
}
