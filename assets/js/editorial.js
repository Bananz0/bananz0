// ==========================================
// EDITORIAL PAGE HELPERS
// Long project descriptions are clamped to a few lines (.ed-item-desc in
// refine.css); this adds a "Read more" toggle only where text is actually cut.
// The toggle stops propagation because the whole row opens the project modal.
// ==========================================
(function () {
    'use strict';

    function initClamps() {
        document.querySelectorAll('.ed-item-desc').forEach((desc) => {
            if (desc.dataset.clampReady) return;
            desc.dataset.clampReady = '1';
            desc.classList.add('is-clamped');

            // Without the clamp, does it run past the clamped height?
            const clampedHeight = desc.clientHeight;
            desc.classList.remove('is-clamped');
            const fullHeight = desc.scrollHeight;
            if (fullHeight - clampedHeight < 8) return;
            desc.classList.add('is-clamped');

            if (!desc.id) desc.id = 'ed-desc-' + Math.random().toString(36).slice(2, 8);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ed-more-toggle';
            btn.textContent = 'Read more';
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-controls', desc.id);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = desc.classList.toggle('is-clamped') === false;
                btn.textContent = open ? 'Show less' : 'Read more';
                btn.setAttribute('aria-expanded', String(open));
            });
            btn.addEventListener('keydown', (e) => e.stopPropagation());
            desc.after(btn);
        });
    }

    const start = () => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(initClamps);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
