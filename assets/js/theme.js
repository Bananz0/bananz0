// ==========================================
// THEME TOGGLE
// Editorial is the default; cybercore is opt-in from the G menu or a
// ?mode=cyber link. The choice is remembered per visitor. The inline script
// in <head> applies it before first paint; this file only handles switching.
// Listeners (nav measurement, silicon artwork) react to `themechange`.
// ==========================================
(function () {
    'use strict';

    const KEY = 'site-theme';
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const toggles = document.querySelectorAll('[data-theme-toggle]');

    const current = () => (root.getAttribute('data-theme') === 'cyber' ? 'cyber' : 'editorial');

    function sync() {
        const cyber = current() === 'cyber';
        toggles.forEach((btn) => {
            btn.setAttribute('aria-pressed', String(cyber));
            btn.setAttribute('aria-label', cyber ? 'Switch to the editorial theme' : 'Switch to the cybercore theme');
            btn.title = cyber ? 'Editorial theme' : 'Cybercore theme';
        });
    }

    function apply(theme) {
        if (theme === 'cyber') root.setAttribute('data-theme', 'cyber');
        else root.removeAttribute('data-theme');
        try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode: session only */ }
        sync();
        document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }

    toggles.forEach((btn) => {
        btn.addEventListener('click', () => {
            const next = current() === 'cyber' ? 'editorial' : 'cyber';
            if (document.startViewTransition && !reduceMotion.matches) {
                document.startViewTransition(() => apply(next));
            } else {
                apply(next);
            }
        });
    });

    sync();
})();
