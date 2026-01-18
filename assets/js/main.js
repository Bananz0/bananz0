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
// - Removed dead code (cursor-follower, smooth mouse tracking)
// ==========================================

// Mouse position for particle interaction
let mouseParticleX = -1000;
let mouseParticleY = -1000;

// OPTIMIZED: Single unified mouse tracking handler for particle system
document.addEventListener('mousemove', (e) => {
    mouseParticleX = e.clientX;
    mouseParticleY = e.clientY;
}, { passive: true });

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

    // ==========================================
    // ADAPTIVE PARTICLE COUNT SYSTEM
    // Runtime detection with high-end phone support
    // ==========================================
    const particles = [];
    let particleCount = 45; // Safe fallback
    let targetParticleCount = 45;

    function detectDeviceCapability() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);
        const isTablet = isMobile && (width >= 768 || height >= 768);
        const cores = navigator.hardwareConcurrency || 4;
        const memory = navigator.deviceMemory || 4; // GB

        // Detect high-end devices (PRIMARY: hardware specs, SECONDARY: user agent hint)
        // Note: FPS monitoring will fine-tune the actual count in real-time
        const hasHighEndSpecs = cores >= 8 && memory >= 6;
        const hasHighEndHint = /Snapdragon (8|X) Elite|A1[7-9] Bionic|A[2-9][0-9] Bionic|Dimensity 9[0-9]{3}|Google Tensor G[3-9]/i.test(navigator.userAgent);
        const isHighEndDevice = hasHighEndSpecs || (hasHighEndHint && cores >= 6);

        // Base counts by device class (conservative start - FPS monitoring adjusts up/down)
        let baseCount;
        let deviceClass;

        if (!isMobile) {
            // Desktop
            if (memory >= 8 && cores >= 8) {
                baseCount = 140;
                deviceClass = 'desktop-high';
            } else if (memory >= 4) {
                baseCount = 110;
                deviceClass = 'desktop-mid';
            } else {
                baseCount = 90;
                deviceClass = 'desktop-low';
            }
        } else if (isTablet) {
            // Tablet
            if (isHighEndDevice) {
                baseCount = 120;
                deviceClass = 'tablet-high';
            } else if (memory >= 4) {
                baseCount = 90;
                deviceClass = 'tablet-mid';
            } else {
                baseCount = 65;
                deviceClass = 'tablet-low';
            }
        } else if (isHighEndDevice) {
            // High-end mobile (based on specs, not just name)
            baseCount = 100;
            deviceClass = 'mobile-high';
        } else {
            // Standard phone
            if (cores >= 6 && memory >= 4) {
                baseCount = 70;
                deviceClass = 'mobile-mid';
            } else if (cores >= 4) {
                baseCount = 55;
                deviceClass = 'mobile-low';
            } else {
                baseCount = 45;
                deviceClass = 'mobile-basic';
            }
        }

        // Screen size adjustment
        const pixels = width * height;
        if (pixels > 2073600) baseCount = Math.floor(baseCount * 1.15); // 1080p+
        else if (pixels < 921600) baseCount = Math.floor(baseCount * 0.85); // <HD

        // Final clamp and diagnostics
        const finalCount = Math.min(baseCount, 220); // Safety cap
        console.info('Particle System Init:', {
            deviceClass,
            isHighEndDevice,
            cores,
            memory: `${memory}GB`,
            resolution: `${width}x${height} (${(pixels / 1e6).toFixed(1)}MP)`,
            initialParticles: finalCount,
            note: 'FPS monitoring will adjust count in real-time'
        });

        return finalCount;
    }

    particleCount = detectDeviceCapability();
    targetParticleCount = particleCount;

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
            const distSq = dx * dx + dy * dy;
            const interactionRadiusSq = 14400; // 120^2 - avoid sqrt

            // Apply repel force when mouse is near
            if (distSq < interactionRadiusSq) {
                const distance = Math.sqrt(distSq);
                const force = (120 - distance) / 120;
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

    // Initialize particles with unique IDs for efficient deduplication
    for (let i = 0; i < particleCount; i++) {
        const particle = new Particle();
        particle.id = i;
        particles.push(particle);
    }

    // ==========================================
    // FPS MONITORING & ADAPTIVE SCALING
    // ==========================================
    let frameCount = 0;
    let lastFpsCheck = performance.now();
    let currentFps = 60;
    let fpsCheckInterval = 2000; // Check every 2 seconds
    let nextParticleId = particleCount;

    function monitorAndAdaptPerformance() {
        frameCount++;
        const now = performance.now();
        const elapsed = now - lastFpsCheck;

        if (elapsed >= fpsCheckInterval) {
            currentFps = Math.round((frameCount * 1000) / elapsed);
            frameCount = 0;
            lastFpsCheck = now;

            // Adaptive scaling logic
            if (currentFps < 45 && particles.length > 30) {
                // Performance struggling - reduce by 10%
                const removeCount = Math.max(5, Math.floor(particles.length * 0.1));
                particles.splice(0, removeCount);
                console.log(`Reduced particles to ${particles.length} (FPS: ${currentFps})`);
            } else if (currentFps >= 58 && particles.length < targetParticleCount) {
                // Great performance - add more particles progressively
                const addCount = Math.min(10, targetParticleCount - particles.length);
                for (let i = 0; i < addCount; i++) {
                    const particle = new Particle();
                    particle.id = nextParticleId++;
                    particles.push(particle);
                }
                console.log(`Increased particles to ${particles.length} (FPS: ${currentFps})`);
            } else if (currentFps >= 55 && particles.length < targetParticleCount * 1.2) {
                // Excellent performance - try pushing beyond target
                const addCount = Math.min(5, Math.floor(targetParticleCount * 1.2) - particles.length);
                if (addCount > 0) {
                    for (let i = 0; i < addCount; i++) {
                        const particle = new Particle();
                        particle.id = nextParticleId++;
                        particles.push(particle);
                    }
                    console.log(`Bonus particles added: ${particles.length} (FPS: ${currentFps})`);
                }
            }
        }
    }

    // OPTIMIZED: Spatial hash grid for efficient neighbor detection
    const cellSize = 80;
    // Use bitwise operations for integer key to avoid string allocation
    function getSpatialKey(x, y) {
        const cx = Math.floor(x / cellSize) & 0xFFFF;
        const cy = Math.floor(y / cellSize) & 0xFFFF;
        return (cx << 16) | cy;
    }

    // OPTIMIZED: Reuse Map/Set objects to reduce GC pressure
    const grid = new Map();
    const colorGroups = new Map();
    const drawnConnections = new Set();

    function animateParticles() {
        // Optimization: Skip rendering if canvas is hidden or detached
        if (!canvas.offsetParent && getComputedStyle(canvas).display === 'none') {
            requestAnimationFrame(animateParticles);
            return;
        }

        // Monitor performance and adapt particle count
        monitorAndAdaptPerformance();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update all particles using for loop (faster than forEach)
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
        }

        // OPTIMIZED: Build spatial hash grid O(n) instead of O(n²)
        grid.clear();
        for (let i = 0; i < particles.length; i++) {
            const particle = particles[i];
            const key = getSpatialKey(particle.x, particle.y);
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(particle);
        }

        // OPTIMIZED: Batch rendering by color groups (reusing Map)
        colorGroups.clear();
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
        drawnConnections.clear();

        // OPTIMIZED: Batch all connection lines into single path per opacity level
        const connectionsByOpacity = new Map();

        for (let p = 0; p < particles.length; p++) {
            const particle = particles[p];
            const cellX = Math.floor(particle.x / cellSize);
            const cellY = Math.floor(particle.y / cellSize);

            // Check only adjacent cells (9 cells total)
            for (let dxCell = -1; dxCell <= 1; dxCell++) {
                for (let dyCell = -1; dyCell <= 1; dyCell++) {
                    const key = getSpatialKey((cellX + dxCell) * cellSize, (cellY + dyCell) * cellSize);
                    const neighbors = grid.get(key);
                    if (!neighbors) continue;

                    for (let n = 0; n < neighbors.length; n++) {
                        const neighbor = neighbors[n];
                        if (particle === neighbor) continue;

                        // OPTIMIZED: Use particle IDs for connection key (integer math, no strings)
                        const minId = particle.id < neighbor.id ? particle.id : neighbor.id;
                        const maxId = particle.id < neighbor.id ? neighbor.id : particle.id;
                        const connectionKey = (minId << 16) | maxId;
                        if (drawnConnections.has(connectionKey)) continue;
                        drawnConnections.add(connectionKey);

                        const dx = particle.x - neighbor.x;
                        const dy = particle.y - neighbor.y;
                        const distSq = dx * dx + dy * dy;

                        if (distSq < maxDistSq) {
                            // Quantize opacity to reduce unique stroke styles (batch more lines)
                            const rawOpacity = (1 - distSq / maxDistSq) * 0.15;
                            const quantizedOpacity = Math.round(rawOpacity * 20) / 20; // 5% steps

                            if (!connectionsByOpacity.has(quantizedOpacity)) {
                                connectionsByOpacity.set(quantizedOpacity, []);
                            }
                            connectionsByOpacity.get(quantizedOpacity).push(
                                particle.x, particle.y, neighbor.x, neighbor.y
                            );
                        }
                    }
                }
            }
        }

        // Draw batched connections by opacity level
        ctx.lineWidth = 0.5;
        connectionsByOpacity.forEach((lines, opacity) => {
            ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`;
            ctx.beginPath();
            for (let i = 0; i < lines.length; i += 4) {
                ctx.moveTo(lines[i], lines[i + 1]);
                ctx.lineTo(lines[i + 2], lines[i + 3]);
            }
            ctx.stroke();
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
let manuallyExpanded = false; // Track if user manually expanded the bar

// Detect if we're on the music page
const isMusicPage = window.location.pathname.includes('/music');

// Handle Mini-Mode Toggle Click
if (floatingInner && miniToggle) {
    // Improved toggle: use rAF and immediate pointer-events so CTAs appear promptly
    const toggleExpansion = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const isMiniMode = window.innerWidth <= 870 || window.innerHeight <= 660;
        console.log('Toggle clicked! Mini mode:', isMiniMode, 'Width:', window.innerWidth, 'Height:', window.innerHeight);

        if (!isMiniMode) return;

        const isExpanded = floatingInner.classList.contains('mini-expanded') || floatingInner.classList.contains('expanded');
        console.log('Current state - isExpanded:', isExpanded);

        if (isExpanded) {
            // Collapse: remove visible immediately, then adjust classes
            console.log('Collapsing...');
            manuallyExpanded = false; // Clear manual flag
            if (floatingCtas) {
                floatingCtas.classList.remove('visible');
                floatingCtas.style.pointerEvents = 'none';
            }

            // allow the collapse transition to run
            requestAnimationFrame(() => {
                floatingInner.classList.remove('mini-expanded', 'expanded');
                floatingInner.classList.add('compact');
            });
        } else {
            // Expand: set classes first to expose area, then make CTAs visible
            console.log('Expanding...');
            manuallyExpanded = true; // Set manual flag to prevent scroll override
            floatingInner.classList.remove('compact');
            // Force a reflow so the browser acknowledges layout change before animating CTAs
            floatingInner.classList.add('mini-expanded', 'expanded');
            void floatingInner.offsetHeight;

            if (floatingCtas) {
                // Make interactable immediately so clicks don't miss during transition
                floatingCtas.style.pointerEvents = 'auto';
                // Use rAF to ensure CSS transitions trigger properly
                requestAnimationFrame(() => {
                    floatingCtas.classList.add('visible');
                });
            }
        }

        // reset auto-collapse timer whenever user manually toggles
        clearAutoCollapseTimer();
        startAutoCollapseTimer();
    };

    // Attach to mini-toggle button
    miniToggle.addEventListener('click', toggleExpansion);
    console.log('Mini-toggle handler attached');

    // Attach to title group for broader click area
    const titleGroup = floatingInner.querySelector('.title-group');
    if (titleGroup) {
        titleGroup.addEventListener('click', toggleExpansion);
        console.log('Title-group handler attached');
    }

    // Also attach to header-center-box for even broader click area in mini mode
    const headerCenterBox = floatingInner.querySelector('.header-center-box');
    if (headerCenterBox) {
        headerCenterBox.addEventListener('click', (e) => {
            const isMiniMode = window.innerWidth <= 870 || window.innerHeight <= 660;
            if (isMiniMode) {
                // Only trigger if click is not on CTA buttons
                if (!e.target.closest('.floating-ctas')) {
                    toggleExpansion(e);
                }
            }
        });
        console.log('Header-center-box handler attached');
    }
}

function startAutoCollapseTimer() {
    clearAutoCollapseTimer();
    autoCollapseTimer = setTimeout(() => {
        // Auto-collapse after 2 seconds of no activity (Universal in mini-mode)
        // Mini mode activates at 870px (horizontal) or 660px (vertical)
        const isMiniMode = window.innerWidth <= 870 || window.innerHeight <= 660;

        if (floatingInner && isMiniMode) {
            const isExpanded = floatingInner.classList.contains('mini-expanded') ||
                floatingInner.classList.contains('expanded');

            if (isExpanded) {
                manuallyExpanded = false; // Clear manual flag on auto-collapse
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
    }, 1200);
}

function clearAutoCollapseTimer() {
    if (autoCollapseTimer) {
        clearTimeout(autoCollapseTimer);
        autoCollapseTimer = null;
    }
}

function updateFloatingHero() {
    // Skip CTA logic entirely on music page
    if (isMusicPage) {
        // Keep header compact at all times
        if (floatingInner) {
            floatingInner.classList.add('compact');
            floatingInner.classList.remove('expanded', 'mini-expanded');
        }
        return;
    }

    const currentScroll = window.pageYOffset;
    const scrollDelta = currentScroll - lastScroll;
    const isScrollingUp = scrollDelta < -10;
    const isScrollingDown = scrollDelta > 2;

    const heroHeight = heroSection ? heroSection.offsetHeight * 0.6 : 500;
    const isMiniMode = window.innerWidth <= 870 || window.innerHeight <= 660;

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
                // Always expand on scroll-up in mini-mode
                if (floatingInner) {
                    floatingInner.classList.remove('compact');
                    floatingInner.classList.add('mini-expanded', 'expanded');
                    if (floatingCtas) floatingCtas.classList.add('visible');
                }
                manuallyExpanded = false; // Clear flag on scroll-up expand
            } else if (isScrollingDown) {
                // Always collapse on scroll-down in mini-mode
                manuallyExpanded = false; // Clear flag on scroll-down
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
                // Always expand on scroll-up in mini-mode
                if (floatingInner) {
                    floatingInner.classList.add('mini-expanded', 'expanded');
                    floatingInner.classList.remove('compact');
                }
                if (floatingCtas) floatingCtas.classList.add('visible');
                if (miniToggle) miniToggle.classList.remove('highlight');
                manuallyExpanded = false; // Clear flag
            } else if (isScrollingDown && currentScroll > 50) {
                // Immediate collapse hint on scroll-down
                if (floatingInner) {
                    floatingInner.classList.remove('mini-expanded', 'expanded');
                    floatingInner.classList.add('compact');
                    if (floatingCtas) floatingCtas.classList.remove('visible');
                }
                if (miniToggle) miniToggle.classList.add('highlight');
                manuallyExpanded = false; // Clear flag on scroll-down
            } else if (currentScroll < 50) {
                // Full reset at top
                manuallyExpanded = false; // Clear flag at top
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

// Scroll to top when nav hub main button is clicked (only prevent reload if on home page)
const navHubMain = document.querySelector('.nav-hub .hub-main');
if (navHubMain) {
    navHubMain.addEventListener('click', (e) => {
        const currentPath = window.location.pathname;
        const isHomePage = currentPath === '/' || currentPath === '/index.html';

        if (isHomePage) {
            // On home page - just scroll to top
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
        // Otherwise allow normal navigation to home page
    });
}

// ==========================================
// EXPANDABLE NAVIGATION HUB
// Enhanced hover interactions with keyboard support
// ==========================================
(function initExpandableNav() {
    const navHub = document.querySelector('.nav-hub');
    if (!navHub) return;

    // Add keyboard navigation support
    const secondaryButtons = navHub.querySelectorAll('.hub-btn');
    
    secondaryButtons.forEach((btn, index) => {
        // Ensure buttons are tabbable when visible
        btn.setAttribute('tabindex', '0');
        
        // Add keyboard support for better accessibility
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' && index < secondaryButtons.length - 1) {
                secondaryButtons[index + 1].focus();
            } else if (e.key === 'ArrowLeft' && index > 0) {
                secondaryButtons[index - 1].focus();
            }
        });
    });

    // Optional: Add touch support for mobile hover simulation
    if ('ontouchstart' in window) {
        let touchTimeout;
        navHub.addEventListener('touchstart', (e) => {
            clearTimeout(touchTimeout);
            navHub.classList.add('touch-active');
        }, { passive: true });

        navHub.addEventListener('touchend', () => {
            touchTimeout = setTimeout(() => {
                navHub.classList.remove('touch-active');
            }, 3000); // Keep visible for 3s after touch
        }, { passive: true });
    }
})();

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
        const outputParts = [];
        let complete = 0;
        let hasStyledChars = false;

        for (let i = 0, n = this.queue.length; i < n; i++) {
            let { from, to, start, end, char } = this.queue[i];
            if (this.frame >= end) {
                complete++;
                outputParts.push(to);
            } else if (this.frame >= start) {
                if (!char || Math.random() < 0.28) {
                    char = this.randomChar();
                    this.queue[i].char = char;
                }
                hasStyledChars = true;
                outputParts.push(`<span class="dud" style="color: var(--neon-magenta)">${char}</span>`);
            } else {
                outputParts.push(from);
            }
        }

        // Use textContent when complete (faster, no HTML parsing)
        if (complete === this.queue.length) {
            this.el.textContent = outputParts.join('');
            this.resolve();
        } else {
            this.el.innerHTML = outputParts.join('');
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
// OPTIMIZED: Cache bounds on mouseenter and throttle CSS updates via rAF
// ==========================================
function initLiquidButtons() {
    document.querySelectorAll('.cta-btn, .cv-btn, .filter-btn').forEach(btn => {
        let cachedRect = null;
        let rafPending = false;
        let latestX = 0;
        let latestY = 0;

        // Cache bounds on mouseenter to avoid getBoundingClientRect in mousemove
        btn.addEventListener('mouseenter', () => {
            cachedRect = btn.getBoundingClientRect();
        });

        btn.addEventListener('mousemove', (e) => {
            if (!cachedRect) cachedRect = btn.getBoundingClientRect();
            latestX = e.clientX - cachedRect.left;
            latestY = e.clientY - cachedRect.top;

            // Throttle CSS updates to align with browser refresh rate
            if (!rafPending) {
                rafPending = true;
                requestAnimationFrame(() => {
                    btn.style.setProperty('--x', `${latestX}px`);
                    btn.style.setProperty('--y', `${latestY}px`);
                    rafPending = false;
                });
            }
        });

        btn.addEventListener('mouseleave', () => {
            cachedRect = null;
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
console.log('%c Glen Muthoka - Embedded Systems Engineer', 'color: #00f5ff; font-size: 16px; font-weight: 600;');
console.log('%c From Kenya, Based in Southampton, UK', 'color: #a855f7; font-size: 14px;');
console.log('%c Contact: theglenmuthoka@gmail.com', 'color: #fbbf24; font-size: 14px;');
console.log('%c\n Interested in the code? Check out the source!', 'color: #22d3ee; font-size: 12px;');

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
                console.warn(`Low FPS detected: ${fps} fps`);
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
                    console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
                }
            }
        });

        try {
            perfObserver.observe({ entryTypes: ['longtask'] });
        } catch (e) {
            // longtask not supported
        }
    }

    console.log('%cPerformance Monitoring Active', 'color: #00f5ff; font-size: 14px; font-weight: bold;');
    console.log('%cAdd ?debug=perf to URL to enable', 'color: #a855f7; font-size: 12px;');
}

// ==========================================
// GLOBAL POWER SAVING
// Pause animations when tab is hidden
// ==========================================
document.addEventListener('visibilitychange', () => {
    const body = document.body;
    if (document.hidden) {
        body.classList.add('animations-paused');
    } else {
        body.classList.remove('animations-paused');
    }
});

// ==========================================
// SMOOTH PAGE TRANSITIONS
// ==========================================
document.querySelectorAll('a:not([target=\"_blank\"]):not([href^=\"#\"]):not([href^=\"mailto\"]):not([download])').forEach(link => {
    link.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        // Skip if it's a download link or external
        if (href && !href.startsWith('http') && !href.startsWith('//') && !this.hasAttribute('download')) {
            // If the link points to the current path (e.g. clicking the home logo while already on home),
            // don't perform the page-transition (prevents fade-to-black when staying on same page).
            const currentPath = window.location.pathname;
            const normalizedHref = href === '' ? '/' : href;
            const isSameTarget = normalizedHref === currentPath || (normalizedHref === '/' && (currentPath === '/' || currentPath === '/index.html'));
            if (isSameTarget) {
                // Let any element-specific handlers manage the event (they may call preventDefault).
                return;
            }

            e.preventDefault();
            document.body.classList.add('page-transitioning');
            setTimeout(() => {
                window.location.href = href;
            }, 300);
        }
    });
});

// ==========================================
// RESPONSIVE BADGE ANIMATIONS (600px breakpoint)
// Uses spring.js timing for smooth in-place transitions
// ==========================================
(function initResponsiveBadgeAnimations() {
    const navHub = document.querySelector('.nav-hub');
    const socialBadgesMobile = document.querySelector('.social-badges-mobile');
    const socialBadgesInline = document.querySelector('.social-badges-inline');

    if (!navHub) return;

    let wasMobile = window.innerWidth <= 600;

    // Track when crossing the 600px breakpoint
    function handleBreakpointCross() {
        const isMobile = window.innerWidth <= 600;

        if (isMobile !== wasMobile) {
            // Crossed the breakpoint - animate badges in place
            if (isMobile) {
                // Going to mobile: fade/scale in place (no diagonal movement)
                navHub.style.transform = 'scale(0.9)';
                navHub.style.opacity = '0';

                // Use requestAnimationFrame to ensure styles are applied before transition
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        navHub.style.transform = 'scale(1)';
                        navHub.style.opacity = '1';
                    });
                });

                // Fade out inline badges in place (scale down)
                if (socialBadgesInline) {
                    socialBadgesInline.style.transform = 'scale(0.8)';
                    socialBadgesInline.style.opacity = '0';
                }

                // Fade in mobile badges in place (scale up)
                if (socialBadgesMobile) {
                    socialBadgesMobile.style.transform = 'scale(0.8)';
                    socialBadgesMobile.style.opacity = '0';

                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            socialBadgesMobile.style.transform = 'scale(1)';
                            socialBadgesMobile.style.opacity = '1';
                        });
                    });
                }
            } else {
                // Going to desktop: reset to normal state
                gmBadge.style.transform = '';
                gmBadge.style.opacity = '';

                if (socialBadgesInline) {
                    socialBadgesInline.style.transform = '';
                    socialBadgesInline.style.opacity = '';
                }

                if (socialBadgesMobile) {
                    socialBadgesMobile.style.transform = '';
                    socialBadgesMobile.style.opacity = '';
                }
            }

            wasMobile = isMobile;
        }
    }

    // Debounce resize handler
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(handleBreakpointCross, 100);
    }, { passive: true });

    // Initial state check
    if (wasMobile && gmBadge) {
        // If starting on mobile, ensure proper initial state
        gmBadge.style.transform = 'scale(1)';
        gmBadge.style.opacity = '1';
    }
})();
