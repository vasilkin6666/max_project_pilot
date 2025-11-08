//web/js/main.js
// --- Конфигурация ---
const API_BASE_URL = 'https://powerfully-exotic-chamois.cloudpub.ru/api';
let currentUserId = null;
let currentSection = 'dashboard';
let currentTheme = localStorage.getItem('theme') || 'light';

// Логирование
function log(message, data = null) {
    console.log(`[LOG] ${new Date().toISOString()} - ${message}`, data || '');
}

function logError(message, error = null) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');
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
    log('Theme applied');
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
    applyTheme();
    log('Theme toggled');
}

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
applyTheme();

// --- API ---
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

    log(`API call: ${method} ${url}`, data);

    try {
        const response = await fetch(url, config);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData)}`);
        }
        const responseData = await response.json();
        log(`API response: ${method} ${url}`, responseData);
        return responseData;
    } catch (error) {
        logError(`API Error: ${method} ${url}`, error);
        throw error;
    }
}

// Получение данных пользователя по user_id
async function fetchUserData(userId) {
    log(`Fetching user data for user_id: ${userId}`);
    try {
        // Сначала получаем токен
        const tokenResponse = await apiCall('/auth/token', 'POST', {
            max_id: userId,
            full_name: 'User', // Можно получить из URL или запросить
            username: ''
        });

        if (tokenResponse && tokenResponse.access_token) {
            localStorage.setItem('access_token', tokenResponse.access_token);

            // Теперь получаем данные пользователя с токеном
            const response = await apiCall(`/users/${userId}`, 'GET', null, tokenResponse.access_token);
            log(`User data fetched successfully for user_id: ${userId}`, response);
            return response;
        }
    } catch (error) {
        logError(`Error fetching user data for user_id: ${userId}`, error);
    }
    return null;
}

// --- Авторизация ---
function showMainInterface() {
    document.getElementById('mainInterface').style.display = 'block';
    log('Main interface shown');
}

// Отображение данных пользователя
async function showUserInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');

    log(`Checking user_id from URL: ${userId}`);

    if (userId) {
        currentUserId = userId;
        try {
            const userData = await fetchUserData(userId);
            if (userData) {
                document.getElementById('user-name').textContent = userData.full_name || 'Гость';
                document.getElementById('user-avatar').textContent = (userData.full_name || 'Г').charAt(0).toUpperCase();
                localStorage.setItem('user_name', userData.full_name);
                log(`User data displayed: ${userData.full_name}`);
            } else {
                document.getElementById('user-name').textContent = 'Гость';
                document.getElementById('user-avatar').textContent = 'Г';
                log('User data not found, showing as Guest');
            }
        } catch (error) {
            logError(`Error fetching user data for user_id: ${userId}`, error);
            document.getElementById('user-name').textContent = 'Гость';
            document.getElementById('user-avatar').textContent = 'Г';
        }
        showMainInterface();
    } else {
        document.getElementById('mainInterface').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка</h6>
                <p class="text-muted">Отсутствует идентификатор пользователя. Перейдите в бота для авторизации.</p>
            </div>
        `;
        log('No user_id in URL, showing error message');
    }
}

// Проверка авторизации при загрузке
window.addEventListener('load', () => {
    log('Page loaded, initializing...');
    showUserInfo();
});

// --- Секции ---
async function showSection(sectionName) {
    log(`Showing section: ${sectionName}`);
    if (!currentUserId) {
        alert('Пожалуйста, войдите в систему');
        log('No currentUserId, cannot show section');
        return;
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
    event.target.classList.add('active');
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
    if (!currentUserId) return;
    const token = localStorage.getItem('access_token');
    try {
        const projectsData = await getProjects(currentUserId, token);
        log('Projects data loaded', projectsData);
        const tasksData = await getTasks(currentUserId, token);
        log('Tasks data loaded', tasksData);
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
        document.getElementById('projects-count').textContent = '0';
        document.getElementById('tasks-todo-count').textContent = '0';
        document.getElementById('tasks-progress-count').textContent = '0';
        document.getElementById('tasks-done-count').textContent = '0';
        document.getElementById('dashboard-projects-list').innerHTML = '<p class="text-muted">Ошибка загрузки данных.</p>';
    }
}

// --- Проекты ---
async function loadProjects() {
    log('Loading projects');
    if (!currentUserId) {
        document.getElementById('projects-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Необходима авторизация</h6>
                <p class="text-muted">Для просмотра проектов войдите в систему</p>
            </div>`;
        log('No currentUserId, cannot load projects');
        return;
    }
    const token = localStorage.getItem('access_token');
    try {
        const data = await getProjects(currentUserId, token);
        log('Projects loaded', data);
        const container = document.getElementById('projects-list');
        if (!data.projects || data.projects.length === 0) {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-folder-open fa-2x text-muted mb-3"></i>
                    <h6>Проектов пока нет</h6>
                    <p class="text-muted">Создайте свой первый проект!</p>
                    <button class="btn max-btn-primary" onclick="createProject()"><i class="fas fa-plus"></i> Создать проект</button>
                </div>`;
            log('No projects found');
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
        log('Projects displayed successfully');
    } catch (error) {
        logError('Projects load error', error);
        document.getElementById('projects-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить проекты</p>
            </div>`;
    }
}

async function createProject() {
    log('Creating project');
    if (!currentUserId) {
        alert('Необходима авторизация для создания проекта');
        log('No currentUserId, cannot create project');
        return;
    }

    const title = prompt('Введите название проекта:');
    if (!title) return;

    const description = prompt('Введите описание проекта (необязательно):') || '';

    try {
        // Сначала получаем токен
        const tokenResponse = await apiCall('/auth/token', 'POST', {
            max_id: currentUserId,
            full_name: document.getElementById('user-name').textContent,
            username: ''
        });

        if (!tokenResponse || !tokenResponse.access_token) {
            throw new Error('Не удалось получить токен авторизации');
        }

        const token = tokenResponse.access_token;
        localStorage.setItem('access_token', token);

        // Создаем проект
        const result = await createProject(title, description, token);

        if (result && result.project) {
            log('Project created successfully', result);
            alert(`Проект "${result.project.title}" создан!`);
            if (currentSection === 'projects') {
                await loadProjects();
            }
            await loadDashboardData();
        } else {
            throw new Error('Не удалось создать проект: ответ сервера не содержит данных проекта');
        }
    } catch (error) {
        logError('Project creation error', error);
        alert('Ошибка при создании проекта: ' + error.message);
    }
}

// --- Задачи ---
let currentTaskId = null;
let currentTaskDetails = null;
let taskSearchFuse = null;

async function loadTasks(status = null) {
    log('Loading tasks');
    if (!currentUserId) {
        document.getElementById('tasks-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-tasks fa-2x text-muted mb-3"></i>
                <h6>Необходима авторизация</h6>
                <p class="text-muted">Для просмотра задач войдите в систему</p>
            </div>`;
        log('No currentUserId, cannot load tasks');
        return;
    }
    const token = localStorage.getItem('access_token');
    try {
        const data = await getTasks(currentUserId, token);
        log('Tasks loaded', data);
        const tasks = data.tasks || [];
        const filteredTasks = status ? tasks.filter(t => t.status === status) : tasks;
        const container = document.getElementById('tasks-list');
        if (filteredTasks.length === 0) {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-tasks fa-2x text-muted mb-3"></i>
                    <h6>Задач пока нет</h6>
                    <p class="text-muted">Создайте первую задачу в проекте!</p>
                </div>`;
            log('No tasks found');
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
        taskSearchFuse = new Fuse(tasks, {
            keys: ['title', 'description'],
            threshold: 0.3
        });
        log('Tasks displayed successfully');
    } catch (error) {
        logError('Tasks load error', error);
        document.getElementById('tasks-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить задачи</p>
            </div>`;
    }
}

// --- Уведомления ---
async function loadNotifications() {
    log('Loading notifications');
    if (!currentUserId) {
        document.getElementById('notifications-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-bell fa-2x text-muted mb-3"></i>
                <h6>Необходима авторизация</h6>
                <p class="text-muted">Для просмотра уведомлений войдите в систему</p>
            </div>`;
        log('No currentUserId, cannot load notifications');
        return;
    }
    const token = localStorage.getItem('access_token');
    try {
        const data = await getNotifications(currentUserId, token);
        log('Notifications loaded', data);
        const container = document.getElementById('notifications-list');
        if (!data.notifications || data.notifications.length === 0) {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-inbox fa-2x text-muted mb-3"></i>
                    <h6>Уведомлений нет</h6>
                    <p class="text-muted">Новые уведомления появятся здесь</p>
                </div>`;
            log('No notifications found');
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
        log('Notifications displayed successfully');
    } catch (error) {
        logError('Notifications load error', error);
        document.getElementById('notifications-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить уведомления</p>
            </div>`;
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

async function createProject(title, description, token) {
    const params = new URLSearchParams({
        title: title,
        description: description,
        is_private: 'true',
        requires_approval: 'false'
    });
    return await apiCall(`/projects/?${params}`, 'POST', null, token);
}

async function updateTaskStatus(taskId, status, token) {
    const params = new URLSearchParams({ status: status });
    return await apiCall(`/tasks/${taskId}/status?${params}`, 'PUT', null, token);
}

async function markAllNotificationsRead() {
    log('Marking all notifications as read');

    if (!currentUserId) {
        alert('Необходима авторизация для работы с уведомлениями');
        return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('Токен авторизации не найден');
        return;
    }

    try {
        const result = await apiCall('/notifications/mark_all_read', 'PUT', null, token);

        if (result && result.status === 'success') {
            log('All notifications marked as read successfully');

            // Обновляем интерфейс уведомлений
            if (currentSection === 'notifications') {
                await loadNotifications();
            }

            // Показываем уведомление об успехе
            showToast('Все уведомления отмечены как прочитанные', 'success');
        } else {
            throw new Error('Не удалось отметить уведомления как прочитанные');
        }
    } catch (error) {
        logError('Error marking notifications as read', error);
        showToast('Ошибка при обновлении уведомлений: ' + error.message, 'error');
    }
}

let currentSearchQuery = '';
let allTasks = [];

async function searchTasks() {
    const searchInput = document.getElementById('searchTasksInput');
    const query = searchInput.value.trim();

    log(`Searching tasks with query: "${query}"`);

    if (!query) {
        // Если запрос пустой, показываем все задачи
        await loadTasks();
        return;
    }

    if (!currentUserId) {
        alert('Необходима авторизация для поиска задач');
        return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('Токен авторизации не найден');
        return;
    }

    try {
        // Если у нас еще нет всех задач, загружаем их
        if (allTasks.length === 0) {
            const tasksData = await getTasks(currentUserId, token);
            allTasks = tasksData.tasks || [];
        }

        // Выполняем поиск
        const searchResults = performTaskSearch(allTasks, query);
        displaySearchResults(searchResults, query);

        currentSearchQuery = query;

    } catch (error) {
        logError('Error searching tasks', error);
        showToast('Ошибка при поиске задач: ' + error.message, 'error');
    }
}

function performTaskSearch(tasks, query) {
    const lowerQuery = query.toLowerCase();

    return tasks.filter(task => {
        // Поиск по названию
        const titleMatch = task.title.toLowerCase().includes(lowerQuery);

        // Поиск по описанию
        const descriptionMatch = task.description && task.description.toLowerCase().includes(lowerQuery);

        // Поиск по названию проекта
        const projectMatch = task.project && task.project.title.toLowerCase().includes(lowerQuery);

        // Поиск по статусу (русское и английское название)
        const statusMatch =
            getStatusText(task.status).toLowerCase().includes(lowerQuery) ||
            task.status.toLowerCase().includes(lowerQuery);

        // Поиск по приоритету
        const priorityMatch = task.priority && task.priority.toLowerCase().includes(lowerQuery);

        return titleMatch || descriptionMatch || projectMatch || statusMatch || priorityMatch;
    });
}

function displaySearchResults(results, query) {
    const container = document.getElementById('tasks-list');

    if (results.length === 0) {
        container.innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-search fa-2x text-muted mb-3"></i>
                <h6>Задачи не найдены</h6>
                <p class="text-muted">По запросу "${escapeHTML(query)}" ничего не найдено</p>
                <button class="btn max-btn-primary btn-sm" onclick="clearSearch()">
                    <i class="fas fa-times"></i> Очистить поиск
                </button>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">Найдено задач: ${results.length}</h6>
            <button class="btn btn-outline-secondary btn-sm" onclick="clearSearch()">
                <i class="fas fa-times"></i> Очистить поиск
            </button>
        </div>
        ${results.map(task => renderTaskCard(task)).join('')}
    `;
}

function renderTaskCard(task) {
    const statusColor = getStatusColor(task.status);
    const statusText = getStatusText(task.status);

    return `
        <div class="task-item task-${task.status} max-card" onclick="openTaskModal(${task.id})">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <h6 class="mb-0">${highlightSearchTerm(task.title, currentSearchQuery)}</h6>
                    <p class="text-muted small mb-1">
                        ${task.description ? highlightSearchTerm(task.description.substring(0, 100) + '...', currentSearchQuery) : ''}
                    </p>
                    <div class="d-flex align-items-center">
                        <span class="badge bg-${statusColor} me-2">${statusText}</span>
                        <span class="text-muted small">${formatDate(task.created_at)}</span>
                    </div>
                </div>
                <div class="text-end">
                    <div class="text-muted small">Проект: ${highlightSearchTerm(task.project.title, currentSearchQuery)}</div>
                    <div class="text-muted small">Приоритет: ${task.priority}</div>
                </div>
            </div>
        </div>`;
}

function highlightSearchTerm(text, query) {
    if (!text || !query) return escapeHTML(text);

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return escapeHTML(text);

    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);

    return `${escapeHTML(before)}<mark>${escapeHTML(match)}</mark>${escapeHTML(after)}`;
}

function clearSearch() {
    const searchInput = document.getElementById('searchTasksInput');
    searchInput.value = '';
    currentSearchQuery = '';
    loadTasks();
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

    // Удаляем toast из DOM после скрытия
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

// Обновленная функция loadTasks для сохранения всех задач
async function loadTasks(status = null) {
    log('Loading tasks');

    if (!currentUserId) {
        document.getElementById('tasks-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-tasks fa-2x text-muted mb-3"></i>
                <h6>Необходима авторизация</h6>
                <p class="text-muted">Для просмотра задач войдите в систему</p>
            </div>`;
        log('No currentUserId, cannot load tasks');
        return;
    }

    const token = localStorage.getItem('access_token');
    try {
        const data = await getTasks(currentUserId, token);
        log('Tasks loaded', data);

        const tasks = data.tasks || [];
        allTasks = tasks; // Сохраняем задачи для поиска

        const filteredTasks = status ? tasks.filter(t => t.status === status) : tasks;
        const container = document.getElementById('tasks-list');

        if (filteredTasks.length === 0) {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-tasks fa-2x text-muted mb-3"></i>
                    <h6>Задач пока нет</h6>
                    <p class="text-muted">Создайте первую задачу в проекте!</p>
                </div>`;
            log('No tasks found');
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

        log('Tasks displayed successfully');
    } catch (error) {
        logError('Tasks load error', error);
        document.getElementById('tasks-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить задачи</p>
            </div>`;
    }
}

// Функция для обработки поиска по нажатию Enter
function handleSearchKeyPress(event) {
    if (event.key === 'Enter') {
        searchTasks();
    }
}
