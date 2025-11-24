/**
 * Скрипт для динамической адаптации фона под тему устройства
 * Затемняет/осветляет фон при переходе между светлой и тёмной темой
 * Использование: добавить <script src="/js/dynamic-bg-theme.js"></script> перед </body>
 */

(function() {
  // Найдём элемент body (работает на любой странице)
  const body = document.body;
  
  if (!body) return;
  
  /**
   * Применяет стили для адаптации фона под тему
   * @param {boolean} isDarkMode - true если тёмная тема
   */
  function applyThemeStyles(isDarkMode) {
    if (isDarkMode) {
      // Тёмная тема - затемняем фон
      body.style.backgroundImage = `
        linear-gradient(
          rgba(0, 0, 0, 0.4),
          rgba(0, 0, 0, 0.4)
        ),
        url('${getBackgroundImageUrl()}')
      `;
    } else {
      // Светлая тема - обычный фон
      body.style.backgroundImage = `url('${getBackgroundImageUrl()}')`;
    }
  }
  
  /**
   * Получает URL фонового изображения из текущего стиля
   */
  function getBackgroundImageUrl() {
    const computedStyle = window.getComputedStyle(body);
    const bgImage = computedStyle.backgroundImage;
    
    // Извлекаем URL из backgroundImage (формат: url("..."))
    const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
    return urlMatch ? urlMatch[1] : '/images/d0bc85d59a329e3583206f2eb39d034d.jpg';
  }
  
  /**
   * Проверяет, включена ли тёмная тема на устройстве
   */
  function isDarkTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  
  // Применяем начальные стили при загрузке страницы
  applyThemeStyles(isDarkTheme());
  
  // Следим за изменением темы устройства
  if (window.matchMedia) {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Для современных браузеров (addEventListener)
    if (darkModeQuery.addEventListener) {
      darkModeQuery.addEventListener('change', (e) => {
        applyThemeStyles(e.matches);
      });
    }
    // Для старых браузеров (addListener - deprecated, но работает)
    else if (darkModeQuery.addListener) {
      darkModeQuery.addListener((e) => {
        applyThemeStyles(e.matches);
      });
    }
  }
})();
