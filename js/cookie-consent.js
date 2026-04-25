/**
 * cookie-consent.js — Simple cookie consent banner for Photarea.
 */
(function () {
  var COOKIE_KEY = 'cookie_consent_accepted';

  function getCookie(name) {
    var v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return v ? v[2] : null;
  }

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/';
  }

  function createBanner() {
    if (getCookie(COOKIE_KEY)) return;

    var banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0',
      'background:rgba(17,17,17,0.92)', 'color:#fff',
      'padding:14px 20px', 'display:flex', 'align-items:center',
      'justify-content:space-between', 'gap:14px', 'z-index:9999',
      'font-family:system-ui,sans-serif', 'font-size:14px',
      'backdrop-filter:blur(6px)'
    ].join(';');

    var text = document.createElement('span');
    text.setAttribute('data-i18n', 'cookie_text');
    text.textContent = 'We use cookies to improve the site\'s performance. By continuing to use the site, you agree to our policy.';

    var btn = document.createElement('button');
    btn.setAttribute('data-i18n', 'cookie_accept');
    btn.textContent = 'Accept';
    btn.style.cssText = 'background:#fff;color:#111;border:none;padding:8px 18px;border-radius:20px;font-weight:600;cursor:pointer;flex-shrink:0';
    btn.addEventListener('click', function () {
      setCookie(COOKIE_KEY, '1', 365);
      banner.remove();
    });

    banner.appendChild(text);
    banner.appendChild(btn);
    document.body.appendChild(banner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createBanner);
  } else {
    createBanner();
  }
})();
