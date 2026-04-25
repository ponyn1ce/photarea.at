/**
 * login-form.js — Login form handler for Photarea (GitHub Pages static version).
 * Backend authentication is not available on static GitHub Pages.
 * The form is shown as a UI demo; submission displays an info message.
 */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('loginForm');
    var errorEl = document.getElementById('loginError');

    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (errorEl) {
        errorEl.textContent = 'Авторизация недоступна в демо-версии сайта. Это статическая GitHub Pages версия.';
        errorEl.style.color = '#e67e22';
      }
    });
  });
})();
