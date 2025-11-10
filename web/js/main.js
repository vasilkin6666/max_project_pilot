// web/js/main.js - Только для MAX среды
// --- Конфигурация ---
const API_BASE_URL = 'https://powerfully-exotic-chamois.cloudpub.ru/api';
let currentUserId = null;
let currentSection = 'dashboard';
let currentTheme = localStorage.getItem('theme') || 'light';

// Проверяем, что мы в MAX среде
if (typeof window.WebApp === 'undefined') {
    document.body.innerHTML = `
        <div class="container py-4">
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Приложение доступно только в MAX</h6>
                <p class="text-muted">Откройте это приложение через чат-бота в MAX</p>
            </div>
        </div>
    `;
    throw new Error('Это приложение работает только в среде MAX');
}

// Логирование
function log(message, data = null) {
    console.log(`[MAX App] ${new Date().toISOString()} - ${message}`, data || '');
}

function logError(message, error = null) {
    console.error(`[MAX App Error] ${new Date().toISOString()} - ${message}`, error || '');
}

// --- Утилиты ---
function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

function getStatusColor(status) {
    const colors = {'todo': 'warning', 'in_progress': 'info', 'done': 'success'};
    return colors[status] || 'secondary';
}

function getStatusText(status) {
    const texts = {'todo': 'К выполнению', 'in_progress': 'В работе', 'done': 'Завершено'};
    return texts[status] || status;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// --- Тема ---
function applyTheme() {
    const body = document.body;
    const icon = document.querySelector('#theme-toggle i');
    if (currentTheme === 'dark') {
        body.classList.add('dark-theme');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        body.classList.remove('dark-theme');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
    applyTheme();
}

// --- MAX Bridge интеграция ---
async function initMaxBridge() {
    log('Initializing MAX Bridge');

    try {
        // Получаем данные пользователя из MAX
        const userData = window.WebApp.initDataUnsafe?.user;
        if (userData && userData.id) {
            currentUserId = userData.id.toString();
            log(`MAX user ID detected: ${currentUserId}`);

            // Получаем токен для этого пользователя
            await getMaxUserToken();
        } else {
            throw new Error('User data not found in MAX Bridge');
        }

        // Настройка кнопки назад
        const backButton = document.getElementById('back-button');
        window.WebApp.BackButton.onClick(() => {
            handleMaxBackButton();
        });

        // Показываем кнопку назад
        window.WebApp.BackButton.show();
        backButton.classList.remove('d-none');

        backButton.addEventListener('click', () => {
            handleMaxBackButton();
        });

        // Включаем подтверждение закрытия
        window.WebApp.enableClosingConfirmation();

        // Обновляем интерфейс пользователя
        updateUserInterface(userData);

        // Сообщаем MAX, что приложение готово
        window.WebApp.ready();

        log('MAX Bridge initialized successfully');

        // Загружаем дашборд после инициализации
        setTimeout(() => loadDashboardData(), 100);

    } catch (error) {
        logError('MAX Bridge initialization error', error);
        showError('Ошибка инициализации MAX Bridge');
    }
}

// Получение токена для пользователя MAX
async function getMaxUserToken() {
    if (!currentUserId) return null;

    try {
        const userData = window.WebApp.initDataUnsafe?.user;
        const fullName = userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() : 'MAX User';
        const username = userData?.username || '';

        log(`Getting token for MAX user: ${currentUserId}, ${fullName}`);

        const tokenResponse = await apiCall('/auth/token', 'POST', {
            max_id: currentUserId,
            full_name: fullName,
            username: username
        });

        if (tokenResponse && tokenResponse.access_token) {
            localStorage.setItem('access_token', tokenResponse.access_token);
            log('MAX user token saved to localStorage');
            return tokenResponse.access_token;
        }
    } catch (error) {
        logError('Error getting MAX user token', error);
        throw error;
    }
    return null;
}

// Обновление интерфейса пользователя
function updateUserInterface(userData) {
    const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Пользователь MAX';

    document.getElementById('user-name').textContent = fullName;
    document.getElementById('user-avatar').textContent = (userData.first_name || 'U').charAt(0).toUpperCase();
    document.getElementById('mainInterface').style.display = 'block';

    log(`User interface updated: ${fullName}`);
}

function handleMaxBackButton() {
    const sections = ['dashboard', 'projects', 'tasks', 'notifications'];
    const currentSection = document.querySelector('.section.active')?.id;

    if (!currentSection) return;

    const currentIndex = sections.indexOf(currentSection);

    if (currentIndex > 0) {
        // Возврат к предыдущей секции
        showSection(sections[currentIndex - 1]);
    } else {
        // Если на главной - закрываем приложение
        window.WebApp.close();
    }

    // Тактильная обратная связь
    try {
        window.WebApp.HapticFeedback.impactOccurred('light');
    } catch (error) {
        logError('Haptic feedback error', error);
    }
}

function shareInMax(text, link) {
    try {
        window.WebApp.shareContent(text, link);
    } catch (error) {
        logError('Share content error', error);
        // Fallback - копирование в буфер обмена
        navigator.clipboard.writeText(link);
        showToast('Ссылка скопирована в буфер обмена', 'success');
    }
}

// --- API ---
async function apiCall(endpoint, method = 'GET', data = null, token = null) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
    };

    // Используем токен из localStorage если не передан явно
    const authToken = token || localStorage.getItem('access_token');
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    } else {
        throw new Error('No authentication token available');
    }

    const config = {
        method,
        headers,
    };

    if (data && method !== 'GET') {
        config.body = JSON.stringify(data);
    }

    log(`API call: ${method} ${url}`);

    try {
        const response = await fetch(url, config);

        if (response.status === 401) {
            localStorage.removeItem('access_token');
            // Пытаемся получить новый токен
            await getMaxUserToken();
            throw new Error('Authentication required - token refreshed');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData)}`);
        }

        return await response.json();
    } catch (error) {
        logError(`API Error: ${method} ${url}`, error);
        throw error;
    }
}

// --- Секции ---
async function showSection(sectionName) {
    log(`Showing section: ${sectionName}`);

    // Тактильная обратная связь
    try {
        window.WebApp.HapticFeedback.impactOccurred('light');
    } catch (error) {
        logError('Haptic feedback error', error);
    }

    // Скрыть все секции
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Показать выбранную
    document.getElementById(sectionName).classList.add('active');

    // Обновить активную вкладку
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Находим активную ссылку
    const activeLink = document.querySelector(`[onclick*="${sectionName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    currentSection = sectionName;

    // Загрузить данные для секции
    switch(sectionName) {
        case 'dashboard':
            await loadDashboardData();
            break;
        case 'projects':
            await loadProjects();
            break;
        case 'tasks':
            await loadTasks();
            break;
        case 'notifications':
            await loadNotifications();
            break;
    }
}

// --- Дашборд ---
async function loadDashboardData() {
    log('Loading dashboard data');

    const token = localStorage.getItem('access_token');
    if (!token) {
        showError('Токен авторизации не найден');
        return;
    }

    try {
        const projectsData = await getProjects(currentUserId, token);
        const tasksData = await getTasks(currentUserId, token);

        const projectsCount = projectsData.projects ? projectsData.projects.length : 0;
        const tasks = tasksData.tasks || [];
        const tasksTodo = tasks.filter(t => t.status === 'todo').length;
        const tasksProgress = tasks.filter(t => t.status === 'in_progress').length;
        const tasksDone = tasks.filter(t => t.status === 'done').length;

        document.getElementById('projects-count').textContent = projectsCount;
        document.getElementById('tasks-todo-count').textContent = tasksTodo;
        document.getElementById('tasks-progress-count').textContent = tasksProgress;
        document.getElementById('tasks-done-count').textContent = tasksDone;

        const container = document.getElementById('dashboard-projects-list');
        if (projectsData.projects && projectsData.projects.length > 0) {
            container.innerHTML = projectsData.projects.map(member => {
                const project = member.project;
                const stats = project.stats || { tasks_count: 0, tasks_done: 0 };
                const progress = stats.tasks_count > 0 ? Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;
                return `
                    <div class="project-card mb-2 p-2" onclick="openProject('${project.hash}')">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">${project.title}</h6>
                            <span class="badge bg-${member.role === 'owner' ? 'primary' : 'secondary'}">${member.role}</span>
                        </div>
                        <div class="progress mb-1" style="height: 8px;">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                        <small class="text-muted">${progress}% завершено (${stats.tasks_done}/${stats.tasks_count})</small>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<p class="text-muted">Нет проектов для отображения.</p>';
        }
    } catch (error) {
        logError('Dashboard load error', error);
        showError('Ошибка загрузки дашборда');
    }
}

// --- Проекты ---
async function loadProjects() {
    log('Loading projects');

    const token = localStorage.getItem('access_token');
    if (!token) {
        showError('Токен авторизации не найден');
        return;
    }

    try {
        const data = await getProjects(currentUserId, token);
        const container = document.getElementById('projects-list');

        if (!data.projects || data.projects.length === 0) {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-folder-open fa-2x text-muted mb-3"></i>
                    <h6>Проектов пока нет</h6>
                    <p class="text-muted">Создайте свой первый проект!</p>
                    <button class="btn max-btn-primary" onclick="createProject()">
                        <i class="fas fa-plus"></i> Создать проект
                    </button>
                </div>`;
            return;
        }

        container.innerHTML = data.projects.map(member => {
            const project = member.project;
            const stats = project.stats || { tasks_count: 0, tasks_done: 0 };
            const progress = stats.tasks_count > 0 ? Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;
            return `
                <div class="project-card max-card" onclick="openProject('${project.hash}')">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="mb-0">${project.title}</h6>
                        <span class="badge bg-${member.role === 'owner' ? 'primary' : 'secondary'}">${member.role}</span>
                    </div>
                    <p class="text-muted mb-1">${project.description || 'Без описания'}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">Участников: ${project.members ? project.members.length : 0}</small>
                        <small class="text-muted">Задач: ${stats.tasks_count}</small>
                    </div>
                    <div class="progress mt-2" style="height: 8px;">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <small class="text-muted">${progress}% завершено</small>
                </div>`;
        }).join('');

    } catch (error) {
        logError('Projects load error', error);
        showError('Ошибка загрузки проектов');
    }
}

async function createProject() {
    log('Creating project');

    // Тактильная обратная связь
    try {
        window.WebApp.HapticFeedback.impactOccurred('medium');
    } catch (error) {
        logError('Haptic feedback error', error);
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
        showToast('Ошибка авторизации', 'error');
        return;
    }

    try {
        const title = prompt('Введите название проекта:');
        if (!title) return;

        const description = prompt('Введите описание проекта (необязательно):') || '';

        const result = await apiCall(
            `/projects/?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&is_private=true&requires_approval=false`,
            'POST',
            null,
            token
        );

        if (result && result.project) {
            // Тактильная обратная связь при успехе
            try {
                window.WebApp.HapticFeedback.notificationOccurred('success');
            } catch (error) {
                logError('Haptic feedback error', error);
            }

            showToast(`Проект "${result.project.title}" создан!`, 'success');

            // Обновляем интерфейс
            if (currentSection === 'projects') await loadProjects();
            if (currentSection === 'dashboard') await loadDashboardData();
        }
    } catch (error) {
        logError('Project creation error', error);

        // Тактильная обратная связь при ошибке
        try {
            window.WebApp.HapticFeedback.notificationOccurred('error');
        } catch (error) {
            logError('Haptic feedback error', error);
        }

        showToast('Ошибка при создании проекта: ' + error.message, 'error');
    }
}

// --- Задачи ---
let currentTaskId = null;
let currentTaskDetails = null;
let taskSearchFuse = null;
let currentSearchQuery = '';
let allTasks = [];

async function loadTasks(status = null) {
    log('Loading tasks');

    const token = localStorage.getItem('access_token');
    if (!token) {
        showError('Токен авторизации не найден');
        return;
    }

    try {
        const data = await getTasks(currentUserId, token);
        const tasks = data.tasks || [];
        allTasks = tasks;

        const filteredTasks = status ? tasks.filter(t => t.status === status) : tasks;
        const container = document.getElementById('tasks-list');

        if (filteredTasks.length === 0) {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-tasks fa-2x text-muted mb-3"></i>
                    <h6>Задач пока нет</h6>
                    <p class="text-muted">Создайте проект и добавьте задачи!</p>
                    <button class="btn max-btn-primary" onclick="showSection('projects')">
                        <i class="fas fa-project-diagram"></i> Перейти к проектам
                    </button>
                </div>`;
            return;
        }

        container.innerHTML = filteredTasks.map(task => {
            const statusColor = getStatusColor(task.status);
            const statusText = getStatusText(task.status);
            return `
                <div class="task-item task-${task.status} max-card" onclick="openTaskModal(${task.id})">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="mb-0">${task.title}</h6>
                            <p class="text-muted small mb-1">${task.description ? task.description.substring(0, 50) + '...' : ''}</p>
                            <div class="d-flex align-items-center">
                                <span class="badge bg-${statusColor} me-2">${statusText}</span>
                                <span class="text-muted small">${formatDate(task.created_at)}</span>
                            </div>
                        </div>
                        <div class="text-end">
                            <div class="text-muted small">Проект: ${task.project.title}</div>
                            <div class="text-muted small">Приоритет: ${task.priority}</div>
                        </div>
                    </div>
                </div>`;
        }).join('');

    } catch (error) {
        logError('Tasks load error', error);
        showError('Ошибка загрузки задач');
    }
}

// --- Уведомления ---
async function loadNotifications() {
    log('Loading notifications');

    const token = localStorage.getItem('access_token');
    if (!token) {
        showError('Токен авторизации не найден');
        return;
    }

    try {
        const data = await getNotifications(currentUserId, token);
        const container = document.getElementById('notifications-list');

        if (!data.notifications || data.notifications.length === 0) {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-inbox fa-2x text-muted mb-3"></i>
                    <h6>Уведомлений нет</h6>
                    <p class="text-muted">Новые уведомления появятся здесь</p>
                </div>`;
            return;
        }

        container.innerHTML = data.notifications.map(notification => {
            const unreadClass = notification.is_read ? '' : 'fw-bold';
            const unreadIcon = notification.is_read ? '⚪' : '🔵';
            return `
                <div class="max-card ${unreadClass}">
                    <div class="d-flex justify-content-between">
                        <h6 class="mb-0">${unreadIcon} ${notification.title}</h6>
                        <small class="text-muted">${formatDate(notification.created_at)}</small>
                    </div>
                    <p class="mb-0">${notification.message}</p>
                </div>`;
        }).join('');

    } catch (error) {
        logError('Notifications load error', error);
        showError('Ошибка загрузки уведомлений');
    }
}

// --- API Functions ---
async function getProjects(userId, token) {
    return await apiCall(`/users/${userId}/projects`, 'GET', null, token);
}

async function getTasks(userId, token, status = null) {
    const endpoint = status ? `/tasks/?status=${status}` : '/tasks/';
    return await apiCall(endpoint, 'GET', null, token);
}

async function getNotifications(userId, token) {
    return await apiCall('/notifications/', 'GET', null, token);
}

// --- Вспомогательные функции ---
function openProject(projectHash) {
    showProjectInviteQR(projectHash);
}

function showProjectInviteQR(projectHash) {
    const inviteUrl = `${window.location.origin}/?join=${projectHash}`;
    const modal = new bootstrap.Modal(document.createElement('div'));
    const modalHTML = `
        <div class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Пригласить в проект</h5>
                        <button type="button" class="btn-close" onclick="this.closest('.modal').remove()"></button>
                    </div>
                    <div class="modal-body text-center">
                        <p>Отправьте этот QR-код пользователю:</p>
                        <div id="qrCodeContainer"></div>
                        <p class="mt-2">Или поделитесь ссылкой: <code>${inviteUrl}</code></p>
                        <button class="btn max-btn-primary mt-2" onclick="shareProject('${projectHash}')">
                            <i class="fas fa-share"></i> Поделиться в MAX
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalElement = document.querySelector('.modal.show');
    new QRCode(document.getElementById('qrCodeContainer'), { text: inviteUrl, width: 200, height: 200 });
    modalElement.querySelector('.btn-close').addEventListener('click', () => modalElement.remove());
}

function shareProject(projectHash) {
    const inviteUrl = `${window.location.origin}/?join=${projectHash}`;
    const shareText = `Присоединяйтесь к моему проекту в MAX Project Pilot!`;
    shareInMax(shareText, inviteUrl);
}

function openTaskModal(taskId) {
    showToast('Функция просмотра задачи будет реализована в будущем обновлении', 'info');
}

// Функция для показа toast-уведомлений
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();

    const toastId = 'toast-' + Date.now();
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-bg-${type} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    ${escapeHTML(message)}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);

    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 3000
    });

    toast.show();

    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    return container;
}

function showError(message) {
    showToast(message, 'error');
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    // Настройка темы
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    applyTheme();

    // Инициализация MAX Bridge
    initMaxBridge();
});
