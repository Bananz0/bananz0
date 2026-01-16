/**
 * Project Modal Gallery System
 * Handles expandable project cards with image galleries
 */

class ProjectModal {
    constructor() {
        this.modal = document.getElementById('project-modal');
        this.overlay = this.modal?.querySelector('.modal-overlay');
        this.content = this.modal?.querySelector('.modal-content');
        this.closeBtn = this.modal?.querySelector('.modal-close');
        this.title = document.getElementById('modal-title');
        this.image = document.getElementById('modal-image');
        this.caption = document.getElementById('modal-caption');
        this.indicators = document.getElementById('gallery-indicators');
        this.prevBtn = this.modal?.querySelector('.gallery-prev');
        this.nextBtn = this.modal?.querySelector('.gallery-next');
        
        this.currentImages = [];
        this.currentIndex = 0;
        this.isOpen = false;
        
        this.init();
    }

    init() {
        if (!this.modal) return;

        // Close button
        this.closeBtn?.addEventListener('click', () => this.close());
        
        // Close on overlay click
        this.overlay?.addEventListener('click', () => this.close());
        
        // Navigation buttons
        this.prevBtn?.addEventListener('click', () => this.navigate(-1));
        this.nextBtn?.addEventListener('click', () => this.navigate(1));
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;
            
            switch(e.key) {
                case 'Escape':
                    this.close();
                    break;
                case 'ArrowLeft':
                    this.navigate(-1);
                    break;
                case 'ArrowRight':
                    this.navigate(1);
                    break;
            }
        });

        // Touch swipe support on mobile
        let touchStartX = 0;
        let touchEndX = 0;

        this.content?.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        this.content?.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        }, { passive: true });

        const handleSwipe = () => {
            const swipeThreshold = 50;
            if (touchEndX < touchStartX - swipeThreshold) {
                this.navigate(1); // Swipe left -> next
            }
            if (touchEndX > touchStartX + swipeThreshold) {
                this.navigate(-1); // Swipe right -> prev
            }
        };

        this.handleSwipe = handleSwipe;

        // Attach to project cards
        this.attachToCards();
    }

    attachToCards() {
        const cards = document.querySelectorAll('[data-modal-images]');
        cards.forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
                // Don't open modal if clicking a link inside the card
                if (e.target.tagName === 'A' || e.target.closest('a')) return;
                
                const images = card.dataset.modalImages?.split(',').map(src => src.trim()) || [];
                const captions = card.dataset.modalCaptions?.split('|').map(cap => cap.trim()) || [];
                const title = card.dataset.modalTitle || 'Project';
                
                if (images.length > 0) {
                    this.open(title, images, captions);
                }
            });
        });
    }

    open(title, images, captions = []) {
        if (!this.modal || images.length === 0) return;

        this.currentImages = images.map((src, index) => ({
            src,
            caption: captions[index] || ''
        }));
        this.currentIndex = 0;
        this.isOpen = true;

        // Set title
        if (this.title) {
            this.title.textContent = title;
        }

        // Update image and caption
        this.updateImage();

        // Build indicators
        this.buildIndicators();

        // Show modal
        requestAnimationFrame(() => {
            this.modal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent background scroll
        });

        // Preload images
        this.preloadImages();
    }

    close() {
        if (!this.modal) return;

        this.modal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scroll
        this.isOpen = false;

        // Clear after animation
        setTimeout(() => {
            this.currentImages = [];
            this.currentIndex = 0;
        }, 300);
    }

    navigate(direction) {
        if (this.currentImages.length <= 1) return;

        this.currentIndex += direction;

        // Wrap around
        if (this.currentIndex < 0) {
            this.currentIndex = this.currentImages.length - 1;
        }
        if (this.currentIndex >= this.currentImages.length) {
            this.currentIndex = 0;
        }

        this.updateImage();
        this.updateIndicators();
    }

    updateImage() {
        if (!this.image || !this.currentImages[this.currentIndex]) return;

        const current = this.currentImages[this.currentIndex];

        // Fade out
        this.image.style.opacity = '0';

        setTimeout(() => {
            this.image.src = current.src;
            this.image.alt = current.caption || 'Project screenshot';

            if (this.caption) {
                this.caption.textContent = current.caption || '';
                this.caption.style.display = current.caption ? 'block' : 'none';
            }

            // Fade in
            this.image.style.opacity = '1';
        }, 150);

        // Update navigation buttons
        this.updateNavButtons();
    }

    updateNavButtons() {
        if (!this.prevBtn || !this.nextBtn) return;

        const isSingle = this.currentImages.length <= 1;

        this.prevBtn.disabled = isSingle;
        this.nextBtn.disabled = isSingle;
        this.prevBtn.style.display = isSingle ? 'none' : 'flex';
        this.nextBtn.style.display = isSingle ? 'none' : 'flex';
    }

    buildIndicators() {
        if (!this.indicators) return;

        this.indicators.innerHTML = '';

        if (this.currentImages.length <= 1) {
            this.indicators.style.display = 'none';
            return;
        }

        this.indicators.style.display = 'flex';

        this.currentImages.forEach((_, index) => {
            const indicator = document.createElement('button');
            indicator.className = 'gallery-indicator';
            indicator.setAttribute('aria-label', `Go to image ${index + 1}`);
            
            if (index === this.currentIndex) {
                indicator.classList.add('active');
            }

            indicator.addEventListener('click', () => {
                this.currentIndex = index;
                this.updateImage();
                this.updateIndicators();
            });

            this.indicators.appendChild(indicator);
        });
    }

    updateIndicators() {
        if (!this.indicators) return;

        const dots = this.indicators.querySelectorAll('.gallery-indicator');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === this.currentIndex);
        });
    }

    preloadImages() {
        this.currentImages.forEach(({ src }) => {
            const img = new Image();
            img.src = src;
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.projectModal = new ProjectModal();
    });
} else {
    window.projectModal = new ProjectModal();
}
