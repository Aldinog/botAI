function startNewyearTheme() {
    console.log('🎆 Starting New Year Theme: Premium Enhancements');

    // 1. Start Fireworks Background Immediately
    initFireworks();

    // 2. Prepare Splash Screen (Fireworks Container Only)
    let splash = document.getElementById('ny-splash-screen');
    if (!splash) {
        splash = document.createElement('div');
        splash.id = 'ny-splash-screen';
        splash.innerHTML = `
            <div id="ny-splash-fireworks" style="position: absolute; width:100%; height:100%; top:0; left:0; pointer-events:none;"></div>
        `;
        document.body.appendChild(splash);

        // Make it transparent immediately
        splash.style.background = 'transparent';
    }

    // 3. Inject Countdown & Text into Main App (Below Header, Above Card)
    if (!document.getElementById('ny-countdown')) {
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {

            // A. Create Text (Will be Bottom)
            const copyText = document.createElement('div');
            copyText.id = 'ny-sub-text';
            copyText.innerHTML = 'HAPPY NEW YEAR 2026';
            contentArea.prepend(copyText);

            // B. Create Countdown (Will be Top)
            const cdContainer = document.createElement('div');
            cdContainer.id = 'ny-countdown';
            cdContainer.innerHTML = `
                <div class="countdown-unit"><span class="countdown-val" id="cd-d">00</span><span class="countdown-label">Days</span></div>
                <div class="countdown-separator">:</div>
                <div class="countdown-unit"><span class="countdown-val" id="cd-h">00</span><span class="countdown-label">Hrs</span></div>
                <div class="countdown-separator">:</div>
                <div class="countdown-unit"><span class="countdown-val" id="cd-m">00</span><span class="countdown-label">Min</span></div>
                <div class="countdown-separator">:</div>
                <div class="countdown-unit"><span class="countdown-val" id="cd-s">00</span><span class="countdown-label">Sec</span></div>
            `;
            contentArea.prepend(cdContainer);
        }
    }

    // 4. Start Countdowns & Event Listeners
    startCountdown();
    document.addEventListener('click', handleGoldClick);

    // 4. Trigger initial celebration
    triggerGoldConfetti();
}

function stopNewyearTheme() {
    console.log('🛑 Stopping New Year Theme');

    // Cleanup Intervals
    if (window.nyCountdownInterval) clearInterval(window.nyCountdownInterval);

    // Cleanup Events
    document.removeEventListener('click', handleGoldClick);

    // Cleanup DOM
    const splash = document.getElementById('ny-splash-screen');
    if (splash) splash.remove();

    const cd = document.getElementById('ny-countdown');
    if (cd) cd.remove();

    const subText = document.getElementById('ny-sub-text');
    if (subText) subText.remove();

    const canvas = document.getElementById('fireworks-canvas');
    if (canvas) {
        canvas.style.display = 'none';
    }
}

// --- Logic: Countdown ---
function startCountdown() {
    const targetDate = new Date('January 1, 2026 00:00:00').getTime();

    function update() {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            // Happy New Year!
            const cd = document.getElementById('ny-countdown');
            if (cd) cd.innerHTML = "🎉 IT'S TIME! 🎉";
            clearInterval(window.nyCountdownInterval);
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        if (document.getElementById('cd-d')) document.getElementById('cd-d').innerText = days;
        if (document.getElementById('cd-h')) document.getElementById('cd-h').innerText = hours;
        if (document.getElementById('cd-m')) document.getElementById('cd-m').innerText = minutes;
        if (document.getElementById('cd-s')) document.getElementById('cd-s').innerText = seconds;
    }

    update(); // Initial call
    window.nyCountdownInterval = setInterval(update, 1000);
}

// --- Logic: Magic Gold Click ---
function handleGoldClick(e) {
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('div');
        p.classList.add('gold-particle');
        document.body.appendChild(p);

        // Position at click
        const x = e.clientX;
        const y = e.clientY;
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;

        // Random direction
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 60 + 20; // Spread distance
        const mx = Math.cos(angle) * velocity;
        const my = Math.sin(angle) * velocity;

        p.style.setProperty('--mx', `${mx}px`);
        p.style.setProperty('--my', `${my}px`);

        // Cleanup
        setTimeout(() => p.remove(), 800);
    }
}

// --- Logic ---

function initFireworks() {
    const canvas = document.getElementById('fireworks-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';

    let particles = [];
    const colors = ['#fbbf24', '#f59e0b', '#e2e8f0', '#ffffff', '#ef4444'];

    function createParticle(x, y) {
        const particleCount = 40;
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: x,
                y: y,
                color: colors[Math.floor(Math.random() * colors.length)],
                radius: Math.random() * 2 + 1,
                velocity: {
                    x: (Math.random() - 0.5) * 8,
                    y: (Math.random() - 0.5) * 8
                },
                alpha: 1,
                decay: Math.random() * 0.02 + 0.01
            });
        }
    }

    function loop() {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'lighter';

        particles.forEach((p, index) => {
            if (p.alpha <= 0) {
                particles.splice(index, 1);
            } else {
                p.velocity.y += 0.04;
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

        if (document.body.classList.contains('theme-newyear')) {
            requestAnimationFrame(loop);
        }
    }

    loop();

    if (window.fireworksInterval) clearInterval(window.fireworksInterval);

    window.fireworksInterval = setInterval(() => {
        if (!document.body.classList.contains('theme-newyear')) {
            clearInterval(window.fireworksInterval);
            return;
        }
        createParticle(Math.random() * canvas.width, Math.random() * canvas.height * 0.6);
    }, 800);
}

function triggerGoldConfetti() {
    const canvas = document.getElementById('fireworks-canvas');
    if (!canvas) return;
    setTimeout(() => initFireworks(), 100);
}

// Attach Global
window.startNewyearTheme = startNewyearTheme;
window.stopNewyearTheme = stopNewyearTheme;
