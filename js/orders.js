/**
 * orders.js — Orders page stub for Photarea (GitHub Pages static version).
 * Order data requires a backend; this shows a placeholder notice.
 */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var container = document.getElementById('ordersContainer') ||
      document.querySelector('.orders-list') ||
      document.querySelector('.orders-container');
    if (container && !container.children.length) {
      container.innerHTML = '<p style="text-align:center;color:#888;padding:30px;font-family:system-ui,sans-serif">Данные заказов недоступны в статической GitHub Pages версии.</p>';
    }
  });
})();
