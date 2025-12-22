// Функция для переключения видимости пароля
document.addEventListener('DOMContentLoaded', () => {
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  
  passwordInputs.forEach((passwordInput) => {
    // Создаём контейнер для поля ввода и кнопки
    const inputBox = passwordInput.closest('.input-box');
    
    if (inputBox) {
      // Создаём кнопку "показать пароль"
      const toggleBtn = document.createElement('i');
      toggleBtn.className = 'bx bxs-show';
      toggleBtn.style.cursor = 'pointer';
      toggleBtn.style.userSelect = 'none';
      toggleBtn.style.transition = '0.2s';
      toggleBtn.onclick = (e) => {
        e.preventDefault();
        
        // Переключаем тип поля
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        
        // Меняем иконку
        toggleBtn.className = isPassword ? 'bx bxs-hide' : 'bx bxs-show';
        
        // Добавляем визуальный эффект при клике
        toggleBtn.style.opacity = '0.6';
        setTimeout(() => {
          toggleBtn.style.opacity = '1';
        }, 100);
      };
      
      // Удаляем старую иконку (если есть)
      const oldIcon = inputBox.querySelector('i');
      if (oldIcon) {
        oldIcon.remove();
      }
      
      // Добавляем новую кнопку
      inputBox.appendChild(toggleBtn);
    }
  });
});
