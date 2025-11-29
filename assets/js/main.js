// ==========================================
// NEXUS PORTFOLIO - PREMIUM INTERACTIONS
// Glen Muthoka - Embedded Systems Engineer
// ==========================================

// Shared smoothed mouse position for consistent animation timing
let smoothMouseX = window.innerWidth / 2;
let smoothMouseY = window.innerHeight / 2;
let rawMouseX = window.innerWidth / 2;
let rawMouseY = window.innerHeight / 2;

// Unified smooth mouse tracking
document.addEventListener('mousemove', (e) => {
    rawMouseX = e.clientX;
    rawMouseY = e.clientY;
});

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

    const particles = [];
    const particleCount = window.innerWidth < 768 ? 50 : 80;
    let mouseParticleX = -1000;
    let mouseParticleY = -1000;

    // Track mouse position for particle interaction
    document.addEventListener('mousemove', (e) => {
        mouseParticleX = e.clientX;
        mouseParticleY = e.clientY;
    });

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

        draw() {
            // Calculate distance from mouse for color intensity
            const dx = this.x - mouseParticleX;
            const dy = this.y - mouseParticleY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxDistance = 150;
            
            let opacity = 0.4;
            let color;
            
            // Change color when near mouse
            if (distance < maxDistance) {
                const proximity = 1 - (distance / maxDistance);
                opacity = 0.4 + proximity * 0.6;
                // Blend to cyan when close
                const h = this.hue + (180 - this.hue) * proximity;
                color = `hsla(${h}, 100%, 60%, ${opacity})`;
            } else {
                color = `hsla(${this.hue}, 80%, 50%, ${opacity})`;
            }
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });

        // Draw connections between nearby particles (using distance squared for perf)
        const maxDistSq = 6400; // 80^2
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distSq = dx * dx + dy * dy;

                if (distSq < maxDistSq) {
                    const opacity = (1 - distSq / maxDistSq) * 0.15;
                    ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(animateParticles);
    }

    animateParticles();

    window.addEventListener('resize', () => {
        resizeCanvas();
    });
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
    threshold: 0.1,
    rootMargin: '0px 0px -80px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            // Add staggered delay for multiple elements
            setTimeout(() => {
                entry.target.classList.add('visible');
            }, index * 100);
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
// NAVBAR SCROLL EFFECT - HIDE ON SCROLL
// ==========================================
const nav = document.querySelector('nav');
const heroSection = document.querySelector('.hero');
let lastScroll = 0;
let ticking = false;

// Create floating CV button that appears when nav hides
const floatingCvBtn = document.createElement('a');
floatingCvBtn.href = '/cv/my_mega_cv.pdf';
floatingCvBtn.download = 'Glen_Muthoka_CV.pdf';
floatingCvBtn.className = 'floating-cv-btn';
floatingCvBtn.innerHTML = '📄 CV';
floatingCvBtn.setAttribute('aria-label', 'Download CV');
document.body.appendChild(floatingCvBtn);

function updateNav() {
    const currentScroll = window.pageYOffset;
    
    // Get the height of the hero section (or fallback to 100px)
    const heroHeight = heroSection ? heroSection.offsetHeight * 0.3 : 100;

    if (currentScroll > heroHeight) {
        // Past the hero - hide navbar, show floating CV
        nav.classList.add('nav-hidden');
        floatingCvBtn.classList.add('visible');
    } else {
        // In hero section - show navbar, hide floating CV
        nav.classList.remove('nav-hidden');
        floatingCvBtn.classList.remove('visible');
    }
    
    if (currentScroll > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
    ticking = false;
}

window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(updateNav);
        ticking = true;
    }
});

// ==========================================
// MORPHING CURSOR - LIQUID GLASS CYBERPUNK
// ==========================================
const cursorFollower = document.getElementById('cursor-follower');

if (cursorFollower && !('ontouchstart' in window)) {
    let followerX = smoothMouseX;
    let followerY = smoothMouseY;
    let currentHoverElement = null;
    let currentMorphType = 'default';
    let isMorphing = false;

    // Create liquid trail elements
    const trailElements = [];
    const trailCount = 4;
    
    for (let i = 0; i < trailCount; i++) {
        const trail = document.createElement('div');
        trail.className = 'cursor-trail';
        trail.style.opacity = (1 - i / trailCount) * 0.25;
        document.body.appendChild(trail);
        trailElements.push({
            element: trail,
            x: smoothMouseX,
            y: smoothMouseY
        });
    }

    // Create inner glow element
    const innerGlow = document.createElement('div');
    innerGlow.className = 'cursor-inner-glow';
    cursorFollower.appendChild(innerGlow);

    function animateCursor() {
        // Always follow the mouse smoothly
        followerX += (smoothMouseX - followerX) * 0.18;
        followerY += (smoothMouseY - followerY) * 0.18;

        // Apply transform - cursor always follows mouse
        cursorFollower.style.transform = `translate(${followerX - 16}px, ${followerY - 16}px)`;

        // Animate trail elements with liquid effect
        trailElements.forEach((trail, index) => {
            const delay = (index + 1) * 0.07;
            trail.x += (followerX - trail.x) * delay;
            trail.y += (followerY - trail.y) * delay;
            trail.element.style.transform = `translate(${trail.x - 12}px, ${trail.y - 12}px)`;
        });

        requestAnimationFrame(animateCursor);
    }

    animateCursor();

    // Detect element type and set morph mode
    function getMorphType(element) {
        if (!element) return 'default';
        
        const tagName = element.tagName.toLowerCase();
        const classList = element.classList;
        
        // Check for buttons first
        if (tagName === 'button' || 
            classList.contains('cta-btn') || 
            classList.contains('cv-btn') || 
            classList.contains('filter-btn') ||
            classList.contains('carousel-nav-btn') ||
            classList.contains('carousel-dot') ||
            classList.contains('submit-btn')) {
            return 'button';
        }
        
        // Check for cards
        if (classList.contains('project-card') || 
            classList.contains('stat-card') || 
            classList.contains('skill-panel') ||
            classList.contains('carousel-card') ||
            classList.contains('tech-card') ||
            classList.contains('cert-card') ||
            classList.contains('holo-panel')) {
            return 'card';
        }
        
        // Check for links (not buttons)
        if (tagName === 'a' && !classList.contains('cta-btn') && !classList.contains('cv-btn')) {
            return 'link';
        }
        
        // Check for headings/titles for text highlight effect
        if (classList.contains('glitch') || 
            classList.contains('section-title') ||
            classList.contains('project-title')) {
            return 'text';
        }
        
        return 'default';
    }

    // Track currently bound elements to avoid duplicate listeners
    const boundElements = new WeakSet();

    // Set up hover detection for all interactive elements
    function setupMorphListeners() {
        const interactiveElements = document.querySelectorAll(`
            a, button, 
            .project-card, .stat-card, .skill-panel, .tech-card, .cert-card, .holo-panel,
            .cta-btn, .cv-btn, .filter-btn, .carousel-nav-btn, .carousel-dot, .submit-btn,
            .carousel-card, .glitch, .section-title, .project-title
        `);
        
        interactiveElements.forEach(el => {
            // Skip if already bound
            if (boundElements.has(el)) return;
            boundElements.add(el);
            
            el.addEventListener('mouseenter', (e) => {
                e.stopPropagation();
                currentHoverElement = el;
                currentMorphType = getMorphType(el);
                isMorphing = true;
                
                // Add appropriate class to cursor
                cursorFollower.className = 'cursor-follower';
                cursorFollower.classList.add(`cursor-${currentMorphType}`);
                
                // Update trail classes
                trailElements.forEach(trail => {
                    trail.element.className = 'cursor-trail';
                    trail.element.classList.add(`trail-${currentMorphType}`);
                });
            });

            el.addEventListener('mouseleave', (e) => {
                // Only reset if we're leaving to a non-interactive element
                const relatedTarget = e.relatedTarget;
                if (relatedTarget && getMorphType(relatedTarget) !== 'default') {
                    return; // Don't reset, we're entering another interactive element
                }
                
                currentHoverElement = null;
                currentMorphType = 'default';
                isMorphing = false;
                
                // Reset cursor class
                cursorFollower.className = 'cursor-follower';
                
                // Reset trail classes
                trailElements.forEach(trail => {
                    trail.element.className = 'cursor-trail';
                });
            });
        });
    }

    setupMorphListeners();

    // Re-setup listeners when DOM changes (debounced)
    let morphObserverTimeout;
    const morphObserver = new MutationObserver(() => {
        clearTimeout(morphObserverTimeout);
        morphObserverTimeout = setTimeout(setupMorphListeners, 200);
    });
    morphObserver.observe(document.body, { childList: true, subtree: true });

} else if (cursorFollower) {
    cursorFollower.style.display = 'none';
}

// ==========================================
// LIQUID GLASS TILT EFFECT
// ==========================================
function initLiquidTilt() {
    // Skip on mobile and touch devices
    if ('ontouchstart' in window || window.innerWidth < 768) {
        return;
    }

    const tiltElements = document.querySelectorAll('.project-card, .stat-card, .skill-panel, .holo-panel, .tech-card');
    
    tiltElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            this.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
        });

        element.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // Calculate rotation
            const rotateX = (y - centerY) / centerY * -8;
            const rotateY = (x - centerX) / centerX * 8;
            
            // Apply 3D transform
            this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
            
            // Liquid Glass Shine Effect
            // Update CSS variables for liquid shine
            this.style.setProperty('--mouse-x', `${x}px`);
            this.style.setProperty('--mouse-y', `${y}px`);
            
            // Move the glow element if it exists
            const glowElement = this.querySelector('.panel-glow');
            if (glowElement) {
                glowElement.style.left = `${(x / rect.width) * 100 - 50}%`;
                glowElement.style.top = `${(y / rect.height) * 100 - 50}%`;
            }
        });

        element.addEventListener('mouseleave', function() {
            this.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            this.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
            
            const glowElement = this.querySelector('.panel-glow');
            if (glowElement) {
                glowElement.style.left = '-50%';
                glowElement.style.top = '-50%';
            }
        });
    });
}

// Initialize Liquid Tilt
initLiquidTilt();

// Re-initialize after dynamic content loads
const tiltObserver = new MutationObserver(() => {
    initLiquidTilt();
});

tiltObserver.observe(document.body, {
    childList: true,
    subtree: true
});

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
        if(el.dataset.scrambling) return;
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

    // Touch/swipe support
    let touchStartX = 0;
    let touchEndX = 0;

    track.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        stopAutoPlay();
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
    });

    init();
}

// Initialize carousel when DOM is ready
document.addEventListener('DOMContentLoaded', initProjectCarousel);

// ==========================================
// SMOOTH SCROLL FOR SINGLE PAGE NAVIGATION
// ==========================================
function initSmoothScroll() {
    document.querySelectorAll('a[href*="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
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
// SMOOTH PAGE TRANSITIONS
// ==========================================
document.querySelectorAll('a:not([target="_blank"]):not([href^="#"]):not([href^="mailto"]):not([download])').forEach(link => {
    link.addEventListener('click', function(e) {
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
