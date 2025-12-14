document.addEventListener('DOMContentLoaded', () => {
    // Initialize Telegram Web App
    const tg = window.Telegram.WebApp;

    // Expand to full height
    tg.expand();

    // Set header color to match our dark theme
    if (tg.setHeaderColor) {
        tg.setHeaderColor('#050505');
    }
    if (tg.setBackgroundColor) {
        tg.setBackgroundColor('#050505');
    }

    // Interactivity for the "Initialize Chat" button
    const startBtn = document.getElementById('start-chat-btn');
    startBtn.addEventListener('click', () => {
        // Haptic feedback
        if (tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('heavy');
        }

        // Visual feedback
        startBtn.innerHTML = '<span class="btn-content">INITIALIZING...</span>';
        
        // Simulate loading then maybe close or send data
        setTimeout(() => {
            startBtn.innerHTML = '<span class="btn-content">ACTIVE</span>';
            startBtn.style.borderColor = '#00f3ff';
            startBtn.style.color = '#00f3ff';
            startBtn.style.boxShadow = '0 0 20px #00f3ff';
            
            // Send data back to bot (optional demo)
            // tg.sendData("Chat Initialized"); 
        }, 1500);
    });

    // Glitch effect randomization (optional enhancement)
    const glitchText = document.querySelector('.glitch');
    if (glitchText) {
        setInterval(() => {
            glitchText.style.textShadow = `
                ${Math.random() * 4 - 2}px ${Math.random() * 4 - 2}px 0 #ff00ff,
                ${Math.random() * 4 - 2}px ${Math.random() * 4 - 2}px 0 #00f3ff
            `;
            setTimeout(() => {
                glitchText.style.textShadow = '0 0 10px rgba(0, 243, 255, 0.7)';
            }, 100);
        }, 3000);
    }
});
