/**
 * NIS Alumni — App JavaScript
 * Handles scroll animations, mobile nav, and page interactions.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Scroll-reveal with Intersection Observer ─────────────
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    reveals.forEach(el => observer.observe(el));
  }

  // ── Mobile nav toggle ────────────────────────────────────
  const menuBtn  = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const closeBtn = document.getElementById('menu-close');

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => mobileMenu.classList.add('open'));
  }
  if (closeBtn && mobileMenu) {
    closeBtn.addEventListener('click', () => mobileMenu.classList.remove('open'));
  }

  // Close mobile menu on link click
  if (mobileMenu) {
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => mobileMenu.classList.remove('open'));
    });
  }

  // ── Navbar scroll effect ─────────────────────────────────
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }

  // ── Smooth scroll for anchor links ───────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── Counter animation (stats section) ────────────────────
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el    = entry.target;
          const target = parseInt(el.dataset.count, 10);
          const duration = 2000;
          const step   = Math.ceil(target / (duration / 16));
          let current  = 0;

          const timer = setInterval(() => {
            current += step;
            if (current >= target) {
              current = target;
              clearInterval(timer);
            }
            el.textContent = current.toLocaleString() + (el.dataset.suffix || '');
          }, 16);

          countObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(el => countObserver.observe(el));
  }

});
