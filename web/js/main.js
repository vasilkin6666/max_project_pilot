// web/js/main.js - Полная интеграция с API
let currentUserId = null;
let currentUser = null;
let currentSection = 'dashboard';
let currentTheme = localStorage.getItem('theme') || 'light';
let isMaxEnvironment = typeof window.WebApp !== 'undefined';
let isInitialized = false;
let allTasks = [];
let allProjects = [];

// Логирование
function log(message, data = null) {
    console.log(`[LOG] ${new Date().toISOString()} - ${message}`, data || '');
}

function logError(message, error = null) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');
}

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

// --- Тема ---
function applyTheme() {
    const body = document.body;
    const icon = document.querySelector('#theme-toggle i');

    body.style.transition = 'background 0.5s ease, color 0.3s ease';

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
    provideHapticFeedback('light');
    log('Theme toggled');
}

// --- MAX Bridge интеграция ---
function initMaxBridge() {
    if (!isMaxEnvironment) {
        log('MAX Bridge: Running in standalone mode');
        document.body.classList.add('standalone-mode');
        return;
    }

    log('MAX Bridge: Initializing in MAX environment');
    document.body.classList.add('max-environment');

    try {
        const backButton = document.getElementById('back-button');
        window.WebApp.BackButton.onClick(() => {
            handleMaxBackButton();
        });

        window.WebApp.BackButton.show();
        backButton.classList.remove('d-none');

        backButton.addEventListener('click', () => {
            handleMaxBackButton();
        });

        window.WebApp.enableClosingConfirmation();
        window.WebApp.ready();

        log('MAX Bridge initialized successfully');
    } catch (error) {
        logError('MAX Bridge initialization error', error);
    }
}

function handleMaxBackButton() {
    const sections = ['dashboard', 'projects', 'tasks', 'notifications'];
    const currentSection = document.querySelector('.section.active')?.id;

    if (!currentSection) return;

    const currentIndex = sections.indexOf(currentSection);

    const currentActive = document.querySelector('.section.active');
    if (currentActive) {
        currentActive.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        currentActive.style.opacity = '0';
        currentActive.style.transform = 'translateX(-20px)';
    }

    if (currentIndex > 0) {
        setTimeout(() => {
            showSection(sections[currentIndex - 1]);
            const newSection = document.getElementById(sections[currentIndex - 1]);
            newSection.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            newSection.style.opacity = '0';
            newSection.style.transform = 'translateX(20px)';

            setTimeout(() => {
                newSection.style.opacity = '1';
                newSection.style.transform = 'translateX(0)';
            }, 50);
        }, 300);
    } else {
        setTimeout(() => {
            if (isMaxEnvironment) {
                window.WebApp.close();
            }
        }, 300);
    }

    provideHapticFeedback('light');
}

function shareInMax(text, link) {
    if (isMaxEnvironment) {
        try {
            window.WebApp.shareContent(text, link);
        } catch (error) {
            logError('Share content error', error);
            navigator.clipboard.writeText(link);
            showToast('Ссылка скопирована в буфер обмена', 'success');
        }
    } else {
        if (navigator.share) {
            navigator.share({
                title: text,
                url: link
            });
        } else {
            navigator.clipboard.writeText(link);
            showToast('Ссылка скопирована в буфер обмена: ' + link, 'success');
        }
    }
}

// --- Авторизация ---
async function initializeUser() {
    if (isMaxEnvironment && window.WebApp.initDataUnsafe?.user) {
        // Авторизация через MAX
        const userData = window.WebApp.initDataUnsafe.user;
        await handleMaxUserAuth(userData);
    } else {
        // Авторизация через URL параметры
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('user_id');

        if (userId) {
            await handleUrlUserAuth(userId);
        } else {
            // Тестовый режим (только для разработки)
            await handleTestUserAuth();
        }
    }
}

async function handleMaxUserAuth(userData) {
    try {
        const maxId = userData.id.toString();
        const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Пользователь MAX';
        const username = userData.username || '';

        log(`MAX user authentication: ${fullName} (${maxId})`);

        // Получаем токен
        const tokenData = await apiGetAuthToken(maxId, fullName, username);

        if (tokenData && tokenData.access_token) {
            localStorage.setItem('access_token', tokenData.access_token);
            currentUser = tokenData.user;
            currentUserId = currentUser.id;

            displayUserInfo(currentUser);
            showMainInterface();

            log('MAX user authenticated successfully');
        } else {
            throw new Error('No access token received');
        }
    } catch (error) {
        logError('MAX user authentication failed', error);
        showToast('Ошибка авторизации. Пожалуйста, попробуйте снова.', 'error');
    }
}

async function handleUrlUserAuth(userId) {
    try {
        log(`URL user authentication: ${userId}`);

        // Получаем данные пользователя и токен
        const tokenData = await apiGetAuthToken(userId, 'Пользователь', '');

        if (tokenData && tokenData.access_token) {
            localStorage.setItem('access_token', tokenData.access_token);
            currentUser = tokenData.user;
            currentUserId = currentUser.id;

            displayUserInfo(currentUser);
            showMainInterface();

            log('URL user authenticated successfully');
        }
    } catch (error) {
        logError('URL user authentication failed', error);
        showToast('Ошибка авторизации. Проверьте user_id.', 'error');
    }
}

async function handleTestUserAuth() {
    // Только для разработки - создаем тестового пользователя
    try {
        const testId = 'test_user_' + Date.now();
        const tokenData = await apiGetAuthToken(testId, 'Тестовый Пользователь', 'test');

        if (tokenData && tokenData.access_token) {
            localStorage.setItem('access_token', tokenData.access_token);
            currentUser = tokenData.user;
            currentUserId = currentUser.id;

            displayUserInfo(currentUser);
            showMainInterface();

            log('Test user authenticated successfully');
            showToast('Режим разработки: тестовый пользователь', 'info');
        }
    } catch (error) {
        logError('Test user authentication failed', error);
        // Показываем интерфейс без данных
        displayUserInfo({ full_name: 'Гость', id: 'guest' });
        showMainInterface();
    }
}

function displayUserInfo(user) {
    document.getElementById('user-name').textContent = user.full_name || 'Гость';
    document.getElementById('user-avatar').textContent = (user.full_name || 'Г').charAt(0).toUpperCase();
    localStorage.setItem('user_name', user.full_name);
}

function showMainInterface() {
    document.getElementById('mainInterface').style.display = 'block';
    log('Main interface shown');
}

// --- Секции ---
async function showSection(sectionName) {
    log(`Showing section: ${sectionName}`);
    provideHapticFeedback('light');

    if (!currentUserId) {
        showToast('Пожалуйста, войдите в систему', 'warning');
        log('No currentUserId, cannot show section');
        return;
    }

    // Анимация перехода
    const currentActive = document.querySelector('.section.active');
    const targetSection = document.getElementById(sectionName);

    if (currentActive) {
        currentActive.style.opacity = '0';
        currentActive.style.transform = 'translateY(10px)';
        setTimeout(() => {
            currentActive.classList.remove('active');
        }, 200);
    }

    setTimeout(() => {
        targetSection.classList.add('active');
        targetSection.style.opacity = '0';
        targetSection.style.transform = 'translateY(10px)';

        setTimeout(() => {
            targetSection.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            targetSection.style.opacity = '1';
            targetSection.style.transform = 'translateY(0)';
        }, 50);
    }, 250);

    // Обновить активную вкладку
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event.target.classList.add('active');
    currentSection = sectionName;

    // Загрузить данные для секции
    setTimeout(async () => {
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
    }, 300);
}

// --- Дашборд ---
async function loadDashboardData() {
    log('Loading dashboard data');

    try {
        // Загружаем проекты и задачи параллельно
        const [projectsData, tasksData] = await Promise.all([
            apiGetUserProjects(currentUserId),
            apiGetAllTasks()
        ]);

        log('Dashboard data loaded', { projects: projectsData, tasks: tasksData });

        const projectsCount = projectsData.projects ? projectsData.projects.length : 0;
        const tasks = tasksData.tasks || [];
        const tasksTodo = tasks.filter(t => t.status === 'todo').length;
        const tasksProgress = tasks.filter(t => t.status === 'in_progress').length;
        const tasksDone = tasks.filter(t => t.status === 'done').length;

        // Обновляем счетчики
        document.getElementById('projects-count').textContent = projectsCount;
        document.getElementById('tasks-todo-count').textContent = tasksTodo;
        document.getElementById('tasks-progress-count').textContent = tasksProgress;
        document.getElementById('tasks-done-count').textContent = tasksDone;

        // Обновляем список проектов
        const container = document.getElementById('dashboard-projects-list');
        if (projectsData.projects && projectsData.projects.length > 0) {
            container.innerHTML = projectsData.projects.map(member => {
                const project = member.project;
                const stats = project.stats || { tasks_count: 0, tasks_done: 0 };
                const progress = stats.tasks_count > 0 ? Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;

                return `
                    <div class="project-card max-card mb-3" onclick="openProjectDetail('${project.hash}')">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="mb-0">${escapeHTML(project.title)}</h6>
                            <span class="badge bg-${member.role === 'owner' ? 'primary' : 'secondary'}">${member.role}</span>
                        </div>
                        <p class="text-muted small mb-2">${escapeHTML(project.description || 'Без описания')}</p>
                        <div class="progress mb-2" style="height: 8px;">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">${progress}% завершено</small>
                            <small class="text-muted">${stats.tasks_done}/${stats.tasks_count} задач</small>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-folder-open fa-2x text-muted mb-3"></i>
                    <h6>Проектов пока нет</h6>
                    <p class="text-muted">Создайте свой первый проект!</p>
                    <button class="btn max-btn-primary" onclick="showSection('projects')">
                        <i class="fas fa-plus"></i> Создать проект
                    </button>
                </div>`;
        }

    } catch (error) {
        logError('Dashboard load error', error);
        showToast('Ошибка загрузки дашборда', 'error');
        document.getElementById('dashboard-projects-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить данные</p>
            </div>`;
    }
}

// --- Проекты ---
async function loadProjects() {
    log('Loading projects');

    try {
        const data = await apiGetUserProjects(currentUserId);
        log('Projects loaded', data);

        const container = document.getElementById('projects-list');
        allProjects = data.projects || [];

        if (allProjects.length === 0) {
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

        container.innerHTML = allProjects.map(member => {
            const project = member.project;
            const stats = project.stats || { tasks_count: 0, tasks_done: 0 };
            const progress = stats.tasks_count > 0 ? Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;

            return `
                <div class="project-card max-card mb-3" onclick="openProjectDetail('${project.hash}')">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="mb-0">${escapeHTML(project.title)}</h6>
                        <span class="badge bg-${member.role === 'owner' ? 'primary' : member.role === 'admin' ? 'info' : 'secondary'}">${member.role}</span>
                    </div>
                    <p class="text-muted mb-2">${escapeHTML(project.description || 'Без описания')}</p>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <small class="text-muted">Участников: ${project.members ? project.members.length : 0}</small>
                        <small class="text-muted">Задач: ${stats.tasks_count}</small>
                    </div>
                    <div class="progress mb-2" style="height: 8px;">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">${progress}% завершено</small>
                        <button class="btn btn-outline-secondary btn-sm" onclick="event.stopPropagation(); showProjectInviteQR('${project.hash}')">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                </div>`;
        }).join('');

        log('Projects displayed successfully');
    } catch (error) {
        logError('Projects load error', error);
        showToast('Ошибка загрузки проектов', 'error');
        document.getElementById('projects-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить проекты</p>
            </div>`;
    }
}

async function createProject() {
    provideHapticFeedback('medium');

    const title = prompt('Введите название проекта:');
    if (!title) {
        log('Project creation cancelled - no title');
        return;
    }

    const description = prompt('Введите описание проекта (необязательно):') || '';

    try {
        log(`Creating project: "${title}"`);
        const result = await apiCreateProject(title, description);

        if (result && result.project) {
            provideHapticFeedback('notification');
            showToast(`Проект "${result.project.title}" создан!`, 'success');
            log('Project created successfully', result);

            // Обновляем интерфейс
            if (currentSection === 'projects') {
                await loadProjects();
            }
            if (currentSection === 'dashboard') {
                await loadDashboardData();
            }
        } else {
            throw new Error('Не удалось создать проект');
        }
    } catch (error) {
        logError('Project creation error', error);
        provideHapticFeedback('notification');
        showToast('Ошибка при создании проекта: ' + error.message, 'error');
    }
}

// --- Детали проекта ---
async function openProjectDetail(projectHash) {
    try {
        log(`Opening project detail: ${projectHash}`);
        const projectData = await apiGetProjectByHash(projectHash);

        showProjectModal(projectData);
    } catch (error) {
        logError('Error opening project detail', error);
        showToast('Ошибка загрузки проекта', 'error');
    }
}

function showProjectModal(projectData) {
    const project = projectData.project;
    const members = projectData.members || [];
    const stats = projectData.stats || { tasks_count: 0, tasks_done: 0 };
    const progress = stats.tasks_count > 0 ? Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;

    const modalHTML = `
        <div class="modal fade" id="projectModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${escapeHTML(project.title)}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <h6>Описание</h6>
                            <p class="text-muted">${escapeHTML(project.description || 'Без описания')}</p>
                        </div>

                        <div class="row mb-3">
                            <div class="col-6">
                                <div class="stats-card">
                                    <i class="fas fa-tasks fa-2x mb-2" style="color: var(--primary-color);"></i>
                                    <h5>${stats.tasks_count}</h5>
                                    <p class="text-muted mb-0">Всего задач</p>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="stats-card">
                                    <i class="fas fa-check-circle fa-2x mb-2" style="color: var(--success-color);"></i>
                                    <h5>${progress}%</h5>
                                    <p class="text-muted mb-0">Прогресс</p>
                                </div>
                            </div>
                        </div>

                        <div class="mb-3">
                            <h6>Участники (${members.length})</h6>
                            <div class="d-flex flex-wrap gap-2">
                                ${members.map(member => `
                                    <span class="badge bg-light text-dark">
                                        ${escapeHTML(member.user.full_name)}
                                        ${member.role === 'owner' ? '👑' : member.role === 'admin' ? '⚡' : ''}
                                    </span>
                                `).join('')}
                            </div>
                        </div>

                        <div class="d-grid gap-2">
                            <button class="btn max-btn-primary" onclick="showProjectTasks('${project.hash}')">
                                <i class="fas fa-tasks"></i> Просмотреть задачи
                            </button>
                            <button class="btn btn-outline-primary" onclick="showProjectInviteQR('${project.hash}')">
                                <i class="fas fa-share-alt"></i> Пригласить участников
                            </button>
                            ${project.created_by === currentUserId ? `
                                <button class="btn btn-outline-warning" onclick="regenerateInviteHash('${project.hash}')">
                                    <i class="fas fa-refresh"></i> Обновить ссылку
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    // Удаляем существующий модал
    const existingModal = document.getElementById('projectModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('projectModal'));
    modal.show();
}

async function showProjectTasks(projectHash) {
    try {
        const tasks = await apiGetProjectTasks(projectHash);
        showTasksModal(tasks.tasks || [], `Задачи проекта`);
    } catch (error) {
        logError('Error loading project tasks', error);
        showToast('Ошибка загрузки задач проекта', 'error');
    }
}

function showTasksModal(tasks, title) {
    const modalHTML = `
        <div class="modal fade" id="tasksModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        ${tasks.length === 0 ? `
                            <div class="text-center text-muted">
                                <i class="fas fa-tasks fa-3x mb-3"></i>
                                <p>Задач пока нет</p>
                            </div>
                        ` : tasks.map(task => `
                            <div class="task-item task-${task.status} max-card mb-2" onclick="openTaskDetail(${task.id})">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div class="flex-grow-1">
                                        <h6 class="mb-1">${escapeHTML(task.title)}</h6>
                                        <p class="text-muted small mb-1">${escapeHTML(task.description || '')}</p>
                                        <div class="d-flex align-items-center">
                                            <span class="badge bg-${getStatusColor(task.status)} me-2">${getStatusText(task.status)}</span>
                                            <span class="badge bg-secondary me-2">${task.priority}</span>
                                            <span class="text-muted small">${formatDate(task.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>`;

    const existingModal = document.getElementById('tasksModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('tasksModal'));
    modal.show();
}

// --- Задачи ---
async function loadTasks(status = null) {
    log('Loading tasks', { status });

    try {
        const data = await apiGetAllTasks(status);
        log('Tasks loaded', data);

        allTasks = data.tasks || [];
        const container = document.getElementById('tasks-list');

        if (allTasks.length === 0) {
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

        container.innerHTML = allTasks.map(task => {
            const statusColor = getStatusColor(task.status);
            const statusText = getStatusText(task.status);

            return `
                <div class="task-item task-${task.status} max-card mb-3" onclick="openTaskDetail(${task.id})">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${escapeHTML(task.title)}</h6>
                            <p class="text-muted small mb-2">${escapeHTML(task.description || '')}</p>
                            <div class="d-flex align-items-center flex-wrap gap-2">
                                <span class="badge bg-${statusColor}">${statusText}</span>
                                <span class="badge bg-secondary">${task.priority}</span>
                                <span class="text-muted small">Проект: ${escapeHTML(task.project.title)}</span>
                                <span class="text-muted small">${formatDate(task.created_at)}</span>
                            </div>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" onclick="event.stopPropagation()">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" onclick="updateTaskStatus(${task.id}, 'todo')">К выполнению</a></li>
                                <li><a class="dropdown-item" href="#" onclick="updateTaskStatus(${task.id}, 'in_progress')">В работу</a></li>
                                <li><a class="dropdown-item" href="#" onclick="updateTaskStatus(${task.id}, 'done')">Завершить</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="deleteTask(${task.id})">Удалить</a></li>
                            </ul>
                        </div>
                    </div>
                </div>`;
        }).join('');

        log('Tasks displayed successfully');
    } catch (error) {
        logError('Tasks load error', error);
        showToast('Ошибка загрузки задач', 'error');
        document.getElementById('tasks-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить задачи</p>
            </div>`;
    }
}

async function openTaskDetail(taskId) {
    try {
        // Для простоты используем существующие данные задачи
        const task = allTasks.find(t => t.id === taskId);
        if (task) {
            showTaskModal(task);
        }
    } catch (error) {
        logError('Error opening task detail', error);
        showToast('Ошибка загрузки задачи', 'error');
    }
}

function showTaskModal(task) {
    const modalHTML = `
        <div class="modal fade" id="taskModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${escapeHTML(task.title)}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <h6>Описание</h6>
                            <p class="text-muted">${escapeHTML(task.description || 'Без описания')}</p>
                        </div>

                        <div class="row mb-3">
                            <div class="col-6">
                                <strong>Статус:</strong>
                                <span class="badge bg-${getStatusColor(task.status)} ms-2">${getStatusText(task.status)}</span>
                            </div>
                            <div class="col-6">
                                <strong>Приоритет:</strong>
                                <span class="badge bg-secondary ms-2">${task.priority}</span>
                            </div>
                        </div>

                        <div class="row mb-3">
                            <div class="col-6">
                                <strong>Проект:</strong>
                                <span class="ms-2">${escapeHTML(task.project.title)}</span>
                            </div>
                            <div class="col-6">
                                <strong>Создана:</strong>
                                <span class="ms-2">${formatDate(task.created_at)}</span>
                            </div>
                        </div>

                        <div class="d-grid gap-2">
                            <div class="btn-group">
                                <button class="btn btn-outline-warning" onclick="updateTaskStatus(${task.id}, 'todo')">К выполнению</button>
                                <button class="btn btn-outline-info" onclick="updateTaskStatus(${task.id}, 'in_progress')">В работу</button>
                                <button class="btn btn-outline-success" onclick="updateTaskStatus(${task.id}, 'done')">Завершить</button>
                            </div>
                            <button class="btn btn-outline-danger" onclick="deleteTask(${task.id})">
                                <i class="fas fa-trash"></i> Удалить задачу
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    const existingModal = document.getElementById('taskModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('taskModal'));
    modal.show();
}

async function updateTaskStatus(taskId, status) {
    try {
        provideHapticFeedback('medium');
        await apiUpdateTaskStatus(taskId, status);
        provideHapticFeedback('notification');
        showToast('Статус задачи обновлен', 'success');

        // Закрываем модальные окна
        bootstrap.Modal.getInstance(document.getElementById('taskModal'))?.hide();

        // Обновляем список задач
        await loadTasks();
        if (currentSection === 'dashboard') {
            await loadDashboardData();
        }
    } catch (error) {
        logError('Error updating task status', error);
        showToast('Ошибка обновления статуса', 'error');
    }
}

async function deleteTask(taskId) {
    if (!confirm('Вы уверены, что хотите удалить эту задачу?')) {
        return;
    }

    try {
        provideHapticFeedback('medium');
        await apiDeleteTask(taskId);
        provideHapticFeedback('notification');
        showToast('Задача удалена', 'success');

        // Закрываем модальные окна
        bootstrap.Modal.getInstance(document.getElementById('taskModal'))?.hide();

        // Обновляем списки
        await loadTasks();
        if (currentSection === 'dashboard') {
            await loadDashboardData();
        }
    } catch (error) {
        logError('Error deleting task', error);
        showToast('Ошибка удаления задачи', 'error');
    }
}

// --- Создание задачи ---
async function createTaskModal() {
    if (!allProjects || allProjects.length === 0) {
        showToast('Сначала создайте проект', 'warning');
        showSection('projects');
        return;
    }

    const projectOptions = allProjects.map(p =>
        `<option value="${p.project.hash}">${p.project.title}</option>`
    ).join('');

    const modalHTML = `
        <div class="modal fade" id="createTaskModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Создать задачу</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="createTaskForm">
                            <div class="mb-3">
                                <label class="form-label">Название задачи *</label>
                                <input type="text" class="form-control" id="taskTitle" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Описание</label>
                                <textarea class="form-control" id="taskDescription" rows="3"></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Проект *</label>
                                <select class="form-select" id="taskProject" required>
                                    <option value="">Выберите проект</option>
                                    ${projectOptions}
                                </select>
                            </div>
                            <div class="row">
                                <div class="col-6">
                                    <label class="form-label">Статус</label>
                                    <select class="form-select" id="taskStatus">
                                        <option value="todo">К выполнению</option>
                                        <option value="in_progress">В работе</option>
                                        <option value="done">Завершено</option>
                                    </select>
                                </div>
                                <div class="col-6">
                                    <label class="form-label">Приоритет</label>
                                    <select class="form-select" id="taskPriority">
                                        <option value="low">Низкий</option>
                                        <option value="medium" selected>Средний</option>
                                        <option value="high">Высокий</option>
                                        <option value="urgent">Срочный</option>
                                    </select>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                        <button type="button" class="btn max-btn-primary" onclick="submitTaskForm()">Создать</button>
                    </div>
                </div>
            </div>
        </div>`;

    const existingModal = document.getElementById('createTaskModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('createTaskModal'));
    modal.show();
}

async function submitTaskForm() {
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDescription').value;
    const projectHash = document.getElementById('taskProject').value;
    const status = document.getElementById('taskStatus').value;
    const priority = document.getElementById('taskPriority').value;

    if (!title || !projectHash) {
        showToast('Заполните обязательные поля', 'warning');
        return;
    }

    try {
        const taskData = {
            title: title,
            project_hash: projectHash,
            description: description,
            status: status,
            priority: priority
        };

        const result = await apiCreateTask(taskData);

        if (result && result.task) {
            showToast('Задача создана успешно!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('createTaskModal')).hide();

            // Обновляем интерфейс
            if (currentSection === 'tasks') {
                await loadTasks();
            }
            if (currentSection === 'dashboard') {
                await loadDashboardData();
            }
        }
    } catch (error) {
        logError('Error creating task', error);
        showToast('Ошибка создания задачи: ' + error.message, 'error');
    }
}

// --- Уведомления ---
async function loadNotifications() {
    log('Loading notifications');

    try {
        const data = await apiGetNotifications();
        log('Notifications loaded', data);

        const container = document.getElementById('notifications-list');
        const notifications = data.notifications || [];

        if (notifications.length === 0) {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-inbox fa-2x text-muted mb-3"></i>
                    <h6>Уведомлений нет</h6>
                    <p class="text-muted">Новые уведомления появятся здесь</p>
                </div>`;
            return;
        }

        container.innerHTML = notifications.map(notification => {
            const unreadClass = notification.is_read ? '' : 'fw-bold';
            const unreadIcon = notification.is_read ? '⚪' : '🔵';

            return `
                <div class="max-card mb-3 ${unreadClass}">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="mb-0">${unreadIcon} ${escapeHTML(notification.title)}</h6>
                        <small class="text-muted">${formatDate(notification.created_at)}</small>
                    </div>
                    <p class="mb-0">${escapeHTML(notification.message)}</p>
                </div>`;
        }).join('');

        // Обновляем статистику
        updateNotificationsSummary(notifications);

    } catch (error) {
        logError('Notifications load error', error);
        showToast('Ошибка загрузки уведомлений', 'error');
        document.getElementById('notifications-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить уведомления</p>
            </div>`;
    }
}

function updateNotificationsSummary(notifications) {
    const total = notifications.length;
    const unread = notifications.filter(n => !n.is_read).length;
    const read = total - unread;

    document.getElementById('notifications-summary').textContent =
        `Всего: ${total}, Прочитано: ${read}, Непрочитано: ${unread}`;

    document.getElementById('unread-notifications-count').textContent = unread;

    // Обновляем бейдж в навигации
    updateNotificationsBadge(unread);
}

function updateNotificationsBadge(count) {
    const badge = document.getElementById('notifications-badge');
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline';
    } else {
        badge.style.display = 'none';
    }
}

async function markAllNotificationsRead() {
    try {
        provideHapticFeedback('medium');
        await apiMarkAllNotificationsRead();
        provideHapticFeedback('notification');
        showToast('Все уведомления отмечены как прочитанные', 'success');
        await loadNotifications();
    } catch (error) {
        logError('Error marking notifications as read', error);
        showToast('Ошибка обновления уведомлений', 'error');
    }
}

// --- Приглашения и QR-коды ---
function showProjectInviteQR(projectHash) {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${projectHash}`;

    const modalHTML = `
        <div class="modal fade" id="qrModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Пригласить в проект</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <p>Отсканируйте QR-код для присоединения к проекту:</p>
                        <div id="qrCodeContainer" class="mb-3"></div>
                        <div class="input-group mb-3">
                            <input type="text" class="form-control" value="${inviteUrl}" id="inviteUrl" readonly>
                            <button class="btn btn-outline-secondary" type="button" onclick="copyInviteUrl()">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <button class="btn max-btn-primary" onclick="shareProject('${projectHash}')">
                            <i class="fas fa-share"></i> Поделиться
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

    const existingModal = document.getElementById('qrModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('qrModal'));

    modal.show();
    document.getElementById('qrModal').addEventListener('shown.bs.modal', function () {
        const container = document.getElementById('qrCodeContainer');
        container.innerHTML = '';
        new QRCode(container, {
            text: inviteUrl,
            width: 200,
            height: 200,
            colorDark: currentTheme === 'dark' ? '#ffffff' : '#000000',
            colorLight: currentTheme === 'dark' ? '#343d55' : '#ffffff'
        });
    });
}

function copyInviteUrl() {
    const input = document.getElementById('inviteUrl');
    input.select();
    document.execCommand('copy');
    showToast('Ссылка скопирована в буфер обмена', 'success');
}

function shareProject(projectHash) {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${projectHash}`;
    const shareText = `Присоединяйтесь к моему проекту в MAX Project Pilot!`;
    shareInMax(shareText, inviteUrl);
}

async function regenerateInviteHash(projectHash) {
    try {
        provideHapticFeedback('medium');
        const result = await apiRegenerateProjectInvite(projectHash);
        provideHapticFeedback('notification');
        showToast('Ссылка приглашения обновлена', 'success');

        // Закрываем текущий модал и показываем новый с обновленной ссылкой
        bootstrap.Modal.getInstance(document.getElementById('projectModal'))?.hide();
        setTimeout(() => {
            showProjectInviteQR(projectHash);
        }, 300);
    } catch (error) {
        logError('Error regenerating invite hash', error);
        showToast('Ошибка обновления ссылки', 'error');
    }
}

// --- Поиск задач ---
function handleSearchKeyPress(event) {
    if (event.key === 'Enter') {
        searchTasks();
    }
}

function searchTasks() {
    const searchInput = document.getElementById('searchTasksInput');
    const query = searchInput.value.trim();

    log(`Searching tasks with query: "${query}"`);

    if (!query) {
        loadTasks();
        return;
    }

    const searchResults = performTaskSearch(allTasks, query);
    displaySearchResults(searchResults, query);
}

function performTaskSearch(tasks, query) {
    const lowerQuery = query.toLowerCase();

    return tasks.filter(task => {
        const titleMatch = task.title.toLowerCase().includes(lowerQuery);
        const descriptionMatch = task.description && task.description.toLowerCase().includes(lowerQuery);
        const projectMatch = task.project && task.project.title.toLowerCase().includes(lowerQuery);
        const statusMatch = getStatusText(task.status).toLowerCase().includes(lowerQuery);
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
        <div class="task-item task-${task.status} max-card mb-3" onclick="openTaskDetail(${task.id})">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <h6 class="mb-1">${escapeHTML(task.title)}</h6>
                    <p class="text-muted small mb-2">${escapeHTML(task.description || '')}</p>
                    <div class="d-flex align-items-center flex-wrap gap-2">
                        <span class="badge bg-${statusColor}">${statusText}</span>
                        <span class="badge bg-secondary">${task.priority}</span>
                        <span class="text-muted small">Проект: ${escapeHTML(task.project.title)}</span>
                        <span class="text-muted small">${formatDate(task.created_at)}</span>
                    </div>
                </div>
            </div>
        </div>`;
}

function clearSearch() {
    const searchInput = document.getElementById('searchTasksInput');
    searchInput.value = '';
    loadTasks();
}

// --- Поиск проектов ---
function handleProjectSearchKeyPress(event) {
    if (event.key === 'Enter') {
        searchProjects();
    }
}

function searchProjects() {
    const searchInput = document.getElementById('searchProjectsInput');
    const query = searchInput.value.trim();

    if (!query) {
        loadProjects();
        return;
    }

    const searchResults = allProjects.filter(projectMember => {
        const project = projectMember.project;
        const searchLower = query.toLowerCase();

        return project.title.toLowerCase().includes(searchLower) ||
               (project.description && project.description.toLowerCase().includes(searchLower)) ||
               projectMember.role.toLowerCase().includes(searchLower);
    });

    displayProjectSearchResults(searchResults, query);
}

function displayProjectSearchResults(results, query) {
    const container = document.getElementById('projects-list');

    if (results.length === 0) {
        container.innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-search fa-2x text-muted mb-3"></i>
                <h6>Проекты не найдены</h6>
                <p class="text-muted">По запросу "${escapeHTML(query)}" ничего не найдено</p>
                <button class="btn max-btn-primary btn-sm" onclick="clearProjectSearch()">
                    <i class="fas fa-times"></i> Очистить поиск
                </button>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">Найдено проектов: ${results.length}</h6>
            <button class="btn btn-outline-secondary btn-sm" onclick="clearProjectSearch()">
                <i class="fas fa-times"></i> Очистить поиск
            </button>
        </div>
        ${results.map(member => renderProjectCard(member)).join('')}
    `;
}

function renderProjectCard(member) {
    const project = member.project;
    const stats = project.stats || { tasks_count: 0, tasks_done: 0 };
    const progress = stats.tasks_count > 0 ? Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;

    return `
        <div class="project-card max-card mb-3" onclick="openProjectDetail('${project.hash}')">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <h6 class="mb-0">${escapeHTML(project.title)}</h6>
                <span class="badge bg-${member.role === 'owner' ? 'primary' : member.role === 'admin' ? 'info' : 'secondary'}">${member.role}</span>
            </div>
            <p class="text-muted mb-2">${escapeHTML(project.description || 'Без описания')}</p>
            <div class="d-flex justify-content-between align-items-center mb-2">
                <small class="text-muted">Участников: ${project.members ? project.members.length : 0}</small>
                <small class="text-muted">Задач: ${stats.tasks_count}</small>
            </div>
            <div class="progress mb-2" style="height: 8px;">
                <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
            <div class="d-flex justify-content-between align-items-center">
                <small class="text-muted">${progress}% завершено</small>
                <button class="btn btn-outline-secondary btn-sm" onclick="event.stopPropagation(); showProjectInviteQR('${project.hash}')">
                    <i class="fas fa-share-alt"></i>
                </button>
            </div>
        </div>`;
}

function clearProjectSearch() {
    const searchInput = document.getElementById('searchProjectsInput');
    searchInput.value = '';
    loadProjects();
}

// --- Обработка присоединения к проекту ---
async function handleProjectJoin() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectHash = urlParams.get('join');

    if (projectHash && currentUserId) {
        try {
            log(`Attempting to join project: ${projectHash}`);
            const result = await apiJoinProject(projectHash);

            if (result.status === 'joined') {
                showToast('Вы успешно присоединились к проекту!', 'success');
                // Показываем проект
                openProjectDetail(projectHash);
            } else if (result.status === 'pending_approval') {
                showToast('Запрос на присоединение отправлен на одобрение', 'info');
            }

            // Убираем параметр из URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);

        } catch (error) {
            logError('Error joining project', error);
            showToast('Ошибка присоединения к проекту: ' + error.message, 'error');
        }
    }
}

// --- Инициализация при загрузке ---
window.addEventListener('load', async () => {
    log('Page loaded, initializing...');

    // Инициализация темы
    applyTheme();

    // Инициализация обработчиков событий
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Инициализация MAX Bridge
    initMaxBridge();

    // Инициализация пользователя
    setTimeout(async () => {
        await initializeUser();

        // Обрабатываем присоединение к проекту если есть параметр
        await handleProjectJoin();

        // Скрываем loading overlay
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.transition = 'opacity 0.5s ease';
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
            }, 500);
        }
    }, 1000);

    isInitialized = true;
});

// 🏢 Управление запросами на присоединение
async function showJoinRequests(projectHash) {
    try {
        const requests = await apiGetProjectJoinRequests(projectHash);
        showJoinRequestsModal(requests, projectHash);
    } catch (error) {
        logError('Error loading join requests', error);
        showToast('Ошибка загрузки запросов на присоединение', 'error');
    }
}

function showJoinRequestsModal(requests, projectHash) {
    const modalHTML = `
        <div class="modal fade" id="joinRequestsModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Запросы на присоединение</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        ${requests.length === 0 ? `
                            <div class="text-center text-muted">
                                <i class="fas fa-inbox fa-3x mb-3"></i>
                                <p>Запросов на присоединение нет</p>
                            </div>
                        ` : requests.map(request => `
                            <div class="max-card mb-3">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div class="flex-grow-1">
                                        <h6 class="mb-1">${escapeHTML(request.user.full_name)}</h6>
                                        <p class="text-muted small mb-2">
                                            <i class="fas fa-clock"></i> ${formatDate(request.created_at)}
                                        </p>
                                        <p class="mb-2">${escapeHTML(request.message || 'Хочет присоединиться к проекту')}</p>
                                    </div>
                                    <div class="btn-group">
                                        <button class="btn btn-success btn-sm" onclick="approveJoinRequest('${projectHash}', ${request.id})">
                                            <i class="fas fa-check"></i>
                                        </button>
                                        <button class="btn btn-danger btn-sm" onclick="rejectJoinRequest('${projectHash}', ${request.id})">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>`;

    const existingModal = document.getElementById('joinRequestsModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('joinRequestsModal'));
    modal.show();
}

async function approveJoinRequest(projectHash, requestId) {
    try {
        provideHapticFeedback('medium');
        await apiApproveJoinRequest(projectHash, requestId);
        provideHapticFeedback('success');
        showToast('Запрос одобрен', 'success');

        // Закрываем модальное окно
        bootstrap.Modal.getInstance(document.getElementById('joinRequestsModal'))?.hide();

        // Обновляем данные проекта
        if (currentSection === 'projects') {
            await loadProjects();
        }
    } catch (error) {
        logError('Error approving join request', error);
        showToast('Ошибка одобрения запроса', 'error');
    }
}

async function rejectJoinRequest(projectHash, requestId) {
    try {
        provideHapticFeedback('medium');
        await apiRejectJoinRequest(projectHash, requestId);
        provideHapticFeedback('success');
        showToast('Запрос отклонен', 'success');

        // Закрываем модальное окно
        bootstrap.Modal.getInstance(document.getElementById('joinRequestsModal'))?.hide();
    } catch (error) {
        logError('Error rejecting join request', error);
        showToast('Ошибка отклонения запроса', 'error');
    }
}

// ✅ Зависимости задач
async function showTaskDependencies(taskId) {
    try {
        const dependencies = await apiGetTaskDependencies(taskId);
        showDependenciesModal(dependencies, taskId);
    } catch (error) {
        logError('Error loading task dependencies', error);
        showToast('Ошибка загрузки зависимостей', 'error');
    }
}

function showDependenciesModal(dependencies, taskId) {
    const modalHTML = `
        <div class="modal fade" id="dependenciesModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Зависимости задачи</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-6">
                                <h6>Зависимости (блокирующие):</h6>
                                ${dependencies.dependencies && dependencies.dependencies.length > 0 ?
                                    dependencies.dependencies.map(dep => `
                                        <div class="max-card mb-2">
                                            <h6 class="mb-1">${escapeHTML(dep.title)}</h6>
                                            <span class="badge bg-${getStatusColor(dep.status)}">${getStatusText(dep.status)}</span>
                                        </div>
                                    `).join('') :
                                    '<p class="text-muted">Нет зависимостей</p>'
                                }
                            </div>
                            <div class="col-6">
                                <h6>Зависимые задачи:</h6>
                                ${dependencies.dependents && dependencies.dependents.length > 0 ?
                                    dependencies.dependents.map(dep => `
                                        <div class="max-card mb-2">
                                            <h6 class="mb-1">${escapeHTML(dep.title)}</h6>
                                            <span class="badge bg-${getStatusColor(dep.status)}">${getStatusText(dep.status)}</span>
                                        </div>
                                    `).join('') :
                                    '<p class="text-muted">Нет зависимых задач</p>'
                                }
                            </div>
                        </div>

                        <div class="mt-4">
                            <h6>Добавить зависимость</h6>
                            <div class="input-group">
                                <input type="number" class="form-control" id="dependencyTaskId" placeholder="ID задачи-зависимости">
                                <button class="btn max-btn-primary" onclick="addTaskDependency(${taskId})">
                                    <i class="fas fa-link"></i> Добавить
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    const existingModal = document.getElementById('dependenciesModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('dependenciesModal'));
    modal.show();
}

async function addTaskDependency(taskId) {
    const dependsOnId = document.getElementById('dependencyTaskId').value;

    if (!dependsOnId) {
        showToast('Введите ID задачи', 'warning');
        return;
    }

    try {
        provideHapticFeedback('medium');
        await apiAddTaskDependency(taskId, dependsOnId);
        provideHapticFeedback('success');
        showToast('Зависимость добавлена', 'success');

        // Закрываем модальное окно
        bootstrap.Modal.getInstance(document.getElementById('dependenciesModal'))?.hide();
    } catch (error) {
        logError('Error adding task dependency', error);
        showToast('Ошибка добавления зависимости: ' + error.message, 'error');
    }
}

// ✅ Комментарии задач
async function showTaskComments(taskId) {
    try {
        const comments = await apiGetTaskComments(taskId);
        showCommentsModal(comments, taskId);
    } catch (error) {
        logError('Error loading task comments', error);
        showToast('Ошибка загрузки комментариев', 'error');
    }
}

function showCommentsModal(comments, taskId) {
    const modalHTML = `
        <div class="modal fade" id="commentsModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Комментарии к задаче</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-4" style="max-height: 400px; overflow-y: auto;">
                            ${comments.length === 0 ? `
                                <div class="text-center text-muted">
                                    <i class="fas fa-comments fa-3x mb-3"></i>
                                    <p>Комментариев пока нет</p>
                                </div>
                            ` : comments.map(comment => `
                                <div class="max-card mb-3">
                                    <div class="d-flex justify-content-between align-items-start mb-2">
                                        <div>
                                            <h6 class="mb-0">${escapeHTML(comment.user?.full_name || 'Пользователь')}</h6>
                                            <small class="text-muted">${formatDate(comment.created_at)}</small>
                                        </div>
                                    </div>
                                    <p class="mb-0">${escapeHTML(comment.content)}</p>
                                </div>
                            `).join('')}
                        </div>

                        <div class="mt-4">
                            <h6>Добавить комментарий</h6>
                            <div class="mb-3">
                                <textarea class="form-control" id="commentContent" rows="3" placeholder="Введите ваш комментарий..."></textarea>
                            </div>
                            <button class="btn max-btn-primary" onclick="addTaskComment(${taskId})">
                                <i class="fas fa-paper-plane"></i> Отправить
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    const existingModal = document.getElementById('commentsModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('commentsModal'));
    modal.show();
}

async function addTaskComment(taskId) {
    const content = document.getElementById('commentContent').value;

    if (!content.trim()) {
        showToast('Введите текст комментария', 'warning');
        return;
    }

    try {
        provideHapticFeedback('medium');
        await apiAddTaskComment(taskId, content);
        provideHapticFeedback('success');
        showToast('Комментарий добавлен', 'success');

        // Очищаем поле ввода
        document.getElementById('commentContent').value = '';

        // Перезагружаем комментарии
        await showTaskComments(taskId);
    } catch (error) {
        logError('Error adding task comment', error);
        showToast('Ошибка добавления комментария: ' + error.message, 'error');
    }
}

// 🔄 Обновленная функция showTaskModal с новыми кнопками
function showTaskModal(task) {
    const modalHTML = `
        <div class="modal fade" id="taskModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${escapeHTML(task.title)}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <h6>Описание</h6>
                            <p class="text-muted">${escapeHTML(task.description || 'Без описания')}</p>
                        </div>

                        <div class="row mb-3">
                            <div class="col-6">
                                <strong>Статус:</strong>
                                <span class="badge bg-${getStatusColor(task.status)} ms-2">${getStatusText(task.status)}</span>
                            </div>
                            <div class="col-6">
                                <strong>Приоритет:</strong>
                                <span class="badge bg-secondary ms-2">${task.priority}</span>
                            </div>
                        </div>

                        <div class="row mb-3">
                            <div class="col-6">
                                <strong>Проект:</strong>
                                <span class="ms-2">${escapeHTML(task.project.title)}</span>
                            </div>
                            <div class="col-6">
                                <strong>Создана:</strong>
                                <span class="ms-2">${formatDate(task.created_at)}</span>
                            </div>
                        </div>

                        <div class="d-grid gap-2 mb-3">
                            <div class="btn-group">
                                <button class="btn btn-outline-warning" onclick="updateTaskStatus(${task.id}, 'todo')">К выполнению</button>
                                <button class="btn btn-outline-info" onclick="updateTaskStatus(${task.id}, 'in_progress')">В работу</button>
                                <button class="btn btn-outline-success" onclick="updateTaskStatus(${task.id}, 'done')">Завершить</button>
                            </div>
                        </div>

                        <div class="row mb-3">
                            <div class="col-4">
                                <button class="btn btn-outline-primary w-100" onclick="showTaskDependencies(${task.id})">
                                    <i class="fas fa-link"></i> Зависимости
                                </button>
                            </div>
                            <div class="col-4">
                                <button class="btn btn-outline-info w-100" onclick="showTaskComments(${task.id})">
                                    <i class="fas fa-comments"></i> Комментарии
                                </button>
                            </div>
                            <div class="col-4">
                                <button class="btn btn-outline-danger w-100" onclick="deleteTask(${task.id})">
                                    <i class="fas fa-trash"></i> Удалить
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    const existingModal = document.getElementById('taskModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('taskModal'));
    modal.show();
}

// 🔄 Обновленная функция showProjectModal с кнопкой управления запросами
function showProjectModal(projectData) {
    const project = projectData.project;
    const members = projectData.members || [];
    const stats = projectData.stats || { tasks_count: 0, tasks_done: 0 };
    const progress = stats.tasks_count > 0 ? Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;

    // Проверяем права пользователя (владелец или админ)
    const currentUserMember = members.find(m => m.user_id === currentUser.id);
    const canManageRequests = currentUserMember && (currentUserMember.role === 'owner' || currentUserMember.role === 'admin');

    const modalHTML = `
        <div class="modal fade" id="projectModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${escapeHTML(project.title)}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <h6>Описание</h6>
                            <p class="text-muted">${escapeHTML(project.description || 'Без описания')}</p>
                        </div>

                        <div class="row mb-3">
                            <div class="col-6">
                                <div class="stats-card">
                                    <i class="fas fa-tasks fa-2x mb-2" style="color: var(--primary-color);"></i>
                                    <h5>${stats.tasks_count}</h5>
                                    <p class="text-muted mb-0">Всего задач</p>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="stats-card">
                                    <i class="fas fa-check-circle fa-2x mb-2" style="color: var(--success-color);"></i>
                                    <h5>${progress}%</h5>
                                    <p class="text-muted mb-0">Прогресс</p>
                                </div>
                            </div>
                        </div>

                        <div class="mb-3">
                            <h6>Участники (${members.length})</h6>
                            <div class="d-flex flex-wrap gap-2">
                                ${members.map(member => `
                                    <span class="badge bg-light text-dark">
                                        ${escapeHTML(member.user.full_name)}
                                        ${member.role === 'owner' ? '👑' : member.role === 'admin' ? '⚡' : ''}
                                    </span>
                                `).join('')}
                            </div>
                        </div>

                        <div class="d-grid gap-2">
                            <button class="btn max-btn-primary" onclick="showProjectTasks('${project.hash}')">
                                <i class="fas fa-tasks"></i> Просмотреть задачи
                            </button>
                            <button class="btn btn-outline-primary" onclick="showProjectInviteQR('${project.hash}')">
                                <i class="fas fa-share-alt"></i> Пригласить участников
                            </button>
                            ${canManageRequests ? `
                                <button class="btn btn-outline-info" onclick="showJoinRequests('${project.hash}')">
                                    <i class="fas fa-user-plus"></i> Запросы на присоединение
                                </button>
                            ` : ''}
                            ${project.created_by === currentUserId ? `
                                <button class="btn btn-outline-warning" onclick="regenerateInviteHash('${project.hash}')">
                                    <i class="fas fa-refresh"></i> Обновить ссылку
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

    const existingModal = document.getElementById('projectModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('projectModal'));
    modal.show();
}
