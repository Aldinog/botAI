function startNewyearTheme() {
    console.log('🚀 Starting New Year Theme: Rocket Launch Sequence');

    // 1. Prepare Splash Screen (Only if not already present)
    if (!document.getElementById('ny-splash-screen')) {
        const splash = document.createElement('div');
        splash.id = 'ny-splash-screen';
        splash.innerHTML = `
            <div class="ny-title">
                HAPPY<br>NEW YEAR
                <span style="display:block; font-size: 0.5em; color: white;">2026</span>
            </div>
            <div id="ny-splash-fireworks" style="position: absolute; width:100%; height:100%; top:0; left:0; pointer-events:none;"></div>
        `;
        document.body.appendChild(splash);
    }

    // 2. Prepare Main Container & Rocket
    const container = document.querySelector('.container');
    if (container) {
        // Add Ready State (Hidden Down)
        document.body.classList.add('launch-ready');

        // Add Rocket
        if (!document.getElementById('theme-rocket')) {
            const rocket = document.createElement('div');
            rocket.id = 'theme-rocket';
            rocket.className = 'theme-rocket';
            rocket.innerHTML = '<i class="fas fa-rocket"></i>';
            container.appendChild(rocket); // Attach to container so it moves with it
        }
    }

    // 3. Start Fireworks on Splash
    initFireworks();

    // 4. THE LAUNCH SEQUENCE
    // Wait for user to admire splash (2 seconds)
    setTimeout(() => {
        // Ignite!
        document.body.classList.add('rocket-ignited');

        // Play Sound? (Optional, maybe later)

        // Launch (Move Container Up)
        requestAnimationFrame(() => {
            document.body.classList.add('launching');
            document.body.classList.remove('launch-ready');
        });

        // Cleanup after transition (2.5s matched CSS)
        setTimeout(() => {
            const splash = document.getElementById('ny-splash-screen');
            if (splash) splash.remove();

            const rocket = document.getElementById('theme-rocket');
            if (rocket) {
                // Rocket flies off screen
                rocket.style.transition = 'transform 1s ease-in';
                rocket.style.transform = 'translateY(-200vh)';
                setTimeout(() => rocket.remove(), 1000);
            }

            document.body.classList.remove('rocket-ignited');

            // Trigger Confetti Celebration (Arrival)
            triggerGoldConfetti();
        }, 2500);

    }, 2000);
}

function stopNewyearTheme() {
    console.log('🛑 Stopping New Year Theme');

    // Cleanup Splash
    const splash = document.getElementById('ny-splash-screen');
    if (splash) splash.remove();

    // Cleanup Rocket
    const rocket = document.getElementById('theme-rocket');
    if (rocket) rocket.remove();

    // Reset Classes
    document.body.classList.remove('launch-ready', 'launching', 'rocket-ignited');

    // Stop Fireworks
    const canvas = document.getElementById('fireworks-canvas');
    if (canvas) {
        canvas.style.display = 'none';
    }
}

// --- Logic (Shared with previous version) ---

function initFireworks() {
    // Re-using main canvas or splash specific if needed
    // For simplicity, we use the global canvas which is fixed overlay
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

// Attach to window for ThemeEngine
window.startNewyearTheme = startNewyearTheme;
window.stopNewyearTheme = stopNewyearTheme;
