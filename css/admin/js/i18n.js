const languageSelect = document.getElementById("languageSelect");

async function loadLanguage(lang) {

  try {
    const isHtmlFolder = window.location.pathname.includes('/html/');
    const basePath = isHtmlFolder ? '../' : './';
    const response = await fetch(`${basePath}lang/${lang}.json`);
    const translations = await response.json();
    window.currentTranslations = translations; // Экспортируем глобально для других скриптов

    document.querySelectorAll("[data-i18n]").forEach(el => {

      const key = el.getAttribute("data-i18n");

      if (translations[key]) {
        el.textContent = translations[key];
      }

    });

    localStorage.setItem("language", lang);

    // Обновляем подсказки Smart Insights при смене языка
    if (typeof loadAITranslations !== 'undefined') {
      loadAITranslations().then(() => {
        if (typeof generateAIHints !== 'undefined' && window.lastOrdersData) {
          generateAIHints(window.lastOrdersData);
        }
      });
    }

    // Обновляем перевод аналитики
    if (typeof renderAllAnalytics !== 'undefined' && window.lastOrdersData) {
      renderAllAnalytics(window.lastOrdersData);
    }
    
    // Обновляем график на странице аналитики
    if (typeof window.refreshChartLang === 'function') {
      window.refreshChartLang();
    }

  } catch (error) {
    console.error("Translation loading error:", error);
  }

}

languageSelect.addEventListener("change", (e) => {
  loadLanguage(e.target.value);
});

window.addEventListener("DOMContentLoaded", () => {

  const savedLang = localStorage.getItem("language") || "en";

  languageSelect.value = savedLang;

  loadLanguage(savedLang);

});