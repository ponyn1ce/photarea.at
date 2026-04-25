/**
 * password-toggle.js — Show/hide password toggle for input fields.
 * Adds an eye icon next to each password input with class .input-box.
 */
(function () {
  function attachToggles() {
    document.querySelectorAll('input[type="password"]').forEach(function (input) {
      var parent = input.parentElement;
      if (!parent || parent.querySelector('.pw-toggle')) return;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pw-toggle';
      btn.setAttribute('aria-label', 'Toggle password visibility');
      btn.style.cssText = [
        'position:absolute', 'right:14px', 'top:50%', 'transform:translateY(-50%)',
        'background:none', 'border:none', 'cursor:pointer', 'padding:0',
        'color:#888', 'font-size:18px', 'line-height:1', 'z-index:2'
      ].join(';');
      btn.innerHTML = '&#128065;'; // eye emoji fallback

      // Use boxicons if available
      var icon = document.createElement('i');
      icon.className = 'bx bx-hide';
      btn.innerHTML = '';
      btn.appendChild(icon);

      btn.addEventListener('click', function () {
        var isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        icon.className = isHidden ? 'bx bx-show' : 'bx bx-hide';
      });

      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      parent.appendChild(btn);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachToggles);
  } else {
    attachToggles();
  }
})();
