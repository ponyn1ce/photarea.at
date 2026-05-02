const sideMenu = document.querySelector("aside");
const menuBtn = document.querySelector("#menu-btn");
const closeBtn = document.querySelector("#close-btn");
const themeToggler = document.querySelector(".theme-toggler");


// Show sidebar
menuBtn.addEventListener('click', () => {
    sideMenu.style.display = 'block';
})
// Close sidebar
closeBtn.addEventListener('click', ()=>{
    sideMenu.style.display = 'none';
})


const THEME_KEY = 'user-theme';
const systemThemeMedia = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

// Функция установки темы
function setTheme(isDark) {
    document.body.classList.toggle('dark-theme-variables', isDark);

    if (!themeToggler) {
        return;
    }

    // Обновляем активность спанов
    const span1 = themeToggler.querySelector('span:nth-child(1)');
    const span2 = themeToggler.querySelector('span:nth-child(2)');

    if (isDark) {
        span1.classList.add('active');
        span2.classList.remove('active');
    } else {
        span1.classList.remove('active');
        span2.classList.add('active');
    }
}

// Инициализация темы при загрузке страницы
function initTheme() {
    let isDark = false;

    if (systemThemeMedia) {
        // Всегда следуем системной теме, если она доступна
        isDark = systemThemeMedia.matches;
        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } else {
        const storedTheme = localStorage.getItem(THEME_KEY);
        if (storedTheme === 'dark') {
            isDark = true;
        } else if (storedTheme === 'light') {
            isDark = false;
        }
    }

    setTheme(isDark);
}

// Переключение темы по клику
if (themeToggler) {
    themeToggler.addEventListener('click', () => {
        // Получаем текущий статус после initTheme
        const isCurrentlyDark = document.body.classList.contains('dark-theme-variables');

        setTheme(!isCurrentlyDark);

        // Сохраняем выбор пользователя
        localStorage.setItem(THEME_KEY, !isCurrentlyDark ? 'dark' : 'light');
    });
}

// Запуск при загрузке страницы
window.addEventListener('DOMContentLoaded', initTheme);

if (systemThemeMedia) {
    systemThemeMedia.addEventListener('change', (event) => {
        // Всегда синхронизируемся с системной темой
        setTheme(event.matches);
        localStorage.setItem(THEME_KEY, event.matches ? 'dark' : 'light');
    });
}

