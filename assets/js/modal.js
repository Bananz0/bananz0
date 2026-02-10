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
        this.iframe = document.getElementById('modal-iframe');
        this.caption = document.getElementById('modal-caption');
        this.indicators = document.getElementById('gallery-indicators');
        this.prevBtn = this.modal?.querySelector('.gallery-prev');
        this.nextBtn = this.modal?.querySelector('.gallery-next');
        
        this.currentItems = [];
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
        const cards = document.querySelectorAll('[data-modal-images], [data-modal-iframe], [data-project-link]');
        cards.forEach(card => {
            card.style.cursor = 'pointer';
            if (!card.hasAttribute('tabindex')) {
                card.setAttribute('tabindex', '0');
            }
            card.setAttribute('role', 'button');

            const handleActivate = (e) => {
                // Allow explicit links inside the card to work normally
                if (e.target.tagName === 'A' || e.target.closest('a')) return;

                const items = this.getItemsFromCard(card);
                const title = card.dataset.modalTitle || card.dataset.projectTitle || card.querySelector('h3')?.textContent?.trim() || 'Project';
                const link = card.dataset.projectLink;
                const linkTarget = card.dataset.projectLinkTarget || (link && link.startsWith('http') ? '_blank' : '_self');

                if (items.length > 0) {
                    e.preventDefault();
                    this.open(title, items);
                    return;
                }

                if (link) {
                    if (linkTarget === '_blank') {
                        window.open(link, '_blank', 'noopener');
                    } else {
                        window.location.href = link;
                    }
                }
            };

            card.addEventListener('click', handleActivate);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleActivate(e);
                }
            });
        });
    }

    getItemsFromCard(card) {
        const items = [];
        const imagesRaw = card.dataset.modalImages || '';
        const captionsRaw = card.dataset.modalCaptions || '';
        const iframeRaw = card.dataset.modalIframe || '';
        const iframeCaption = (card.dataset.modalIframeCaption || '').trim();

        const images = imagesRaw ? imagesRaw.split(',').map(src => src.trim()).filter(Boolean) : [];
        const captions = captionsRaw ? captionsRaw.split('|').map(cap => cap.trim()) : [];

        images.forEach((src, index) => {
            items.push({
                type: 'image',
                src,
                caption: captions[index] || ''
            });
        });

        if (iframeRaw.trim()) {
            items.push({
                type: 'iframe',
                src: iframeRaw.trim(),
                caption: iframeCaption
            });
        }

        return items;
    }

    open(title, items) {
        if (!this.modal || items.length === 0) return;

        this.currentItems = items;
        this.currentIndex = 0;
        this.isOpen = true;

        // Set title
        if (this.title) {
            this.title.textContent = title;
        }

        // Update image and caption
        this.updateMedia();

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

        if (this.iframe) {
            this.iframe.src = '';
            this.iframe.classList.remove('active');
        }

        // Clear after animation
        setTimeout(() => {
            this.currentItems = [];
            this.currentIndex = 0;
        }, 300);
    }

    navigate(direction) {
        if (this.currentItems.length <= 1) return;

        this.currentIndex += direction;

        // Wrap around
        if (this.currentIndex < 0) {
            this.currentIndex = this.currentItems.length - 1;
        }
        if (this.currentIndex >= this.currentItems.length) {
            this.currentIndex = 0;
        }

        this.updateMedia();
        this.updateIndicators();
    }

    updateMedia() {
        const current = this.currentItems[this.currentIndex];
        if (!current) return;

        if (current.type === 'iframe') {
            if (this.image) {
                this.image.style.opacity = '0';
                this.image.style.display = 'none';
                this.image.src = '';
            }

            if (this.iframe) {
                this.iframe.src = current.src;
                this.iframe.classList.add('active');
            }
        } else if (this.image) {
            if (this.iframe) {
                this.iframe.src = '';
                this.iframe.classList.remove('active');
            }

            this.image.style.display = 'block';
            this.image.style.opacity = '0';

            setTimeout(() => {
                this.image.src = current.src;
                this.image.alt = current.caption || 'Project screenshot';
                this.image.style.opacity = '1';
            }, 150);
        }

        if (this.caption) {
            this.caption.textContent = current.caption || '';
            this.caption.style.display = current.caption ? 'block' : 'none';
        }

        // Update navigation buttons
        this.updateNavButtons();
    }

    updateNavButtons() {
        if (!this.prevBtn || !this.nextBtn) return;

        const isSingle = this.currentItems.length <= 1;

        this.prevBtn.disabled = isSingle;
        this.nextBtn.disabled = isSingle;
        this.prevBtn.style.display = isSingle ? 'none' : 'flex';
        this.nextBtn.style.display = isSingle ? 'none' : 'flex';
    }

    buildIndicators() {
        if (!this.indicators) return;

        this.indicators.innerHTML = '';

        if (this.currentItems.length <= 1) {
            this.indicators.style.display = 'none';
            return;
        }

        this.indicators.style.display = 'flex';

        this.currentItems.forEach((_, index) => {
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
        this.currentItems
            .filter(item => item.type === 'image')
            .forEach(({ src }) => {
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
