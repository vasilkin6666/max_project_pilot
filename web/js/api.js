// web/js/api.js
// Конфигурация
const API_BASE_URL = 'http://localhost:8000/api'; // Заменить на URL вашего сервера

// Универсальный вызов API
async function apiCall(endpoint, method = 'GET', data = null, token = null) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers,
    };

    if (data) {
        config.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, config);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Экспортируем функции для использования в других модулях
// В старом коде они были глобальными, в новом можно экспортировать
// export { apiCall, login, getProjects, createProject, getTasks, getProjectTasks, createTask, updateTaskStatus, getNotifications, markAllNotificationsRead };
