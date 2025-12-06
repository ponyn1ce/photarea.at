document.addEventListener('DOMContentLoaded', function() {
// Album Guide Modal Script

// Album Guide Modal Script
  const closeBtn = document.getElementById('guide-close');
  const cancelBtn = document.getElementById('cancel-btn');
  const startBtn = document.getElementById('start-btn');

  // Close button -> перейти на главную
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      window.location.href = '../index.html';
    });
  }

  // Cancel button -> перейти на опросник
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      window.location.href = '../html/survey.html';
    });
  }

  // Start button -> открыть Telegram-бота в новой вкладке
  if (startBtn) {
    startBtn.addEventListener('click', function() {
      window.open('https://t.me/Photareabot', '_blank');
    });
  }
});
