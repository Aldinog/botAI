/**
 * Theme Engine
 * Handles dynamic loading/unloading of theme assets.
 */
class ThemeEngine {
    constructor() {
        this.basePath = 'themes/';
        this.activeTheme = localStorage.getItem('active_theme') || 'default';
        this.loadedStyles = new Set();
        this.loadedScripts = new Set();

        // Registry of available themes
        this.THEMES = ['default', 'christmas', 'newyear', 'ramadan'];

        this.themePaths = {
            'default': { css: 'themes/default.css' },
            'christmas': { css: 'themes/christmas.css', js: 'themes/christmas.js' },
            'newyear': { css: 'themes/newyear.css', js: 'themes/newyear.js' },
            'ramadan': { css: 'themes/ramadan.css', js: 'themes/ramadan.js' }
        };
    }

    init() {
        // Load default theme base (always needed for variables)
        this.loadCSS('default.css');

        // Apply persisted theme
        this.applyTheme(this.activeTheme);
    }

    async applyTheme(themeName) {
        console.log(`Applying Theme: ${themeName}`);
        const oldTheme = this.activeTheme;

        // 1. Remove old theme class from body
        if (oldTheme !== 'default') {
            document.body.classList.remove(`theme-${oldTheme}`);
            this.unloadThemeAssets(oldTheme);
        }

        // 2. Set new theme
        this.activeTheme = themeName;
        localStorage.setItem('active_theme', themeName);

        if (themeName !== 'default') {
            document.body.classList.add(`theme-${themeName}`);

            // Load specific assets
            this.loadCSS(`${themeName}.css`);
            await this.loadJS(`${themeName}.js`);

            // Initialize theme-specific logic if available
            // Convention: each theme JS exposes a `startTheme()` and `stopTheme()` function globally
            const startFn = window[`start${this.capitalize(themeName)}Theme`];
            if (typeof startFn === 'function') {
                startFn();
            }
        }
    }

    unloadThemeAssets(themeName) {
        // We generally keep CSS loaded to avoid flash of unstyled content if switching back,
        // but for clean separation let's remove specific JS side effects.

        const stopFn = window[`stop${this.capitalize(themeName)}Theme`];
        if (typeof stopFn === 'function') {
            stopFn();
        }

        // Optional: Remove CSS link tag if strictly needed (usually not necessary for simple overrides)
        // const link = document.querySelector(`link[href="${this.basePath}${themeName}.css"]`);
        // if (link) link.remove();
    }

    loadCSS(filename) {
        if (this.loadedStyles.has(filename)) return;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `${this.basePath}${filename}`;
        document.head.appendChild(link);
        this.loadedStyles.add(filename);
    }

    loadJS(filename) {
        return new Promise((resolve, reject) => {
            if (this.loadedScripts.has(filename)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = `${this.basePath}${filename}`;
            script.onload = () => {
                this.loadedScripts.add(filename);
                resolve();
            };
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// Global Instance
window.themeEngine = new ThemeEngine();
// Delay init slightly to ensure DOM logic needs
document.addEventListener('DOMContentLoaded', () => {
    // Check if init already called manually? No, just call it.
    window.themeEngine.init();
});
