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
    constructor(wrapper, products) {
      this.wrapper = wrapper;
      this.track = wrapper.querySelector('.carousel-track');
      this.viewport = wrapper.querySelector('.carousel-track-wrapper');
      this.prevBtn = wrapper.querySelector('.control-btn[data-direction="left"]');
      this.nextBtn = wrapper.querySelector('.control-btn[data-direction="right"]');
      this.filterBtns = wrapper.querySelectorAll('.filter-btn');
      this.allProducts = (products || window.fuelProducts || []).slice();
      this.products = this.allProducts.slice();
      this.reducedMotion = prefersReducedMotion;

      // Conveyor geometry
      this.gap = 16;
      this.cardWidth = 0;
      this.step = 0;
      this.windowCount = 0;
      this.scroll = 0;
      this.gStart = 0;
      this.speed = 25;

      // Virtualization pools
      this.mounted = new Map(); // global index -> card element
      this.pool = [];

      // Interaction state
      this.autoplayOn = false;
      this.hoverPaused = false;
      this.dragPaused = false;
      this.manualPaused = false;
      this.tween = null;
      this.resumeTimer = null;
      this.rafId = null;
      this.prevTs = 0;

      this.dragging = false;
      this.pointerId = null;
      this.dragStartX = 0;
      this.dragStartScroll = 0;
      this.dragMoved = false;

      this.tick = (ts) => {
        this.rafId = requestAnimationFrame(this.tick);
        if (this.prevTs === 0) { this.prevTs = ts; return; }
        const dt = Math.min(64, ts - this.prevTs);
        this.prevTs = ts;

        if (this.tween) {
          const t = Math.min(1, (ts - this.tween.start) / this.tween.dur);
          const k = 1 - Math.pow(1 - t, 3);
          this.scroll = this.tween.from + (this.tween.to - this.tween.from) * k;
          if (t >= 1) this.tween = null;
        } else if (this.autoplayOn && !this.hoverPaused && !this.dragPaused && !this.manualPaused) {
          this.scroll += this.speed * (dt / 1000);
        }

        if (!this.products.length) return;
        const gStart = Math.floor(this.scroll / this.step);
        if (gStart !== this.gStart) this.buildWindow();
        else this.paint();
      };

      this.init();
    }

    init() {
      if (!this.track || !this.products.length) return;
      this.measure();
      this.setupFilters();
      this.setupEvents();
      this.buildWindow();
      this.observeVisibility();
      this.startAutoplay();
      this.updateCounter();
    }

    getSlidesPerView() {
      const w = window.innerWidth;
      if (w < 480) return 1.2;
      if (w < 768) return 1.6;
      if (w < 992) return 2;
      if (w < 1200) return 3;
      return 4;
    }

    measure() {
      const vw = this.viewport ? this.viewport.clientWidth : this.wrapper.clientWidth;
      const spv = this.getSlidesPerView();
      this.cardWidth = Math.max(140, Math.round((vw - spv * this.gap) / spv));
      this.step = this.cardWidth + this.gap;
      this.windowCount = Math.max(Math.ceil(spv) + 3, Math.ceil(vw / this.step) + 6);
    }

    filterProducts(filter) {
      if (filter === 'all' || !filter) return this.allProducts.slice();
      if (filter === 'bestseller') return this.allProducts.filter(p => p.badge === 'Bestseller');
      if (filter === 'new') return this.allProducts.filter(p => p.badge === 'New');
      return this.allProducts.filter(p => p.category === filter);
    }

    cardHTML(g) {
      const N = this.products.length;
      const idx = mod(g, N);
      const p = this.products[idx];
      const cat = p.category === 'cafe' ? 'COFFEE'
        : p.category === 'tea' ? 'TEA'
        : p.category === 'boba' ? 'BOBA'
        : p.category === 'beer' ? 'BEER'
        : p.category === 'icecream' ? 'ICECREAM'
        : p.category === 'energy' ? 'ENERGY'
        : p.category === 'fastfood' ? 'FASTFOOD' : 'SNACK';
      const price = new Intl.NumberFormat('vi-VN').format(p.price);
      const badge = p.badge ? `<span class="badge ${(p.badge || '').toLowerCase()}">${p.badge}</span>` : '';
      const rating = (4.5 + ((idx * 7) % 5) / 10).toFixed(1);
      const prep = 3 + (idx % 9);
      const jp = p.category === 'beer' ? 'ビール'
        : p.category === 'icecream' ? 'アイスクリーム'
        : p.category === 'energy' ? 'エナジードリンク'
        : p.category === 'fastfood' ? 'ファストフード'
        : ['コーヒー', 'ラテ', '抹茶', 'ボバ', 'スナック', 'デザート'][idx % 6];
      return `
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
        `;
    }

    paint() {
      this.mounted.forEach((el, g) => {
        el.style.transform = `translateX(${g * this.step - this.scroll}px)`;
      });
    }

    buildWindow() {
      if (!this.products.length) return;
      this.gStart = Math.floor(this.scroll / this.step);
      const from = this.gStart - 1;
      const to = this.gStart + this.windowCount + 2;
      const needed = new Set();
      for (let g = from; g < to; g++) needed.add(g);

      const kept = new Map();
      this.mounted.forEach((el, g) => {
        if (needed.has(g)) { kept.set(g, el); needed.delete(g); }
        else this.pool.push(el);
      });
      this.mounted = kept;

      needed.forEach(g => {
        const idx = mod(g, this.products.length);
        const p = this.products[idx];
        const el = this.pool.pop() || document.createElement('article');
        el.className = 'coffee-card' + (p.badge === 'Bestseller' ? ' featured' : p.badge === 'New' ? ' premium' : '');
        el.setAttribute('role', 'listitem');
        el.dataset.category = p.category;
        el.style.width = `${this.cardWidth}px`;
        el.innerHTML = this.cardHTML(g);
        this.mounted.set(g, el);
        this.track.appendChild(el);
      });

      this.paint();
      this.alignHeights();
    }

    alignHeights() {
      requestAnimationFrame(() => {
        let max = 0;
        this.mounted.forEach(el => { max = Math.max(max, el.offsetHeight); });
        if (!max) return;
        this.track.style.height = `${max}px`;
        this.mounted.forEach(el => { el.style.height = `${max}px`; });
      });
    }

    updateCounter() {
      const cur = this.wrapper.querySelector('.current-slide');
      const total = this.wrapper.querySelector('.total-slides');
      if (cur) cur.textContent = this.products.length;
      if (total) total.textContent = ' / ∞';
    }

    setupFilters() {
      this.filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.setFilter(btn.dataset.filter);
          this.scheduleResume(1200);
        });
      });
    }

    setFilter(filter) {
      this.filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
      this.products = this.filterProducts(filter);
      this.scroll = 0;
      this.gStart = 0;
      this.tween = null;
      this.pool.push(...this.mounted.values());
      this.mounted.clear();
      this.track.innerHTML = '';
      this.buildWindow();
      this.updateCounter();
    }

    animateTo(target) {
      this.tween = {
        from: this.scroll,
        to: target,
        start: performance.now(),
        dur: this.reducedMotion ? 1 : 380
      };
      this.manualPaused = true;
      this.scheduleResume(2500);
    }

    scheduleResume(delay) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = setTimeout(() => {
        if (!this.hoverPaused && !this.dragPaused && !this.dragging) this.autoplayOn = true;
      }, delay);
    }

    startAutoplay() {
      this.autoplayOn = !this.reducedMotion;
    }

    setupEvents() {
      this.prevBtn?.addEventListener('click', () => this.animateTo(this.scroll - this.step));
      this.nextBtn?.addEventListener('click', () => this.animateTo(this.scroll + this.step));

      const debouncedResize = debounce(() => {
        this.measure();
        this.buildWindow();
      }, 250);
      window.addEventListener('resize', debouncedResize);

      // Pause autoplay while hovering / focused
      this.wrapper.addEventListener('mouseenter', () => {
        this.hoverPaused = true;
        clearTimeout(this.resumeTimer);
      });
      this.wrapper.addEventListener('mouseleave', () => {
        this.hoverPaused = false;
        this.scheduleResume(1200);
      });
      this.wrapper.addEventListener('focusin', () => {
        this.hoverPaused = true;
        clearTimeout(this.resumeTimer);
      });
      this.wrapper.addEventListener('focusout', () => {
        this.hoverPaused = false;
        this.scheduleResume(1200);
      });

      // Drag / swipe
      const viewport = this.viewport;
      if (viewport) {
        viewport.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          if (e.target.closest('.order-btn')) return;
          this.dragging = true;
          this.pointerId = e.pointerId;
          this.dragStartX = e.clientX;
          this.dragStartScroll = this.scroll;
          this.dragMoved = false;
          this.dragPaused = true;
          this.tween = null;
          clearTimeout(this.resumeTimer);
          try { viewport.setPointerCapture(e.pointerId); } catch (err) {}
          viewport.classList.add('dragging');
        });

        viewport.addEventListener('pointermove', (e) => {
          if (!this.dragging || e.pointerId !== this.pointerId) return;
          const dx = e.clientX - this.dragStartX;
          if (Math.abs(dx) > 4) this.dragMoved = true;
          this.scroll = this.dragStartScroll - dx;
          const gStart = Math.floor(this.scroll / this.step);
          if (gStart !== this.gStart) this.buildWindow();
          else this.paint();
        });

        const endDrag = (e) => {
          if (!this.dragging || e.pointerId !== this.pointerId) return;
          this.dragging = false;
          this.dragPaused = false;
          try { viewport.releasePointerCapture(e.pointerId); } catch (err) {}
          viewport.classList.remove('dragging');
          this.scheduleResume(this.dragMoved ? 2500 : 1200);
        };
        viewport.addEventListener('pointerup', endDrag);
        viewport.addEventListener('pointercancel', endDrag);

        // Wheel / trackpad
        viewport.addEventListener('wheel', (e) => {
          e.preventDefault();
          if (this.products.length < 2) return;
          const delta = e.deltaMode === 1 ? e.deltaY * this.step : (e.deltaY || e.deltaX);
          this.tween = null;
          this.manualPaused = true;
          this.scroll += delta;
          const gStart = Math.floor(this.scroll / this.step);
          if (gStart !== this.gStart) this.buildWindow();
          else this.paint();
          this.scheduleResume(1600);
        }, { passive: false });
      }

      // Keyboard
      document.addEventListener('keydown', (e) => {
        if (!this.wrapper.contains(document.activeElement) && !this.inView()) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); this.animateTo(this.scroll + this.step); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.animateTo(this.scroll - this.step); }
      });
    }

    observeVisibility() {
      if (!('IntersectionObserver' in window)) {
        this.rafId = requestAnimationFrame(this.tick);
        return;
      }
      const io = new IntersectionObserver((entries) => {
        const visible = entries[0].isIntersecting;
        if (visible && this.rafId === null) {
          this.prevTs = 0;
          this.rafId = requestAnimationFrame(this.tick);
        } else if (!visible && this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      }, { rootMargin: '200px' });
      io.observe(this.wrapper);
    }

    inView() {
      const r = this.wrapper.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    }
  }

  function mod(n, m) {
    return ((n % m) + m) % m;
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
        : p.category === 'boba' ? 'BOBA'
        : p.category === 'beer' ? 'BEER'
        : p.category === 'icecream' ? 'ICECREAM'
        : p.category === 'energy' ? 'ENERGY'
        : p.category === 'fastfood' ? 'FASTFOOD' : 'SNACK';
      const price = new Intl.NumberFormat('vi-VN').format(p.price);
      const badge = p.badge ? `<span class="badge ${(p.badge || '').toLowerCase()}">${p.badge}</span>` : '';
      const featured = p.badge === 'Bestseller' ? ' featured' : p.badge === 'New' ? ' premium' : '';
      const rating = (4.5 + ((i * 7) % 5) / 10).toFixed(1);
      const prep = 3 + (i % 9);
      const jp = p.category === 'beer' ? 'ビール'
        : p.category === 'icecream' ? 'アイスクリーム'
        : p.category === 'energy' ? 'エナジードリンク'
        : p.category === 'fastfood' ? 'ファストフード'
        : ['コーヒー', 'ラテ', '抹茶', 'ボバ', 'スナック', 'デザート'][i % 6];
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
    if (!window.fuelProducts) return;
    document.querySelectorAll('.coffee-carousel').forEach(wrapper => {
      renderFuelCounts(wrapper, window.fuelProducts);
      new ArasakaCarousel(wrapper, window.fuelProducts);
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
  // LOADING SCREEN (verbatim port of the standalone reference)
  // ------------------------------------------------------------
  function initLoadingScreen() {
    const existing = document.querySelector('#loading-screen');
    if (existing) return;

    const style = document.createElement('style');
    style.id = 'arasaka-loading-style';
    style.textContent = `
@import url("https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap");

#loading-screen {
  --vh: 100vh;
  --vh: 100svh;
  position: fixed;
  width: 100vw;
  height: var(--vh);
  background: #050508;
  z-index: 999999999;
  color: #fff;
  top: 0;
  left: 0;
  font-family: "Geist", "Inter", sans-serif;
  box-sizing: border-box;
}

#loading-screen *,
#loading-screen *::before,
#loading-screen *::after {
  box-sizing: border-box;
}

body.loading-active {
  overflow: hidden;
}

.loading-split {
  display: flex;
  width: 100%;
  height: 100%;
}

.loading-left {
  flex: 1;
  position: relative;
  background: transparent;
  overflow: hidden;
  pointer-events: none;
}

.loading-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0a0c10 0%, #0d0f14 100%);
  position: relative;
}

.jp-loading-content {
  text-align: center;
  position: relative;
  padding: 2rem;
}

.jp-text-container {
  margin-bottom: 3rem;
}

.jp-main {
  font-family: "Noto Sans JP", "Zen Kaku Gothic New", "BIZ UDGothic",
    "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
  font-size: clamp(2rem, 6vw, 4rem);
  font-weight: 500;
  letter-spacing: 0.1em;
  background: linear-gradient(135deg, #ffffff 0%, #ff0033 80%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  margin-bottom: 1rem;
  opacity: 0;
  animation: jpFadeInUp 0.8s ease forwards;
  animation-delay: 0.2s;
}

.jp-sub {
  font-family: "Noto Sans JP", "Zen Kaku Gothic New", "BIZ UDGothic",
    "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
  font-size: clamp(0.9rem, 2vw, 1.2rem);
  font-weight: 300;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.2em;
  opacity: 0;
  animation: jpFadeInUp 0.8s ease forwards;
  animation-delay: 0.4s;
}

.jp-loader {
  width: 280px;
  max-width: 80%;
  margin: 2rem auto;
}

.jp-loader-bar {
  height: 2px;
  background: rgba(255, 0, 51, 0.3);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.jp-loader-bar::after {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, #ff0033, #ffd700);
  border-radius: 2px;
  transition: width 0.1s linear;
  width: var(--pct, 0%);
}

.jp-loader-percent {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.8rem;
  text-align: right;
  margin-top: 0.5rem;
  color: #ff0033;
  letter-spacing: 1px;
}

.jp-vertical-text {
  position: absolute;
  right: 2rem;
  top: 50%;
  transform: translateY(-50%);
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-family: "Noto Sans JP", "Zen Kaku Gothic New", "BIZ UDGothic",
    "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
  font-size: 0.8rem;
  font-weight: 300;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.15);
  white-space: nowrap;
  pointer-events: none;
}

@keyframes jpFadeInUp {
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .loading-split {
    flex-direction: column;
  }
  .loading-left {
    min-height: 40vh;
  }
  .loading-right {
    min-height: 60vh;
  }
  .jp-vertical-text {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .jp-main, .jp-sub {
    animation: none;
    opacity: 1;
  }
}

.loading-button {
  padding: 20px 50px;
  border-radius: 100px;
  background-color: #000;
  overflow: hidden;
  font-size: 18px;
  font-weight: 500;
  position: relative;
  z-index: 9;
  color: #fff;
  cursor: pointer;
}

.loading-button::before {
  content: "";
  background-color: #ffffff;
  top: var(--mouse-y);
  left: var(--mouse-x);
  border-radius: 50%;
  width: 60px;
  height: 60px;
  opacity: 1;
  position: absolute;
  z-index: 99;
  filter: blur(60px);
  opacity: 0;
  transform: translate(-50%, -50%);
}

.loading-button:hover::before { opacity: 1; }
.loading-clicked .loading-button::before { opacity: 0; }

.loading-wrap {
  --Lsize: 145px;
  padding: 6px;
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  min-width: 0px;
  min-height: 0px;
  border-radius: 100px;
  background-color: #000;
  overflow: hidden;
  transition: 0.8s ease-in-out;
  transition-delay: 0.2s;
  box-shadow: 0px 15px 15px 0px rgba(0,0,0,0.2);
  display: flex;
  justify-content: center;
  align-items: center;
}

.loading-clicked {
  transition-delay: 0ms;
  transition-timing-function: cubic-bezier(0.33, 0.11, 1, 0.72);
  transform: translate(-50%, -50%) scale(1);
  min-width: calc(100vw + 5000px);
  border-radius: 5000px;
  min-height: calc(100vh + 500px);
  box-shadow: none;
}

.loading-clicked .loading-button { overflow: visible; }

.loading-hover {
  background-color: #ffd700;
  width: 250px;
  height: 120px;
  position: absolute;
  top: var(--mouse-y);
  left: var(--mouse-x);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  filter: blur(30px);
  opacity: 1;
  transition: opacity 500ms;
}

.loading-wrap:hover .loading-hover { opacity: 1; }
.loading-clicked:hover .loading-hover,
.loading-clicked .loading-hover { opacity: 0; }

.loading-content {
  position: relative;
  background-color: #000;
  width: 100%;
  overflow: hidden;
  transition: 0.6s;
  text-transform: uppercase;
}

.loading-content-in {
  position: relative;
  width: var(--Lsize);
  overflow: hidden;
}

.loading-content2 {
  position: relative;
  letter-spacing: 2px;
  text-transform: uppercase;
  width: var(--Lsize);
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  column-gap: 10px;
  text-align: center;
  transition: 1s;
  max-width: var(--Lsize);
}

.loading-clicked .loading-content2 { opacity: 0; transition: 0.5s; }

.loading-content span {
  font-weight: 300;
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  opacity: 0.7;
}

.loading-box {
  position: absolute;
  right: 0px;
  top: 50%;
  transform: translate(100%, -50%);
  width: 15px;
  height: 25px;
  background-color: white;
  animation: blink 1s linear infinite;
}

@keyframes blink {
  0% { opacity: 0; }
  25% { opacity: 1; }
  75% { opacity: 1; }
  100% { opacity: 0; }
}

.loading-complete .loading-box {
  animation: blinkDone 0.3s forwards;
  animation-delay: 1s;
  opacity: 1;
}

@keyframes blinkDone {
  to { opacity: 0; }
}

.loading-container {
  position: absolute;
  width: 100%;
  max-width: var(--Lsize);
  top: 50%;
  transition: 1s;
  left: 50px;
  z-index: 9;
  transform: translateY(-50%);
}

.loading-complete .loading-container { max-width: 0px; }

.loaderGame {
  position: absolute;
  top: 2rem;
  right: 3rem;
  opacity: 0.6;
  transition: 0.3s;
  z-index: 1;
}

.loaderGame-container {
  width: 200px;
  height: 100px;
  overflow: hidden;
  position: relative;
  transform: scale(0.35);
  transform-origin: top right;
}

.loader-out .loaderGame-container { opacity: 0; }

.loaderGame-in {
  width: 1200px;
  position: absolute;
  overflow: hidden;
  left: 0;
  animation: loaderGame 7s linear infinite;
}

@keyframes loaderGame {
  0% { transform: translateX(0px); }
  100% { transform: translateX(-300px); }
}

.loaderGame-line {
  float: left;
  margin: 0px 20px;
  margin-bottom: 40px;
  position: relative;
  width: 10px;
  height: 60px;
  background-color: rgba(255, 0, 51, 0.3);
  display: block;
}

.loaderGame-line:nth-child(2n) {
  margin-top: 40px;
  margin-bottom: 0px;
}

.loaderGame-ball {
  position: absolute;
  left: 20%;
  top: 0%;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background-color: #ffd700;
  animation: ball25 7s infinite;
  transform: translateY(10px);
  animation-timing-function: cubic-bezier(0.3, 1.18, 0.63, 1.28);
}

@keyframes ball25 {
  0% { transform: translateY(70px); }
  15% { transform: translateY(10px); }
  30% { transform: translateY(70px); }
  45% { transform: translateY(10px); }
  67% { transform: translateY(70px); }
  80% { transform: translateY(10px); }
  90% { transform: translateY(70px); }
  100% { transform: translateY(70px); }
}

@media only screen and (min-width: 1400px) {
  .loading-wrap { --Lsize: 210px; }
  .loading-button { padding: 30px 70px; font-size: 25px; }
  .loading-container { left: 70px; }
}

@media (prefers-reduced-motion: reduce) {
  .jp-main, .jp-sub {
    animation: none;
    opacity: 1;
  }
}

#welcome-message {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: #0A0B10;
  z-index: 999999998;
  color: #fff;
  font-family: "Noto Sans JP", "Geist", sans-serif;
  flex-direction: column;
  gap: 1rem;
  opacity: 0;
  transition: opacity 0.8s ease;
}

#welcome-message.show {
  display: flex;
  opacity: 1;
}

#welcome-message h1 {
  font-size: clamp(2rem, 6vw, 4rem);
  font-weight: 500;
  letter-spacing: 0.1em;
  background: linear-gradient(135deg, #ffffff 0%, #ff0033 80%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

#welcome-message p {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.2em;
}
`;
    document.head.appendChild(style);

    document.body.classList.add('loading-active');

    const screen = document.createElement('div');
    screen.id = 'loading-screen';
    screen.innerHTML = `
  <div class="loading-split">
    <div class="loading-left"></div>
    <div class="loading-right">
      <div class="loaderGame" id="loaderGame">
        <div class="loaderGame-container">
          <div class="loaderGame-in" id="loaderGameIn"></div>
          <div class="loaderGame-ball"></div>
        </div>
      </div>
      <div class="jp-loading-content">
        <div class="jp-text-container">
          <div class="jp-main">読み込み中...</div>
          <div class="jp-sub">システムを起動する</div>
        </div>
        <div class="jp-loader">
          <div class="jp-loader-bar"></div>
          <div class="jp-loader-percent" id="jpLoadPercent">0%</div>
        </div>
      </div>
      <div class="jp-vertical-text">機・械・の・下・の・機・械</div>
    </div>
  </div>
  <div class="loading-wrap" id="loadingWrap">
    <div class="loading-hover"></div>
    <div class="loading-button" id="loadingButton">
      <div class="loading-container">
        <div class="loading-content">
          <div class="loading-content-in">Loading <span id="loadPercent">0%</span></div>
        </div>
        <div class="loading-box"></div>
      </div>
      <div class="loading-content2"><span>ようこそ</span></div>
    </div>
  </div>
`;
    document.body.appendChild(screen);

    const welcome = document.createElement('div');
    welcome.id = 'welcome-message';
    welcome.innerHTML = `
  <h1>ようこそ</h1>
  <p>Welcome — loading complete</p>
`;
    document.body.appendChild(welcome);

    // Loader game bars
    const loaderIn = document.getElementById('loaderGameIn');
    for (let i = 0; i < 27; i++) {
      const div = document.createElement('div');
      div.className = 'loaderGame-line';
      loaderIn.appendChild(div);
    }

    const loadingWrap = document.getElementById('loadingWrap');
    const loadingButton = document.getElementById('loadingButton');
    const loadPercent = document.getElementById('loadPercent');
    const jpLoadPercent = document.getElementById('jpLoadPercent');
    const jpLoaderBar = document.querySelector('.jp-loader-bar');

    function updatePercentUI(val) {
      if (loadPercent) loadPercent.textContent = val + '%';
      if (jpLoadPercent) jpLoadPercent.textContent = val + '%';
      if (jpLoaderBar) jpLoaderBar.style.setProperty('--pct', val + '%');
    }

    const loadState = { percent: 0 };
    let interval = setInterval(function () {
      if (loadState.percent <= 50) {
        loadState.percent += Math.round(Math.random() * 5);
      } else {
        clearInterval(interval);
        interval = setInterval(function () {
          loadState.percent += Math.round(Math.random());
          updatePercentUI(loadState.percent);
          if (loadState.percent > 91) {
            clearInterval(interval);
          }
        }, 2000);
      }
      updatePercentUI(loadState.percent);
    }, 100);

    function finishLoading() {
      return new Promise(function (resolve) {
        clearInterval(interval);
        const fastInterval = setInterval(function () {
          if (loadState.percent < 100) {
            loadState.percent++;
            updatePercentUI(loadState.percent);
          } else {
            clearInterval(fastInterval);
            resolve();
          }
        }, 2);
      });
    }

    let loadingClicked = false;

    loadingButton.addEventListener('click', async function () {
      if (loadingClicked) return;
      loadingClicked = true;
      loadingButton.classList.add('loading-complete');
      await finishLoading();
      loadingWrap.classList.add('loading-clicked');
      document.getElementById('loaderGame').classList.add('loader-out');

      setTimeout(function () {
        document.getElementById('loading-screen').style.display = 'none';
        document.body.classList.remove('loading-active');
        const welcomeMsg = document.getElementById('welcome-message');
        welcomeMsg.classList.add('show');
        setTimeout(function () {
          welcomeMsg.classList.remove('show');
          setTimeout(function () {
            welcomeMsg.remove();
            const ls = document.getElementById('arasaka-loading-style');
            if (ls) ls.remove();
          }, 800);
        }, 2200);
      }, 1000);
    });

    loadingWrap.addEventListener('mousemove', function (e) {
      const rect = loadingWrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      loadingWrap.style.setProperty('--mouse-x', x + 'px');
      loadingWrap.style.setProperty('--mouse-y', y + 'px');
    });
  }

  // ------------------------------------------------------------
  // BOOT
  // ------------------------------------------------------------
  function boot() {
    initLoadingScreen();
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

  initLoadingScreen();
})();
