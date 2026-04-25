/**
 * admin-chat.js — Admin chat stub for Photarea (GitHub Pages static version).
 */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var container = document.querySelector('.chat-container') ||
      document.querySelector('#chatMessages') ||
      document.querySelector('.messages-area');
    if (container) {
      var msg = document.createElement('p');
      msg.style.cssText = 'text-align:center;color:#888;padding:20px;font-family:system-ui,sans-serif';
      msg.textContent = 'Админ-чат недоступен в статической GitHub Pages версии.';
      container.prepend(msg);
    }
  });
})();
