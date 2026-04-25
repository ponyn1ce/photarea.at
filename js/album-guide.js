/**
 * album-guide.js — Album guide page script for Photarea (GitHub Pages static version).
 * Handles step animations and the "Get Started" button.
 */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    // Animate guide steps on scroll
    var steps = document.querySelectorAll('.guide-step');
    if (!steps.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.15 });

    steps.forEach(function (step) {
      step.style.opacity = '0';
      step.style.transform = 'translateY(20px)';
      step.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      observer.observe(step);
    });
  });
})();
