// web/js/auth.js
// import { apiCall } from './api.js'; // Если используем ES6 modules

// Глобальные переменные (если не используем модули)
let currentUserId = null;

// Функция входа
async function login(userId, fullName) {
    try {
        const response = await apiCall('/auth/token', 'POST', { max_id: userId, full_name: fullName });
        if (response.access_token) {
            localStorage.setItem('access_token', response.access_token);
            localStorage.setItem('user_id', response.user.id);
            localStorage.setItem('user_name', response.user.full_name);
            currentUserId = response.user.id;
            return response.user;
        }
        return null;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

// Проверка авторизации при загрузке
window.addEventListener('load', () => {
    const token = localStorage.getItem('access_token');
    if (token) {
        currentUserId = localStorage.getItem('user_id');
        if (currentUserId) {
            showMainInterface();
        } else {
            showAuthSection();
        }
    } else {
        showAuthSection();
    }
});

// Функции показа интерфейса (предполагаем, что они определены в main.js)
function showAuthSection() {
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('mainInterface').style.display = 'none';
}

function showMainInterface() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('mainInterface').style.display = 'block';
    document.getElementById('user-name').textContent = localStorage.getItem('user_name');
    document.getElementById('user-avatar').textContent = localStorage.getItem('user_name').charAt(0).toUpperCase();
}

// Функция вызова из main.js
async function login() {
    const userId = document.getElementById('userIdInput').value.trim();
    if (!userId) {
        alert('Введите User ID');
        return;
    }
    // Для простоты, используем 'Anonymous' как имя, если не получено из MAX
    const fullName = prompt('Введите ваше имя (для регистрации):') || 'Anonymous';
    try {
        const user = await login(userId, fullName); // Вызываем локальную функцию login
        if (user) {
            showMainInterface();
            await loadDashboardData();
            await loadProjects();
            await loadTasks();
            await loadNotifications();
        } else {
            alert('Ошибка входа');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Ошибка входа: ' + error.message);
    }
}
