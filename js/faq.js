/**
 * faq.js — FAQ page interactions for Photarea.
 * Handles accordion expand/collapse behaviour.
 */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var items = document.querySelectorAll('.faq-item, .accordion-item');
    items.forEach(function (item) {
      var header = item.querySelector('.faq-question, .accordion-header, summary');
      if (!header) return;
      header.addEventListener('click', function () {
        item.classList.toggle('open');
      });
    });
  });
})();
