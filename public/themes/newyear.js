function startNewyearTheme() {
    console.log('🎆 Starting New Year Theme: Midnight Gold');

    // 1. Start Fireworks Background
    initFireworks();

    // 2. Add specific celebratory classes (optional, handled mostly by CSS)
    document.body.classList.add('celebration-mode');

    // 3. Trigger initial confetti burst for "Wow" factor
    triggerGoldConfetti();
}

function stopNewyearTheme() {
    console.log('🛑 Stopping New Year Theme');

    // 1. Stop Fireworks
    const canvas = document.getElementById('fireworks-canvas');
    if (canvas) {
        canvas.style.display = 'none';
        // Only clear canvas context if we want to stop animation loop completely?
        // For now, hidden is enough. CSS handles display:none.
    }

    document.body.classList.remove('celebration-mode');
}

// --- Logic ---

function initFireworks() {
    const canvas = document.getElementById('fireworks-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // We rely on CSS to show it
    // canvas.style.display = 'block'; 

    let particles = [];
    // Gold, Silver, White, Red
    const colors = ['#fbbf24', '#f59e0b', '#e2e8f0', '#ffffff', '#ef4444'];

    function createParticle(x, y) {
        const particleCount = 40; // Dense explosion
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: x,
                y: y,
                color: colors[Math.floor(Math.random() * colors.length)],
                radius: Math.random() * 2 + 1,
                velocity: {
                    x: (Math.random() - 0.5) * 8, // Faster spread
                    y: (Math.random() - 0.5) * 8
                },
                alpha: 1,
                decay: Math.random() * 0.02 + 0.01
            });
        }
    }

    function loop() {
        // Trail effect
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Slower fade for longer trails
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'lighter';

        particles.forEach((p, index) => {
            if (p.alpha <= 0) {
                particles.splice(index, 1);
            } else {
                p.velocity.y += 0.04; // Gravity
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

    // Auto launch fireworks randomly
    // Prevent multiple intervals just in case
    if (window.fireworksInterval) clearInterval(window.fireworksInterval);

    window.fireworksInterval = setInterval(() => {
        if (!document.body.classList.contains('theme-newyear')) {
            clearInterval(window.fireworksInterval);
            return;
        }
        createParticle(Math.random() * canvas.width, Math.random() * canvas.height * 0.6);
    }, 1200); // Slightly more frequent
}

function triggerGoldConfetti() {
    // Re-use the existing confetti canvas if available, or just use fireworks
    // This is a quick burst
    const canvas = document.getElementById('fireworks-canvas');
    if (!canvas) return;

    // Just force a few big explosions in the center
    setTimeout(() => initFireworks(), 100);
}

// Attach to window for ThemeEngine
window.startNewyearTheme = startNewyearTheme;
window.stopNewyearTheme = stopNewyearTheme;
