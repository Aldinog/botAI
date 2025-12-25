document.addEventListener('DOMContentLoaded', async () => {
    const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
    let sessionToken = localStorage.getItem('aston_session_token');

    const authOverlay = document.getElementById('auth-overlay');
    const authStatus = document.getElementById('auth-status');
    const watchlistBody = document.getElementById('watchlist-body');
    const statusBadge = document.getElementById('app-status-badge');
    const statusText = document.getElementById('status-text');
    const toggleMtBtn = document.getElementById('toggle-mt-btn');

    // State Tracker
    let isMaintenanceActive = false;

    // --- 1. Admin Verification ---
    // --- 1. Admin Verification ---
    const verifyAdmin = async () => {
        if (!sessionToken) {
            window.location.href = 'index.html';
            return;
        }

        // Safety Check for Telegram Environment
        if (!tg || !tg.initData) {
            authStatus.innerHTML = `
                <span style="color:#ef4444">Akses Ditolak: Invalid Environment</span><br>
                <span style="font-size:0.8em; opacity:0.7">Buka melalui Telegram App</span>
            `;
            // Optional: Redirect for safety
            setTimeout(() => window.location.href = 'index.html', 3000);
            return;
        }

        try {
            // Re-fetch login or a simple verify endpoint to check is_admin
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: tg.initData })
            });

            // Handle non-JSON responses (e.g. 404 HTML from Vercel/Localhost)
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Server returned non-JSON response. API might be down.");
            }

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

                updateMTUI(data.user.is_maintenance, data.user.maintenance_end_time);
                loadWatchlist();
            } else {
                authStatus.innerHTML = '<span style="color:#ef4444">Akses Ditolak: Khusus Admin</span>';
                setTimeout(() => window.location.href = 'index.html', 2000);
            }
        } catch (err) {
            console.error(err);
            authStatus.innerHTML = `<span style="color:#ef4444">Gagal Verifikasi: ${err.message}</span>`;
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
    let mtInterval;

    const updateMTUI = (isOn, endTime) => {
        isMaintenanceActive = isOn;
        statusBadge.classList.toggle('maintenance-active', isOn);
        statusText.innerText = isOn ? 'Maintenance' : 'Online';
        mtBtnText.innerText = `Maintenance: ${isOn ? 'ON' : 'OFF'}`;
        toggleMtBtn.classList.toggle('active', isOn);

        const countdownEl = document.getElementById('admin-mt-countdown');
        const timerEl = document.getElementById('amt-timer');

        if (mtInterval) clearInterval(mtInterval);

        if (isOn && endTime) {
            countdownEl.style.display = 'block';
            const end = new Date(endTime).getTime();

            mtInterval = setInterval(() => {
                const now = new Date().getTime();
                const diff = end - now;

                if (diff < 0) {
                    clearInterval(mtInterval);
                    timerEl.innerText = "00:00:00 (Finishing...)";
                    setTimeout(() => location.reload(), 2000);
                    return;
                }

                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);

                timerEl.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            }, 1000);
        } else {
            countdownEl.style.display = 'none';
        }
    };

    // --- Maintenance Logic ---

    const mtModal = document.getElementById('mt-modal');
    const mtTitle = mtModal.querySelector('h3');
    const mtDesc = mtModal.querySelector('p');
    const mtInputGroup = mtModal.querySelector('.input-group');
    const confirmBtn = document.getElementById('confirm-mt-btn');
    const cancelBtn = document.getElementById('cancel-mt-btn');

    toggleMtBtn.onclick = () => {
        mtModal.classList.remove('hidden');

        if (isMaintenanceActive) {
            // UI for Turning OFF
            mtTitle.innerText = 'Matikan Maintenance?';
            mtDesc.innerText = 'User akan bisa kembali mengakses aplikasi.';
            mtInputGroup.classList.add('hidden');
            confirmBtn.innerText = 'Matikan Sekarang';
            confirmBtn.classList.remove('primary-btn');
            confirmBtn.style.backgroundColor = '#ef4444'; // Red for stop
            confirmBtn.style.borderColor = '#ef4444';
        } else {
            // UI for Turning ON
            mtTitle.innerText = 'Maintenance Mode';
            mtDesc.innerText = 'Aktifkan mode maintenance? User biasa tidak akan bisa login.';
            mtInputGroup.classList.remove('hidden');
            confirmBtn.innerText = 'Aktifkan';
            confirmBtn.classList.add('primary-btn');
            confirmBtn.style.backgroundColor = ''; // Reset
            confirmBtn.style.borderColor = '';
        }
    };

    cancelBtn.onclick = () => {
        mtModal.classList.add('hidden');
    };

    document.getElementById('confirm-mt-btn').onclick = () => {
        // If Active -> Turn Off
        if (isMaintenanceActive) {
            toggleMaintenanceAPI(null); // Send null to deactivate
            document.getElementById('mt-modal').classList.add('hidden');
            return;
        }

        // If Inactive -> Turn On logic
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
                // Pass the requested endTime since backend might not return it in this specific endpoint yet
                updateMTUI(data.is_maintenance, endTime);
            }
        } catch (e) { console.error('MT Error', e); }
    };

    // Update initial state check


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
