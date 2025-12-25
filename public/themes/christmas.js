/**
 * Christmas Theme Logic
 */

// Global control functions called by theme-engine.js

window.startChristmasTheme = function () {
    initSnowflakes();

    // Auth status override for index.html
    const authStatus = document.getElementById('auth-status');
    if (authStatus) {
        // Only if currently authenticating, but this might persist
        // We can just set it if present, usually safe
        if (authStatus.innerText.includes('Authenticating')) {
            authStatus.innerText = 'Merry Christmas! Processing... 🎄';
        }
    }

    console.log('Christmas Theme Started 🎄');
};

window.stopChristmasTheme = function () {
    const container = document.getElementById('snow-container');
    if (container) container.innerHTML = '';
    console.log('Christmas Theme Stopped');
};

function initSnowflakes() {
    const container = document.getElementById('snow-container');
    if (!container) return;

    if (container.children.length > 0) return; // Prevent double init

    const count = 20;
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
