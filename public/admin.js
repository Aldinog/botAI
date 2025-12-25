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

                // Seasonal Theme (via Engine)
                const activeTheme = data.user.active_theme || 'default';
                if (window.themeEngine) {
                    await window.themeEngine.applyTheme(activeTheme);
                }

                // Update selector to match
                document.getElementById('theme-selector').value = activeTheme;

                updateMTUI(data.user.is_maintenance);
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

    // --- Maintenance Logic ---
    let isMaintenanceActive = false; // State tracker

    toggleMtBtn.onclick = () => {
        if (isMaintenanceActive) {
            // Turning OFF: No modal needed
            toggleMaintenanceAPI(null);
        } else {
            // Turning ON: Show Modal
            document.getElementById('mt-modal').classList.remove('hidden');
        }
    };

    document.getElementById('cancel-mt-btn').onclick = () => {
        document.getElementById('mt-modal').classList.add('hidden');
    };

    document.getElementById('confirm-mt-btn').onclick = () => {
        const timeInput = document.getElementById('mt-time-input').value;
        let endTimeISO = null;

        if (timeInput) {
            const now = new Date();
            const [hours, minutes] = timeInput.split(':').map(Number);
            let target = new Date();
            target.setHours(hours, minutes, 0, 0);

            // If target time is earlier than now, assume it's for tomorrow
            if (target < now) {
                target.setDate(target.getDate() + 1);
            }
            endTimeISO = target.toISOString();
        }

        toggleMaintenanceAPI(endTimeISO);
        document.getElementById('mt-modal').classList.add('hidden');
    };

    async function toggleMaintenanceAPI(endTime) {
        try {
            const res = await fetch('/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
                body: JSON.stringify({ action: 'toggle-maintenance', endTime })
            });
            const data = await res.json();
            if (data.success) {
                isMaintenanceActive = data.is_maintenance; // Sync state
                updateMTUI(data.is_maintenance);
            }
        } catch (e) { console.error('MT Error', e); }
    };

    // Update initial state check
    const updateMTUI = (isOn) => {
        isMaintenanceActive = isOn;
        statusBadge.classList.toggle('maintenance-active', isOn);
        statusText.innerText = isOn ? 'Maintenance' : 'Online';
        mtBtnText.innerText = `Maintenance: ${isOn ? 'ON' : 'OFF'}`;
        toggleMtBtn.classList.toggle('active', isOn);
    };

    document.getElementById('update-theme-btn').onclick = async () => {
        const theme = document.getElementById('theme-selector').value;

        // Optimistic UI Update
        if (window.themeEngine) {
            await window.themeEngine.applyTheme(theme);
        }

        const res = await fetch('/api/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
            body: JSON.stringify({ action: 'admin/update-theme', theme })
        });
        if (res.ok) {
            if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            // alert('Tema berhasil diubah!'); 
            // No reload needed if UI updates instantly
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
