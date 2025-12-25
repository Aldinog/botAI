function startRamadanTheme() {
    console.log('🌙 Starting Ramadan Theme: Emerald Nights');

    // Check if we are on the chart page
    const isChartPage = window.location.pathname.includes('chart.html');

    // 1. Inject Decorations (Lanterns) - Only if NOT chart page
    if (!isChartPage) {
        createLanterns();
        createMoon();
        initRamadanEnhancements();
    }

    // 3. Inject Stars Background (Global)
    createStars();
}

function stopRamadanTheme() {
    console.log('🛑 Stopping Ramadan Theme');

    // Remove all injected elements
    document.querySelectorAll('.ramadan-lantern').forEach(el => el.remove());
    document.querySelectorAll('.ramadan-moon').forEach(el => el.remove());
    document.querySelectorAll('.ramadan-star').forEach(el => el.remove());
    document.querySelectorAll('.mosque-silhouette').forEach(el => el.remove());
    document.querySelectorAll('.spiritual-tip').forEach(el => el.remove());

    // Cleanup Intervals
    if (window.ramadanTipInterval) clearInterval(window.ramadanTipInterval);

    // Ensure styles are cleaned up if engine doesn't handle classes perfectly
    document.body.classList.remove('theme-ramadan');
}

// --- Logic ---

const spiritualTips = [
    "Sabar adalah kunci keberhasilan.",
    "Barangsiapa sungguh-sungguh, ia akan berhasil.",
    "Kebersihan adalah sebagian dari iman.",
    "Tangan di atas lebih baik dari tangan di bawah.",
    "Senyummu di hadapan saudaramu adalah sedekah.",
    "Gunakan waktu sehatmu sebelum waktu sakitmu.",
    "Tetap semangat puasanya!",
    "Ramadan Kareem - Semoga berkah.",
    "Waktunya berbuat kebaikan.",
    "Jaga lisan, jaga hati."
];

function initRamadanEnhancements() {
    // 1. Inject Mosque Silhouette
    if (!document.querySelector('.mosque-silhouette')) {
        const mosque = document.createElement('div');
        mosque.classList.add('mosque-silhouette');
        document.body.appendChild(mosque);
    }

    // 2. Start Spiritual Tips Rotation
    // Try to find loading container
    const setupTips = () => {
        const authBox = document.querySelector('.auth-box') || document.querySelector('.loading-content');
        if (authBox && !document.querySelector('.spiritual-tip')) {
            const tipDiv = document.createElement('div');
            tipDiv.classList.add('spiritual-tip');
            authBox.appendChild(tipDiv);

            const updateTip = () => {
                const randomTip = spiritualTips[Math.floor(Math.random() * spiritualTips.length)];
                tipDiv.style.opacity = '0';
                setTimeout(() => {
                    tipDiv.innerText = randomTip;
                    tipDiv.style.opacity = '0.8';
                }, 500);
            };

            updateTip();
            if (window.ramadanTipInterval) clearInterval(window.ramadanTipInterval);
            window.ramadanTipInterval = setInterval(updateTip, 5000);
        }
    };

    // Run setup and also observe for dynamic loading screens
    setupTips();
    // Re-check periodically since auth-box might appear/disappear
    if (window.ramadanCheckInterval) clearInterval(window.ramadanCheckInterval);
    window.ramadanCheckInterval = setInterval(setupTips, 2000);
}

function createLanterns() {
    // Simple SVG Lantern representation
    const lanternSVG = `
    <svg viewBox="0 0 50 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M25 0V10" stroke="#fbbf24" stroke-width="2"/> 
        <path d="M15 10H35L40 25H10L15 10Z" fill="#047857" stroke="#fbbf24" stroke-width="1"/>
        <rect x="10" y="25" width="30" height="40" rx="5" fill="#fbbf24" fill-opacity="0.3" stroke="#fbbf24" stroke-width="1"/>
        <path d="M10 65H40L25 85L10 65Z" fill="#047857" stroke="#fbbf24" stroke-width="1"/>
        <circle cx="25" cy="45" r="5" fill="#fbbf24" filter="blur(2px)"/>
    </svg>
    `;

    const positions = ['left', 'center', 'right'];

    positions.forEach(pos => {
        const div = document.createElement('div');
        div.classList.add('ramadan-lantern', pos);
        div.innerHTML = lanternSVG;
        document.body.appendChild(div);
    });
}

function createMoon() {
    const moon = document.createElement('div');
    moon.classList.add('ramadan-moon');
    document.body.appendChild(moon);
}

function createStars() {
    const starCount = 30;
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.classList.add('ramadan-star');

        // Random Position
        const x = Math.random() * 100;
        const y = Math.random() * 60; // Top 60% only

        star.style.left = `${x}vw`;
        star.style.top = `${y}vh`;

        // Random Size
        const size = Math.random() * 3 + 1;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;

        // Random Delay
        star.style.animationDelay = `${Math.random() * 3}s`;

        document.body.appendChild(star);
    }
}

// Attach Global
window.startRamadanTheme = startRamadanTheme;
window.stopRamadanTheme = stopRamadanTheme;
