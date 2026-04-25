/**
 * lang.js — Translation system for Photarea (GitHub Pages static version)
 * Loads JSON translation files from /json/ and applies data-i18n attributes.
 */
(function () {
  const LANG_MAP = { EN: 'eng', RU: 'rus', DE: 'deu', UA: 'ukr' };
  const DEFAULT_LANG = 'EN';

  // Capture script URL at parse time (before any async work)
  const _scriptSrc = (document.currentScript || {}).src || '';

  let translations = {};
  let currentLang = DEFAULT_LANG;

  function getJsonPath(code) {
    // Derive the JSON base URL from the script's own absolute URL.
    // lang.js lives at <base>/js/lang.js, json files live at <base>/json/
    const base = _scriptSrc.replace(/js\/lang\.js[^]*$/, '');
    if (base) {
      return base + 'json/' + (LANG_MAP[code] || 'eng') + '.json';
    }
    // Fallback: relative path heuristic
    const segments = window.location.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    const lastSeg = segments[segments.length - 1] || '';
    const inSubdir = lastSeg.endsWith('.html') && segments.length >= 2 &&
                     !segments[segments.length - 2].includes('.');
    return (inSubdir ? '../' : '') + 'json/' + (LANG_MAP[code] || 'eng') + '.json';
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      const val = translations[key];
      if (!val) return;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.setAttribute('placeholder', val);
      } else {
        el.textContent = val;
      }
    });
  }

  async function loadLanguage(code) {
    code = (code || DEFAULT_LANG).toUpperCase();
    if (!LANG_MAP[code]) code = DEFAULT_LANG;
    currentLang = code;
    try {
      const res = await fetch(getJsonPath(code));
      if (res.ok) {
        translations = await res.json();
      }
    } catch (e) {
      // silently fail — default text remains
    }
    applyTranslations();
    localStorage.setItem('lang', code);

    // Update lang-toggle buttons if present
    document.querySelectorAll('.lang-toggle').forEach(function (btn) {
      btn.textContent = code;
    });
    document.querySelectorAll('.lang-item').forEach(function (item) {
      item.classList.toggle('selected', item.dataset.lang === code);
    });
    document.querySelectorAll('.burger-lang-item').forEach(function (item) {
      item.classList.toggle('selected', item.dataset.lang === code);
    });
  }

  // Expose public API
  window.setSiteLanguage = loadLanguage;
  window.currentLang = function () { return currentLang; };

  // Init on DOMContentLoaded
  function init() {
    const saved = localStorage.getItem('lang') || DEFAULT_LANG;
    loadLanguage(saved);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
