// js/app.js
// Основное приложение
class App {
    static isInitialized = false;
    static tempParentTaskId = null;
    static eventHandlers = new Map();
    static loadDataInProgress = false;

    static async init() {
        if (this.isInitialized) {
            console.log('App already initialized, skipping...');
            return;
        }

        try {
            console.log('Initializing app...');
            this.isInitialized = true;

            // Инициализация менеджера устройств
            this.initDeviceManager();

            // Инициализация онлайн статуса
            this.initOnlineStatus();

            // Аутентификация пользователя
            currentUser = await this.withTimeout(EnhancedAuthManager.initialize(), 10000, 'Authentication timeout');

            // Загрузка данных
            await this.loadData();

            // Настройка обработчиков событий
            this.setupEventListeners();

            // Инициализация мобильных функций
            if (typeof MobileApp !== 'undefined') {
                MobileApp.init();
            }

            // Показ кнопки старта
            this.showStartButton();

            // Инициализация кнопки назад для MAX
            this.initMaxBackButton();

            // Прикрепление обработчика кнопки старта
            this.attachStartButtonListener();

            // Обновление прогресс бара
            this.updateProgressBar();

            console.log('App initialized successfully');

            // Отправка события инициализации
            window.dispatchEvent(new CustomEvent('appInitialized', {
                detail: { user: currentUser, timestamp: new Date() }
            }));
        } catch (error) {
            console.error('App initialization failed:', error);
            this.handleInitError(error);
            this.isInitialized = false;
        }
    }

    static initDeviceManager() {
        // Определение платформы
        const ua = navigator.userAgent;
        if (/Android/i.test(ua)) {
            document.body.classList.add('platform-android');
        } else if (/iPhone|iPad|iPod/i.test(ua)) {
            document.body.classList.add('platform-ios');
        } else if (/Windows/i.test(ua)) {
            document.body.classList.add('platform-windows');
        } else if (/Mac/i.test(ua)) {
            document.body.classList.add('platform-mac');
        } else if (/Linux/i.test(ua)) {
            document.body.classList.add('platform-linux');
        }

        // Определение типа ввода
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            document.body.classList.add('input-touch');
        } else {
            document.body.classList.add('input-mouse');
        }

        // Проверка PWA режима
        if (window.matchMedia('(display-mode: standalone)').matches) {
            document.body.classList.add('pwa-standalone');
        }
    }

    static initOnlineStatus() {
        window.addEventListener('online', () => {
            this.showSuccess('Соединение восстановлено');
            setTimeout(() => this.loadData(), 1000);
        });

        window.addEventListener('offline', () => {
            this.showError('Отсутствует интернет-соединение');
        });

        if (!navigator.onLine) {
            this.showError('Приложение работает в offline режиме');
        }
    }

    static withTimeout(promise, timeoutMs, errorMessage = 'Operation timeout') {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
            )
        ]);
    }

    static showStartButton() {
        const tapToStart = document.getElementById('tapToStart');
        if (tapToStart) {
            tapToStart.style.display = 'block';
            tapToStart.classList.add('fade-in');
        }
    }

    static hapticFeedback(style = 'light') {
        try {
            if (typeof MaxBridge !== 'undefined' && MaxBridge.hapticFeedback) {
                MaxBridge.hapticFeedback(style);
            } else if (typeof WebApp !== 'undefined' && WebApp.HapticFeedback) {
                WebApp.HapticFeedback.impactOccurred(style);
            }
        } catch (error) {
            console.log('Haptic feedback not available');
        }
    }

    static initMaxBackButton() {
        if (typeof WebApp !== 'undefined' && WebApp.BackButton) {
            try {
                WebApp.BackButton.onClick(() => {
                    this.backToPreviousView();
                });
                console.log('MAX Back button handler initialized');
            } catch (error) {
                console.log('MAX Back button setup failed:', error);
            }
        }
    }

    static showExitConfirmation() {
        if (confirm('Вы уверены, что хотите выйти из приложения?')) {
            if (typeof WebApp !== 'undefined' && WebApp.close) {
                WebApp.close();
            } else {
                console.log('Exit confirmed (standalone mode)');
            }
        }
    }

    static attachStartButtonListener() {
        const loadingOverlay = document.getElementById('loading');
        if (loadingOverlay) {
            loadingOverlay.addEventListener('click', () => {
                this.hideSplashScreen();
            });
        }
    }

    static updateProgressBar() {
        const progressBar = document.getElementById('loadingBarProgress');
        if (progressBar) {
            progressBar.style.width = '100%';
            progressBar.style.transition = 'all 0.5s ease-in-out';
            setTimeout(() => {
                progressBar.style.background = 'var(--success)';
                progressBar.style.boxShadow = '0 0 10px var(--success)';
            }, 100);
        }
    }

    static hideSplashScreen() {
        const loadingOverlay = document.getElementById('loading');
        const appElement = document.getElementById('app');
        if (loadingOverlay) {
            console.log('Hiding splash screen...');
            loadingOverlay.classList.add('hidden');
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
                if (appElement) {
                    appElement.style.display = 'block';
                    appElement.classList.add('fade-in');
                }
                console.log('Splash screen hidden, app is ready');
                this.showDashboard();
                window.dispatchEvent(new Event('appStarted'));
            }, 800);
        }
    }

    static handleInitError(error) {
        const loadingContent = document.querySelector('.loading-content');
        if (loadingContent) {
            loadingContent.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <h2>Ошибка загрузки</h2>
                    <p>${error.message || 'Неизвестная ошибка'}</p>
                    <div class="error-actions">
                        <button onclick="location.reload()" class="btn btn-primary retry-button">
                            Перезагрузить
                        </button>
                        <button onclick="App.continueWithoutData()" class="btn btn-outline">
                            Продолжить без данных
                        </button>
                    </div>
                </div>
            `;
        }
        this.showError('Ошибка инициализации приложения: ' + error.message);
    }

    static continueWithoutData() {
        console.log('Continuing without data...');
        this.hideSplashScreen();
        this.renderEnhancedProjects([]);
        this.updateStats([], []);
        this.showSuccess('Приложение запущено в ограниченном режиме');
    }

    // ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================

    static setupEventListeners() {
        this.removeEventListeners();

        // Основная навигация
        this.addEventListener('dashboardBtn', 'click', () => this.showDashboard());
        this.addEventListener('myTasksBtn', 'click', () => this.showMyTasks());
        this.addEventListener('settingsBtn', 'click', () => this.showSettings());

        // Действия на главной
        this.addEventListener('notificationsBtn', 'click', () => this.showEnhancedNotifications());
        this.addEventListener('searchProjectsBtn', 'click', () => this.showSearchProjects());
        this.addEventListener('createProjectBtn', 'click', () => this.showCreateProjectModal());

        // Проекты
        this.addEventListener('manageMembersBtn', 'click', () => this.showProjectMembersManagement());
        this.addEventListener('joinRequestsBtn', 'click', () => this.showJoinRequests());
        this.addEventListener('editProjectBtn', 'click', () => this.showEditProjectModal());
        this.addEventListener('deleteProjectBtn', 'click', () => this.showDeleteProjectModal());
        this.addEventListener('createTaskBtn', 'click', () => this.showCreateTaskModal());

        // Задачи
        this.addEventListener('createSubtaskBtn', 'click', () => this.showCreateSubtaskModal());
        this.addEventListener('editTaskBtn', 'click', () => this.showEditTaskModal());
        this.addEventListener('deleteTaskBtn', 'click', () => this.showDeleteTaskModal());
        this.addEventListener('addCommentBtn', 'click', () => this.addComment());

        // Фильтры задач
        this.addEventListener('tasksFilterStatus', 'change', () => this.loadEnhancedMyTasks());
        this.addEventListener('tasksFilterPriority', 'change', () => this.loadEnhancedMyTasks());
        this.addEventListener('tasksFilterAssignment', 'change', () => this.loadEnhancedMyTasks());
        this.addEventListener('tasksSortBy', 'change', () => this.loadEnhancedMyTasks());

        // Поиск
        this.addEventListener('searchProjectsSubmitBtn', 'click', () => this.enhancedSearchProjects());
        this.addEventListener('searchProjectsInput', 'keypress', (e) => {
            if (e.key === 'Enter') {
                this.enhancedSearchProjects();
            }
        });

        // Модальные окна
        this.addEventListener('submitCreateProjectBtn', 'click', (e) => {
            e.preventDefault();
            this.handleCreateProject();
        });
        this.addEventListener('submitEditProjectBtn', 'click', (e) => {
            e.preventDefault();
            this.handleUpdateProject();
        });
        this.addEventListener('confirmDeleteProjectBtn', 'click', () => this.handleDeleteProject());
        this.addEventListener('submitCreateTaskBtn', 'click', (e) => {
            e.preventDefault();
            this.handleCreateTask();
        });
        this.addEventListener('submitEditTaskBtn', 'click', (e) => {
            e.preventDefault();
            this.handleUpdateTask();
        });
        this.addEventListener('confirmDeleteTaskBtn', 'click', () => this.handleDeleteTask());
        this.addEventListener('submitCreateSubtaskBtn', 'click', (e) => {
            e.preventDefault();
            this.handleCreateSubtask();
        });

        // Настройки
        this.addEventListener('themeSelect', 'change', () => this.saveUserSettings());
        this.addEventListener('notificationsEnabled', 'change', () => this.saveUserSettings());
        this.addEventListener('userFullName', 'change', () => this.saveUserSettings());

        // Project View Actions
        this.addEventListener('manageMembersBtn', 'click', () => this.showProjectMembersManagement());
        this.addEventListener('joinRequestsBtn', 'click', () => this.showJoinRequests());
        this.addEventListener('editProjectBtn', 'click', () => this.showEditProjectModal());
        this.addEventListener('deleteProjectBtn', 'click', () => this.showDeleteProjectModal());

        // Task View Actions
        this.addEventListener('createTaskBtn', 'click', () => this.showCreateTaskModal());
        this.addEventListener('createSubtaskBtn', 'click', () => this.showCreateSubtaskModal());
        this.addEventListener('editTaskBtn', 'click', () => this.showEditTaskModal());
        this.addEventListener('deleteTaskBtn', 'click', () => this.showDeleteTaskModal());
        this.addEventListener('addCommentBtn', 'click', () => this.addComment());

        // My Tasks Filters
        this.addEventListener('tasksFilterStatus', 'change', () => this.loadMyTasks());
        this.addEventListener('tasksFilterProject', 'change', () => this.loadMyTasks());

        // Search Projects
        this.addEventListener('searchProjectsSubmitBtn', 'click', () => this.searchProjects());

        // Form submissions
        this.addEventListener('submitCreateProjectBtn', 'click', (e) => {
            e.preventDefault();
            this.handleCreateProject();
        });
        this.addEventListener('submitEditProjectBtn', 'click', (e) => {
            e.preventDefault();
            this.handleUpdateProject();
        });
        this.addEventListener('confirmDeleteProjectBtn', 'click', () => this.handleDeleteProject());
        this.addEventListener('submitCreateTaskBtn', 'click', (e) => {
            e.preventDefault();
            this.handleCreateTask();
        });
        this.addEventListener('submitEditTaskBtn', 'click', (e) => {
            e.preventDefault();
            this.handleUpdateTask();
        });
        this.addEventListener('confirmDeleteTaskBtn', 'click', () => this.handleDeleteTask());
        this.addEventListener('joinProjectFromPreviewBtn', 'click', () => this.joinProjectFromPreview());

        // --- Добавлены обработчики для новых форм ---
        this.addEventListener('submitCreateSubtaskBtn', 'click', (e) => {
            e.preventDefault();
            this.handleCreateSubtask();
        });
        this.addEventListener('submitUpdateMemberRoleBtn', 'click', (e) => {
            e.preventDefault();
            this.handleUpdateMemberRole();
        });
        this.addEventListener('confirmRemoveMemberBtn', 'click', () => this.handleRemoveMember());

        this.addEventListener('taskStatusSelect', 'change', () => this.updateTaskStatus());

        this.addEventListener('searchProjectsInput', 'keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchProjects();
            }
        });
    }

    static addEventListener(elementId, event, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            const key = `${elementId}_${event}`;
            if (this.eventHandlers.has(key)) {
                const { element: oldElement, event: oldEvent, handler: oldHandler } = this.eventHandlers.get(key);
                oldElement.removeEventListener(oldEvent, oldHandler);
            }
            element.addEventListener(event, handler);
            this.eventHandlers.set(key, { element, event, handler });
        }
    }

    static removeEventListeners() {
        for (const [key, { element, event, handler }] of this.eventHandlers) {
            element.removeEventListener(event, handler);
        }
        this.eventHandlers.clear();
    }

    // ==================== ЗАГРУЗКА ДАННЫХ ====================

    static async loadData() {
        if (this.loadDataInProgress) {
            console.log('Data loading already in progress, skipping...');
            return;
        }

        try {
            this.loadDataInProgress = true;
            console.log('Loading data...');

            const dashboardData = await ApiService.getDashboard();
            const projects = dashboardData.projects || [];
            const settings = dashboardData.settings || {};
            const recentTasks = dashboardData.recent_tasks || [];

            userSettings = settings;
            this.applyUserSettings(settings);

            this.renderEnhancedProjects(projects);
            this.updateStats(projects, recentTasks);
            this.renderRecentTasks(recentTasks);

            console.log('Data loaded successfully');
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Ошибка загрузки данных: ' + error.message);
        } finally {
            this.loadDataInProgress = false;
        }
    }

    static applyUserSettings(settings) {
        if (settings.theme && settings.theme !== 'auto') {
            document.documentElement.setAttribute('data-theme', settings.theme);
        }
    }

    // ==================== ГЛАВНАЯ СТРАНИЦА ====================

    static showDashboard() {
        this.showView('dashboardView');
        this.loadData();
    }

    static renderEnhancedProjects(projects) {
        const container = document.getElementById('projectsList');
        if (!projects || projects.length === 0) {
            container.innerHTML = this.getEmptyProjectsState();
            return;
        }

        container.innerHTML = projects.map(project => {
            const projectData = project.project || project;
            const stats = project.stats || projectData.stats || {};
            const userRole = projectData.current_user_role || 'member';

            // Расчет прогресса (только основные задачи)
            const totalTasks = stats.tasks_count || 0;
            const doneTasks = stats.tasks_done || 0;
            const progress = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

            return `
            <div class="project-card project-card-enhanced hover-lift" onclick="App.openProject('${projectData.hash}')">
                <div class="project-card-header">
                    <h3 class="project-title">${this.escapeHtml(projectData.title)}</h3>
                    <span class="project-type-badge">${projectData.is_private ? '🔒' : '🌐'}</span>
                </div>
                <p class="project-description">${this.escapeHtml(projectData.description || 'Без описания')}</p>
                <div class="project-meta">
                    <span class="project-badge ${projectData.is_private ? 'badge-private' : 'badge-public'}">
                        ${projectData.is_private ? 'Приватный' : 'Публичный'}
                    </span>
                    <span class="project-badge badge-role">
                        ${this.getRoleText(userRole)}
                    </span>
                    ${projectData.requires_approval ? '<span class="project-badge badge-approval">Требует одобрения</span>' : ''}
                </div>
                <div class="project-stats">
                    <span>👥 ${stats.members_count || 0}</span>
                    <span>✅ ${doneTasks}/${totalTasks}</span>
                </div>
                <div class="project-progress">
                    <div class="progress-info">
                        <span>Прогресс:</span>
                        <span>${Math.round(progress)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    static getEmptyProjectsState() {
        return `
        <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <h3>Проектов пока нет</h3>
            <p>Создайте первый проект чтобы начать работу</p>
            <button class="btn btn-primary" onclick="App.showCreateProjectModal()">
                Создать проект
            </button>
        </div>`;
    }

    static updateStats(projects, recentTasks) {
        document.getElementById('projectsCount').textContent = projects.length;
        const totalTasks = projects.reduce((sum, project) => {
            const projectData = project.project || project;
            const stats = project.stats || projectData.stats || {};
            return sum + (stats.tasks_count || stats.tasksCount || 0);
        }, 0);
        document.getElementById('tasksCount').textContent = totalTasks;
        document.getElementById('recentTasksCount').textContent = recentTasks ? recentTasks.length : 0;
    }

    static renderRecentTasks(tasks) {
        const container = document.getElementById('recentTasksList');
        if (!tasks || tasks.length === 0) {
            container.innerHTML = '<p>Нет недавних задач</p>';
            return;
        }

        container.innerHTML = tasks.map(task => {
            const projectTitle = task.project_title || (task.project && task.project.title) || 'N/A';
            return `
            <div class="task-card" onclick="App.openTask(${task.id})">
                <div class="task-card-header">
                    <h4 class="task-card-title">${this.escapeHtml(task.title)}</h4>
                    <span class="task-card-status ${task.status}">${this.getStatusText(task.status)}</span>
                </div>
                <p class="task-card-priority">Приоритет: ${this.getPriorityText(task.priority)}</p>
                <p class="task-card-due-date">Срок: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Не указан'}</p>
                <div class="task-card-footer">
                    <span>Проект: ${this.escapeHtml(projectTitle)}</span>
                </div>
                <div class="task-card-actions">
                    <button class="quick-action-btn quick-action-edit" onclick="event.stopPropagation(); App.showEditTaskModal(${task.id})">✏️</button>
                    <button class="quick-action-btn quick-action-complete" onclick="event.stopPropagation(); App.completeTask(${task.id})">✓</button>
                </div>
            </div>`;
        }).join('');
    }

    // ==================== УВЕДОМЛЕНИЯ ====================

    static async showEnhancedNotifications() {
        try {
            const response = await ApiService.getNotifications();
            const notifications = response.notifications || [];
            const container = document.getElementById('notificationsList');

            if (!notifications || notifications.length === 0) {
                container.innerHTML = '<p>Уведомлений нет</p>';
                return;
            }

            let html = `
            <div class="notifications-actions">
                <h3>Уведомления</h3>
                <button class="btn btn-primary" onclick="App.markAllNotificationsRead()">
                    Прочитать всё
                </button>
            </div>`;

            html += notifications.map(notification => {
                const isRead = notification.is_read || false;
                return `
                <div class="notification-item ${isRead ? 'notification-read' : 'notification-unread'}">
                    <div class="notification-content">
                        ${this.escapeHtml(notification.content)}
                    </div>
                    <div class="notification-meta">
                        <span class="notification-date">
                            ${new Date(notification.created_at).toLocaleString()}
                        </span>
                        ${!isRead ? '<span class="notification-badge">Новое</span>' : ''}
                    </div>
                </div>`;
            }).join('');

            container.innerHTML = html;
            this.showView('notificationsView');
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.showError('Ошибка загрузки уведомлений');
        }
    }

    static async markAllNotificationsRead() {
        try {
            await ApiService.markAllNotificationsRead();
            this.showSuccess('Все уведомления отмечены как прочитанные');
            this.showEnhancedNotifications();
        } catch (error) {
            console.error('Error marking notifications as read:', error);
            this.showError('Ошибка отметки уведомлений');
        }
    }

    // ==================== ПОИСК ПРОЕКТОВ ====================

    static showSearchProjects() {
        this.showView('searchProjectsView');
        document.getElementById('searchProjectsInput').value = '';
        this.loadRecentPublicProjects();
    }

    static async loadRecentPublicProjects() {
        try {
            const response = await ApiService.searchPublicProjects();
            const projects = response.projects || [];
            const title = 'Недавние публичные проекты';
            this.renderEnhancedSearchResults(projects, title);
        } catch (error) {
            console.error('Error loading recent public projects:', error);
        }
    }

    static async enhancedSearchProjects() {
        const searchTerm = document.getElementById('searchProjectsInput').value.trim();
        try {
            if (!searchTerm) {
                await this.loadRecentPublicProjects();
                return;
            }

            // Поиск по хэшу (точное совпадение)
            if (/^[a-zA-Z0-9]{6,}$/.test(searchTerm)) {
                try {
                    const response = await ApiService.getProjectByHashExact(searchTerm);
                    if (response.project) {
                        this.renderEnhancedSearchResults([response.project], `Проект по хэшу: "${searchTerm}"`);
                        return;
                    }
                } catch (error) {
                    console.log('Project not found by hash, trying by name...');
                }
            }

            // Поиск по названию
            const response = await ApiService.searchPublicProjects(searchTerm);
            const projects = response.projects || [];
            const title = `Результаты поиска: "${searchTerm}"`;
            this.renderEnhancedSearchResults(projects, title);
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Ошибка поиска: ' + error.message);
        }
    }

    static renderEnhancedSearchResults(projects, title) {
        const container = document.getElementById('searchResultsList');
        if (!projects || projects.length === 0) {
            container.innerHTML = this.getEmptySearchState();
            return;
        }

        let html = `<h3>${title}</h3>`;
        html += projects.map(project => {
            const stats = project.stats || {};
            const isMember = project.is_member || false;
            const canJoin = !isMember && (!project.is_private || project.requires_approval);

            return `
            <div class="search-result-preview">
                <div class="preview-header">
                    <h4>${this.escapeHtml(project.title)}</h4>
                    <span class="project-type-badge">${project.is_private ? '🔒' : '🌐'}</span>
                </div>
                <p class="project-description">${this.escapeHtml(project.description || 'Без описания')}</p>
                <div class="preview-meta">
                    <span class="project-badge ${project.is_private ? 'badge-private' : 'badge-public'}">
                        ${project.is_private ? 'Приватный' : 'Публичный'}
                    </span>
                    ${project.requires_approval ? '<span class="project-badge badge-approval">Требует одобрения</span>' : ''}
                    <span class="project-badge">Участников: ${stats.members_count || 0}</span>
                    <span class="project-badge">Задач: ${stats.tasks_count || 0}</span>
                </div>
                <div class="preview-actions">
                    ${canJoin ? `
                        <button class="btn ${project.is_private ? 'btn-warning' : 'btn-primary'}"
                                onclick="App.handleJoinProject('${project.hash}')">
                            ${project.is_private ? 'Подать заявку' : 'Присоединиться'}
                        </button>
                    ` : ''}
                    <button class="btn btn-outline"
                            onclick="App.openProjectPreview('${project.hash}')">
                        Подробнее
                    </button>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = html;
    }

    static getEmptySearchState() {
        return `
        <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <h3>Проекты не найдены</h3>
            <p>Попробуйте изменить поисковый запрос или создать новый проект</p>
        </div>`;
    }

    static async handleJoinProject(projectHash) {
        try {
            console.log('Joining project:', projectHash);
            const response = await ApiService.joinProject(projectHash);

            if (response.status === 'joined') {
                this.showSuccess('Вы успешно присоединились к проекту!');
                await this.openProject(projectHash);
            } else if (response.status === 'pending_approval') {
                this.showSuccess('Заявка на вступление отправлена! Ожидайте одобрения.');
                this.showDashboard();
            } else {
                this.showError('Неизвестный статус ответа: ' + response.status);
            }
        } catch (error) {
            console.error('Error joining project:', error);
            if (error.message.includes('400') && error.message.includes('already a member')) {
                this.showError('Вы уже являетесь участником этого проекта');
                await this.openProject(projectHash);
            } else if (error.message.includes('400') && error.message.includes('already pending')) {
                this.showError('Заявка на вступление уже отправлена');
            } else if (error.message.includes('403')) {
                this.showError('Доступ к проекту запрещен');
            } else if (error.message.includes('404')) {
                this.showError('Проект не найден');
            } else {
                this.showError('Ошибка вступления в проект: ' + error.message);
            }
        }
    }

    static async openProjectPreview(projectHash) {
        try {
            const response = await ApiService.getProjectByHashExact(projectHash);
            const project = response.project;
            this.showProjectPreviewModal(project, response);
        } catch (error) {
            console.error('Error opening project preview:', error);
            this.showError('Ошибка загрузки информации о проекте: ' + error.message);
        }
    }

    static showProjectPreviewModal(project, projectData) {
        const content = `
            <h4>${this.escapeHtml(project.title)}</h4>
            <p><strong>Описание:</strong> ${this.escapeHtml(project.description || 'Без описания')}</p>
            <p><strong>Тип:</strong> ${project.is_private ? '🔒 Приватный' : '🌐 Публичный'}</p>
            <p><strong>Одобрение:</strong> ${project.requires_approval ? 'Требуется' : 'Не требуется'}</p>
            ${project.owner ? `<p><strong>Владелец:</strong> ${this.escapeHtml(project.owner.full_name)}</p>` : ''}
            <p><strong>Создан:</strong> ${new Date(project.created_at).toLocaleDateString()}</p>
        `;
        this.showModalContent('Информация о проекте', content);
    }

    // ==================== НАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ ====================

    static async loadUserSettings() {
        try {
            // Загрузка данных профиля
            const userData = await ApiService.getCurrentUser();
            const preferences = await ApiService.getUserPreferences();

            // Заполнение формы
            document.getElementById('userFullName').value = userData.full_name || '';
            document.getElementById('userIdDisplay').textContent = userData.id || '-';
            document.getElementById('userRegisteredDisplay').textContent =
                userData.created_at ? new Date(userData.created_at).toLocaleDateString() : '-';

            // Настройки темы
            document.getElementById('themeSelect').value = preferences.theme || 'auto';
            document.getElementById('notificationsEnabled').checked =
                preferences.notifications_enabled !== false;

            // Загрузка IP адреса
            await this.loadUserIp();

            // Расчет использования памяти
            this.calculateStorageUsage();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    static async loadUserIp() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            document.getElementById('userIpDisplay').textContent = data.ip;
        } catch (error) {
            document.getElementById('userIpDisplay').textContent = 'Не доступен';
        }
    }

    static calculateStorageUsage() {
        let totalSize = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalSize += localStorage[key].length * 2; // UTF-16 chars are 2 bytes
            }
        }
        const usedKB = Math.round(totalSize / 1024);
        document.getElementById('storageUsed').textContent = `${usedKB} KB`;
    }

    static async saveUserSettings() {
        try {
            const fullName = document.getElementById('userFullName').value.trim();
            const theme = document.getElementById('themeSelect').value;
            const notificationsEnabled = document.getElementById('notificationsEnabled').checked;

            // Обновление данных пользователя
            if (fullName) {
                await ApiService.updateCurrentUser({ full_name: fullName });
            }

            // Обновление настроек
            await ApiService.updateUserPreferences({
                theme: theme,
                notifications_enabled: notificationsEnabled
            });

            // Применение темы
            if (theme === 'auto') {
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', theme);
            }

            this.showSuccess('Настройки сохранены');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showError('Ошибка сохранения настроек');
        }
    }

    // ==================== УПРАВЛЕНИЕ ЗАДАЧАМИ С ФИЛЬТРАЦИЕЙ ====================

    static async loadEnhancedMyTasks() {
        try {
            const statusFilter = document.getElementById('tasksFilterStatus').value;
            const priorityFilter = document.getElementById('tasksFilterPriority').value;
            const assignmentFilter = document.getElementById('tasksFilterAssignment').value;
            const sortBy = document.getElementById('tasksSortBy').value;

            const filters = {};
            if (statusFilter) filters.status = statusFilter;
            if (priorityFilter) filters.priority = priorityFilter;
            if (assignmentFilter) filters.assignment = assignmentFilter;

            const response = await ApiService.getUserTasks(filters);
            let tasks = response.tasks || [];

            // Сортировка
            tasks = this.sortTasks(tasks, sortBy);
            this.renderEnhancedTaskList(tasks);
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showError('Ошибка загрузки задач');
        }
    }

    static sortTasks(tasks, sortBy) {
        return tasks.sort((a, b) => {
            switch (sortBy) {
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'created_at':
                    return new Date(b.created_at) - new Date(a.created_at);
                case 'due_date':
                    if (!a.due_date) return 1;
                    if (!b.due_date) return -1;
                    return new Date(a.due_date) - new Date(b.due_date);
                case 'priority':
                    const priorityOrder = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                default:
                    return 0;
            }
        });
    }

    static renderEnhancedTaskList(tasks) {
        const container = document.getElementById('myTasksList');
        if (!tasks || tasks.length === 0) {
            container.innerHTML = this.getEmptyTasksState();
            return;
        }

        container.innerHTML = tasks.map(task => {
            const projectTitle = task.project_title || (task.project && task.project.title) || 'N/A';
            const isAssignedToMe = task.assigned_to_id === currentUser.id;
            const isCreatedByMe = task.created_by_id === currentUser.id;

            return `
            <div class="task-card task-card-enhanced" onclick="App.openTask(${task.id})">
                <div class="task-card-header">
                    <h4 class="task-card-title">${this.escapeHtml(task.title)}</h4>
                    <select class="status-select" onchange="App.updateTaskStatus(${task.id}, this.value)"
                            onclick="event.stopPropagation()">
                        <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>К выполнению</option>
                        <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>В работе</option>
                        <option value="done" ${task.status === 'done' ? 'selected' : ''}>Выполнено</option>
                    </select>
                </div>
                <p class="task-card-priority">
                    <strong>Приоритет:</strong> ${this.getPriorityText(task.priority)}
                    ${task.priority === 'urgent' ? '🚨' : task.priority === 'high' ? '⚠️' : ''}
                </p>
                <p class="task-card-due-date ${this.isOverdue(task.due_date) ? 'overdue' : ''}">
                    <strong>Срок:</strong> ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Не указан'}
                </p>
                <div class="task-card-footer">
                    <span><strong>Исполнитель:</strong> ${task.assigned_to_name || 'Не назначен'}</span>
                    <span><strong>Проект:</strong> ${this.escapeHtml(projectTitle)}</span>
                </div>
                <div class="task-actions-inline">
                    ${this.canEditTask(task) ? `
                        <button class="btn btn-sm btn-outline"
                                onclick="event.stopPropagation(); App.showEditTaskModal(${task.id})">
                            Редактировать
                        </button>
                    ` : ''}
                    ${this.canDeleteTask(task) ? `
                        <button class="btn btn-sm btn-danger"
                                onclick="event.stopPropagation(); App.showDeleteTaskModal(${task.id})">
                            Удалить
                        </button>
                    ` : ''}
                </div>
            </div>`;
        }).join('');
    }

    static getEmptyTasksState() {
        return `
        <div class="empty-state">
            <div class="empty-state-icon">✅</div>
            <h3>Задач нет</h3>
            <p>Создайте первую задачу или дождитесь назначения</p>
        </div>`;
    }

    // ==================== ПРОВЕРКИ ПРАВ ДОСТУПА ====================

    static canEditProject(project) {
        if (!project || !currentUser) return false;
        return project.owner_id === currentUser.id ||
               project.current_user_role === 'admin';
    }

    static canEditTask(task) {
        if (!task || !currentUser) return false;
        return task.created_by_id === currentUser.id ||
               task.assigned_to_id === currentUser.id ||
               (currentProject && this.canEditProject(currentProject));
    }

    static canDeleteTask(task) {
        return this.canEditTask(task); // Те же права что и для редактирования
    }

    static canCreateSubtask(task) {
        if (!task || !currentUser) return false;
        return task.created_by_id === currentUser.id ||
               task.assigned_to_id === currentUser.id ||
               (currentProject && this.canEditProject(currentProject));
    }

    // ==================== ИЕРАРХИЧЕСКИЕ ПОДЗАДАЧИ ====================

    static async loadHierarchicalSubtasks(parentTaskId, level = 0, container = null) {
        try {
            if (!currentProject || !currentProject.hash) {
                console.error('No current project for loading subtasks');
                document.getElementById('subtasksList').innerHTML = '<p>Ошибка загрузки подзадач</p>';
                return;
            }

            const response = await ApiService.getTasks(currentProject.hash);
            const tasks = response.tasks || [];
            const subtasks = tasks.filter(task => task.parent_task_id === parentTaskId);

            const targetContainer = container || document.getElementById('subtasksList');

            if (subtasks.length === 0 && level === 0) {
                targetContainer.innerHTML = '<p>Подзадач нет</p>';
                return;
            }

            let html = '';
            subtasks.forEach(subtask => {
                const hasChildren = tasks.some(t => t.parent_task_id === subtask.id);
                const canEdit = this.canEditTask(subtask);

                html += `
                <div class="subtask-level" data-level="${level}">
                    <div class="subtask-item">
                        <div class="subtask-checkbox ${subtask.status === 'done' ? 'checked' : ''}"
                             onclick="event.stopPropagation(); App.toggleSubtaskStatus(${subtask.id}, ${subtask.status !== 'done'})">
                            ${subtask.status === 'done' ? '✓' : ''}
                        </div>
                        <div class="subtask-content">
                            <div class="subtask-title">${this.escapeHtml(subtask.title)}</div>
                            <div class="subtask-meta">
                                ${this.getStatusText(subtask.status)} •
                                ${this.getPriorityText(subtask.priority)} •
                                ${subtask.due_date ? new Date(subtask.due_date).toLocaleDateString() : 'Без срока'}
                            </div>
                        </div>
                        <div class="subtask-actions">
                            ${canEdit ? `
                                <button class="btn btn-sm btn-outline"
                                        onclick="App.showCreateSubtaskModalForTask(${subtask.id})">
                                    +
                                </button>
                                <button class="btn btn-sm btn-outline"
                                        onclick="App.showEditTaskModal(${subtask.id})">
                                    ✏️
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    ${hasChildren ? '<div class="subtask-children"></div>' : ''}
                </div>`;

                // Рекурсивная загрузка дочерних подзадач
                if (hasChildren) {
                    const childrenContainer = document.createElement('div');
                    childrenContainer.className = 'subtask-children';
                    this.loadHierarchicalSubtasks(subtask.id, level + 1, childrenContainer);
                    // Добавляем после создания элемента
                    setTimeout(() => {
                        const parentElement = targetContainer.querySelector(`[data-level="${level}"]:last-child`);
                        if (parentElement) {
                            parentElement.appendChild(childrenContainer);
                        }
                    }, 0);
                }
            });

            if (level === 0) {
                targetContainer.innerHTML = html;
            } else {
                container.innerHTML = html;
            }
        } catch (error) {
            console.error('Error loading hierarchical subtasks:', error);
        }
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    static isOverdue(dueDate) {
        if (!dueDate) return false;
        return new Date(dueDate) < new Date();
    }

    static changeAvatar() {
        // Простая реализация смены аватара
        const avatars = ['👤', '👨‍💼', '👩‍💼', '🦸', '🦹', '🧙', '🧚', '🧛'];
        const currentAvatar = document.getElementById('userAvatar');
        const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];
        currentAvatar.textContent = randomAvatar;
        this.showSuccess('Аватар изменен');
    }

    static clearCache() {
        localStorage.clear();
        this.calculateStorageUsage();
        this.showSuccess('Кэш очищен');
    }

    static exportData() {
        const data = {
            user: currentUser,
            projects: [], // Можно добавить экспорт проектов
            exportDate: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project-pilot-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ==================== ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ И ДРУГИЕ СТРАНИЦЫ ====================

    static showPrivacyPolicy() {
        const content = `
        <h3>Политика конфиденциальности</h3>
        <p>Мы серьезно относимся к защите ваших данных...</p>
        <!-- Добавьте полный текст политики -->
        `;
        this.showModalContent('Политика конфиденциальности', content);
    }

    static showTermsOfService() {
        const content = `
        <h3>Условия использования</h3>
        <p>Используя наше приложение, вы соглашаетесь с следующими условиями...</p>
        <!-- Добавьте полный текст условий -->
        `;
        this.showModalContent('Условия использования', content);
    }

    static showFAQ() {
        const content = `
        <h3>Часто задаваемые вопросы</h3>
        <div class="faq-item">
            <h4>Как создать проект?</h4>
            <p>Нажмите кнопку "Создать проект" на главной странице...</p>
        </div>
        <!-- Добавьте другие вопросы -->
        `;
        this.showModalContent('FAQ', content);
    }

    static showModalContent(title, content) {
        const modal = document.getElementById('infoModal') || this.createInfoModal();
        modal.querySelector('.modal-title').textContent = title;
        modal.querySelector('.modal-body').innerHTML = content;
        modal.classList.add('active');
    }

    static createInfoModal() {
        const modal = document.createElement('div');
        modal.id = 'infoModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title"></h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').classList.remove('active')">×</button>
                </div>
                <div class="modal-body"></div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="this.closest('.modal-overlay').classList.remove('active')">Закрыть</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    // ==================== СУЩЕСТВУЮЩИЕ МЕТОДЫ (сохранены для совместимости) ====================

    static showView(viewId) {
        document.querySelectorAll('.view').forEach(view => {
            view.style.display = 'none';
        });
        document.getElementById(viewId).style.display = 'block';
    }

    static showMyTasks() {
        this.showView('myTasksView');
        this.loadEnhancedMyTasks();
    }

    static showSettings() {
        this.showView('settingsView');
        this.loadUserSettings();
    }

    static getStatusText(status) {
        const statusMap = {
            'todo': 'К выполнению',
            'in_progress': 'В работе',
            'done': 'Выполнено'
        };
        return statusMap[status] || status;
    }

    static getPriorityText(priority) {
        const priorityMap = {
            'low': 'Низкий',
            'medium': 'Средний',
            'high': 'Высокий',
            'urgent': 'Срочный'
        };
        return priorityMap[priority] || priority;
    }

    static getRoleText(role) {
        const roleMap = {
            'owner': 'Владелец',
            'admin': 'Администратор',
            'member': 'Участник',
            'guest': 'Гость'
        };
        return roleMap[role] || role;
    }

    static escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }

    static hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    static showSuccess(message) {
        console.log('Success:', message);
        alert(message);
    }

    static showError(message) {
        console.error('Error:', message);
        alert('Ошибка: ' + message);
    }

    static backToPreviousView() {
        const currentView = document.querySelector('.view[style*="display: block"]');
        if (currentView && currentView.id !== 'dashboardView') {
            currentView.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                this.showDashboard();
                document.getElementById('dashboardView').style.animation = 'slideInLeft 0.3s ease-out';
            }, 150);
        }
    }

    // Project methods
    static async openProject(projectHash) {
        try {
            console.log('Opening project:', projectHash);
            const projectData = await ApiService.getProject(projectHash);

            currentProject = projectData.project || projectData;
            currentProject.members = projectData.members || [];

            console.log('Opened project:', currentProject);

            // Update project view
            document.getElementById('projectTitleHeader').textContent = currentProject.title;
            document.getElementById('projectDescriptionText').textContent = currentProject.description || 'Без описания';
            document.getElementById('projectHashValue').textContent = currentProject.hash;
            document.getElementById('projectHashInfo').style.display = 'block';

            // Update stats
            document.getElementById('projectMembersCount').textContent = currentProject.members.length;

            const tasksResponse = await ApiService.getTasks(currentProject.hash);
            const tasks = tasksResponse.tasks || [];
            const totalTasks = tasks.length;
            const doneTasks = tasks.filter(t => t.status === 'done').length;
            const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;

            document.getElementById('projectTotalTasks').textContent = totalTasks;
            document.getElementById('projectDoneTasks').textContent = doneTasks;
            document.getElementById('projectInProgressTasks').textContent = inProgressTasks;

            // Load tasks and members (с обработкой ошибок)
            await this.loadProjectTasks(currentProject.hash);

            try {
                await this.loadProjectMembers(currentProject.hash);
            } catch (memberError) {
                console.error('Failed to load members, but continuing:', memberError);
                // Можно показать уведомление, но не блокировать весь процесс
            }

            // Switch view
            this.showView('projectView');
        } catch (error) {
            console.error('Error opening project:', error);
            this.showError('Ошибка открытия проекта: ' + error.message);
        }
    }

    static async loadProjectTasks(projectHash) {
        try {
            const response = await ApiService.getTasks(projectHash);
            const tasks = response.tasks || [];
            const container = document.getElementById('projectTasksList');

            if (!tasks || tasks.length === 0) {
                container.innerHTML = '<p>Задач нет</p>';
                return;
            }

            // Show only main tasks (without parent_task_id)
            const mainTasks = tasks.filter(task => task.parent_task_id === null);
            container.innerHTML = mainTasks.map(task => {
                const taskClass = `task-card ${task.status === 'done' ? 'completed' : ''}`;
                return `
                <div class="${taskClass}" onclick="App.openTask(${task.id})">
                    <div class="task-card-header">
                        <h4 class="task-card-title">${this.escapeHtml(task.title)}</h4>
                        <span class="task-card-status ${task.status}">${this.getStatusText(task.status)}</span>
                    </div>
                    <p class="task-card-priority">Приоритет: ${this.getPriorityText(task.priority)}</p>
                    <p class="task-card-due-date">Срок: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Не указан'}</p>
                    <div class="task-card-footer">
                        <span>Исполнитель: ${task.assigned_to_name || 'Не назначен'}</span>
                    </div>
                    <div class="task-card-actions">
                        <button class="quick-action-btn quick-action-edit" onclick="event.stopPropagation(); App.showEditTaskModal(${task.id})">✏️</button>
                        <button class="quick-action-btn quick-action-complete" onclick="event.stopPropagation(); App.completeTask(${task.id})">✓</button>
                    </div>
                </div>`;
            }).join('');

        } catch (error) {
            console.error('Error loading project tasks:', error);
            this.showError('Ошибка загрузки задач проекта: ' + error.message);
        }
    }

    static async loadProjectMembers(projectHash) {
        try {
            const response = await ApiService.getProjectMembers(projectHash);
            const members = response.members || [];
            const container = document.getElementById('projectMembersList');

            if (!members || members.length === 0) {
                container.innerHTML = '<p>Участников нет</p>';
                return;
            }

            container.innerHTML = members.map(member => {
                const memberData = member.user || member;
                const displayName = (memberData.full_name && memberData.full_name.trim() !== '')
                    ? memberData.full_name
                    : (member.full_name && member.full_name.trim() !== '')
                        ? member.full_name
                        : `Участник #${member.user_id || memberData.id}`;
                const isCurrentUser = (member.user_id || memberData.id) === currentUser.id;
                const isOwnerMember = member.role === ProjectRole.OWNER;
                const isAdminMember = member.role === ProjectRole.ADMIN;

                // Определяем доступные действия
                let canChangeRole = false;
                let canRemoveMember = false;

                if (currentUser.id === currentProject.owner_id) {
                    canChangeRole = !isCurrentUser && !isOwnerMember;
                    canRemoveMember = !isCurrentUser && !isOwnerMember;
                } else if (currentUser.role === ProjectRole.ADMIN) {
                    canChangeRole = !isCurrentUser && !isOwnerMember && !isAdminMember;
                    canRemoveMember = !isCurrentUser && !isOwnerMember && !isAdminMember;
                }

                return `
                <div class="member-item">
                    <span class="member-name">${this.escapeHtml(displayName)}</span>
                    <span class="member-role">${this.getRoleText(member.role)}</span>
                    ${canChangeRole ? `<select class="role-select" onchange="App.updateMemberRole(${member.user_id || memberData.id}, this.value)">
                        <option value="member" ${member.role === 'member' ? 'selected' : ''}>Участник</option>
                        <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Администратор</option>
                    </select>` : ''}
                    ${canRemoveMember ? `<button class="btn btn-danger btn-sm" onclick="App.removeMember(${member.user_id || memberData.id})">Удалить</button>` : ''}
                </div>`;
            }).join('');

        } catch (error) {
            console.error('Error loading project members:', error);
            // Более мягкая обработка ошибки - не показываем alert для этой не критичной функции
            const container = document.getElementById('projectMembersList');
            container.innerHTML = '<p>Не удалось загрузить список участников</p>';
        }
    }

    static backToProject() {
        console.log('Back to project, currentProject:', currentProject);
        if (currentProject && currentProject.hash) {
            this.openProject(currentProject.hash);
        } else {
            console.log('No current project, showing dashboard');
            this.showDashboard();
        }
    }

    // Task methods
    static async openTask(taskId) {
        try {
            const response = await ApiService.getTask(taskId);
            currentTask = response.task || response;

            console.log('Current task set to:', currentTask);
            if (!currentTask) {
                this.showError('Задача не найдена');
                return;
            }

            // Update task view
            document.getElementById('taskTitleHeader').textContent = currentTask.title;
            document.getElementById('taskDescriptionText').textContent = currentTask.description || 'Без описания';
            document.getElementById('taskPriorityText').textContent = this.getPriorityText(currentTask.priority);
            document.getElementById('taskStatusSelect').value = currentTask.status; // Устанавливаем статус
            document.getElementById('taskCreatedAtText').textContent = new Date(currentTask.created_at).toLocaleString();
            document.getElementById('taskDueDateText').textContent = currentTask.due_date ? new Date(currentTask.due_date).toLocaleDateString() : 'Не установлен';

            // --- Загрузка информации об исполнителе из index.txt ---
            if (currentTask.assigned_to_id) {
                if (currentTask.assigned_user) {
                    const displayName = currentTask.assigned_user.full_name || currentTask.assigned_user.username || `Участник #${currentTask.assigned_to_id}`;
                    document.getElementById('taskAssignedToText').textContent = displayName;
                } else {
                    await this.loadTaskAssigneeInfo(currentTask.assigned_to_id);
                }
            } else {
                document.getElementById('taskAssignedToText').textContent = 'Не назначена';
            }

            // Show/hide create subtask button based on permissions or task type
            const createSubtaskBtn = document.getElementById('createSubtaskBtn');
            const subtasksSection = document.getElementById('subtasksSection');
            if (currentTask.parent_task_id === null) {
                subtasksSection.style.display = 'block';
                createSubtaskBtn.style.display = 'inline-block';
                await this.loadSubtasks(taskId);
            } else {
                subtasksSection.style.display = 'none';
                createSubtaskBtn.style.display = 'none';
            }

            // Load comments
            await this.loadTaskComments(taskId);

            // Switch view
            this.showView('taskView');
        } catch (error) {
            console.error('Error opening task:', error);
            this.showError('Ошибка открытия задачи: ' + error.message);
        }
    }

    static async loadTaskAssigneeInfo(assigneeId) {
        try {
            console.log('Loading assignee info for:', assigneeId);
            // Если у нас есть данные о проекте и участниках, ищем исполнителя среди участников
            if (currentProject && currentProject.members) {
                console.log('Searching in project members:', currentProject.members);
                const assignee = currentProject.members.find(member => {
                    const memberId = member.user_id || (member.user && member.user.id);
                    console.log('Checking member:', memberId, 'against assignee:', assigneeId);
                    return memberId === assigneeId;
                });
                if (assignee) {
                    console.log('Found assignee in members:', assignee);
                    const displayName = (assignee.user && assignee.user.full_name) || assignee.full_name || `Участник #${assigneeId}`;
                    document.getElementById('taskAssignedToText').textContent = displayName;
                    return;
                }
            }
            // Если не нашли в участниках, попробуем загрузить участников проекта
            const response = await ApiService.getProjectMembers(currentProject.hash);
            const members = response.members || [];
            const assignee = members.find(member => (member.user_id || (member.user && member.user.id)) === assigneeId);
            if (assignee) {
                const displayName = (assignee.user && assignee.user.full_name) || assignee.full_name || `Участник #${assigneeId}`;
                document.getElementById('taskAssignedToText').textContent = displayName;
                return;
            }
            // Если не нашли, оставляем ID
            document.getElementById('taskAssignedToText').textContent = `Участник #${assigneeId}`;
        } catch (error) {
            console.error('Error loading assignee info:', error);
            document.getElementById('taskAssignedToText').textContent = `Участник #${assigneeId}`;
        }
    }

    static async loadTaskComments(taskId) {
        try {
            const response = await ApiService.getTaskComments(taskId);
            const comments = response.comments || [];
            const container = document.getElementById('taskCommentsList');

            if (!comments || comments.length === 0) {
                container.innerHTML = '<p>Комментариев нет</p>';
                return;
            }

            container.innerHTML = comments.map(comment => {
                return `
                <div class="comment-item">
                    <div class="comment-header">
                        <strong>${this.escapeHtml(comment.author_name)}</strong>
                        <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                    <p class="comment-text">${this.escapeHtml(comment.content)}</p>
                </div>`;
            }).join('');
        } catch (error) {
            console.error('Error loading comments:', error);
            // Don't show error for comments as it's not critical
        }
    }

    static async addComment() {
        if (!currentTask || !currentTask.id) {
            console.error('No current task for comment:', currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        const content = document.getElementById('newCommentText').value.trim();
        if (!content) {
            this.showError('Введите текст комментария');
            return;
        }

        try {
            await ApiService.createTaskComment(currentTask.id, content);
            document.getElementById('newCommentText').value = '';
            await this.loadTaskComments(currentTask.id);
            this.showSuccess('Комментарий добавлен!');
        } catch (error) {
            console.error('Error adding comment:', error);
            this.showError('Ошибка добавления комментария: ' + error.message);
        }
    }

    static async loadMyTasks() {
        try {
            const statusFilter = document.getElementById('tasksFilterStatus').value;
            const projectFilter = document.getElementById('tasksFilterProject').value;

            const filters = {};
            if (statusFilter) filters.status = statusFilter;
            if (projectFilter) filters.project_hash = projectFilter;

            const response = await ApiService.getUserTasks(filters);
            const tasks = response.tasks || [];
            const container = document.getElementById('myTasksList');

            if (!tasks || tasks.length === 0) {
                container.innerHTML = '<p>Задач нет</p>';
                return;
            }

            // Разделяем задачи на назначенные и созданные
            const assignedTasks = tasks.filter(task => task.assigned_to_id === currentUser.id);
            const createdTasks = tasks.filter(task => task.created_by_id === currentUser.id && task.assigned_to_id !== currentUser.id);

            let html = '';

            if (assignedTasks.length > 0) {
                html += '<h4>Назначенные мне</h4>';
                html += assignedTasks.map(task => {
                    const projectTitle = task.project_title || (task.project && task.project.title) || 'N/A';
                    return `
                    <div class="task-card" onclick="App.openTask(${task.id})">
                        <div class="task-card-header">
                            <h4 class="task-card-title">${this.escapeHtml(task.title)}</h4>
                            <span class="task-card-status ${task.status}">${this.getStatusText(task.status)}</span>
                        </div>
                        <p class="task-card-priority">Приоритет: ${this.getPriorityText(task.priority)}</p>
                        <p class="task-card-due-date">Срок: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Не указан'}</p>
                        <div class="task-card-footer">
                            <span>Проект: ${this.escapeHtml(projectTitle)}</span>
                        </div>
                        <div class="task-card-actions">
                            <button class="quick-action-btn quick-action-edit" onclick="event.stopPropagation(); App.showEditTaskModal(${task.id})">✏️</button>
                            <button class="quick-action-btn quick-action-complete" onclick="event.stopPropagation(); App.completeTask(${task.id})">✓</button>
                        </div>
                    </div>`;
                }).join('');
            }

            if (createdTasks.length > 0) {
                if (assignedTasks.length > 0) html += '<h4 style="margin-top: var(--space-6);">Созданные мной</h4>';
                else html += '<h4>Созданные мной</h4>';

                html += createdTasks.map(task => {
                    return `
                    <div class="task-card" onclick="App.openTask(${task.id})">
                        <div class="task-card-header">
                            <h4 class="task-card-title">${this.escapeHtml(task.title)}</h4>
                            <span class="task-card-status ${task.status}">${this.getStatusText(task.status)}</span>
                        </div>
                        <p class="task-card-priority">Приоритет: ${this.getPriorityText(task.priority)}</p>
                        <p class="task-card-due-date">Срок: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Не указан'}</p>
                        <div class="task-card-footer">
                            <span>Исполнитель: ${task.assigned_to_name || 'Не назначен'}</span>
                        </div>
                        <div class="task-card-actions">
                            <button class="quick-action-btn quick-action-edit" onclick="event.stopPropagation(); App.showEditTaskModal(${task.id})">✏️</button>
                            <button class="quick-action-btn quick-action-complete" onclick="event.stopPropagation(); App.completeTask(${task.id})">✓</button>
                        </div>
                    </div>`;
                }).join('');
            }

            container.innerHTML = html;
        } catch (error) {
            console.error('Error loading my tasks:', error);
            this.showError('Ошибка загрузки моих задач: ' + error.message);
        }
    }

    // Project management methods
    static showCreateProjectModal() {
        document.getElementById('createProjectForm').reset();
        this.showModal('createProjectModal');
    }

    static async handleCreateProject() {
        const title = document.getElementById('projectTitle').value.trim();
        const description = document.getElementById('projectDescription').value.trim();
        const isPrivate = document.getElementById('projectIsPrivate').checked;
        const requiresApproval = document.getElementById('projectRequiresApproval').checked;

        if (!title) {
            this.showError('Введите название проекта');
            return;
        }

        try {
            console.log('Creating project:', { title, description, isPrivate, requiresApproval });
            await ApiService.createProject({
                title,
                description,
                is_private: isPrivate,
                requires_approval: requiresApproval
            });

            this.hideModal('createProjectModal');
            document.getElementById('createProjectForm').reset();
            await this.loadData(); // Reload dashboard
            this.showSuccess('Проект создан успешно!');
        } catch (error) {
            console.error('Error creating project:', error);
            this.showError('Ошибка создания проекта: ' + error.message);
        }
    }

    static showEditProjectModal() {
        if (!currentProject) return;
        document.getElementById('editProjectTitle').value = currentProject.title;
        document.getElementById('editProjectDescription').value = currentProject.description || '';
        document.getElementById('editProjectIsPrivate').checked = currentProject.is_private;
        document.getElementById('editProjectRequiresApproval').checked = currentProject.requires_approval;

        this.showModal('editProjectModal');
    }

    static async handleUpdateProject() {
        if (!currentProject) return;
        const title = document.getElementById('editProjectTitle').value.trim();
        const description = document.getElementById('editProjectDescription').value.trim();
        const isPrivate = document.getElementById('editProjectIsPrivate').checked;
        const requiresApproval = document.getElementById('editProjectRequiresApproval').checked;

        if (!title) {
            this.showError('Введите название проекта');
            return;
        }

        try {
            await ApiService.updateProject(currentProject.hash, {
                title,
                description,
                is_private: isPrivate,
                requires_approval: requiresApproval
            });

            this.hideModal('editProjectModal');
            await this.openProject(currentProject.hash); // Перезагружаем проект
            this.showSuccess('Проект обновлен успешно!');
        } catch (error) {
            console.error('Error updating project:', error);
            this.showError('Ошибка обновления проекта: ' + error.message);
        }
    }

    static showDeleteProjectModal() {
        if (!currentProject) return;
        document.getElementById('deleteProjectName').textContent = currentProject.title;
        this.showModal('deleteProjectModal');
    }

    static async handleDeleteProject() {
        if (!currentProject) return;
        try {
            await ApiService.deleteProject(currentProject.hash);

            this.hideModal('deleteProjectModal');
            this.showDashboard();
            this.showSuccess('Проект удален успешно!');
        } catch (error) {
            console.error('Error deleting project:', error);
            this.showError('Ошибка удаления проекта: ' + error.message);
        }
    }

    // Task management methods
    static async showCreateTaskModal() {
        if (!currentProject) return;

        try {
            // Загружаем участников проекта
            const response = await ApiService.getProjectMembers(currentProject.hash);
            const members = response.members || [];

            const assignedToSelect = document.getElementById('taskAssignedTo');
            assignedToSelect.innerHTML = '<option value="">Не назначена</option>';
            members.forEach(member => {
                const memberData = member.user || member;
                const displayName = memberData.full_name && memberData.full_name.trim() !== ''
                    ? memberData.full_name
                    : member.full_name && member.full_name.trim() !== ''
                        ? member.full_name
                        : `Участник #${member.user_id || memberData.id}`;
                const option = document.createElement('option');
                option.value = member.user_id || memberData.id;
                option.textContent = displayName;
                assignedToSelect.appendChild(option);
            });

            // Загружаем задачи для выбора родительской задачи
            const tasksResponse = await ApiService.getTasks(currentProject.hash);
            const tasks = tasksResponse.tasks || [];

            const parentTaskSelect = document.getElementById('taskParentId');
            parentTaskSelect.innerHTML = '<option value="">Основная задача (без родителя)</option>';
            tasks.forEach(task => {
                if (task.parent_task_id === null) { // Only main tasks can be parents
                    const option = document.createElement('option');
                    option.value = task.id;
                    option.textContent = task.title;
                    parentTaskSelect.appendChild(option);
                }
            });

            // Устанавливаем сегодняшнюю дату по умолчанию
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('taskDueDate').value = today;

            this.showModal('createTaskModal');
        } catch (error) {
            console.error('Error loading task creation ', error);
            this.showError('Ошибка загрузки данных: ' + error.message);
        }
    }

    static showCreateSubtaskModal() {
        if (!currentProject || !currentTask) return;
        this.showCreateSubtaskModalForTask(currentTask.id);
    }

    static showCreateSubtaskModalForTask(parentTaskId) {
        // Устанавливаем родительскую задачу для создания подзадачи
        this.tempParentTaskId = parentTaskId;
        this.showCreateTaskModal(); // Reuse the main create modal
    }

    static async handleCreateTask() {
        if (!currentProject) return;
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const priority = document.getElementById('taskPriority').value;
        const dueDate = document.getElementById('taskDueDate').value;
        const parentTaskId = this.tempParentTaskId || document.getElementById('taskParentId').value || null; // Use temp ID first
        const assignedTo = document.getElementById('taskAssignedTo').value || null;

        if (!title) {
            this.showError('Введите название задачи');
            return;
        }

        try {
            const taskData = {
                title,
                description,
                priority,
                project_hash: currentProject.hash
            };

            if (dueDate) taskData.due_date = dueDate;
            if (parentTaskId) taskData.parent_task_id = parseInt(parentTaskId);
            if (assignedTo) taskData.assigned_to_id = parseInt(assignedTo); // ИСПРАВЛЕНО: используем assigned_to_id

            console.log('Creating task with data:', taskData);
            await ApiService.createTask(taskData);

            this.hideModal('createTaskModal');
            // ИСПРАВЛЕНО: Проверяем существование формы перед reset
            const createTaskForm = document.getElementById('createTaskForm');
            if (createTaskForm) {
                createTaskForm.reset();
            }
            // Clear temp parent ID
            this.tempParentTaskId = null;

            // Reload tasks for the current view (project or task)
            if (currentProject && !currentTask) {
                await this.loadProjectTasks(currentProject.hash);
            } else if (currentTask) {
                // Reload subtasks if current task is parent
                if (currentTask.id === parentTaskId || currentTask.id === this.tempParentTaskId) {
                     await this.loadSubtasks(currentTask.id);
                }
            }

            this.showSuccess('Задача создана успешно!');
        } catch (error) {
            console.error('Error creating task:', error);
            this.showError('Ошибка создания задачи: ' + error.message);
        }
    }

    // --- Новое из index.txt ---
    static async handleCreateSubtask() {
        if (!currentTask || !currentTask.id) return;
        const title = document.getElementById('subtaskTitle').value.trim();
        const description = ""; // Подзадачи без описания в index.txt
        if (!title) {
            this.showError('Введите название подзадачи');
            return;
        }

        try {
            // Получаем данные родительской задачи для наследования
            const parentTaskResponse = await ApiService.getTask(currentTask.id);
            const parentTask = parentTaskResponse.task || parentTaskResponse;

            const taskData = {
                title,
                description,
                project_hash: currentProject.hash,
                priority: parentTask.priority || 'medium',
                status: 'todo',
                parent_task_id: currentTask.id
            };

            // Наследуем исполнителя от родительской задачи
            if (parentTask.assigned_to_id) {
                taskData.assigned_to_id = parentTask.assigned_to_id;
            }

            console.log('Creating subtask with data:', taskData);
            await ApiService.createTask(taskData);

            this.hideModal('createSubtaskModal');
            // Reset form
            const createSubtaskForm = document.getElementById('createSubtaskForm');
            if (createSubtaskForm) {
                createSubtaskForm.reset();
            }

            // Reload subtasks for the current task
            if (currentTask) {
                await this.loadSubtasks(currentTask.id);
            }

            this.showSuccess('Подзадача создана успешно!');
        } catch (error) {
            console.error('Error creating subtask:', error);
            this.showError('Ошибка создания подзадачи: ' + error.message);
        }
    }

    static showEditTaskModal() {
        if (!currentTask || !currentTask.id) {
            console.error('No current task for editing:', currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        // ИСПРАВЛЕНО: Проверяем существование элементов перед установкой значений
        const editTaskTitle = document.getElementById('editTaskTitle');
        const editTaskDescription = document.getElementById('editTaskDescription');
        const editTaskPriority = document.getElementById('editTaskPriority');
        const editTaskDueDate = document.getElementById('editTaskDueDate');
        const taskStatusSelect = document.getElementById('taskStatusSelect'); // Добавлено для установки статуса

        if (editTaskTitle) editTaskTitle.value = currentTask.title;
        if (editTaskDescription) editTaskDescription.value = currentTask.description || '';
        if (editTaskPriority) editTaskPriority.value = currentTask.priority;
        if (editTaskDueDate) {
            if (currentTask.due_date) {
                const dueDate = new Date(currentTask.due_date);
                editTaskDueDate.value = dueDate.toISOString().split('T')[0];
            } else {
                editTaskDueDate.value = '';
            }
        }
        if (taskStatusSelect) taskStatusSelect.value = currentTask.status;
        this.showModal('editTaskModal');
    }

    static async handleUpdateTask() {
        if (!currentTask || !currentTask.id) {
            console.error('No current task for update:', currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        const title = document.getElementById('editTaskTitle').value.trim();
        const description = document.getElementById('editTaskDescription').value.trim();
        const priority = document.getElementById('editTaskPriority').value;
        const dueDate = document.getElementById('editTaskDueDate').value;

        if (!title) {
            this.showError('Введите название задачи');
            return;
        }

        try {
            const taskData = {
                title,
                description,
                priority
            };

            if (dueDate) {
                taskData.due_date = dueDate;
            } else {
                taskData.due_date = null; // Explicitly set to null if cleared
            }

            console.log('Updating task:', currentTask.id, taskData);
            await ApiService.updateTask(currentTask.id, taskData);

            this.hideModal('editTaskModal');
            await this.openTask(currentTask.id); // Перезагружаем задачу
            this.showSuccess('Задача обновлена успешно!');
        } catch (error) {
            console.error('Error updating task:', error);
            this.showError('Ошибка обновления задачи: ' + error.message);
        }
    }

    static showDeleteTaskModal() {
        if (!currentTask || !currentTask.id) {
            console.error('No current task for deletion:', currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        // ИСПРАВЛЕНО: Проверяем существование элемента
        const deleteTaskName = document.getElementById('deleteTaskName');
        if (deleteTaskName) {
            deleteTaskName.textContent = currentTask.title;
        }
        this.showModal('deleteTaskModal');
    }

    static async handleDeleteTask() {
        if (!currentTask || !currentTask.id) {
            this.showError('Задача не выбрана');
            return;
        }

        try {
            await ApiService.deleteTask(currentTask.id);

            this.hideModal('deleteTaskModal');
            // Go back to project view or wherever appropriate
            if (currentProject) {
                this.openProject(currentProject.hash);
            } else {
                this.showDashboard();
            }
            this.showSuccess('Задача удалена успешно!');
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showError('Ошибка удаления задачи: ' + error.message);
        }
    }

    // --- Новые методы из index.txt ---

    // Изменение статуса задачи
    static async updateTaskStatus() {
        if (!currentTask || !currentTask.id) {
            console.error('No current task for status update:', currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        const newStatus = document.getElementById('taskStatusSelect').value; // Получаем значение из селекта
        if (!newStatus) {
            this.showError('Выберите статус задачи');
            return;
        }

        try {
            console.log('Updating task status:', currentTask.id, newStatus);
            const updatedTask = await ApiService.updateTaskStatus(currentTask.id, newStatus);

            // Если задача выполнена, проверяем родительскую
            if (newStatus === 'done') {
                await this.completeAllChildTasks(currentTask.id); // Выполняем дочерние, если родительская выполнена
            } else if (newStatus === 'todo') {
                 await this.resetParentTasksStatus(currentTask.id); // Сбрасываем родительские, если дочерняя возвращена
            }
            await this.checkParentTaskStatus(currentTask.id);

            // Обновляем currentTask
            currentTask = updatedTask.task || updatedTask;
            this.showSuccess('Статус задачи обновлен!');
        } catch (error) {
            console.error('Error updating task status:', error);
            this.showError('Ошибка обновления статуса: ' + error.message);
            // Восстанавливаем предыдущее значение если возможно
            if (currentTask) {
                document.getElementById('taskStatusSelect').value = currentTask.status;
            }
        }
    }

    // Проверка статуса родительской задачи
    static async checkParentTaskStatus(taskId) {
        if (!currentProject || !taskId) return;

        try {
            const response = await ApiService.getTasks(currentProject.hash);
            const tasks = response.tasks || [];
            const currentTask = tasks.find(t => t.id === taskId);

            if (currentTask && currentTask.parent_task_id) {
                const parentTask = tasks.find(t => t.id === currentTask.parent_task_id);
                if (!parentTask) return; // Родительская задача не найдена

                // Получаем всех "братьев" текущей задачи (другие дочерние задачи того же родителя)
                const responseSiblings = await ApiService.getTasks(currentProject.hash); // Нужно для обновленного списка
                const tasksSiblings = responseSiblings.tasks || [];
                const siblingTasks = tasksSiblings.filter(t => t.parent_task_id === parentTask.id);

                // Проверяем, все ли дочерние задачи выполнены
                const allChildrenDone = siblingTasks.every(child => child.status === 'done');

                if (allChildrenDone && parentTask.status !== 'done') {
                    // Все дочерние задачи выполнены - выполняем родительскую
                    await ApiService.updateTaskStatus(parentTask.id, 'done');
                    // Рекурсивно проверяем родительскую задачу
                    await this.checkParentTaskStatus(parentTask.id);
                } else if (!allChildrenDone && parentTask.status === 'done') {
                    // Не все дочерние выполнены, но родительская стоит как done - возвращаем в todo
                    await ApiService.updateTaskStatus(parentTask.id, 'todo');
                }
            }
        } catch (error) {
            console.error('Error checking parent task status:', error);
        }
    }

    // Сброс статуса родительских задач
    static async resetParentTasksStatus(taskId) {
        if (!currentProject || !taskId) return;

        try {
            const response = await ApiService.getTasks(currentProject.hash);
            const tasks = response.tasks || [];
            const currentTask = tasks.find(t => t.id === taskId);

            if (currentTask && currentTask.parent_task_id) {
                const parentTask = tasks.find(t => t.id === currentTask.parent_task_id);
                if (!parentTask) return;

                // Обновляем статус родительской задачи на 'todo'
                if (parentTask.status !== 'todo') {
                    await ApiService.updateTaskStatus(parentTask.id, 'todo');
                }

                // Рекурсивно сбрасываем статусы выше
                await this.resetParentTasksStatus(parentTask.id);
            }
        } catch (error) {
            console.error('Error resetting parent task status:', error);
        }
    }

    // Выполнение всех дочерних задач
    static async completeAllChildTasks(parentTaskId) {
        if (!currentProject || !parentTaskId) return;

        try {
            const response = await ApiService.getTasks(currentProject.hash);
            const tasks = response.tasks || [];
            const childTasks = tasks.filter(t => t.parent_task_id === parentTaskId);

            for (const childTask of childTasks) {
                if (childTask.status !== 'done') {
                    await ApiService.updateTaskStatus(childTask.id, 'done');
                    // Рекурсивно выполнить дочерние подзадачи
                    await this.completeAllChildTasks(childTask.id);
                }
            }
        } catch (error) {
            console.error('Error completing child tasks:', error);
        }
    }

    // Назначение задачи пользователю
    static async assignTaskToUser(userId) { // Принимает userId
        if (!currentTask || !currentTask.id || !userId) {
            this.showError('ID задачи и ID пользователя обязательны');
            return;
        }
        try {
            await ApiService.updateTask(currentTask.id, { assigned_to_id: userId });
            this.showSuccess('Исполнитель задачи обновлен!');
            // Перезагружаем задачу
            if (currentTask && currentTask.id === currentTask.id) {
                await this.openTask(currentTask.id);
            }
        } catch (error) {
            console.error('Error assigning task:', error);
            this.showError('Ошибка назначения исполнителя: ' + error.message);
        }
    }

    // Загрузка подзадач
    static async loadSubtasks(parentTaskId, level = 0, container = null) {
        try {
            if (!currentProject || !currentProject.hash) {
                console.error('No current project for loading subtasks');
                document.getElementById('subtasksList').innerHTML = '<p>Ошибка загрузки подзадач</p>';
                return;
            }

            const response = await ApiService.getTasks(currentProject.hash);
            const tasks = response.tasks || [];
            const subtasks = tasks.filter(task => task.parent_task_id === parentTaskId);

            const targetContainer = container || document.getElementById('subtasksList');

            if (subtasks.length === 0 && level === 0) {
                targetContainer.innerHTML = '<p>Подзадач нет</p>';
                return;
            }

            let subtasksHtml = '';
            subtasks.forEach(subtask => {
                const paddingLeft = level * 20;
                const childSubtasks = tasks.filter(task => task.parent_task_id === subtask.id);
                const hasChildren = childSubtasks.length > 0;

                subtasksHtml += `
                <div class="subtask-item" style="margin-left: ${paddingLeft}px; display: flex; align-items: center; gap: 10px; padding: 8px; border: 1px solid #eee; border-radius: 4px; margin-bottom: 5px;">
                    <span style="width: 16px;"></span> <!-- Spacer for indentation -->
                    <input type="checkbox" ${subtask.status === 'done' ? 'checked' : ''}
                           onchange="App.toggleSubtaskStatus(${subtask.id}, this.checked)"
                           style="cursor: pointer;"
                           onclick="event.stopPropagation()">
                    <div style="flex: 1;">
                        <div style="font-weight: bold;" onclick="App.openTask(${subtask.id})">${this.escapeHtml(subtask.title)}</div>
                    </div>
                    <div style="font-size: 12px; color: #666;">${this.getStatusText(subtask.status)}</div>
                    <button onclick="App.showCreateSubtaskModalForTask(${subtask.id}); event.stopPropagation();"
                            style="padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">+</button>
                </div>`;

                // Recursively add child subtasks
                if (hasChildren) {
                    const childContainer = document.createElement('div');
                    childContainer.className = 'subtask-children';
                    this.loadSubtasks(subtask.id, level + 1, childContainer);
                    subtasksHtml += childContainer.outerHTML;
                }
            });

            targetContainer.innerHTML = subtasksHtml;
        } catch (error) {
            console.error('Error loading subtasks:', error);
            this.showError('Ошибка загрузки подзадач: ' + error.message);
        }
    }

    // Переключение статуса подзадачи
    static async toggleSubtaskStatus(taskId, isDone) {
        try {
            const newStatus = isDone ? 'done' : 'todo';
            // Обновляем статус текущей задачи
            await ApiService.updateTaskStatus(taskId, newStatus);

            // Если задача выполняется, выполняем все дочерние задачи
            if (isDone) {
                await this.completeAllChildTasks(taskId);
            } else {
                // Если задача возвращается в "к выполнению", сбрасываем статус родительских задач
                await this.resetParentTasksStatus(taskId);
            }

            // Проверяем статус родительской задачи
            await this.checkParentTaskStatus(taskId);

            // Перезагружаем отображение подзадач
            if (currentTask) {
                await this.loadSubtasks(currentTask.id);
            }
            this.showSuccess('Статус задачи обновлен!');
        } catch (error) {
            console.error('Error toggling subtask status:', error);
            this.showError('Ошибка обновления статуса задачи: ' + error.message);
        }
    }

    // Search projects
    static async searchProjects() {
        const searchTerm = document.getElementById('searchProjectsInput').value.trim();
        try {
             if (!searchTerm) {
                await this.loadRecentPublicProjects(); // --- Вызываем, если поле пустое ---
                return;
            }

            // Если поисковый запрос похож на хэш (только буквы и цифры, длина 6+ символов), пробуем поиск по хэшу
            if (/^[a-zA-Z0-9]{6,}$/.test(searchTerm)) {
                console.log('Searching by exact hash:', searchTerm);
                try {
                    await this.searchProjectByExactHash(searchTerm);
                    return; // Если нашли по хэшу, выходим
                } catch (error) {
                    console.log('Project not found by hash, trying by name...'); // Выводим в консоль, как в index.txt
                    // Если не нашли по хэшу, продолжаем поиск по названию
                    await this.searchProjectsByQuery(searchTerm);
                    return;
                }
            } else {
                // Поиск только по названию
                await this.searchProjectsByQuery(searchTerm);
                return;
            }
        } catch (error) {
            console.error('Error searching projects:', error);
            this.showError('Ошибка поиска проектов: ' + error.message);
        }
    }

    static async searchProjectByExactHash(hash) {
        try {
            const response = await ApiService.getProjectByHashExact(hash);
            const project = response.project;

            if (project) {
                // Показываем найденный проект
                const title = `Проект по хэшу: "${hash}"`;
                this.renderSearchResults([project], title);
            } else {
                // Если проект по хэшу не найден, выбрасываем ошибку для перехода к поиску по названию
                throw new Error('Project not found by hash');
            }
        } catch (error) {
            console.error('Error searching project by exact hash:', error);
            // Не показываем ошибку, так как это может быть просто неправильный хэш, и мы переходим к поиску по названию
            throw error; // Перебрасываем ошибку для вызова обычного поиска
        }
    }

    static async searchProjectsByQuery(query) {
        try {
            const response = await ApiService.searchPublicProjects(query);
            const projects = response.projects || [];
            const title = query ? `Результаты поиска по названию: "${query}"` : 'Публичные проекты';
            this.renderSearchResults(projects, title);
        } catch (error) {
            console.error('Error searching projects by query:', error);
            // Не показываем ошибку здесь, так как она обрабатывается в searchProjects
        }
    }

    static renderSearchResults(projects, title) {
        const container = document.getElementById('searchResultsList');
        if (!projects || projects.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p>Проекты не найдены</p>
                <p>Попробуйте изменить поисковый запрос или создать новый проект</p>
            </div>`;
            return;
        }

        let html = `<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;"><h3 style="margin: 0;">${title}</h3>${title.includes('хэшу') ? '<span class="search-type-badge">По хэшу</span>' : '<span class="search-type-badge">По названию</span>'}</div>`;
        html += projects.map(project => {
            const stats = project.stats || {};
            const requiresApproval = project.requires_approval;
            const isPrivate = project.is_private;

            // Определяем текст и действие для кнопки
            let buttonText = 'Присоединиться';
            let buttonAction = `App.handleJoinProject('${project.hash}')`; // ИЗМЕНЕНО: используем handleJoinProject вместо joinProject
            let buttonClass = 'btn-primary';

            // ПЕРВОЕ: Проверяем exactMatchData для определения статуса пользователя (если бы оно было в ответе)
            // В упрощенной версии предполагаем, что можно присоединиться, если публичный или требует одобрения
            if (isPrivate && !requiresApproval) {
                // Приватный без одобрения - доступ закрыт для посторонних
                buttonText = 'Доступ закрыт';
                buttonAction = '';
                buttonClass = 'btn-secondary';
            } else if (isPrivate && requiresApproval) {
                buttonText = 'Отправить заявку';
                buttonClass = 'btn-warning';
            } else if (isPrivate) {
                buttonText = 'Запросить доступ';
                buttonClass = 'btn-info';
            }

            // Формируем атрибут disabled
            const disabledAttr = (buttonClass.includes('btn-secondary') || !buttonAction) ? 'disabled' : '';

            return `
            <div class="search-result-item">
                <div class="project-card">
                    <div class="project-card-header">
                        <h3 class="project-title">${this.escapeHtml(project.title)}</h3>
                        <span class="project-type-badge">${isPrivate ? '🔒' : '🌐'}</span>
                    </div>
                    <p class="project-description">${this.escapeHtml(project.description || 'Без описания')}</p>
                    <div class="project-stats">
                        <span>Участников: ${stats.members_count || 0}</span>
                        <span>Задач: ${stats.tasks_count || 0}</span>
                        <span>Выполнено: ${stats.tasks_done || 0}</span>
                        <span>Тип: ${isPrivate ? 'Приватный' : 'Публичный'}</span>
                        ${isPrivate ? `<span>Одобрение: ${requiresApproval ? 'Требуется' : 'Не требуется'}</span>` : ''}
                    </div>
                    <div style="font-size: 12px; color: #999;">Хэш: <code style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px;">${project.hash}</code> • Создан: ${new Date(project.created_at).toLocaleDateString()}${project.owner ? ` • Владелец: ${this.escapeHtml(project.owner.full_name)}` : ''}</div>
                    <div style="display: flex; flex-direction: column; gap: 10px; min-width: 150px;">
                        <button onclick="${buttonAction}"
                                style="padding: 8px 16px; background: ${this.getButtonColor(buttonClass)}; color: white; border: none; border-radius: 4px; cursor: pointer;" ${disabledAttr}>${buttonText}</button>
                        <button onclick="App.openProjectPreview('${project.hash}')"
                                style="padding: 6px 12px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Подробнее</button>
                    </div>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = html;
    }

    static getButtonColor(buttonClass) {
        const colorMap = {
            'btn-primary': '#007bff',
            'btn-warning': '#ffc107',
            'btn-info': '#17a2b8',
            'btn-success': '#28a745',
            'btn-secondary': '#6c757d'
        };
        return colorMap[buttonClass] || '#007bff';
    }

    static async joinProjectFromPreview(projectHash) {
        try {
            const response = await ApiService.joinProject(projectHash);

            if (response.status === 'joined') {
                this.showSuccess('Вы успешно присоединились к проекту!');
                await this.openProject(projectHash);
            } else if (response.status === 'pending_approval') {
                this.showSuccess('Заявка на вступление отправлена! Ожидайте одобрения.');
                this.showDashboard();
            } else {
                this.showError('Неизвестный статус ответа: ' + response.status);
            }
        } catch (error) {
            console.error('Error joining project from preview:', error);
             if (error.message.includes('400') && error.message.includes('already a member')) {
                this.showError('Вы уже являетесь участником этого проекта');
                await this.openProject(projectHash);
            } else if (error.message.includes('400') && error.message.includes('already pending')) {
                this.showError('Заявка на вступление уже отправлена');
            } else if (error.message.includes('403')) {
                this.showError('Доступ к проекту запрещен');
            } else if (error.message.includes('404')) {
                this.showError('Проект не найден');
            } else {
                this.showError('Ошибка вступления в проект: ' + error.message);
            }
        }
    }

    // Project members management
    static showProjectMembersManagement() {
        this.showView('projectMembersView');
        this.loadProjectMembersManagement();
    }

    static async loadProjectMembersManagement() {
        if (!currentProject) return;

        try {
            const response = await ApiService.getProjectMembers(currentProject.hash);
            const members = response.members || [];
            const container = document.getElementById('projectMembersManagementList');

            if (!members || members.length === 0) {
                container.innerHTML = '<p>Участников нет</p>';
                return;
            }

            container.innerHTML = members.map(member => {
                const memberData = member.user || member;
                const displayName = (memberData.full_name && memberData.full_name.trim() !== '') ? memberData.full_name : (member.full_name && member.full_name.trim() !== '') ? member.full_name : `Участник #${member.user_id || memberData.id}`;
                const isCurrentUser = (member.user_id || memberData.id) === currentUser.id;
                const isOwnerMember = member.role === ProjectRole.OWNER;
                const isAdminMember = member.role === ProjectRole.ADMIN;

                // Определяем доступные действия
                let canChangeRole = false;
                let canRemoveMember = false;

                if (currentUser.id === currentProject.owner_id) { // Current user is owner
                    canChangeRole = !isCurrentUser && !isOwnerMember;
                    canRemoveMember = !isCurrentUser && !isOwnerMember;
                } else if (currentUser.role === ProjectRole.ADMIN) { // Current user is admin
                    canChangeRole = !isCurrentUser && !isOwnerMember && !isAdminMember;
                    canRemoveMember = !isCurrentUser && !isOwnerMember && !isAdminMember;
                }

                return `
                <div class="member-management-item">
                    <div class="member-info">
                        <span class="member-name">${this.escapeHtml(displayName)}</span>
                        <span class="member-role">${this.getRoleText(member.role)}</span>
                        <span class="member-email">${this.escapeHtml(memberData.email || 'N/A')}</span>
                    </div>
                    <div class="member-actions">
                        ${canChangeRole ? `<select class="role-select" onchange="App.updateMemberRole(${member.user_id || memberData.id}, this.value)">
                            <option value="member" ${member.role === 'member' ? 'selected' : ''}>Участник</option>
                            <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Администратор</option>
                        </select>
                        <button onclick="App.prepareUpdateMemberRole(${member.user_id || memberData.id})" class="btn btn-primary btn-sm">Обновить</button>` : ''}
                        ${canRemoveMember ? `<button onclick="App.prepareRemoveMember(${member.user_id || memberData.id})" class="btn btn-danger btn-sm">Удалить</button>` : ''}
                    </div>
                </div>`;
            }).join('');

        } catch (error) {
            console.error('Error loading project members management:', error);
            this.showError('Ошибка загрузки участников: ' + error.message);
        }
    }

    static prepareUpdateMemberRole(memberId) {
        currentMemberToUpdate = memberId;
        this.showModal('updateMemberRoleModal');
    }

    static prepareRemoveMember(memberId) {
        currentMemberToRemove = memberId;
        this.showModal('removeMemberModal');
    }

    static async updateMemberRole(memberId, newRole) {
        try {
            await ApiService.updateProjectMemberRole(currentProject.hash, memberId, newRole);
            this.showSuccess('Роль участника обновлена');
            // Reload the management list
            await this.loadProjectMembersManagement();
        } catch (error) {
            console.error('Error updating member role:', error);
            this.showError('Ошибка обновления роли: ' + error.message);
        }
    }

    static async handleUpdateMemberRole() {
        if (!currentMemberToUpdate) return;
        const newRole = document.getElementById('updateMemberRoleSelect').value;
        await this.updateMemberRole(currentMemberToUpdate, newRole);
        this.hideModal('updateMemberRoleModal');
    }

    static async removeMember(memberId) {
        try {
            await ApiService.removeProjectMember(currentProject.hash, memberId);
            this.showSuccess('Участник удален');
            // Reload the management list
            await this.loadProjectMembersManagement();
        } catch (error) {
            console.error('Error removing member:', error);
            this.showError('Ошибка удаления участника: ' + error.message);
        }
    }

    static async handleRemoveMember() {
        if (!currentMemberToRemove) return;
        await this.removeMember(currentMemberToRemove);
        this.hideModal('removeMemberModal');
    }

    // Join requests
    static showJoinRequests() {
        this.showView('joinRequestsView');
        this.loadJoinRequests();
    }

    static async loadJoinRequests() {
        if (!currentProject) return;

        try {
            const response = await ApiService.getProjectJoinRequests(currentProject.hash);
            const joinRequests = response.requests || [];
            const container = document.getElementById('joinRequestsList');

            if (!joinRequests || joinRequests.length === 0) {
                container.innerHTML = '<p>Заявок нет</p>';
                return;
            }

            container.innerHTML = joinRequests.map(request => {
                const requestDate = request.created_at;
                const formattedDate = requestDate ? new Date(requestDate).toLocaleString() : 'Дата не указана';
                // Определяем статус и доступные действия
                const statusText = this.getJoinRequestStatusText(request.status); // --- Предполагаемая функция ---
                const statusColor = this.getJoinRequestStatusColor(request.status); // --- Предполагаемая функция ---
                const canApprove = request.status === 'pending';
                const canReject = request.status === 'pending';

                return `
                <div class="join-request-item">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <strong>${this.escapeHtml(request.user_name)}</strong> (${this.escapeHtml(request.user_email)}) - ${formattedDate}
                            <span style="color: ${statusColor};">${statusText}</span>
                        </div>
                        <div class="request-actions">
                            ${canApprove ? `<button class="btn btn-success btn-sm" onclick="App.handleApproveRequest(${request.id})">Одобрить</button>` : ''}
                            ${canReject ? `<button class="btn btn-danger btn-sm" onclick="App.handleRejectRequest(${request.id})">Отклонить</button>` : ''}
                        </div>
                    </div>
                </div>`;
            }).join('');

        } catch (error) {
            console.error('Error loading join requests:', error);
            this.showError('Ошибка загрузки заявок: ' + error.message);
        }
    }

    static getJoinRequestStatusText(status) {
        const map = { 'pending': 'Ожидает', 'approved': 'Одобрена', 'rejected': 'Отклонена' };
        return map[status] || status;
    }

    static getJoinRequestStatusColor(status) {
        const map = { 'pending': '#ffc107', 'approved': '#28a745', 'rejected': '#dc3545' };
        return map[status] || '#6c757d';
    }

    static async handleApproveRequest(requestId) {
        if (!currentProject) return;
        try {
            console.log('Approving join request:', requestId, 'for project:', currentProject.hash);
            await ApiService.approveJoinRequest(currentProject.hash, requestId);
            this.showSuccess('Заявка одобрена!');
            await this.showJoinRequests(); // Перезагружаем список
        } catch (error) {
            console.error('Error approving join request:', error);
            if (error.message.includes('404')) {
                this.showError('Заявка не найдена. Возможно, она уже была обработана.');
            } else {
                this.showError('Ошибка одобрения заявки: ' + error.message);
            }
        }
    }

    static async handleRejectRequest(requestId) {
        if (!currentProject) return;
        try {
            console.log('Rejecting join request:', requestId, 'for project:', currentProject.hash);
            await ApiService.rejectJoinRequest(currentProject.hash, requestId);
            this.showSuccess('Заявка отклонена!');
            await this.showJoinRequests(); // Перезагружаем список
        } catch (error) {
            console.error('Error rejecting join request:', error);
            if (error.message.includes('404')) {
                this.showError('Заявка не найдена. Возможно, она уже была обработана.');
            } else {
                this.showError('Ошибка отклонения заявки: ' + error.message);
            }
        }
    }

    // Settings
    static async loadSettings() {
        try {
            const userData = await ApiService.getCurrentUser();
            document.getElementById('userFullName').value = userData.full_name || '';
            document.getElementById('userUsername').value = userData.username || '';

            // Загружаем предпочтения пользователя
            // Предположим, что они входят в состав userSettings или загружаются отдельно
            // const userPrefs = await ApiService.getUserPreferences(); // Если есть такой метод
            // document.getElementById('userTheme').value = userPrefs.theme || 'light';
            // document.getElementById('userNotificationsEnabled').checked = userPrefs.notifications_enabled || false;
            // document.getElementById('userCompactView').checked = userPrefs.compact_view || false;

            // Или используем уже загруженные userSettings
            document.getElementById('userTheme').value = userSettings.theme || 'light';
            document.getElementById('userNotificationsEnabled').checked = userSettings.notifications_enabled || false;
            document.getElementById('userCompactView').checked = userSettings.compact_view || false;

        } catch (error) {
            console.error('Error loading settings:', error);
            this.showError('Ошибка загрузки настроек: ' + error.message);
        }
    }

    static async handleSaveSettings() {
        try {
            const fullName = document.getElementById('userFullName').value.trim();
            const username = document.getElementById('userUsername').value.trim();

            // Обновляем данные пользователя
            if (fullName || username) {
                await ApiService.updateCurrentUser({
                    full_name: fullName,
                    username: username
                });
            }

            // Обновляем настройки
            await ApiService.updateUserPreferences({
                theme: document.getElementById('userTheme').value,
                notifications_enabled: document.getElementById('userNotificationsEnabled').checked,
                compact_view: document.getElementById('userCompactView').checked
            });

            this.hideModal('settingsModal');
            this.showSuccess('Настройки сохранены успешно!');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showError('Ошибка сохранения настроек: ' + error.message);
        }
    }

    static async resetUserPreferences() {
        try {
            await ApiService.resetUserPreferences();
            this.hideModal('settingsModal');
            this.showSuccess('Настройки сброшены к значениям по умолчанию!');
        } catch (error) {
            console.error('Error resetting preferences:', error);
            this.showError('Ошибка сброса настроек: ' + error.message);
        }
    }
}

// Mobile navigation and enhanced features
class MobileApp {
    static init() {
        this.initMobileNavigation();
        this.initSwipeGestures();
        this.initFloatingActionButton();
        this.initPullToRefresh();
    }

    static initMobileNavigation() {
        const mobileNavItems = document.querySelectorAll('.mobile-nav-item[data-view]');

        mobileNavItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                // Remove active class from all items
                mobileNavItems.forEach(i => i.classList.remove('active'));

                // Add active class to clicked item
                item.classList.add('active');

                const view = item.dataset.view;
                if (view) {
                    App.showView(view);

                    // Load specific data for the view
                    switch(view) {
                        case 'dashboardView':
                            App.loadData();
                            break;
                        case 'myTasksView':
                            App.loadEnhancedMyTasks();
                            break;
                        case 'notificationsView':
                            App.showEnhancedNotifications();
                            break;
                        case 'searchProjectsView':
                            App.showSearchProjects();
                            break;
                    }
                }
            });
        });

        // Mobile settings button
        const mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
        if (mobileSettingsBtn) {
            mobileSettingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                App.showSettings();
            });
        }
    }

    static initFloatingActionButton() {
        const fab = document.createElement('button');
        fab.className = 'fab';
        fab.innerHTML = '+';
        fab.id = 'mainFab';

        const fabMenu = document.createElement('div');
        fabMenu.className = 'fab-menu';
        fabMenu.innerHTML = `
            <button class="fab-item" id="fabCreateProject" title="Создать проект">📁</button>
            <button class="fab-item" id="fabCreateTask" title="Создать задачу">✅</button>
            <button class="fab-item" id="fabQuickNote" title="Быстрая заметка">📝</button>
        `;

        document.body.appendChild(fab);
        document.body.appendChild(fabMenu);

        // FAB functionality
        fab.addEventListener('click', () => {
            fabMenu.classList.toggle('open');
        });

        // FAB item functionality
        document.getElementById('fabCreateProject')?.addEventListener('click', () => {
            App.showCreateProjectModal();
            fabMenu.classList.remove('open');
        });

        document.getElementById('fabCreateTask')?.addEventListener('click', () => {
            if (currentProject) {
                App.showCreateTaskModal();
            } else {
                App.showError('Сначала откройте проект');
            }
            fabMenu.classList.remove('open');
        });

        // Close FAB menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!fab.contains(e.target) && !fabMenu.contains(e.target)) {
                fabMenu.classList.remove('open');
            }
        });
    }

    static initSwipeGestures() {
        let startX = 0;
        let currentX = 0;
        let isSwiping = false;
        let currentCard = null;

        document.addEventListener('touchstart', (e) => {
            const card = e.target.closest('.project-card, .task-card');
            if (card) {
                startX = e.touches[0].clientX;
                currentX = startX;
                isSwiping = true;
                currentCard = card;

                // Reset other swiped cards
                document.querySelectorAll('.project-card.swiped, .task-card.swiped').forEach(c => {
                    if (c !== card) c.classList.remove('swiped');
                });
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (!isSwiping || !currentCard) return;

            currentX = e.touches[0].clientX;
            const diff = startX - currentX;

            // Only allow right-to-left swipe
            if (diff > 0) {
                e.preventDefault();
                const translateX = Math.min(diff, 80);
                currentCard.style.transform = `translateX(-${translateX}px)`;
            }
        });

        document.addEventListener('touchend', () => {
            if (!isSwiping || !currentCard) return;

            const diff = startX - currentX;
            const threshold = 50;

            if (diff > threshold) {
                currentCard.classList.add('swiped');
                currentCard.style.transform = 'translateX(-80px)';

                // Auto-close after 3 seconds
                setTimeout(() => {
                    currentCard.classList.remove('swiped');
                    currentCard.style.transform = '';
                }, 3000);
            } else {
                currentCard.classList.remove('swiped');
                currentCard.style.transform = '';
            }

            isSwiping = false;
            currentCard = null;
        });
    }

    static initPullToRefresh() {
        let startY = 0;
        let currentY = 0;
        let isPulling = false;
        const pullIndicator = document.createElement('div');
        pullIndicator.className = 'pull-indicator';
        pullIndicator.innerHTML = '<div class="spinner"></div> Обновление...';

        document.querySelector('.main-content')?.prepend(pullIndicator);

        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (!isPulling) return;

            currentY = e.touches[0].clientY;
            const diff = currentY - startY;

            if (diff > 0) {
                e.preventDefault();
                pullIndicator.style.display = 'block';
                pullIndicator.style.opacity = Math.min(diff / 100, 1);
            }
        });

        document.addEventListener('touchend', async () => {
            if (!isPulling) return;

            const diff = currentY - startY;

            if (diff > 80) {
                pullIndicator.classList.add('refreshing');

                try {
                    await App.loadData();
                    App.showSuccess('Данные обновлены');
                } catch (error) {
                    App.showError('Ошибка обновления');
                }

                setTimeout(() => {
                    pullIndicator.classList.remove('refreshing');
                    pullIndicator.style.display = 'none';
                    pullIndicator.style.opacity = '0';
                }, 1000);
            } else {
                pullIndicator.style.display = 'none';
            }

            isPulling = false;
        });
    }

    static updateNotificationBadge(count) {
        const badge = document.querySelector('.nav-badge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 9 ? '9+' : count;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }
}

// Enhanced view transitions
const originalShowView = App.showView;
App.showView = function(viewId) {
    const currentView = document.querySelector('.view[style*="display: block"]');

    if (currentView) {
        currentView.style.animation = 'slideOutLeft 0.3s ease-out';
        setTimeout(() => {
            originalShowView.call(this, viewId);
            document.getElementById(viewId).style.animation = 'slideInRight 0.3s ease-out';
        }, 150);
    } else {
        originalShowView.call(this, viewId);
    }
};

// ИСПРАВЛЕНО: Добавляем функцию для инициализации искр
function initSparkAnimation() {
    const sparkContainer = document.getElementById('sparkContainer');
    if (!sparkContainer) return;

    const createSpark = () => {
        const spark = document.createElement('div');
        spark.classList.add('spark');

        // Случайная стартовая позиция
        const startX = Math.random() * 100;
        const startY = Math.random() * 100;

        // Случайная конечная позиция (используем CSS переменные)
        const endX = (Math.random() - 0.5) * 200; // От -100 до 100vw
        const endY = (Math.random() - 0.5) * 200; // От -100 до 100vh

        spark.style.setProperty('--end-x', `${endX}vw`);
        spark.style.setProperty('--end-y', `${endY}vh`);
        spark.style.left = `${startX}%`;
        spark.style.top = `${startY}%`;

        sparkContainer.appendChild(spark);

        // Удаляем искру после анимации
        setTimeout(() => {
            spark.remove();
        }, 3000);
    };

    // Создаем искры каждые 200-500мс
    setInterval(createSpark, Math.random() * 300 + 200);
}

// ИСПРАВЛЕНО: Добавляем функцию для анимации прогресса
function initLoadingProgress() {
    const progressBar = document.getElementById('loadingBarProgress');
    if (!progressBar) return;
}

function showStartButton() {
    const startButton = document.getElementById('startButton');
    if (startButton) {
        // Плавно появляем кнопку
        setTimeout(() => {
            startButton.style.display = 'inline-block';
        }, 300); // Небольшая задержка для завершения анимации прогресса
    }
}

function attachStartButtonListener() {
    const startButton = document.getElementById('startButton');
    if (startButton) {
        startButton.addEventListener('click', () => {
            const loadingOverlay = document.getElementById('loading');
            if (loadingOverlay) {
                // Вызываем событие завершения загрузки
                window.dispatchEvent(new Event('appLoaded'));
                // Скрываем заставку через небольшую задержку для анимации
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 300); // Соответствует transition
            }
        });
    }
}

// Обновленная инициализация
document.addEventListener('DOMContentLoaded', async () => {
    // Инициализируем искры
    initSparkAnimation();
    // Инициализируем анимацию прогресса
    initLoadingProgress();
    // Инициализируем приложение
    App.init();

    // Добавьте эти обработчики
    App.addEventListener('themeSelect', 'change', () => App.saveUserSettings());
    App.addEventListener('notificationsEnabled', 'change', () => App.saveUserSettings());
    App.addEventListener('userFullName', 'change', () => App.saveUserSettings());

    // Загрузка настроек при открытии вкладки
    const originalShowView = App.showView;
    App.showView = function(viewId) {
        originalShowView.call(this, viewId);
        if (viewId === 'settingsView') {
            App.loadUserSettings();
        }
    };
});
