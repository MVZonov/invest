document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  
  const handleLogin = async (e) => {
      e.preventDefault(); // Блокируем стандартную отправку формы
      
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value.trim();

      if (!username || !password) {
          alert('Заполните все поля');
          return;
      }

      try {
          const response = await fetch('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password }),
              credentials: 'include'
          });

          if (response.ok) {
              window.location.href = '/index.html';
          } else {
              const error = await response.json();
              alert(error.error || 'Ошибка входа');
          }
      } catch (err) {
          console.error('Ошибка:', err);
          alert('Сервер недоступен');
      }
  };

  // Обработчик для кнопки
  loginForm.querySelector('button').addEventListener('click', handleLogin);
  
  // Обработчик для нажатия Enter
  loginForm.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
          handleLogin(e);
      }
  });
});