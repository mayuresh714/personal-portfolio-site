// Mayuresh Khanaj — Portfolio interactions
// Lightweight, dependency-free. Handles loader, nav, reveal,
// expandable highlights, case-study toggles and animated stats.

class Portfolio {
  constructor() {
    this.init();
  }

  init() {
    this.setupLoadingScreen();
    this.setupNavbar();
    this.setupMobileMenu();
    this.setupSmoothScrolling();
    this.setupScrollReveal();
    this.setupExpandables();
    this.setupCaseToggles();
    this.setupActiveNav();
    this.setupStatCounters();
  }

  // ---- Loading screen ----
  setupLoadingScreen() {
    const loader = document.getElementById('meta-loader');
    if (!loader) return;

    const hasVisited = sessionStorage.getItem('hasVisited');
    if (hasVisited || window.location.hash) {
      loader.style.display = 'none';
      return;
    }
    sessionStorage.setItem('hasVisited', 'true');

    setTimeout(() => {
      loader.classList.add('hidden');
      setTimeout(() => { loader.style.display = 'none'; }, 500);
    }, 1600);
  }

  // ---- Navbar scroll state ----
  setupNavbar() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    const onScroll = () => {
      navbar.classList.toggle('scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---- Mobile menu ----
  setupMobileMenu() {
    const toggle = document.querySelector('.nav-mobile-toggle');
    const links = document.querySelector('.nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      links.classList.toggle('active');
    });
    document.addEventListener('click', (e) => {
      if (links.classList.contains('active') &&
          !e.target.closest('.nav-links') &&
          !e.target.closest('.nav-mobile-toggle')) {
        links.classList.remove('active');
      }
    });
    links.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => links.classList.remove('active'))
    );
  }

  // ---- Smooth in-page scrolling ----
  setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href === '#' || href.length < 2) return;
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - 68;
        window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  }

  // ---- Scroll reveal ----
  setupScrollReveal() {
    const els = document.querySelectorAll('.animate-on-scroll');
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('animate-in'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => observer.observe(el));
  }

  // ---- Expandable "about" highlights ----
  setupExpandables() {
    document.querySelectorAll('.expandable').forEach(item => {
      const header = item.querySelector('.highlight-header');
      const details = item.querySelector('.highlight-details');
      const icon = item.querySelector('.expand-icon');
      if (!header || !details) return;

      details.style.maxHeight = '0';
      details.style.overflow = 'hidden';
      details.style.transition = 'max-height 0.35s ease, opacity 0.3s ease, padding 0.3s ease';
      details.style.opacity = '0';
      details.style.paddingTop = '0';
      details.style.paddingBottom = '0';

      header.addEventListener('click', () => {
        const isOpen = item.getAttribute('data-expanded') === 'true';
        item.setAttribute('data-expanded', String(!isOpen));
        if (!isOpen) {
          details.style.maxHeight = details.scrollHeight + 40 + 'px';
          details.style.opacity = '1';
          details.style.paddingBottom = '1.5rem';
        } else {
          details.style.maxHeight = '0';
          details.style.opacity = '0';
          details.style.paddingBottom = '0';
        }
        if (icon) icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    });
  }

  // ---- Case-study "more detail" toggles ----
  setupCaseToggles() {
    document.querySelectorAll('.case-toggle').forEach(btn => {
      const card = btn.closest('.case-card');
      if (!card) return;
      const label = btn.querySelector('i');
      btn.addEventListener('click', () => {
        const open = card.classList.toggle('open');
        btn.childNodes[0].nodeValue = open ? 'Less detail ' : 'More detail ';
        if (label) btn.appendChild(label);
      });
    });
  }

  // ---- Active nav link highlighting ----
  setupActiveNav() {
    const sections = document.querySelectorAll('main section[id]');
    const links = document.querySelectorAll('.nav-links a[href^="#"]');
    if (!sections.length || !links.length || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
          });
        }
      });
    }, { threshold: 0.4, rootMargin: '-80px 0px -55% 0px' });
    sections.forEach(s => observer.observe(s));
  }

  // ---- Animated stat counters ----
  setupStatCounters() {
    const stats = document.querySelectorAll('.stat-number');
    if (!stats.length) return;

    const animate = (el) => {
      const raw = el.textContent.trim();
      const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
      if (isNaN(num)) return;
      const suffix = raw.replace(/[0-9.]/g, '');
      const duration = 1100;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = num >= 10 ? Math.round(num * eased) : (num * eased).toFixed(0);
        el.textContent = val + suffix;
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = raw;
      };
      requestAnimationFrame(step);
    };

    if (!('IntersectionObserver' in window)) { stats.forEach(animate); return; }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    stats.forEach(s => observer.observe(s));
  }
}

document.addEventListener('DOMContentLoaded', () => new Portfolio());
