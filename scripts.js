// Meta-inspired Software Engineer Portfolio
// Clean, professional interactions for hiring managers and recruiters

class SoftwareEngineerPortfolio {
  constructor() {
    this.init();
  }

  init() {
    this.setupLoadingScreen();
    this.setupNavigation();
    this.setupSmoothScrolling();
    this.setupScrollEffects();
    this.setupExpandableItems();
    this.setupCardAnimations();
  }

  // Loading Screen
  setupLoadingScreen() {
    const loader = document.getElementById('meta-loader');
    const hasVisited = sessionStorage.getItem('hasVisited');
    
    if (hasVisited || window.location.hash) {
      loader.style.display = 'none';
      return;
    }

    sessionStorage.setItem('hasVisited', 'true');
    
    setTimeout(() => {
      loader.classList.add('hidden');
      setTimeout(() => {
        loader.style.display = 'none';
        this.animateEntrance();
      }, 500);
    }, 2000);
  }

  // Expandable Items
  setupExpandableItems() {
    document.querySelectorAll('.expandable').forEach(item => {
      const header = item.querySelector('.highlight-header');
      const details = item.querySelector('.highlight-details');
      
      if (header && details) {
        details.style.display = 'none';
        details.style.height = '0';
        details.style.opacity = '0';
        details.style.transform = 'translateY(-10px)';
        details.style.transition = 'height 0.3s ease-out, opacity 0.3s ease-out, transform 0.3s ease-out';
        
        header.addEventListener('click', () => {
          const isExpanded = item.getAttribute('data-expanded') === 'true';
          
          // Smooth animation
          if (!isExpanded) {
            details.style.display = 'block';
            requestAnimationFrame(() => {
              details.style.height = details.scrollHeight + 'px';
              details.style.opacity = '1';
              details.style.transform = 'translateY(0)';
            });
          } else {
            details.style.height = '0';
            details.style.opacity = '0';
            details.style.transform = 'translateY(-10px)';
            setTimeout(() => {
              details.style.display = 'none';
            }, 300);
          }
          
          item.setAttribute('data-expanded', !isExpanded);
          header.querySelector('.expand-icon').style.transform = 
            isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
        });
      }
    });
  }

  // Navigation
  setupNavigation() {
    const nav = document.getElementById('meta-nav');
    const navItems = document.querySelectorAll('.nav-item');
    const brand = document.querySelector('.nav-brand');
    const resumeBtn = document.querySelector('.hire-me-btn');
    
    // Scroll-based navigation styling
    window.addEventListener('scroll', () => {
      if (window.pageYOffset > 50) {
        nav.style.background = 'rgba(255, 255, 255, 0.98)';
        nav.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
      } else {
        nav.style.background = 'rgba(255, 255, 255, 0.95)';
        nav.style.boxShadow = 'none';
      }
    });

    // Active navigation highlighting
    const sections = document.querySelectorAll('section[id]');
    const observerOptions = {
      threshold: 0.3,
      rootMargin: '-100px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navItems.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${id}`) {
              link.classList.add('active');
            }
          });
        }
      });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));

    // Navigation clicks
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = item.getAttribute('href');
        this.smoothScrollTo(target);
      });
    });

    // Brand click to scroll to top
    if (brand) {
      brand.addEventListener('click', () => {
        this.smoothScrollTo('#home');
      });
    }

    // Resume button
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        window.open('assets/Mayuresh_Khanaj_Resume.pdf', '_blank');
      });
    }
  }

  // Smooth Scrolling
  setupSmoothScrolling() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('href');
        this.smoothScrollTo(target);
      });
    });
  }

  smoothScrollTo(target) {
    const element = document.querySelector(target);
    if (element) {
      const headerHeight = 64;
      const elementPosition = element.offsetTop - headerHeight;
      
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      });
    }
  }

  // Scroll Effects
  setupScrollEffects() {
    const observerOptions = {
      threshold: 0.2,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          
          // Handle section line animation
          if (entry.target.classList.contains('section-header')) {
            entry.target.querySelector('.section-line')?.classList.add('animate-in');
          }
          
          // Stagger child animations
          if (entry.target.classList.contains('contact-cards')) {
            entry.target.querySelectorAll('.contact-card').forEach((card, index) => {
              setTimeout(() => {
                card.classList.add('animate-in');
              }, index * 100);
            });
          }
        }
      });
    }, observerOptions);

    document.querySelectorAll('.animate-on-scroll, .section-header, .contact-cards').forEach(el => {
      observer.observe(el);
    });
  }

  // Card Animations
  setupCardAnimations() {
    const cards = document.querySelectorAll(`
      .stat-item,
      .skill-category,
      .project-card,
      .blog-card,
      .contact-item,
      .highlight-item,
      .timeline-content
    `);

    cards.forEach(card => {
      card.addEventListener('mouseenter', () => {
        this.animateCardHover(card, true);
      });
      
      card.addEventListener('mouseleave', () => {
        this.animateCardHover(card, false);
      });
    });

    // Skill tag interactions
    const skillTags = document.querySelectorAll('.skill-tag');
    skillTags.forEach(tag => {
      tag.addEventListener('mouseenter', () => {
        tag.style.transform = 'translateY(-2px)';
      });
      
      tag.addEventListener('mouseleave', () => {
        tag.style.transform = 'translateY(0)';
      });
    });

    // Tech stack interactions
    const techItems = document.querySelectorAll('.tech-item');
    techItems.forEach(item => {
      item.addEventListener('mouseenter', () => {
        item.style.transform = 'scale(1.05)';
      });
      
      item.addEventListener('mouseleave', () => {
        item.style.transform = 'scale(1)';
      });
    });
  }

  animateCardHover(card, isHovering) {
    if (isHovering) {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = '0 8px 15px rgba(0, 0, 0, 0.15)';
    } else {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    }
  }

  // Entrance Animations
  animateEntrance() {
    const heroContent = document.querySelector('.hero-content');
    const heroVisual = document.querySelector('.hero-visual');
    
    if (heroContent) {
      heroContent.style.opacity = '0';
      heroContent.style.transform = 'translateX(-30px)';
      heroContent.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
      
      setTimeout(() => {
        heroContent.style.opacity = '1';
        heroContent.style.transform = 'translateX(0)';
      }, 200);
    }
    
    if (heroVisual) {
      heroVisual.style.opacity = '0';
      heroVisual.style.transform = 'translateX(30px)';
      heroVisual.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
      
      setTimeout(() => {
        heroVisual.style.opacity = '1';
        heroVisual.style.transform = 'translateX(0)';
      }, 400);
    }

    // Animate stats
    this.animateStats();
  }

  // Animate Statistics
  animateStats() {
    const statNumbers = document.querySelectorAll('.stat-number');
    
    const animateNumber = (element, target) => {
      const isPercentage = target.includes('%');
      const isPlus = target.includes('+');
      const numericValue = parseInt(target.replace(/[^0-9]/g, ''));
      
      let current = 0;
      const increment = numericValue / 30;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= numericValue) {
          current = numericValue;
          clearInterval(timer);
        }
        
        let displayValue = Math.floor(current);
        if (isPercentage) displayValue += '%';
        if (isPlus) displayValue += '+';
        
        element.textContent = displayValue;
      }, 50);
    };

    // Observe stats section
    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            statNumbers.forEach(stat => {
              const target = stat.textContent;
              stat.textContent = '0';
              animateNumber(stat, target);
            });
          }, 500);
          statsObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) {
      statsObserver.observe(heroStats);
    }
  }
}

// Initialize the portfolio
document.addEventListener('DOMContentLoaded', function() {
    const navbar = document.querySelector('.navbar');
    const mobileToggle = document.querySelector('.nav-mobile-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    // Scroll Effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile Menu Toggle
    mobileToggle?.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (navLinks.classList.contains('active') && 
            !e.target.closest('.nav-links') && 
            !e.target.closest('.nav-mobile-toggle')) {
            navLinks.classList.remove('active');
        }
    });
  new SoftwareEngineerPortfolio();
});

// Additional smooth scrolling for any missed links
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (link && link.getAttribute('href') !== '#') {
    e.preventDefault();
    const target = link.getAttribute('href');
    const element = document.querySelector(target);
    if (element) {
      const headerHeight = 64;
      const elementPosition = element.offsetTop - headerHeight;
      
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      });
    }
  }
});