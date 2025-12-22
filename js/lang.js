// lang.js — автоматическое определение языка и применение переводов
// Поведение:
// - при первом заходе пытается прочитать `siteLang` из localStorage
// - если нет, определяет язык из `navigator.languages` / `navigator.language`
// - пытается подобрать один из доступных языков (deutsch, english, ukrain)
// - загружает соответствующий JSON из `lang/<name>.json` и применяет значения
// HTML: элементы должны иметь атрибут `data-i18n="key.path"`.
// Для установки атрибута используйте `data-i18n-attr="placeholder"` (опционально).

(function () {
  const AVAILABLE = {
    // key: { codes: [...], htmlLang: 'xx', file: null|filename }
    // file == null means restore originals (no JSON)
    russian: { codes: ['ru'], htmlLang: 'ru', file: 'rus' },
    deutsch: { codes: ['de'], htmlLang: 'de', file: 'deu' },
    english: { codes: ['en'], htmlLang: 'en', file: null },
    ukrain: { codes: ['uk', 'ukr'], htmlLang: 'uk', file: 'ukr' }
  };

  const STORAGE_KEY = 'siteLang';

  function mapLangCode(code) {
    if (!code) return null;
    code = code.toLowerCase();
    for (const key of Object.keys(AVAILABLE)) {
      const entry = AVAILABLE[key];
      for (const c of entry.codes) {
        if (code.startsWith(c)) return key;
      }
    }
    return null;
  }

  function getPreferredFromNavigator() {
    const nav = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (const lang of nav) {
      const mapped = mapLangCode(lang);
      if (mapped) return mapped;
    }
    return null;
  }

  function getNested(obj, path) {
    return path.split('.').reduce((acc, p) => (acc && acc[p] !== undefined ? acc[p] : undefined), obj);
  }

  async function loadLangJson(langKey) {
    try {
      const entry = AVAILABLE[langKey];
      if (!entry) throw new Error('unknown language ' + langKey);
      if (!entry.file) return null; // no JSON, originals used
      const res = await fetch(`/json/${entry.file}.json`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch failed ' + res.status);
      return await res.json();
    } catch (err) {
      console.warn('Не удалось загрузить словарь:', langKey, err);
      return null;
    }
  }

  function applyTranslations(translations) {
    if (!translations) return;
    const els = document.querySelectorAll('[data-i18n]');
    els.forEach(el => {
      const key = el.dataset.i18n;
      if (!key) return;
      const value = getNested(translations, key);
      if (value === undefined) return;
      const attr = el.dataset.i18nAttr; // optional attribute to set instead of textContent
      if (attr) {
        el.setAttribute(attr, value);
        return;
      }
      // если элемент input/textarea и указан data-i18n-input — ставим placeholder
      if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.type !== 'button') {
        if (el.hasAttribute('placeholder')) {
          el.placeholder = value;
          return;
        }
        el.value = value;
        return;
      }
      // по умолчанию — текст
      el.textContent = value;
    });
  }

  // Сохраняем оригиналы (перед заменой переводом) для возможности восстановить русский
  const ORIGINALS = new WeakMap();

  function backupOriginals() {
    const els = document.querySelectorAll('[data-i18n]');
    els.forEach(el => {
      if (ORIGINALS.has(el)) return; // уже сохранено
      const attr = el.dataset.i18nAttr;
      const original = {
        text: el.textContent,
        attrName: attr || null,
        attrValue: attr ? el.getAttribute(attr) : null,
        placeholder: (el.getAttribute && el.getAttribute('placeholder')) || null,
        value: (el.value !== undefined ? el.value : null)
      };
      ORIGINALS.set(el, original);
    });
  }

  function restoreOriginals() {
    const els = document.querySelectorAll('[data-i18n]');
    els.forEach(el => {
      const original = ORIGINALS.get(el);
      if (!original) return;
      if (original.attrName) {
        if (original.attrValue === null) el.removeAttribute(original.attrName);
        else el.setAttribute(original.attrName, original.attrValue);
      }
      if (original.placeholder !== null) el.setAttribute('placeholder', original.placeholder);
      if (original.text !== null) el.textContent = original.text;
      if (original.value !== null && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) el.value = original.value;
    });
  }

  async function setLanguage(langKey, persist = true) {
    if (langKey === 'english') {
      // восстановить оригинальные тексты и удалить сохранение (English is original)
      restoreOriginals();
      document.documentElement.setAttribute('lang', 'en');
      if (persist) localStorage.removeItem(STORAGE_KEY);
      const sel = document.getElementById('site-lang');
      if (sel) sel.value = 'english';
      return;
    }

    const translations = await loadLangJson(langKey);
    if (!translations) return;
    applyTranslations(translations);
    // установить html lang
    const htmlLang = (AVAILABLE[langKey] && AVAILABLE[langKey].htmlLang) || 'en';
    document.documentElement.setAttribute('lang', htmlLang);
    if (persist) localStorage.setItem(STORAGE_KEY, langKey);
    // синхронизируем селектор
    const sel = document.getElementById('site-lang');
    if (sel) sel.value = langKey;
  }

  // API: window.setSiteLanguage(key)
  window.setSiteLanguage = function (key) {
    if (!key) return;
    if (key !== 'english' && !AVAILABLE[key]) {
      console.warn('Язык не поддерживается:', key);
      return;
    }
    setLanguage(key, true);
  };

  // Map quick selector codes (EN/DE/RU/UA) to internal keys
  function selectorCodeToKey(code){
    if(!code) return null;
    const c = code.toString().toLowerCase();
    if(c === 'en') return 'english';
    if(c === 'ru') return 'russian';
    if(c === 'de') return 'deutsch';
    if(c === 'ua' || c === 'uk') return 'ukrain';
    return null;
  }

  // Attach click handlers to menu language items (if present)
  function wireMenuLanguageButtons(){
    const items = document.querySelectorAll('.lang-item');
    if(!items || !items.length) return;
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        const code = item.dataset.lang || item.textContent.trim();
        const key = selectorCodeToKey(code);
        if(key) window.setSiteLanguage(key);
      });
    });
  }

  // Map internal key back to quick selector code (EN/DE/RU/UA)
  function keyToSelectorCode(key){
    if(!key) return null;
    if(key === 'english') return 'EN';
    if(key === 'russian') return 'RU';
    if(key === 'deutsch') return 'DE';
    if(key === 'ukrain') return 'UA';
    return null;
  }

  function updateMenuSelection(langKey){
    const code = keyToSelectorCode(langKey);
    const items = Array.from(document.querySelectorAll('.lang-item'));
    const toggle = document.querySelector('.lang-toggle');
    if(toggle && code) toggle.textContent = code;
    if(!items || !items.length) return;
    items.forEach(i=>{
      const itemCode = (i.dataset.lang||i.textContent||'').toString().trim().toUpperCase();
      if(itemCode === code) i.classList.add('selected'); else i.classList.remove('selected');
    });
  }

  // Инициализация при загрузке DOM
  document.addEventListener('DOMContentLoaded', async () => {
    // Сохраняем оригиналы перед применением переводов
    backupOriginals();

    // wire menu buttons
    wireMenuLanguageButtons();

    let langKey = localStorage.getItem(STORAGE_KEY);
    if (!langKey) {
      langKey = getPreferredFromNavigator();
    }
    if (!langKey) {
      // fallback — English (original)
      langKey = 'english';
    }
    await setLanguage(langKey, true);
    // sync menu visual state
    updateMenuSelection(langKey);
  });

})();
