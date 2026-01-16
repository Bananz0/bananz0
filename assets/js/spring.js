/**
 * Apple-style Spring Animation System
 * Converts spring physics parameters (stiffness, damping, mass) to CSS timing functions
 * Based on spring-mass-damper system physics
 */

class SpringAnimation {
    /**
     * Spring presets matching Apple's design language
     */
    static presets = {
        // Snappy, responsive - for UI interactions
        snappy: {
            stiffness: 520,
            damping: 28,
            mass: 0.9,
            initialVelocity: 0
        },
        // Default - balanced, responsive with slight bounce
        default: {
            stiffness: 380,
            damping: 22,
            mass: 1.0,
            initialVelocity: 0
        },
        // Smooth - increased mass and damping (trial)
        smooth: {
            stiffness: 320,
            damping: 38,
            mass: 1.6,
            initialVelocity: 0
        },
        // Bouncy - playful but still responsive
        bouncy: {
            stiffness: 340,
            damping: 16,
            mass: 1.0,
            initialVelocity: 0
        },
        // Slow - deliberate and heavy
        slow: {
            stiffness: 140,
            damping: 18,
            mass: 1.6,
            initialVelocity: 0
        }
    };

    /**
     * Calculate spring animation curve
     * @param {number} stiffness - Spring stiffness (higher = faster)
     * @param {number} damping - Damping coefficient (higher = less oscillation)
     * @param {number} mass - Mass of the object (higher = slower)
     * @param {number} initialVelocity - Initial velocity
     * @returns {Object} Animation properties
     */
    static calculate(stiffness = 300, damping = 28, mass = 1, initialVelocity = 0) {
        // Calculate natural frequency and damping ratio
        const omega0 = Math.sqrt(stiffness / mass);
        const zeta = damping / (2 * Math.sqrt(stiffness * mass));
        
        // Determine if underdamped, critically damped, or overdamped
        const isUnderdamped = zeta < 1;
        const isCriticallyDamped = Math.abs(zeta - 1) < 0.001;
        
        // Calculate settling time (time to reach 2% of final value)
        let duration;
        if (isUnderdamped) {
            duration = (3.8 / (zeta * omega0)) * 1000; // Convert to ms
        } else {
            duration = (3.5 / omega0) * 1000;
        }
        
        // Generate cubic-bezier approximation for the spring
        const bezier = this.springToBezier(stiffness, damping, mass, duration);
        
        return {
            duration: Math.max(160, Math.min(duration, 2200)), // Clamp between 160ms-2.2s for responsive feel
            timingFunction: `cubic-bezier(${bezier.join(', ')})`,
            stiffness,
            damping,
            mass,
            initialVelocity
        };
    }

    /**
     * Approximate spring motion with cubic-bezier
     * Uses iterative fitting to match spring curve
     */
    static springToBezier(stiffness, damping, mass, duration) {
        const zeta = damping / (2 * Math.sqrt(stiffness * mass));
        
        // Apple-style bezier approximations with enhanced bounce
        if (zeta >= 1) {
            // Overdamped or critically damped - smooth, no overshoot
            return [0.4, 0, 0.2, 1];
        } else if (zeta >= 0.8) {
            // Slightly underdamped - gentle bounce
            return [0.36, 0, 0.66, 1.02];
        } else if (zeta >= 0.5) {
            // Moderate underdamping - noticeable bounce
            return [0.34, 0, 0.55, 1.05];
        } else {
            // Heavily underdamped - pronounced bounce with overshoot
            const overshoot = Math.min(1.15, (1 - zeta) * 0.8 + 1);
            return [0.32, 0, 0.5, overshoot];
        }
    }

    /**
     * Apply spring animation to CSS custom properties
     */
    static applySprings() {
        const root = document.documentElement;
        const prefersReduced = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (prefersReduced) {
            // Respect user preference: minimize motion
            root.style.setProperty('--spring-snappy', `0ms linear`);
            root.style.setProperty('--spring-default', `0ms linear`);
            root.style.setProperty('--spring-smooth', `0ms linear`);
            root.style.setProperty('--spring-bouncy', `0ms linear`);
            root.style.setProperty('--transition-fast', `0ms linear`);
            root.style.setProperty('--transition-normal', `0ms linear`);
            root.style.setProperty('--transition-slow', `0ms linear`);
            root.style.setProperty('--transition-bounce', `0ms linear`);
            try {
                document.querySelectorAll('[data-spring]').forEach(el => {
                    el.style.transition = 'none';
                });
            } catch (e) {}
            return;
        }
        
        // Calculate spring animations for different speeds
        const snappy = this.calculate(400, 30, 1);
        const defaultSpring = this.calculate(300, 28, 1);
        const smooth = this.calculate(320, 38, 1.6);
        const bouncy = this.calculate(380, 18, 1);
        
        // Set CSS custom properties
        root.style.setProperty('--spring-snappy-duration', `${snappy.duration}ms`);
        root.style.setProperty('--spring-snappy-timing', snappy.timingFunction);
        root.style.setProperty('--spring-snappy', `${snappy.duration}ms ${snappy.timingFunction}`);
        
        root.style.setProperty('--spring-default-duration', `${defaultSpring.duration}ms`);
        root.style.setProperty('--spring-default-timing', defaultSpring.timingFunction);
        root.style.setProperty('--spring-default', `${defaultSpring.duration}ms ${defaultSpring.timingFunction}`);
        
        root.style.setProperty('--spring-smooth-duration', `${smooth.duration}ms`);
        root.style.setProperty('--spring-smooth-timing', smooth.timingFunction);
        root.style.setProperty('--spring-smooth', `${smooth.duration}ms ${smooth.timingFunction}`);
        
        root.style.setProperty('--spring-bouncy-duration', `${bouncy.duration}ms`);
        root.style.setProperty('--spring-bouncy-timing', bouncy.timingFunction);
        root.style.setProperty('--spring-bouncy', `${bouncy.duration}ms ${bouncy.timingFunction}`);
        
        // Update old transition variables to use springs
        root.style.setProperty('--transition-fast', `${snappy.duration}ms ${snappy.timingFunction}`);
        root.style.setProperty('--transition-normal', `${defaultSpring.duration}ms ${defaultSpring.timingFunction}`);
        root.style.setProperty('--transition-slow', `${smooth.duration}ms ${smooth.timingFunction}`);
        root.style.setProperty('--transition-bounce', `${bouncy.duration}ms ${bouncy.timingFunction}`);

        // Apply per-element transitions for elements with `data-spring` attribute
        try {
            document.querySelectorAll('[data-spring]').forEach(el => {
                const key = el.getAttribute('data-spring') || 'default';
                let config = this.presets[key] || null;
                if (!config) {
                    // allow inline numeric attributes (data-stiffness etc)
                    const s = parseFloat(el.getAttribute('data-stiffness')) || undefined;
                    const d = parseFloat(el.getAttribute('data-damping')) || undefined;
                    const m = parseFloat(el.getAttribute('data-mass')) || undefined;
                    if (s || d || m) {
                        config = { ...this.presets.default };
                        if (s) config.stiffness = s;
                        if (d) config.damping = d;
                        if (m) config.mass = m;
                    }
                }

                // support per-element bounce via `data-bounce` (optional)
                const bounceAttr = el.getAttribute('data-bounce');
                let anim;
                if (bounceAttr !== null) {
                    const factor = parseFloat(bounceAttr) || 1;
                    const base = config ? { ...config } : { ...this.presets.default };
                    // reduce damping to allow controlled overshoot; clamp to reasonable range
                    const dampReduction = Math.min(20, Math.max(4, 10 * factor));
                    const newDamping = Math.max(6, (base.damping || this.presets.default.damping) - dampReduction);
                    anim = this.calculate(base.stiffness || this.presets.default.stiffness, newDamping, base.mass || this.presets.default.mass, base.initialVelocity || 0);
                } else {
                    anim = config ? this.custom(config) : this.calculate();
                }
                const t = `${anim.duration}ms ${anim.timingFunction}`;
                // Apply to common properties used in this site, include size properties so expansions (max-width/max-height) animate
                el.style.transition = `opacity ${t}, transform ${t}, box-shadow ${t}, max-width ${t}, max-height ${t}, width ${t}, height ${t}, margin ${t}, padding ${t}`;
                // Hint the compositor for smoother animations
                try { el.style.willChange = 'transform, opacity, max-height, max-width'; } catch (e) {}
            });
        } catch (e) {
            // ignore in environments without DOM
        }
    }

    /**
     * Create custom spring animation with specific parameters
     */
    static custom(params = {}) {
        const config = { ...this.presets.default, ...params };
        return this.calculate(
            config.stiffness,
            config.damping,
            config.mass,
            config.initialVelocity
        );
    }
}

// Initialize springs when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SpringAnimation.applySprings());
} else {
    SpringAnimation.applySprings();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpringAnimation;
}

// Recalculate spring variables on resize/orientation change to keep timings responsive
function debounce(fn, wait = 150) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

const reapply = debounce(() => SpringAnimation.applySprings(), 180);
window.addEventListener('resize', reapply, { passive: true });
window.addEventListener('orientationchange', reapply, { passive: true });
// React to user's reduced-motion preference changes
if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.addEventListener) {
        mq.addEventListener('change', () => SpringAnimation.applySprings());
    } else if (mq.addListener) {
        mq.addListener(() => SpringAnimation.applySprings());
    }
}
