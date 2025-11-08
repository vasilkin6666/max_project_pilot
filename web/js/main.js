// web/js/main.js
// --- Конфигурация ---
const API_BASE_URL = 'https://powerfully-exotic-chamois.cloudpub.ru/api';
let currentUserId = null;
let currentSection = 'dashboard';
let currentTheme = localStorage.getItem('theme') || 'light';

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

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
applyTheme(); // Применить тему при загрузке

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

// Auth
async function login(userId, fullName) {
    const response = await apiCall('/auth/token', 'POST', { max_id: userId, full_name: fullName });
    if (response.access_token) {
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('user_id', response.user.id);
        localStorage.setItem('user_name', response.user.full_name);
        currentUserId = response.user.id;
        return response.user;
    }
    return null;
}

// Projects
async function getProjects(userId, token) {
    return await apiCall(`/users/${userId}/projects`, 'GET', null, token);
}

async function createProject(title, description, token) {
    return await apiCall('/projects/', 'POST', { title, description }, token);
}

// Tasks
async function getTasks(userId, token) {
    return await apiCall(`/tasks/?user_id=${userId}`, 'GET', null, token);
}

async function getProjectTasks(projectHash, token) {
    return await apiCall(`/tasks/project/${projectHash}`, 'GET', null, token);
}

async function createTask(title, projectHash, description, status, priority, assignedToIds, token) {
    return await apiCall('/tasks/', 'POST', { title, project_hash: projectHash, description, status, priority, assigned_to_ids: assignedToIds }, token);
}

async function updateTaskStatus(taskId, status, token) {
    return await apiCall(`/tasks/${taskId}/status`, 'PUT', { status }, token);
}

// Notifications
async function getNotifications(userId, token) {
    return await apiCall(`/notifications/?user_id=${userId}`, 'GET', null, token);
}

async function markAllNotificationsRead(userId, token) {
    return await apiCall('/notifications/mark_all_read', 'PUT', null, token);
}

// --- Авторизация ---
function showAuthSection() {
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('mainInterface').style.display = 'none';
}

function showMainInterface() {
    document.getElementById('mainInterface').style.display = 'block';
}

async function login() {
    const userId = document.getElementById('userIdInput').value.trim();
    if (!userId) {
        alert('Введите User ID');
        return;
    }
    // Для простоты, используем 'Anonymous' как имя, если не получено из MAX
    const fullName = prompt('Введите ваше имя (для регистрации):') || 'Anonymous';
    try {
        const user = await login(userId, fullName);
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

// Проверка авторизации при загрузке
window.addEventListener('load', () => {
    showUserInfo();
});

function showUserInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');
    const userName = urlParams.get('user_name') || localStorage.getItem('user_name') || 'Гость';

    if (userId) {
        document.getElementById('user-name').textContent = userName;
        document.getElementById('user-avatar').textContent = userName.charAt(0).toUpperCase();
        localStorage.setItem('user_name', userName);
        showMainInterface();
    } else {
        document.getElementById('mainInterface').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка</h6>
                <p class="text-muted">Отсутствует идентификатор пользователя. Перейдите в бота для авторизации.</p>
            </div>
        `;
    }
}

// --- Секции ---
async function showSection(sectionName) {
    if (!currentUserId) {
        alert('Пожалуйста, войдите в систему');
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
    if (!currentUserId) return;
    const token = localStorage.getItem('access_token');
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
        console.error('Dashboard load error:', error);
        document.getElementById('projects-count').textContent = '0';
        document.getElementById('tasks-todo-count').textContent = '0';
        document.getElementById('tasks-progress-count').textContent = '0';
        document.getElementById('tasks-done-count').textContent = '0';
        document.getElementById('dashboard-projects-list').innerHTML = '<p class="text-muted">Ошибка загрузки данных.</p>';
    }
}

// --- Проекты ---
async function loadProjects() {
    if (!currentUserId) {
        document.getElementById('projects-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Необходима авторизация</h6>
                <p class="text-muted">Для просмотра проектов войдите в систему</p>
            </div>`;
        return;
    }
    const token = localStorage.getItem('access_token');
    try {
        const data = await getProjects(currentUserId, token);
        const container = document.getElementById('projects-list');

        if (!data.projects || data.projects.length === 0) {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-folder-open fa-2x text-muted mb-3"></i>
                    <h6>Проектов пока нет</h6>
                    <p class="text-muted">Создайте свой первый проект!</p>
                    <button class="btn max-btn-primary" onclick="createProject()"><i class="fas fa-plus"></i> Создать проект</button>
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
        console.error('Projects load error:', error);
        document.getElementById('projects-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить проекты</p>
            </div>`;
    }
}

async function createProject() {
    if (!currentUserId) {
        alert('Необходима авторизация для создания проекта');
        return;
    }
    const title = prompt('Введите название проекта:');
    if (!title) return;
    const description = prompt('Введите описание проекта (необязательно):') || '';

    const token = localStorage.getItem('access_token');
    try {
        const result = await createProject(title, description, token);
        alert(`Проект "${result.project.title}" создан!`);
        if (currentSection === 'projects') {
            await loadProjects();
        }
        await loadDashboardData(); // Обновить счётчики
    } catch (error) {
        console.error('Project creation error:', error);
        alert('Ошибка при создании проекта: ' + error.message);
    }
}

function openProject(projectHash) {
    // Здесь можно открыть модальное окно с деталями проекта или перейти на страницу проекта
    // Пока просто покажем QR-код для приглашения
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
                    </div>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalElement = document.querySelector('.modal.show');
    new QRCode(document.getElementById('qrCodeContainer'), { text: inviteUrl, width: 200, height: 200 });
    modalElement.querySelector('.btn-close').addEventListener('click', () => modalElement.remove());
}

// --- Задачи ---
let currentTaskId = null;
let currentTaskDetails = null;
let taskSearchFuse = null;

async function loadTasks(status = null) {
    if (!currentUserId) {
        document.getElementById('tasks-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-tasks fa-2x text-muted mb-3"></i>
                <h6>Необходима авторизация</h6>
                <p class="text-muted">Для просмотра задач войдите в систему</p>
            </div>`;
        return;
    }
    const token = localStorage.getItem('access_token');
    try {
        const data = await getTasks(currentUserId, token);
        const tasks = data.tasks || [];

        // Фильтрация по статусу
        const filteredTasks = status ? tasks.filter(t => t.status === status) : tasks;

        const container = document.getElementById('tasks-list');
        if (filteredTasks.length === 0) {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-tasks fa-2x text-muted mb-3"></i>
                    <h6>Задач пока нет</h6>
                    <p class="text-muted">Создайте первую задачу в проекте!</p>
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

        // Инициализация поиска
        taskSearchFuse = new Fuse(tasks, {
            keys: ['title', 'description'],
            threshold: 0.3
        });

    } catch (error) {
        console.error('Tasks load error:', error);
        document.getElementById('tasks-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить задачи</p>
            </div>`;
    }
}

function openTaskModal(taskId) {
    currentTaskId = taskId;
    // Загрузка деталей задачи и открытие модального окна
    // Пока упрощённо
    const token = localStorage.getItem('access_token');
    fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        currentTaskDetails = data.task;
        document.getElementById('taskModalTitle').textContent = data.task.title;
        document.getElementById('taskModalProjectTitle').textContent = data.task.project.title;
        document.getElementById('taskModalDescription').textContent = data.task.description || '';
        document.getElementById('taskModalStatus').value = data.task.status;

        // Заполнение assignees
        const assigneeSelect = document.getElementById('taskModalAssignees');
        assigneeSelect.innerHTML = '';
        data.task.project.members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.user_id;
            option.textContent = member.user.full_name;
            if (data.task.assigned_to_id === member.user_id) option.selected = true;
            assigneeSelect.appendChild(option);
        });

        // Заполнение подзадач
        const subtasksContainer = document.getElementById('taskModalSubtasks');
        subtasksContainer.innerHTML = data.task.subtasks ? data.task.subtasks.map(st => `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="" id="subtask${st.id}" ${st.status === 'done' ? 'checked' : ''} disabled>
                <label class="form-check-label" for="subtask${st.id}">${st.title}</label>
            </div>
        `).join('') : '';

        // Заполнение комментариев
        const commentsContainer = document.getElementById('taskModalComments');
        commentsContainer.innerHTML = data.task.comments ? data.task.comments.map(c => `
            <div class="comment-item mb-2">
                <strong>${c.user.full_name}</strong> <small class="text-muted">${formatDate(c.created_at)}</small>
                <p class="mb-1">${escapeHTML(c.content)}</p>
            </div>
        `).join('') : '';

        // Заполнение файлов
        const filesContainer = document.getElementById('taskModalFiles');
        filesContainer.innerHTML = data.task.attachments ? data.task.attachments.map(att => `
            <a href="${att.url}" target="_blank">${att.filename}</a>
        `).join('<br>') : 'Нет прикреплённых файлов';

        const modal = new bootstrap.Modal(document.getElementById('taskModal'));
        modal.show();
    })
    .catch(err => console.error('Error loading task details:', err));
}

function updateTask() {
    if (!currentUserId || !currentTaskId) return;
    const token = localStorage.getItem('access_token');
    const newStatus = document.getElementById('taskModalStatus').value;
    updateTaskStatus(currentTaskId, newStatus, token)
        .then(() => {
            alert('Задача обновлена!');
            const modal = bootstrap.Modal.getInstance(document.getElementById('taskModal'));
            modal.hide();
            if (currentSection === 'tasks') {
                loadTasks(); // Перезагрузить задачи
            }
        })
        .catch(err => {
            console.error('Update task error:', err);
            alert('Ошибка обновления задачи');
        });
}

function debounceSaveTaskDescription() {
    debounce(async () => {
        if (!currentTaskId) return;
        const newDesc = document.getElementById('taskModalDescription').textContent;
        // Реализовать PUT запрос для обновления описания
        // PUT /api/tasks/{id}/description
        // console.log('Saving description for task', currentTaskId, ':', newDesc);
    }, 500)();
}

function addSubtask() {
    const title = prompt('Введите название подзадачи:');
    if (title) {
        // Реализовать POST запрос для создания подзадачи
        // POST /api/tasks/
        // console.log('Adding subtask:', title, 'to task', currentTaskId);
    }
}

function addComment() {
    const text = document.getElementById('newCommentText').value.trim();
    if (!text) return;
    // Реализовать POST запрос для создания комментария
    // POST /api/tasks/{id}/comments
    // console.log('Adding comment:', text, 'to task', currentTaskId);
    document.getElementById('newCommentText').value = '';
}

function searchTasks() {
    const query = document.getElementById('searchTasksInput').value;
    if (!taskSearchFuse || !query) {
        loadTasks(); // Показать все задачи, если нет запроса
        return;
    }
    const results = taskSearchFuse.search(query);
    const container = document.getElementById('tasks-list');
    if (results.length === 0) {
        container.innerHTML = '<p class="text-muted">Задачи не найдены.</p>';
        return;
    }
    container.innerHTML = results.map(result => {
        const task = result.item;
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
}

// --- Уведомления ---
async function loadNotifications() {
    if (!currentUserId) {
        document.getElementById('notifications-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-bell fa-2x text-muted mb-3"></i>
                <h6>Необходима авторизация</h6>
                <p class="text-muted">Для просмотра уведомлений войдите в систему</p>
            </div>`;
        return;
    }
    const token = localStorage.getItem('access_token');
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
        console.error('Notifications load error:', error);
        document.getElementById('notifications-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить уведомления</p>
            </div>`;
    }
}

async function markAllNotificationsRead() {
    if (!currentUserId) return;
    const token = localStorage.getItem('access_token');
    try {
        await markAllNotificationsRead(currentUserId, token);
        await loadNotifications(); // Обновить список
        alert('Все уведомления отмечены как прочитанные');
    } catch (error) {
        console.error('Mark read error:', error);
        alert('Ошибка при отметке уведомлений');
    }
}
