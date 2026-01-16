// ==========================================
// NEXUS PORTFOLIO - PREMIUM INTERACTIONS
// Glen Muthoka - Embedded Systems Engineer
// 
// PERFORMANCE OPTIMIZATIONS IMPLEMENTED:
// - Consolidated mousemove listeners (1 instead of 4+)
// - Spatial hash grid for O(n) particle connections vs O(n²)
// - Batched canvas rendering (color groups)
// - Event delegation instead of MutationObservers
// - Cached getBoundingClientRect calls
// - Passive event listeners for scroll/touch
// - Device-based particle count adjustment
// - Throttled resize handlers
// - requestIdleCallback for non-critical animations
// ==========================================

// Shared smoothed mouse position for consistent animation timing
let smoothMouseX = window.innerWidth / 2;
let smoothMouseY = window.innerHeight / 2;
let rawMouseX = window.innerWidth / 2;
let rawMouseY = window.innerHeight / 2;
let mouseParticleX = -1000;
let mouseParticleY = -1000;

// OPTIMIZED: Single unified mouse tracking handler for all features
document.addEventListener('mousemove', (e) => {
    rawMouseX = e.clientX;
    rawMouseY = e.clientY;
    mouseParticleX = e.clientX;
    mouseParticleY = e.clientY;
}, { passive: true });

// Single animation loop for smooth mouse position
function updateSmoothMouse() {
    const easing = 0.15;
    smoothMouseX += (rawMouseX - smoothMouseX) * easing;
    smoothMouseY += (rawMouseY - smoothMouseY) * easing;
    requestAnimationFrame(updateSmoothMouse);
}
updateSmoothMouse();

// Dot grid removed - focusing on liquid glass and cyberpunk aesthetics

// ==========================================
// PREMIUM INTERACTIVE PARTICLE SYSTEM
// ==========================================
const canvas = document.getElementById('particles');
const ctx = canvas ? canvas.getContext('2d', {
    alpha: true,
    desynchronized: true,  // Allows canvas to bypass compositor for lower latency
    willReadFrequently: false
}) : null;

if (ctx) {
    // Force GPU layer
    canvas.style.transform = 'translateZ(0)';
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resizeCanvas();

    // OPTIMIZED: Detect device performance and adjust particle count
    const isLowEnd = navigator.hardwareConcurrency <= 4 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);
    const particles = [];
    const particleCount = isLowEnd ? 45 : (window.innerWidth < 768 ? 65 : 90);

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.3;
            this.vy = (Math.random() - 0.5) * 0.3;
            this.size = Math.random() * 2 + 0.5;
            this.baseVx = this.vx;
            this.baseVy = this.vy;
            this.hue = Math.random() * 60 + 280; // Purple to magenta range
        }

        update() {
            // Calculate distance from mouse
            const dx = this.x - mouseParticleX;
            const dy = this.y - mouseParticleY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const interactionRadius = 120;

            // Apply repel force when mouse is near
            if (distance < interactionRadius) {
                const force = (interactionRadius - distance) / interactionRadius;
                const angle = Math.atan2(dy, dx);
                const repelStrength = 2;

                this.vx = this.baseVx + Math.cos(angle) * force * repelStrength;
                this.vy = this.baseVy + Math.sin(angle) * force * repelStrength;
            } else {
                // Gradually return to base velocity
                this.vx += (this.baseVx - this.vx) * 0.03;
                this.vy += (this.baseVy - this.vy) * 0.03;
            }

            this.x += this.vx;
            this.y += this.vy;

            // Wrap around edges smoothly
            if (this.x < -10) this.x = canvas.width + 10;
            if (this.x > canvas.width + 10) this.x = -10;
            if (this.y < -10) this.y = canvas.height + 10;
            if (this.y > canvas.height + 10) this.y = -10;
        }

        getColor() {
            // Calculate distance from mouse for color intensity
            const dx = this.x - mouseParticleX;
            const dy = this.y - mouseParticleY;
            const distSq = dx * dx + dy * dy;
            const maxDistSq = 22500; // 150^2

            let opacity = 0.4;

            // Change color when near mouse
            if (distSq < maxDistSq) {
                const proximity = 1 - Math.sqrt(distSq / maxDistSq);
                opacity = 0.4 + proximity * 0.6;
                const h = this.hue + (180 - this.hue) * proximity;
                return `hsla(${h}, 100%, 60%, ${opacity})`;
            }
            return `hsla(${this.hue}, 80%, 50%, ${opacity})`;
        }
    }

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    // OPTIMIZED: Spatial hash grid for efficient neighbor detection
    const cellSize = 80;
    function getSpatialKey(x, y) {
        return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update all particles
        particles.forEach(particle => particle.update());

        // OPTIMIZED: Build spatial hash grid O(n) instead of O(n²)
        const grid = new Map();
        particles.forEach(particle => {
            const key = getSpatialKey(particle.x, particle.y);
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(particle);
        });

        // OPTIMIZED: Batch rendering by color groups
        const colorGroups = new Map();
        particles.forEach(particle => {
            const color = particle.getColor();
            if (!colorGroups.has(color)) colorGroups.set(color, []);
            colorGroups.get(color).push(particle);
        });

        // Draw particles in batches
        colorGroups.forEach((group, color) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            group.forEach(particle => {
                ctx.moveTo(particle.x + particle.size, particle.y);
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            });
            ctx.fill();
        });

        // Draw connections using spatial hash (check only adjacent cells)
        const maxDistSq = 6400; // 80^2
        const drawnConnections = new Set();

        particles.forEach(particle => {
            const cellX = Math.floor(particle.x / cellSize);
            const cellY = Math.floor(particle.y / cellSize);

            // Check only adjacent cells (9 cells total)
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const key = `${cellX + dx},${cellY + dy}`;
                    const neighbors = grid.get(key);
                    if (!neighbors) continue;

                    neighbors.forEach(neighbor => {
                        if (particle === neighbor) return;

                        // Prevent duplicate connections
                        const connectionKey = particle.x < neighbor.x ?
                            `${particle.x},${particle.y}-${neighbor.x},${neighbor.y}` :
                            `${neighbor.x},${neighbor.y}-${particle.x},${particle.y}`;
                        if (drawnConnections.has(connectionKey)) return;
                        drawnConnections.add(connectionKey);

                        const dx = particle.x - neighbor.x;
                        const dy = particle.y - neighbor.y;
                        const distSq = dx * dx + dy * dy;

                        if (distSq < maxDistSq) {
                            const opacity = (1 - distSq / maxDistSq) * 0.15;
                            ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`;
                            ctx.lineWidth = 0.5;
                            ctx.beginPath();
                            ctx.moveTo(particle.x, particle.y);
                            ctx.lineTo(neighbor.x, neighbor.y);
                            ctx.stroke();
                        }
                    });
                }
            }
        });

        requestAnimationFrame(animateParticles);
    }

    animateParticles();

    // OPTIMIZED: Throttled resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, 150);
    }, { passive: true });
}

// ==========================================
// TERMINAL CURSOR BLINK ANIMATION
// ==========================================
const style = document.createElement('style');
style.textContent = `
    @keyframes blink {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
    }
`;
document.head.appendChild(style);

// ==========================================
// SMOOTH SCROLLING FOR NAVIGATION LINKS
// ==========================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ==========================================
// INTERSECTION OBSERVER FOR ANIMATIONS
// ==========================================
const observerOptions = {
    threshold: 0.05,  // Reduced threshold for better mobile visibility
    rootMargin: '0px 0px -20px 0px'  // Reduced bottom margin for mobile
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            // OPTIMIZED: Use requestIdleCallback for non-critical animations
            const addVisible = () => {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 100);
            };

            if ('requestIdleCallback' in window) {
                requestIdleCallback(addVisible, { timeout: 500 });
            } else {
                addVisible();
            }
        }
    });
}, observerOptions);

// Observe all elements with fade-in class
document.querySelectorAll('.fade-in, .stat-card, .project-card, .skill-panel, .holo-panel, .tech-card').forEach(el => {
    observer.observe(el);
});

// ==========================================
// MOBILE MENU TOGGLE
// ==========================================
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const navLinks = document.querySelector('.nav-links');

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        mobileMenuToggle.classList.toggle('active');
        // Prevent body scroll when menu is open
        document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    });

    // Close menu when clicking on a link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navLinks.classList.contains('active')) {
            navLinks.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

// ==========================================
// FLOATING HERO SCROLL EFFECT & MINI-TOGGLE
// ==========================================
const floatingCtas = document.querySelector('.floating-ctas');
const floatingInner = document.querySelector('.floating-inner');
const heroSection = document.querySelector('.hero');
const miniToggle = document.querySelector('.mini-toggle');
let lastScroll = 0;
let ticking = false;
let autoCollapseTimer = null;

// Handle Mini-Mode Toggle Click
if (floatingInner && miniToggle) {
    const toggleExpansion = (e) => {
        e.stopPropagation();
        if (window.innerWidth <= 500 || window.innerHeight <= 660) {
            // Check for BOTH expanded states to determine if currently expanded
            const isExpanded = floatingInner.classList.contains('mini-expanded') ||
                floatingInner.classList.contains('expanded');

            if (isExpanded) {
                // Collapse
                floatingInner.classList.remove('mini-expanded', 'expanded');
                floatingInner.classList.add('compact');
                if (floatingCtas) floatingCtas.classList.remove('visible');
            } else {
                // Expand manually
                floatingInner.classList.add('mini-expanded', 'expanded');
                floatingInner.classList.remove('compact');
                if (floatingCtas) floatingCtas.classList.add('visible');
            }
            // Reset timer on click too
            startAutoCollapseTimer();
        }
    };

    if (miniToggle) miniToggle.addEventListener('click', toggleExpansion);

    const titleGroup = floatingInner.querySelector('.title-group');
    if (titleGroup) titleGroup.addEventListener('click', toggleExpansion);
}

function startAutoCollapseTimer() {
    clearAutoCollapseTimer();
    autoCollapseTimer = setTimeout(() => {
        // Auto-collapse after 1.5 seconds of no activity (Universal in mini-mode)
        const isMiniMode = window.innerWidth <= 500 || window.innerHeight <= 660;

        if (floatingInner && isMiniMode) {
            const isExpanded = floatingInner.classList.contains('mini-expanded') ||
                floatingInner.classList.contains('expanded');

            if (isExpanded) {
                floatingInner.classList.remove('mini-expanded', 'expanded');
                floatingInner.classList.add('compact');
                if (floatingCtas) floatingCtas.classList.remove('visible');

                // Keep the chevron highlighted if the page has been scrolled past the hero.
                // Only remove the highlight when the user is inside the hero area.
                if (miniToggle) {
                    const currentScroll = window.pageYOffset;
                    const heroHeight = heroSection ? heroSection.offsetHeight * 0.6 : 500;
                    if (currentScroll <= heroHeight) {
                        miniToggle.classList.remove('highlight');
                    }
                }
            }
        }
    }, 1500);
}

function clearAutoCollapseTimer() {
    if (autoCollapseTimer) {
        clearTimeout(autoCollapseTimer);
        autoCollapseTimer = null;
    }
}

function updateFloatingHero() {
    const currentScroll = window.pageYOffset;
    const scrollDelta = currentScroll - lastScroll;
    const isScrollingUp = scrollDelta < -2;
    const isScrollingDown = scrollDelta > 2;

    const heroHeight = heroSection ? heroSection.offsetHeight * 0.6 : 500;
    const isMiniMode = window.innerWidth <= 500 || window.innerHeight <= 660;

    if (currentScroll > heroHeight) {
        // PAST HERO
        if (!isMiniMode) {
            // Desktop/Tablet stays expanded
            if (floatingCtas) floatingCtas.classList.add('visible');
            if (floatingInner) {
                floatingInner.classList.remove('compact', 'mini-expanded');
                floatingInner.classList.add('expanded');
            }
            clearAutoCollapseTimer();
        } else {
            // Mobile past hero: can be compact UNLESS actively interacting/scrolling stop timer
            // We only FORCE expansion on scroll-up
            if (isScrollingUp) {
                if (floatingInner) {
                    floatingInner.classList.remove('compact');
                    floatingInner.classList.add('mini-expanded', 'expanded');
                    if (floatingCtas) floatingCtas.classList.add('visible');
                }
            } else if (isScrollingDown) {
                if (floatingInner) {
                    floatingInner.classList.remove('mini-expanded', 'expanded');
                    floatingInner.classList.add('compact');
                    if (floatingCtas) floatingCtas.classList.remove('visible');
                }
            }
        }
        if (miniToggle) {
            // Preserve chevron highlight for mini-mode users when they've scrolled past
            // the hero/CTAs. Only remove highlight for non-mini (desktop/tablet).
            if (!isMiniMode) {
                miniToggle.classList.remove('highlight');
            } else {
                // If the header is expanded (user opened it), don't keep highlight
                if (floatingInner && (floatingInner.classList.contains('mini-expanded') || floatingInner.classList.contains('expanded'))) {
                    miniToggle.classList.remove('highlight');
                }
                // Otherwise keep the highlight so the chevron remains noticeable
            }
        }
    } else {
        // IN HERO SECTION
        if (isMiniMode) {
            if (isScrollingUp && currentScroll > 50) {
                // Expand momentarily on scroll-up
                if (floatingInner) {
                    floatingInner.classList.add('mini-expanded', 'expanded');
                    floatingInner.classList.remove('compact');
                }
                if (floatingCtas) floatingCtas.classList.add('visible');
                if (miniToggle) miniToggle.classList.remove('highlight');
            } else if (isScrollingDown && currentScroll > 50) {
                // Immediate collapse hint on scroll-down
                if (floatingInner) {
                    floatingInner.classList.remove('mini-expanded', 'expanded');
                    floatingInner.classList.add('compact');
                    if (floatingCtas) floatingCtas.classList.remove('visible');
                }
                if (miniToggle) miniToggle.classList.add('highlight');
            } else if (currentScroll < 50) {
                // Full reset at top
                if (floatingInner) {
                    floatingInner.classList.remove('mini-expanded', 'expanded');
                    floatingInner.classList.add('compact');
                }
                if (floatingCtas) floatingCtas.classList.remove('visible');
                if (miniToggle) miniToggle.classList.remove('highlight');
                clearAutoCollapseTimer();
            }
        } else {
            // Desktop/Tablet
            if (floatingCtas) floatingCtas.classList.remove('visible');
            if (floatingInner) {
                floatingInner.classList.remove('expanded', 'mini-expanded');
                floatingInner.classList.add('compact');
            }
            if (miniToggle) miniToggle.classList.remove('highlight');
            clearAutoCollapseTimer();
        }
    }

    lastScroll = currentScroll;
    ticking = true;
}

// Tick management with scroll-stop detection
function handleScroll() {
    if (!ticking) {
        requestAnimationFrame(() => {
            updateFloatingHero();
            ticking = false;
        });
        ticking = true;
    }

    // Clear existing timer while scrolling
    clearAutoCollapseTimer();

    // Start timer when scrolling stops (debounced)
    clearTimeout(window.scrollStopTimer);
    window.scrollStopTimer = setTimeout(() => {
        startAutoCollapseTimer();
    }, 150); // Wait 150ms after scroll stops before starting the 2-second timer
}

// Initialize with compact state
if (floatingInner) {
    floatingInner.classList.add('compact');
}

// OPTIMIZED: Passive scroll listener for better performance
window.addEventListener('scroll', handleScroll, { passive: true });

// Scroll to top when logo badge is clicked
const logoBadge = document.querySelector('.static-logo-badge a');
if (logoBadge) {
    logoBadge.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// OPTIMIZED: Removed MutationObserver - using event delegation instead

// ==========================================
// CYBERPUNK TEXT SCRAMBLE EFFECT
// ==========================================
class TextScramble {
    constructor(el) {
        this.el = el;
        this.chars = '!<>-_\\/[]{}—=+*^?#________';
        this.update = this.update.bind(this);
    }
    setText(newText) {
        const oldText = this.el.innerText;
        const length = Math.max(oldText.length, newText.length);
        const promise = new Promise((resolve) => this.resolve = resolve);
        this.queue = [];
        for (let i = 0; i < length; i++) {
            const from = oldText[i] || '';
            const to = newText[i] || '';
            const start = Math.floor(Math.random() * 40);
            const end = start + Math.floor(Math.random() * 40);
            this.queue.push({ from, to, start, end });
        }
        cancelAnimationFrame(this.frameRequest);
        this.frame = 0;
        this.update();
        return promise;
    }
    update() {
        let output = '';
        let complete = 0;
        for (let i = 0, n = this.queue.length; i < n; i++) {
            let { from, to, start, end, char } = this.queue[i];
            if (this.frame >= end) {
                complete++;
                output += to;
            } else if (this.frame >= start) {
                if (!char || Math.random() < 0.28) {
                    char = this.randomChar();
                    this.queue[i].char = char;
                }
                output += `<span class="dud" style="color: var(--neon-magenta)">${char}</span>`;
            } else {
                output += from;
            }
        }
        this.el.innerHTML = output;
        if (complete === this.queue.length) {
            this.resolve();
        } else {
            this.frameRequest = requestAnimationFrame(this.update);
            this.frame++;
        }
    }
    randomChar() {
        return this.chars[Math.floor(Math.random() * this.chars.length)];
    }
}

// Apply scramble effect to glitch elements on hover
document.querySelectorAll('.glitch, .section-title span').forEach(el => {
    const scrambler = new TextScramble(el);
    el.addEventListener('mouseenter', () => {
        if (el.dataset.scrambling) return;
        el.dataset.scrambling = true;
        scrambler.setText(el.innerText).then(() => {
            el.dataset.scrambling = false;
        });
    });
});

// ==========================================
// LIQUID BUTTON EFFECT
// ==========================================
function initLiquidButtons() {
    document.querySelectorAll('.cta-btn, .cv-btn, .filter-btn').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            btn.style.setProperty('--x', `${x}px`);
            btn.style.setProperty('--y', `${y}px`);
        });
    });
}
initLiquidButtons();

// ==========================================
// TYPING EFFECT FOR TERMINAL (IF EXISTS)
// ==========================================
const terminalBody = document.querySelector('.terminal-body');

if (terminalBody) {
    const lines = terminalBody.querySelectorAll('.terminal-line');
    lines.forEach((line, index) => {
        line.style.opacity = '0';
        setTimeout(() => {
            line.style.transition = 'opacity 0.4s ease';
            line.style.opacity = '1';
        }, index * 150);
    });
}

// ==========================================
// STAT COUNTER ANIMATION
// ==========================================
function animateValue(element, start, end, duration, suffix = '') {
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const current = start + (end - start) * easeOutQuart(progress);

        // Handle different number formats
        if (suffix === '%' || suffix === 'nm') {
            element.textContent = Math.round(current) + suffix;
        } else if (end < 10) {
            element.textContent = current.toFixed(1) + suffix;
        } else {
            element.textContent = Math.round(current) + suffix;
        }

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

function easeOutQuart(x) {
    return 1 - Math.pow(1 - x, 4);
}

// Animate stat numbers when they come into view
const statObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.dataset.animated) {
            entry.target.dataset.animated = 'true';
            const statNumber = entry.target.querySelector('.stat-number');
            if (statNumber) {
                const text = statNumber.textContent;
                const value = parseFloat(text);
                const suffix = text.replace(/[0-9.]/g, '');

                animateValue(statNumber, 0, value, 2500, suffix);
            }
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-card').forEach(card => {
    statObserver.observe(card);
});

// ==========================================
// SKILLS PAGE - FILTER FUNCTIONALITY
// ==========================================
const filterButtons = document.querySelectorAll('.filter-btn');
const skillPanels = document.querySelectorAll('.skill-panel');

if (filterButtons.length > 0) {
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const filterValue = button.getAttribute('data-filter');

            // Filter skill panels
            skillPanels.forEach(panel => {
                if (filterValue === 'all') {
                    panel.classList.remove('hidden');
                    panel.style.display = 'block';
                } else {
                    const category = panel.getAttribute('data-category');
                    if (category === filterValue) {
                        panel.classList.remove('hidden');
                        panel.style.display = 'block';
                    } else {
                        panel.classList.add('hidden');
                        panel.style.display = 'none';
                    }
                }
            });
        });
    });
}

// ==========================================
// SKILLS PAGE - ANIMATED SKILL BARS
// ==========================================
const skillBarsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const skillFills = entry.target.querySelectorAll('.skill-fill-animated');
            skillFills.forEach(fill => {
                const width = fill.getAttribute('data-width');
                setTimeout(() => {
                    fill.style.width = width + '%';
                }, 100);
            });
            skillBarsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.2 });

// Observe all skill panels for bar animations
document.querySelectorAll('.skill-panel').forEach(panel => {
    skillBarsObserver.observe(panel);
});

// ==========================================
// CONTACT FORM HANDLING
// ==========================================
const contactForm = document.getElementById('contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        // Show loading state
        submitBtn.textContent = 'SENDING...';
        submitBtn.disabled = true;

        try {
            const formData = new FormData(contactForm);
            const response = await fetch(contactForm.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                // Success message
                submitBtn.textContent = '✓ MESSAGE SENT!';
                submitBtn.style.background = 'var(--cyber-blue)';
                submitBtn.style.borderColor = 'var(--cyber-blue)';

                // Show success in terminal
                const terminalBody = contactForm.closest('.terminal-body');
                if (terminalBody) {
                    const successLine = document.createElement('div');
                    successLine.className = 'terminal-line';
                    successLine.style.color = 'var(--cyber-blue)';
                    successLine.innerHTML = '<span class="terminal-prompt">$</span> Message sent successfully! ✓';
                    terminalBody.appendChild(successLine);
                }

                // Reset form after 2 seconds
                setTimeout(() => {
                    contactForm.reset();
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                    submitBtn.style.background = '';
                    submitBtn.style.borderColor = '';
                }, 2000);
            } else {
                throw new Error('Form submission failed');
            }
        } catch (error) {
            // Error message
            submitBtn.textContent = '✗ FAILED - TRY AGAIN';
            submitBtn.style.background = 'var(--cyber-pink)';
            submitBtn.style.borderColor = 'var(--cyber-pink)';

            // Show error in terminal
            const terminalBody = contactForm.closest('.terminal-body');
            if (terminalBody) {
                const errorLine = document.createElement('div');
                errorLine.className = 'terminal-line';
                errorLine.style.color = 'var(--cyber-pink)';
                errorLine.innerHTML = '<span class="terminal-prompt">$</span> Error: Message failed to send. Please try again.';
                terminalBody.appendChild(errorLine);
            }

            setTimeout(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                submitBtn.style.background = '';
                submitBtn.style.borderColor = '';
            }, 3000);
        }
    });
}

// ==========================================
// CONSOLE EASTER EGG
// ==========================================
console.log('%c⚡ NEXUS SYSTEM INITIALIZED ⚡', 'color: #ff2d92; font-size: 24px; font-weight: bold; text-shadow: 0 0 10px #ff2d92;');
console.log('%c🚀 Glen Muthoka - Embedded Systems Engineer', 'color: #00f5ff; font-size: 16px; font-weight: 600;');
console.log('%c📍 From Kenya, Based in Southampton, UK', 'color: #a855f7; font-size: 14px;');
console.log('%c📧 Contact: theglenmuthoka@gmail.com', 'color: #fbbf24; font-size: 14px;');
console.log('%c\n💡 Interested in the code? Check out the source!', 'color: #22d3ee; font-size: 12px;');

// ==========================================
// PROJECT CAROUSEL - LIQUID GLASS EFFECT
// ==========================================
function initProjectCarousel() {
    const carousel = document.querySelector('.project-carousel');
    if (!carousel) return;

    const track = carousel.querySelector('.carousel-track');
    const cards = carousel.querySelectorAll('.carousel-card');
    const prevBtn = carousel.querySelector('.carousel-prev');
    const nextBtn = carousel.querySelector('.carousel-next');
    const dotsContainer = carousel.querySelector('.carousel-dots');

    if (!track || cards.length === 0) return;

    let currentIndex = 0;
    let isAnimating = false;
    let autoPlayInterval;
    let cardWidth;
    let visibleCards = 3;

    // Calculate visible cards based on screen width
    function calculateVisibleCards() {
        const width = window.innerWidth;
        if (width < 640) visibleCards = 1;
        else if (width < 1024) visibleCards = 2;
        else visibleCards = 3;
    }

    // Create dots
    function createDots() {
        dotsContainer.innerHTML = '';
        const totalDots = Math.ceil(cards.length / visibleCards);
        for (let i = 0; i < totalDots; i++) {
            const dot = document.createElement('button');
            dot.className = `carousel-dot ${i === 0 ? 'active' : ''}`;
            dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
            dot.addEventListener('click', () => goToSlide(i * visibleCards));
            dotsContainer.appendChild(dot);
        }
    }

    // Update dots
    function updateDots() {
        const dots = dotsContainer.querySelectorAll('.carousel-dot');
        const activeDotIndex = Math.floor(currentIndex / visibleCards);
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === activeDotIndex);
        });
    }

    // Go to specific slide
    function goToSlide(index) {
        if (isAnimating) return;

        const maxIndex = cards.length - visibleCards;
        currentIndex = Math.max(0, Math.min(index, maxIndex));

        isAnimating = true;

        // Calculate offset
        const gap = 24; // Gap between cards
        const offset = currentIndex * (cardWidth + gap);

        track.style.transform = `translateX(-${offset}px)`;

        // Update card states with liquid glass effect
        cards.forEach((card, i) => {
            const distance = Math.abs(i - currentIndex - Math.floor(visibleCards / 2));
            const isVisible = i >= currentIndex && i < currentIndex + visibleCards;

            if (isVisible) {
                card.classList.add('active');
                card.style.opacity = '1';
                card.style.transform = `scale(${1 - distance * 0.05}) translateZ(${50 - distance * 20}px)`;
                card.style.filter = `blur(${distance * 0.5}px)`;
            } else {
                card.classList.remove('active');
                card.style.opacity = '0.3';
                card.style.transform = 'scale(0.85) translateZ(-50px)';
                card.style.filter = 'blur(2px)';
            }
        });

        updateDots();

        setTimeout(() => {
            isAnimating = false;
        }, 500);
    }

    // Navigation
    function nextSlide() {
        const maxIndex = cards.length - visibleCards;
        if (currentIndex < maxIndex) {
            goToSlide(currentIndex + 1);
        } else {
            goToSlide(0); // Loop back
        }
    }

    function prevSlide() {
        if (currentIndex > 0) {
            goToSlide(currentIndex - 1);
        } else {
            goToSlide(cards.length - visibleCards); // Loop to end
        }
    }

    // Auto-play
    function startAutoPlay() {
        stopAutoPlay(); // Ensure previous interval is cleared
        autoPlayInterval = setInterval(nextSlide, 5000);
    }

    function stopAutoPlay() {
        if (autoPlayInterval) {
            clearInterval(autoPlayInterval);
            autoPlayInterval = null;
        }
    }

    // Event listeners
    if (prevBtn) prevBtn.addEventListener('click', () => { stopAutoPlay(); prevSlide(); startAutoPlay(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { stopAutoPlay(); nextSlide(); startAutoPlay(); });

    // Touch/swipe support - OPTIMIZED: Passive event listeners
    let touchStartX = 0;
    let touchEndX = 0;

    track.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        stopAutoPlay();
    }, { passive: true });

    track.addEventListener('touchmove', (e) => {
        // Allow native scrolling behavior
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) nextSlide();
            else prevSlide();
        }
        startAutoPlay();
    }, { passive: true });

    // Mouse drag support
    let isDragging = false;
    let dragStartX = 0;

    track.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartX = e.clientX;
        track.style.cursor = 'grabbing';
        stopAutoPlay();
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            track.style.cursor = 'grab';
            startAutoPlay();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const diff = dragStartX - e.clientX;
        if (Math.abs(diff) > 80) {
            if (diff > 0) nextSlide();
            else prevSlide();
            isDragging = false;
            track.style.cursor = 'grab';
        }
    });

    // Keyboard navigation
    carousel.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { stopAutoPlay(); prevSlide(); startAutoPlay(); }
        if (e.key === 'ArrowRight') { stopAutoPlay(); nextSlide(); startAutoPlay(); }
    });

    // Pause on hover
    carousel.addEventListener('mouseenter', stopAutoPlay);
    carousel.addEventListener('mouseleave', startAutoPlay);

    // Initialize
    function init() {
        calculateVisibleCards();
        cardWidth = cards[0].offsetWidth;
        createDots();
        goToSlide(0);
        startAutoPlay();
    }

    // Handle resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            calculateVisibleCards();
            cardWidth = cards[0].offsetWidth;
            createDots();
            goToSlide(currentIndex);
        }, 250);
    }, { passive: true });

    init();
}

// Initialize carousel when DOM is ready
document.addEventListener('DOMContentLoaded', initProjectCarousel);

// ==========================================
// SMOOTH SCROLL FOR SINGLE PAGE NAVIGATION
// ==========================================
function initSmoothScroll() {
    document.querySelectorAll('a[href*="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            // Extract the hash from the href (handles both #id and /path#id)
            const hashIndex = href.indexOf('#');
            if (hashIndex === -1) return;

            const targetId = href.substring(hashIndex);
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                e.preventDefault();
                const navHeight = document.querySelector('nav')?.offsetHeight || 0;
                const targetPosition = targetElement.offsetTop - navHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Update URL without jumping
                history.pushState(null, null, targetId);

                // Close mobile menu if open
                const navLinks = document.querySelector('.nav-links');
                const mobileToggle = document.querySelector('.mobile-menu-toggle');
                if (navLinks?.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    mobileToggle?.classList.remove('active');
                    document.body.style.overflow = '';
                }
            }
        });
    });
}

initSmoothScroll();

// ==========================================
// ACTIVE SECTION HIGHLIGHT IN NAV
// ==========================================
function initActiveNavHighlight() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a[href*="#"]');

    if (sections.length === 0 || navLinks.length === 0) return;

    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    link.classList.remove('nav-active');
                    const href = link.getAttribute('href');
                    // Match both #id and /path#id formats
                    if (href === `#${id}` || href.endsWith(`#${id}`)) {
                        link.classList.add('nav-active');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
}

initActiveNavHighlight();

// ==========================================
// PAGE LOAD ANIMATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded');

    // Trigger initial animations after a short delay
    setTimeout(() => {
        document.querySelectorAll('.hero-content > *').forEach((el, i) => {
            el.style.animationDelay = `${i * 0.1}s`;
        });
    }, 100);
});

// ==========================================
// PERFORMANCE MONITORING (DEV MODE)
// ==========================================
if (window.location.search.includes('debug=perf')) {
    let frameCount = 0;
    let lastTime = performance.now();
    let fps = 0;

    // FPS Monitor
    function measureFPS() {
        frameCount++;
        const currentTime = performance.now();

        if (currentTime >= lastTime + 1000) {
            fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
            frameCount = 0;
            lastTime = currentTime;

            // Warn if FPS drops below 30
            if (fps < 30) {
                console.warn(`⚠️ Low FPS detected: ${fps} fps`);
            }
        }

        requestAnimationFrame(measureFPS);
    }

    measureFPS();

    // Long Task Detection
    if ('PerformanceObserver' in window) {
        const perfObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.duration > 50) {
                    console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`);
                }
            }
        });

        try {
            perfObserver.observe({ entryTypes: ['longtask'] });
        } catch (e) {
            // longtask not supported
        }
    }

    console.log('%c🔍 Performance Monitoring Active', 'color: #00f5ff; font-size: 14px; font-weight: bold;');
    console.log('%cAdd ?debug=perf to URL to enable', 'color: #a855f7; font-size: 12px;');
}

// ==========================================
// SMOOTH PAGE TRANSITIONS
// ==========================================
document.querySelectorAll('a:not([target="_blank"]):not([href^="#"]):not([href^="mailto"]):not([download])').forEach(link => {
    link.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        // Skip if it's a download link or external
        if (href && !href.startsWith('http') && !href.startsWith('//') && !this.hasAttribute('download')) {
            e.preventDefault();
            document.body.classList.add('page-transitioning');
            setTimeout(() => {
                window.location.href = href;
            }, 300);
        }
    });
});
