// ============================================================
// CYBERCOFFEE // ARASAKA CORPO SHELL
// Sidebar, status bar, carousel controller, order toast
// ============================================================

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------
  // SIDEBAR / MOBILE NAV
  // ------------------------------------------------------------
  function initSidebar() {
    const shell = document.querySelector('.app-shell');
    const toggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    const collapsedKey = 'arasaka.sidebar.collapsed';

    if (shell && toggle && window.innerWidth > 768) {
      if (localStorage.getItem(collapsedKey) === '1') {
        shell.classList.add('sidebar-collapsed');
      }
      toggle.addEventListener('click', () => {
        shell.classList.toggle('sidebar-collapsed');
        localStorage.setItem(collapsedKey, shell.classList.contains('sidebar-collapsed') ? '1' : '0');
      });
    }

    if (sidebar && overlay) {
      const open = () => {
        sidebar.classList.add('open');
        overlay.classList.add('show');
      };
      const close = () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      };

      if (toggle && window.innerWidth <= 768) {
        toggle.addEventListener('click', open);
      }
      overlay.addEventListener('click', close);

      // Close on link click (mobile)
      sidebar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', close);
      });
    }
  }

  // ------------------------------------------------------------
  // STATUS BAR CLOCK (JST)
  // ------------------------------------------------------------
  function initClock() {
    const el = document.querySelector('.status-time');
    if (!el) return;

    function tick() {
      const now = new Date();
      const jst = new Date(now.getTime() + (9 - now.getTimezoneOffset() / 60) * 3600000);
      const hh = String(jst.getUTCHours()).padStart(2, '0');
      const mm = String(jst.getUTCMinutes()).padStart(2, '0');
      const ss = String(jst.getUTCSeconds()).padStart(2, '0');
      el.textContent = `${hh}:${mm}:${ss} JST`;
    }

    tick();
    setInterval(tick, 1000);
  }

  // ------------------------------------------------------------
  // ACTIVE NAV LINK
  // ------------------------------------------------------------
  function initActiveNav() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    const map = {
      'index.html': 'dashboard',
      'featureproducts.html': 'menu',
      'discount.html': 'rewards',
      'blog.html': 'logs',
      'jobsubmit.html': 'join'
    };
    const target = map[path];
    if (!target) return;
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.dataset.nav === target) item.classList.add('active');
    });
  }

  // ------------------------------------------------------------
  // CAROUSEL
  // ------------------------------------------------------------
  class ArasakaCarousel {
    constructor(wrapper) {
      this.wrapper = wrapper;
      this.track = wrapper.querySelector('.carousel-track');
      this.cards = wrapper.querySelectorAll('.coffee-card');
      this.prevBtn = wrapper.querySelector('.control-btn[data-direction="left"]');
      this.nextBtn = wrapper.querySelector('.control-btn[data-direction="right"]');
      this.filterBtns = wrapper.querySelectorAll('.filter-btn');
      this.paginationDots = wrapper.querySelectorAll('.pagination-dot');
      this.currentSlide = 0;
      this.totalSlides = this.cards.length;
      this.autoPlayInterval = null;
      this.touchStartX = null;
      this.reducedMotion = prefersReducedMotion;

      this.init();
    }

    init() {
      this.ensurePaginationDots();
      this.setupEventListeners();
      this.setupFilters();
      this.updatePagination();
      this.startAutoPlay();
      this.updateCounter();
    }

    ensurePaginationDots() {
      const container = this.wrapper.querySelector('.carousel-pagination');
      if (!container || container.children.length > 0) return;
      const spv = this.getSlidesPerView();
      const totalDots = Math.max(1, Math.ceil(this.totalSlides / spv));
      for (let i = 0; i < totalDots; i++) {
        const dot = document.createElement('button');
        dot.className = 'pagination-dot';
        dot.setAttribute('aria-label', `Go to page ${i + 1}`);
        container.appendChild(dot);
      }
      this.paginationDots = container.querySelectorAll('.pagination-dot');
    }

    getSlidesPerView() {
      const w = window.innerWidth;
      if (w < 768) return 2;
      if (w < 1200) return 3;
      return 4;
    }

    updateCarousel(animate = true) {
      const spv = this.getSlidesPerView();
      const maxSlide = Math.max(0, this.totalSlides - spv);
      this.currentSlide = Math.min(this.currentSlide, maxSlide);

      const card = this.cards[0];
      const cardWidth = card ? card.offsetWidth : 0;
      const gap = 16;
      const offset = this.currentSlide * (cardWidth + gap);

      if (animate && !this.reducedMotion) {
        this.track.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      } else {
        this.track.style.transition = 'none';
      }
      this.track.style.transform = `translateX(-${offset}px)`;

      this.updatePagination();
      this.updateCounter();
      this.updateButtons();
    }

    goToSlide(index) {
      const spv = this.getSlidesPerView();
      const maxSlide = Math.max(0, this.totalSlides - spv);
      this.currentSlide = Math.max(0, Math.min(index, maxSlide));
      this.updateCarousel(true);
    }

    nextSlide() {
      const spv = this.getSlidesPerView();
      const maxSlide = Math.max(0, this.totalSlides - spv);
      this.goToSlide(this.currentSlide >= maxSlide ? 0 : this.currentSlide + 1);
    }

    prevSlide() {
      const spv = this.getSlidesPerView();
      const maxSlide = Math.max(0, this.totalSlides - spv);
      this.goToSlide(this.currentSlide <= 0 ? maxSlide : this.currentSlide - 1);
    }

    updatePagination() {
      const container = this.wrapper.querySelector('.carousel-pagination');
      if (!container) return;
      const spv = this.getSlidesPerView();
      const totalDots = Math.max(1, Math.ceil(this.totalSlides / spv));
      if (container.children.length !== totalDots) {
        container.innerHTML = '';
        for (let i = 0; i < totalDots; i++) {
          const dot = document.createElement('button');
          dot.className = 'pagination-dot';
          dot.setAttribute('aria-label', `Go to page ${i + 1}`);
          container.appendChild(dot);
        }
        this.paginationDots = container.querySelectorAll('.pagination-dot');
        this.paginationDots.forEach((dot, index) => {
          dot.addEventListener('click', () => {
            this.goToSlide(index * spv);
            this.resetAutoPlay();
          });
        });
      }
      const activePage = Math.floor(this.currentSlide / spv);
      this.paginationDots.forEach((dot, index) => {
        const active = index === activePage;
        dot.classList.toggle('active', active);
        dot.setAttribute('aria-selected', active);
      });
    }

    updateCounter() {
      const cur = this.wrapper.querySelector('.current-slide');
      const total = this.wrapper.querySelector('.total-slides');
      if (cur) cur.textContent = this.currentSlide + 1;
      if (total) total.textContent = `/ ${this.totalSlides}`;
    }

    updateButtons() {
      const spv = this.getSlidesPerView();
      const maxSlide = Math.max(0, this.totalSlides - spv);
      if (this.prevBtn) this.prevBtn.disabled = this.currentSlide === 0;
      if (this.nextBtn) this.nextBtn.disabled = this.currentSlide >= maxSlide;
    }

    setupFilters() {
      this.filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const filter = btn.dataset.filter;
          this.filterBtns.forEach(b => b.classList.toggle('active', b === btn));
          this.filterCards(filter);
        });
      });
    }

    filterCards(filter) {
      const visible = [];
      this.cards.forEach(card => {
        const cat = card.dataset.category;
        const isFeatured = card.classList.contains('featured');
        const isPremium = card.classList.contains('premium');
        const show = filter === 'all' ||
          cat === filter ||
          (filter === 'bestseller' && (isFeatured || card.querySelector('.badge.bestseller'))) ||
          (filter === 'new' && (isPremium || card.querySelector('.badge.new')));
        card.style.display = show ? 'block' : 'none';
        if (show) visible.push(card);
      });

      this.currentSlide = 0;
      this.totalSlides = visible.length;
      this.updateCarousel(false);
      this.updatePagination();
      this.updateCounter();
    }

    setupEventListeners() {
      this.prevBtn?.addEventListener('click', () => { this.prevSlide(); this.resetAutoPlay(); });
      this.nextBtn?.addEventListener('click', () => { this.nextSlide(); this.resetAutoPlay(); });

      this.paginationDots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
          const spv = this.getSlidesPerView();
          this.goToSlide(index * spv);
          this.resetAutoPlay();
        });
      });

      const debouncedResize = debounce(() => this.updateCarousel(false), 250);
      window.addEventListener('resize', debouncedResize);

      // Touch swipe
      this.track.addEventListener('touchstart', (e) => {
        this.touchStartX = e.changedTouches[0].screenX;
        this.stopAutoPlay();
      }, { passive: true });

      this.track.addEventListener('touchend', (e) => {
        if (this.touchStartX === null) return;
        const diff = this.touchStartX - e.changedTouches[0].screenX;
        this.touchStartX = null;
        if (Math.abs(diff) > 50) {
          if (diff > 0) this.nextSlide();
          else this.prevSlide();
          this.resetAutoPlay();
        } else {
          this.startAutoPlay();
        }
      }, { passive: true });

      // Pause autoplay while hovering / focused
      this.wrapper.addEventListener('mouseenter', () => this.stopAutoPlay());
      this.wrapper.addEventListener('mouseleave', () => this.startAutoPlay());
      this.wrapper.addEventListener('focusin', () => this.stopAutoPlay());
      this.wrapper.addEventListener('focusout', () => this.startAutoPlay());

      // Keyboard
      document.addEventListener('keydown', (e) => {
        if (!this.wrapper.contains(document.activeElement) && !this.inView()) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); this.nextSlide(); this.resetAutoPlay(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.prevSlide(); this.resetAutoPlay(); }
      });
    }

    inView() {
      const r = this.wrapper.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    }

    startAutoPlay() {
      if (this.autoPlayInterval || this.reducedMotion) return;
      this.autoPlayInterval = setInterval(() => this.nextSlide(), 5000);
    }

    stopAutoPlay() {
      clearInterval(this.autoPlayInterval);
      this.autoPlayInterval = null;
    }

    resetAutoPlay() {
      this.stopAutoPlay();
      this.startAutoPlay();
    }
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // ------------------------------------------------------------
  // FUEL CARD RENDERER (shared)
  // ------------------------------------------------------------
  function renderFuelCards(track, products) {
    if (!track) return;
    track.innerHTML = products.map((p, i) => {
      const cat = p.category === 'cafe' ? 'COFFEE'
        : p.category === 'tea' ? 'TEA'
        : p.category === 'boba' ? 'BOBA' : 'SNACK';
      const price = new Intl.NumberFormat('vi-VN').format(p.price);
      const badge = p.badge ? `<span class="badge ${(p.badge || '').toLowerCase()}">${p.badge}</span>` : '';
      const featured = p.badge === 'Bestseller' ? ' featured' : p.badge === 'New' ? ' premium' : '';
      const rating = (4.5 + ((i * 7) % 5) / 10).toFixed(1);
      const prep = 3 + (i % 9);
      const jp = ['コーヒー', 'ラテ', '抹茶', 'ボバ', 'スナック', 'デザート'][i % 6];
      return `
        <article class="coffee-card${featured}" data-category="${p.category}" role="listitem">
          <div class="card-glow${p.badge === 'Bestseller' ? ' gold' : ''}"></div>
          <div class="card-image">
            <img src="${p.image || 'media-assets/coffee.png'}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="image-placeholder" style="display:none;">☕</div>
            <div class="card-badges">${badge}</div>
          </div>
          <div class="card-content">
            <div class="card-header">
              <h3 class="card-title">${p.name}</h3>
              <span class="card-japanese">${jp} // ${cat}</span>
            </div>
            <div class="card-meta">
              <div class="meta-rating">
                <span class="stars">★★★★★</span>
                <span class="rating-count">${rating}</span>
              </div>
              <span class="meta-prep">⏱ ${prep}min</span>
            </div>
            <div class="card-footer">
              <div class="price-container">
                <span class="price-current">${price}đ</span>
              </div>
              <button class="order-btn${p.badge === 'Bestseller' ? ' premium' : ''}" data-name="${p.name}" aria-label="Order ${p.name}">
                ORDER <span class="btn-icon">▶</span>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderFuelCounts(wrapper, products) {
    wrapper.querySelectorAll('.filter-btn').forEach(btn => {
      const filter = btn.dataset.filter;
      const count = filter === 'all' ? products.length
        : filter === 'bestseller' ? products.filter(p => p.badge === 'Bestseller').length
        : filter === 'new' ? products.filter(p => p.badge === 'New').length
        : products.filter(p => p.category === filter).length;
      const el = btn.querySelector('.filter-count');
      if (el) el.textContent = count;
    });
  }

  // Expose for pages
  window.ArasakaCarousel = ArasakaCarousel;
  window.renderFuelCards = renderFuelCards;
  window.renderFuelCounts = renderFuelCounts;

  function initCarousel() {
    if (window.fuelProducts) {
      const track = document.querySelector('#fuel-track');
      if (track && !track.children.length) {
        renderFuelCards(track, window.fuelProducts);
        const wrapper = track.closest('.coffee-carousel');
        if (wrapper) renderFuelCounts(wrapper, window.fuelProducts);
      }
    }
    document.querySelectorAll('.coffee-carousel').forEach(wrapper => {
      new ArasakaCarousel(wrapper);
    });
  }

  // ------------------------------------------------------------
  // ORDER TOAST
  // ------------------------------------------------------------
  function initOrderButtons() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.order-btn');
      if (!btn) return;
      e.stopPropagation();
      const card = btn.closest('.coffee-card');
      const name = card ? card.querySelector('.card-title')?.textContent : 'Item';
      const price = card ? card.querySelector('.price-current')?.textContent : '';
      showOrderToast(name, price);

      btn.style.transform = 'scale(0.92)';
      setTimeout(() => { btn.style.transform = ''; }, 180);
    });
  }

  function showOrderToast(name, price) {
    let toast = document.querySelector('.order-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'order-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">✅</span>
        <span class="toast-text">${name} 注文完了 - Order Confirmed</span>
        <span class="toast-system">◆ ${price} // SYSTEM: ORDER_PROCESSED</span>
      </div>
    `;
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // ------------------------------------------------------------
  // BOOT
  // ------------------------------------------------------------
  function boot() {
    initSidebar();
    initClock();
    initActiveNav();
    initCarousel();
    initOrderButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
