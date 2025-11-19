// ==========================================
// 3D DOT GRID OVERLAY (OPTIMIZED WITH SPATIAL PARTITIONING)
// ==========================================
function create3DDotGrid() {
    const dotGrid = document.createElement('div');
    dotGrid.id = 'dot-grid';
    document.body.appendChild(dotGrid);

    const dots = [];
    const spacing = 50; // Distance between dots
    const cols = Math.ceil(window.innerWidth / spacing);
    const rows = Math.ceil(window.innerHeight / spacing);
    const checkRadius = 150; // Only check dots within this radius

    // Create dot grid with spatial hash map
    const spatialGrid = {};
    const cellSize = 100;

    function getSpatialKey(x, y) {
        return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
    }

    // Create dot grid
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            const x = col * spacing + spacing / 2;
            const y = row * spacing + spacing / 2;
            dot.style.left = x + 'px';
            dot.style.top = y + 'px';
            dotGrid.appendChild(dot);
            
            const dotData = {
                element: dot,
                x: x,
                y: y
            };
            
            dots.push(dotData);

            // Add to spatial grid
            const key = getSpatialKey(x, y);
            if (!spatialGrid[key]) {
                spatialGrid[key] = [];
            }
            spatialGrid[key].push(dotData);
        }
    }

    // Track mouse position accurately
    let mouseX = -1000;
    let mouseY = -1000;
    let animationFrameId = null;

    // Get nearby dots using spatial partitioning
    function getNearbyDots(x, y) {
        const nearbyDots = [];
        const cellX = Math.floor(x / cellSize);
        const cellY = Math.floor(y / cellSize);

        // Check surrounding cells
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                const key = `${cellX + dx},${cellY + dy}`;
                if (spatialGrid[key]) {
                    nearbyDots.push(...spatialGrid[key]);
                }
            }
        }
        return nearbyDots;
    }

    function updateDots() {
        // Get only nearby dots for performance
        const nearbyDots = getNearbyDots(mouseX, mouseY);

        // Reset previously active dots
        dots.forEach(dot => {
            if (dot.element.classList.contains('active') || dot.element.classList.contains('nearby')) {
                dot.element.classList.remove('active', 'nearby');
            }
        });

        // Update only nearby dots
        nearbyDots.forEach(dot => {
            const dx = dot.x - mouseX;
            const dy = dot.y - mouseY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 60) {
                dot.element.classList.add('active');
            } else if (distance < 120) {
                dot.element.classList.add('nearby');
            }
        });
    }

    // Use mousemove for accurate tracking with requestAnimationFrame for smooth updates
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(() => {
                updateDots();
                animationFrameId = null;
            });
        }
    });

    // Reset on mouse leave
    document.addEventListener('mouseleave', () => {
        dots.forEach(dot => {
            dot.element.classList.remove('active', 'nearby');
        });
    });

    // Recreate grid on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            location.reload(); // Simplest approach for resize
        }, 500);
    });

    // Hide on mobile for performance
    if ('ontouchstart' in window) {
        dotGrid.style.display = 'none';
    }
}

// Initialize dot grid
create3DDotGrid();

// ==========================================
// INTERACTIVE PARTICLE SYSTEM
// ==========================================
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resizeCanvas();

const particles = [];
const particleCount = 100;
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
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2;
        this.baseVx = this.vx;
        this.baseVy = this.vy;
    }

    update() {
        // Calculate distance from mouse
        const dx = this.x - mouseParticleX;
        const dy = this.y - mouseParticleY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const interactionRadius = 150;

        // Apply repel force when mouse is near
        if (distance < interactionRadius) {
            const force = (interactionRadius - distance) / interactionRadius;
            const angle = Math.atan2(dy, dx);
            const repelStrength = 3;
            
            this.vx = this.baseVx + Math.cos(angle) * force * repelStrength;
            this.vy = this.baseVy + Math.sin(angle) * force * repelStrength;
        } else {
            // Gradually return to base velocity
            this.vx += (this.baseVx - this.vx) * 0.05;
            this.vy += (this.baseVy - this.vy) * 0.05;
        }

        this.x += this.vx;
        this.y += this.vy;

        // Bounce off edges
        if (this.x < 0 || this.x > canvas.width) {
            this.vx *= -1;
            this.baseVx *= -1;
        }
        if (this.y < 0 || this.y > canvas.height) {
            this.vy *= -1;
            this.baseVy *= -1;
        }
    }

    draw() {
        // Calculate distance from mouse for color intensity
        const dx = this.x - mouseParticleX;
        const dy = this.y - mouseParticleY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 150;
        
        let opacity = 0.5;
        let color = '0, 217, 255'; // Cyan
        
        // Change color when near mouse
        if (distance < maxDistance) {
            const proximity = 1 - (distance / maxDistance);
            opacity = 0.5 + proximity * 0.5;
            // Blend from cyan to pink
            const r = Math.floor(proximity * 255);
            const g = Math.floor(217 * (1 - proximity));
            const b = 255;
            color = `${r}, ${g}, ${b}`;
        }
        
        ctx.fillStyle = `rgba(${color}, ${opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Initialize particles
for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });

    // Draw connections between nearby particles
    particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach(p2 => {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 100) {
                ctx.strokeStyle = `rgba(0, 217, 255, ${0.2 * (1 - distance / 100)})`;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        });
    });

    requestAnimationFrame(animate);
}

animate();

window.addEventListener('resize', () => {
    resizeCanvas();
});

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
// FADE-IN ANIMATION ON SCROLL
// ==========================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all elements with fade-in class
document.querySelectorAll('.fade-in, .stat-card, .project-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
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
    });

    // Close menu when clicking on a link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
        });
    });
}

// ==========================================
// NAVBAR BACKGROUND ON SCROLL
// ==========================================
const nav = document.querySelector('nav');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
        nav.style.background = 'rgba(5, 8, 22, 0.95)';
        nav.style.boxShadow = '0 4px 20px rgba(0, 217, 255, 0.1)';
    } else {
        nav.style.background = 'rgba(5, 8, 22, 0.9)';
        nav.style.boxShadow = 'none';
    }

    lastScroll = currentScroll;
});

// ==========================================
// ENHANCED CURSOR FOLLOWER WITH MAGNETIC EFFECT
// ==========================================
const cursorFollower = document.getElementById('cursor-follower');

if (cursorFollower) {
    let mouseX = 0;
    let mouseY = 0;
    let followerX = 0;
    let followerY = 0;
    let currentHoverElement = null;
    let isMagnetic = false;

    // Create ghost cursor trails
    const ghostCursors = [];
    const ghostCount = 5;
    
    for (let i = 0; i < ghostCount; i++) {
        const ghost = document.createElement('div');
        ghost.className = 'cursor-ghost';
        ghost.style.opacity = (1 - i / ghostCount) * 0.3;
        document.body.appendChild(ghost);
        ghostCursors.push({
            element: ghost,
            x: 0,
            y: 0
        });
    }

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function animateCursor() {
        let targetX = mouseX;
        let targetY = mouseY;

        // Magnetic effect: snap to center of hovered element
        if (currentHoverElement && isMagnetic) {
            const rect = currentHoverElement.getBoundingClientRect();
            const elementCenterX = rect.left + rect.width / 2;
            const elementCenterY = rect.top + rect.height / 2;
            
            // Calculate distance to element center
            const distX = elementCenterX - mouseX;
            const distY = elementCenterY - mouseY;
            const distance = Math.sqrt(distX * distX + distY * distY);
            
            // Apply magnetic pull within 100px radius
            if (distance < 100) {
                const pullStrength = Math.min(1, (100 - distance) / 100) * 0.5;
                targetX += distX * pullStrength;
                targetY += distY * pullStrength;
            }
        }

        // Smooth follow with easing
        const easing = isMagnetic ? 0.15 : 0.1;
        followerX += (targetX - followerX) * easing;
        followerY += (targetY - followerY) * easing;

        cursorFollower.style.left = followerX + 'px';
        cursorFollower.style.top = followerY + 'px';

        // Animate ghost cursors with delay
        ghostCursors.forEach((ghost, index) => {
            const delay = (index + 1) * 0.05;
            ghost.x += (followerX - ghost.x) * delay;
            ghost.y += (followerY - ghost.y) * delay;
            ghost.element.style.left = ghost.x + 'px';
            ghost.element.style.top = ghost.y + 'px';
        });

        requestAnimationFrame(animateCursor);
    }

    animateCursor();

    // Add magnetic hover effect on interactive elements
    const magneticElements = document.querySelectorAll('a, button, .project-card, .stat-card, .skill-panel, .cv-btn');
    
    magneticElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            currentHoverElement = el;
            isMagnetic = true;
            cursorFollower.classList.add('cursor-active');
            cursorFollower.style.transform = 'translate(-50%, -50%) scale(1.5)';
            cursorFollower.style.borderColor = 'rgba(255, 0, 110, 0.8)';
            ghostCursors.forEach(ghost => {
                ghost.element.classList.add('ghost-active');
            });
        });

        el.addEventListener('mouseleave', () => {
            currentHoverElement = null;
            isMagnetic = false;
            cursorFollower.classList.remove('cursor-active');
            cursorFollower.style.transform = 'translate(-50%, -50%) scale(1)';
            cursorFollower.style.borderColor = 'rgba(0, 217, 255, 0.5)';
            ghostCursors.forEach(ghost => {
                ghost.element.classList.remove('ghost-active');
            });
        });
    });

    // Hide cursor on mobile
    if ('ontouchstart' in window) {
        cursorFollower.style.display = 'none';
        ghostCursors.forEach(ghost => {
            ghost.element.style.display = 'none';
        });
    }
}

// ==========================================
// 3D TILT EFFECT FOR CARDS
// ==========================================
function init3DTilt() {
    const tiltElements = document.querySelectorAll('.project-card, .stat-card, .skill-panel');
    
    tiltElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            this.style.transition = 'none';
        });

        element.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / centerY * -10; // Max 10deg tilt
            const rotateY = (x - centerX) / centerX * 10;
            
            this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
            
            // Move the glow effect
            const glowElement = this.querySelector('.panel-glow');
            if (glowElement) {
                glowElement.style.left = `${(x / rect.width) * 100 - 50}%`;
                glowElement.style.top = `${(y / rect.height) * 100 - 50}%`;
            }
        });

        element.addEventListener('mouseleave', function() {
            this.style.transition = 'transform 0.5s ease';
            this.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
            
            const glowElement = this.querySelector('.panel-glow');
            if (glowElement) {
                glowElement.style.left = '-50%';
                glowElement.style.top = '-50%';
            }
        });
    });
}

// Initialize 3D tilt on page load and after DOM changes
init3DTilt();

// Re-initialize after dynamic content loads
const tiltObserver = new MutationObserver(() => {
    init3DTilt();
});

tiltObserver.observe(document.body, {
    childList: true,
    subtree: true
});

// ==========================================
// TYPING EFFECT FOR TERMINAL (IF EXISTS)
// ==========================================
const terminalBody = document.querySelector('.terminal-body');

if (terminalBody) {
    const lines = terminalBody.querySelectorAll('.terminal-line');
    lines.forEach((line, index) => {
        line.style.opacity = '0';
        setTimeout(() => {
            line.style.transition = 'opacity 0.3s ease';
            line.style.opacity = '1';
        }, index * 200);
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

                animateValue(statNumber, 0, value, 2000, suffix);
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
console.log('%c⚡ SYSTEM INITIALIZED ⚡', 'color: #00d9ff; font-size: 20px; font-weight: bold;');
console.log('%c🚀 Glen Muthoka - Embedded Systems Engineer', 'color: #ff006e; font-size: 14px;');
console.log('%c📍 From Kenya, Based in Southampton, UK', 'color: #b537f2; font-size: 12px;');
console.log('%c📧 Looking to collaborate? Email: theglenmuthoka@gmail.com', 'color: #ffbe0b; font-size: 12px;');
