// ==========================================
// PARTICLE SYSTEM
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

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }

    draw() {
        ctx.fillStyle = 'rgba(0, 217, 255, 0.5)';
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
// CURSOR FOLLOWER (OPTIONAL)
// ==========================================
const cursorFollower = document.getElementById('cursor-follower');

if (cursorFollower) {
    let mouseX = 0;
    let mouseY = 0;
    let followerX = 0;
    let followerY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function animateCursor() {
        // Smooth follow with easing
        followerX += (mouseX - followerX) * 0.1;
        followerY += (mouseY - followerY) * 0.1;
        
        cursorFollower.style.left = followerX + 'px';
        cursorFollower.style.top = followerY + 'px';
        
        requestAnimationFrame(animateCursor);
    }

    animateCursor();

    // Add hover effect on interactive elements
    const hoverElements = document.querySelectorAll('a, button, .project-card, .stat-card');
    hoverElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursorFollower.style.transform = 'translate(-50%, -50%) scale(1.5)';
            cursorFollower.style.borderColor = 'rgba(255, 0, 110, 0.8)';
        });
        
        el.addEventListener('mouseleave', () => {
            cursorFollower.style.transform = 'translate(-50%, -50%) scale(1)';
            cursorFollower.style.borderColor = 'rgba(0, 217, 255, 0.5)';
        });
    });
}

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
