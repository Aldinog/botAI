function startNewyearTheme() {
    console.log('🎆 Starting New Year Theme: Simple Mode');

    // 1. Start Fireworks Background Immediately
    initFireworks();

    // 2. Add transparency classes to container for visibility
    const container = document.querySelector('.container');
    if (container) {
        // Ensure container is glass-like so fireworks show through
        // The CSS handles the base style, but we reinforce transparency here if needed
        // or rely on the CSS update we are about to make.
    }

    // 3. Trigger initial confetti burst for celebration
    triggerGoldConfetti();
}

function stopNewyearTheme() {
    console.log('🛑 Stopping New Year Theme');

    const canvas = document.getElementById('fireworks-canvas');
    if (canvas) {
        canvas.style.display = 'none';
    }

    // Initial cleanup if switching away (though standard theme engine handles basics)
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
