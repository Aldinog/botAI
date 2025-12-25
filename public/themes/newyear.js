/**
 * New Year Theme Logic
 */

let fireworksInterval;
let animationFrameId;

window.startNewyearTheme = function () {
    initFireworks();

    const authStatus = document.getElementById('auth-status');
    if (authStatus && authStatus.innerText.includes('Authenticating')) {
        authStatus.innerText = 'Happy New Year! Processing... 🎆';
    }
    console.log('New Year Theme Started 🎆');
};

window.stopNewyearTheme = function () {
    clearInterval(fireworksInterval);
    cancelAnimationFrame(animationFrameId);
    const canvas = document.getElementById('fireworks-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
        // Force hide style if controlled by css also
        canvas.style.display = '';
    }
    console.log('New Year Theme Stopped');
};

function initFireworks() {
    const canvas = document.getElementById('fireworks-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Visiblity handled by start/CSS, but ensure canvas prop

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
