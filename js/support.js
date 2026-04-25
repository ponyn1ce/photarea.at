/**
 * support.js — Support chat stub for Photarea (GitHub Pages static version).
 * Real-time chat via Socket.IO requires a backend server.
 * This stub shows a notice that the chat is unavailable on the static version.
 */
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var chatContainer = document.getElementById('chatMessages') ||
      document.querySelector('.chat-messages') ||
      document.querySelector('.messages-container');

    var notice = document.createElement('div');
    notice.style.cssText = [
      'text-align:center', 'padding:30px 20px', 'color:#888',
      'font-size:15px', 'font-family:system-ui,sans-serif'
    ].join(';');
    notice.textContent = 'Чат поддержки недоступен в статической GitHub Pages версии. Пожалуйста, свяжитесь с нами по email.';

    if (chatContainer) {
      chatContainer.appendChild(notice);
    }

    // Disable send button
    var sendBtn = document.getElementById('sendBtn') ||
      document.querySelector('button[type="submit"]');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.style.opacity = '0.5';
    }
  });
})();
