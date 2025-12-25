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
            <!-- Fireworks container exists but empty initially -->
            <div id="ny-splash-fireworks" style="position: absolute; width:100%; height:100%; top:0; left:0; pointer-events:none;"></div>
        `;
        document.body.appendChild(splash);
    }

    // 2. Prepare Main Container & Rocket
    const container = document.querySelector('.container');
    if (container) {
        // Add Ready State IMMEDIATELY (Hidden Down)
        document.body.classList.add('launch-ready');

        // Add Rocket
        if (!document.getElementById('theme-rocket')) {
            const rocket = document.createElement('div');
            rocket.id = 'theme-rocket';
            rocket.className = 'theme-rocket';
            rocket.innerHTML = '<i class="fas fa-rocket"></i>';
            container.appendChild(rocket);
        }
    }

    // 3. DO NOT Start Fireworks yet. Wait for "Login/Load" simulation.
    // initFireworks(); <--- REMOVED

    // 4. THE LAUNCH SEQUENCE
    // Wait for user to admire splash (2 seconds) simulating "Login Process" completion
    setTimeout(() => {
        // Ignite!
        document.body.classList.add('rocket-ignited');

        // Launch (Move Container Up)
        requestAnimationFrame(() => {
            // Remove 'launch-ready' (which forces translateY(100vh))
            // Add 'launching' (which has transition + translateY(0))
            document.body.classList.remove('launch-ready');
            document.body.classList.add('launching');
        });

        // Cleanup after transition (2.5s matched CSS)
        setTimeout(() => {
            const rocket = document.getElementById('theme-rocket');
            if (rocket) {
                // Rocket flies off screen
                rocket.style.transition = 'transform 1s ease-in';
                rocket.style.transform = 'translateY(-200vh)';
                setTimeout(() => rocket.remove(), 1000);
            }

            document.body.classList.remove('rocket-ignited');

            // User Request: Keep Splash visible behind. 
            // So we DO NOT remove splash.

            // Make container semi-transparent glass so we can see the text/fireworks behind
            const container = document.querySelector('.container');
            if (container) {
                container.style.background = 'rgba(2, 6, 23, 0.6)'; // Semi-transparent
                container.style.backdropFilter = 'blur(8px)'; // Blur effect
            }

            // Trigger Confetti & Start Fireworks Background NOW
            triggerGoldConfetti();
            initFireworks(); // <--- Moved here (Only after animation done)

        }, 2500);

    }, 2000);
}

function stopNewyearTheme() {
    console.log('🛑 Stopping New Year Theme');

    const splash = document.getElementById('ny-splash-screen');
    if (splash) splash.remove();

    const rocket = document.getElementById('theme-rocket');
    if (rocket) rocket.remove();

    document.body.classList.remove('launch-ready', 'launching', 'rocket-ignited');

    const canvas = document.getElementById('fireworks-canvas');
    if (canvas) {
        canvas.style.display = 'none';
        // Stop the loop if needed? Logic handles it via class check
    }
}

// --- Logic (Shared) ---

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
    // Just ensure fireworks are running (initFireworks handles it)
    // or trigger extra burst
    const canvas = document.getElementById('fireworks-canvas');
    if (!canvas) return;
    // We can assume loop is running after initFireworks called
}

// Attach Global
window.startNewyearTheme = startNewyearTheme;
window.stopNewyearTheme = stopNewyearTheme;
