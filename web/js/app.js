// Main application class
class ProjectPilotApp {
    constructor() {
        this.modules = {};
        this.components = {};
        this.currentView = 'dashboard';
        this.currentProject = null;
        this.currentTask = null;
        this.currentUser = null;
        this.userSettings = {};
        this.isInitialized = false;
    }

    // В файле js\app.js добавляем в метод init:

    async init() {
        if (this.isInitialized) return;

        try {
            console.log('Initializing Project Pilot...');
            this.showLoading();

            // Apply default theme immediately for better UX
            this.applyDefaultTheme();

            // Initialize modules
            await this.initializeModules();

            // Initialize components
            await this.initializeComponents();

            // Set up event listeners
            this.setupEventListeners();

            // Load initial data
            await this.loadInitialData();

            this.showApp();
            this.isInitialized = true;
            console.log('Project Pilot initialized successfully');

            this.startBackgroundProcesses();

        } catch (error) {
            console.error('App initialization failed:', error);
            this.showError('Ошибка инициализации приложения: ' + error.message);

            // Показать приложение даже при ошибке
            this.showApp();
        }
    }

    handleUserAction(action) {
        this.hideUserMenu();

        switch (action) {
            case 'profile':
                this.showProfile();
                break;
            case 'settings':
                this.showSettings();
                break;
            case 'toggleTheme':
                this.toggleTheme();
                break;
            case 'logout':
                this.logout();
                break;
        }
    }

    // Добавляем метод toggleTheme:
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        this.setTheme(newTheme);

        // Сохраняем в настройках пользователя, если есть API
        if (this.modules.api && this.currentUser) {
            this.saveThemePreference(newTheme);
        }

        Utils.showToast(`Тема изменена на ${newTheme === 'dark' ? 'тёмную' : 'светлую'}`, 'success');
    }

    async saveThemePreference(theme) {
        try {
            await this.modules.api.patchUserPreferences({ theme });
        } catch (error) {
            console.error('Error saving theme preference:', error);
        }
    }

    // Добавляем метод applyDefaultTheme:
    applyDefaultTheme() {
        // Проверяем сохраненную тему или используем системную
        const savedTheme = Utils.getStorage('user_theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        let theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

        console.log('Applying default theme:', { savedTheme, systemPrefersDark, theme });
        this.setTheme(theme);
    }

    async initializeModules() {
        console.log('Initializing modules...');

        this.modules.utils = Utils;
        this.modules.cache = new CacheManager();
        this.modules.auth = new AuthManager();
        this.modules.api = new ApiService();
        this.modules.notifications = new NotificationManager();
        this.modules.gestures = new GestureManager();

        // Initialize each module with better error handling
        for (const [name, module] of Object.entries(this.modules)) {
            try {
                if (typeof module.init === 'function') {
                    await module.init();
                    console.log(`Module ${name} initialized`);
                } else {
                    console.log(`Module ${name} doesn't require initialization`);
                }
            } catch (error) {
                console.error(`Failed to initialize module ${name}:`, error);
                // Не прерываем инициализацию при ошибке в отдельных модулях
                if (name === 'auth' || name === 'api') {
                    // Критические модули - пробрасываем ошибку
                    throw error;
                }
            }
        }
    }

    async initializeComponents() {
        console.log('Initializing components...');

        this.components.modals = new ModalManager();
        this.components.views = new ViewManager();
        this.components.tasks = new TaskManager();

        // Initialize each component
        for (const [name, component] of Object.entries(this.components)) {
            try {
                await component.init();
                console.log(`Component ${name} initialized`);
            } catch (error) {
                console.error(`Failed to initialize component ${name}:`, error);
                throw error;
            }
        }
    }

    // В файле js\app.js исправляем setupEventListeners:

    setupEventListeners() {
        console.log('Setting up event listeners...');

        // Global error handling
        window.addEventListener('error', this.handleGlobalError.bind(this));
        window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));

        // Online/offline handling
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));

        // Visibility change (tab switch)
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

        // User menu
        document.getElementById('userMenuBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleUserMenu();
        });

        // Close user menu when clicking outside
        document.addEventListener('click', () => {
            this.hideUserMenu();
        });

        // Header actions - исправляем обработчики
        document.getElementById('searchProjectsBtn')?.addEventListener('click', () => {
            this.showSearchProjects();
        });

        document.getElementById('notificationsBtn')?.addEventListener('click', () => {
            this.showNotificationsFallback();
        });

        document.getElementById('createProjectBtn')?.addEventListener('click', () => {
            this.components.modals.showCreateProjectModal();
        });

        // Refresh dashboard
        document.getElementById('refreshDashboard')?.addEventListener('click', () => {
            this.loadDashboardData();
        });

        // User dropdown actions
        document.addEventListener('click', (e) => {
            const dropdownItem = e.target.closest('[data-action]');
            if (dropdownItem) {
                const action = dropdownItem.dataset.action;
                this.handleUserAction(action);
            }
        });
    }

    showNotificationsFallback() {
        const modalManager = this.components.modals;
        if (modalManager && modalManager.showModal) {
            modalManager.showModal('notifications');
        } else {
            Utils.showToast('Функция уведомлений в разработке', 'info');
        }
    }

    async loadInitialData() {
        console.log('Loading initial data...');

        try {
            // Authenticate user
            await this.authenticateUser();

            // Load user preferences only if authenticated
            if (this.modules.auth.isAuthenticated) {
                await this.loadUserPreferences();
                await this.loadDashboardData();
                await this.modules.notifications.loadNotifications();
            }

        } catch (error) {
            console.error('Error loading initial data:', error);
            // Не прерываем работу приложения при ошибках загрузки данных
            Utils.showToast('Ошибка загрузки данных', 'error');
        }
    }

    async authenticateUser() {
        console.log('Authenticating user...');

        try {
            this.currentUser = await this.modules.auth.authenticateWithMax();
            console.log('User authenticated:', this.currentUser);
        } catch (error) {
            console.error('Authentication failed:', error);
            throw error;
        }
    }

    async loadUserPreferences() {
        try {
            const api = this.modules.api;
            if (!api) return;

            const preferences = await api.getUserPreferences();
            this.userSettings = preferences || {};

            // Apply user settings
            this.applyUserSettings(this.userSettings);

        } catch (error) {
            console.error('Error loading user preferences:', error);
        }
    }

    applyUserSettings(settings) {
        console.log('Applying user settings:', settings);

        // Apply theme
        if (settings.theme) {
            this.setTheme(settings.theme);
        } else {
            // Default theme if not set
            this.setTheme('dark'); // или 'light' в зависимости от предпочтений
        }

        // Apply other settings
        if (settings.compact_view) {
            document.body.classList.add('compact-view');
        }

        if (settings.notifications_enabled === false) {
            this.modules.notifications.stopPolling();
        }
    }

    setTheme(theme) {
        console.log('Setting theme to:', theme);

        const lightTheme = document.getElementById('light-theme');
        const darkTheme = document.getElementById('dark-theme');

        if (theme === 'dark') {
            if (lightTheme) lightTheme.disabled = true;
            if (darkTheme) darkTheme.disabled = false;
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            if (lightTheme) lightTheme.disabled = false;
            if (darkTheme) darkTheme.disabled = true;
            document.documentElement.setAttribute('data-theme', 'light');
        }

        // Save theme preference
        Utils.setStorage('user_theme', theme);
    }

    async loadDashboardData() {
        try {
            const api = this.modules.api;
            if (!api) return;

            const dashboardData = await api.getDashboard();

            // Update dashboard view
            this.components.views.renderDashboard(dashboardData);

            // Store current projects for later use
            this.currentProjects = dashboardData.projects || [];

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            Utils.showToast('Ошибка загрузки дашборда', 'error');
        }
    }

    async loadMyTasks() {
        try {
            const api = this.modules.api;
            if (!api) return;

            const statusFilter = document.getElementById('tasksFilterStatus')?.value || '';
            const projectFilter = document.getElementById('tasksFilterProject')?.value || '';
            const priorityFilter = document.getElementById('tasksFilterPriority')?.value || '';

            const filters = {};
            if (statusFilter) filters.status = statusFilter;
            if (projectFilter) filters.project_hash = projectFilter;
            if (priorityFilter) filters.priority = priorityFilter;

            const response = await api.getUserTasks(filters);
            const tasks = response.tasks || [];

            // Render tasks based on current view mode
            const viewMode = document.getElementById('tasksViewMode')?.value || 'list';
            const container = document.getElementById('myTasksList');

            if (container) {
                const renderer = this.components.tasks.taskViewModes.get(viewMode);
                if (renderer) {
                    renderer(tasks, container);
                }
            }

        } catch (error) {
            console.error('Error loading user tasks:', error);
            Utils.showToast('Ошибка загрузки задач', 'error');
        }
    }

    // View management
    showView(viewName) {
        this.components.views.showView(viewName);
        this.currentView = viewName;
    }

    showDashboard() {
        this.showView('dashboard');
        this.loadDashboardData();
    }

    showMyTasks() {
        this.showView('myTasks');
        this.loadMyTasks();
    }

    async showSearchProjects() {
        this.showView('searchProjects');
        await this.loadSearchProjects();
    }

    async loadSearchProjects() {
        try {
            const api = this.modules.api;
            if (!api) return;

            const response = await api.searchPublicProjects();
            const projects = response.projects || [];

            // Render search results
            this.renderSearchResults(projects, 'Публичные проекты');

        } catch (error) {
            console.error('Error loading search projects:', error);
            Utils.showToast('Ошибка загрузки проектов', 'error');
        }
    }

    renderSearchResults(projects, title) {
        const container = document.getElementById('searchResultsList');
        if (!container) return;

        if (!projects || projects.length === 0) {
            container.innerHTML = this.createEmptyState(
                'Проекты не найдены',
                'Попробуйте изменить поисковый запрос',
                '🔍'
            );
            return;
        }

        container.innerHTML = `
            <h3>${title}</h3>
            <div class="projects-container grid">
                ${projects.map(project => `
                    <div class="project-card">
                        <div class="project-card-header">
                            <h3 class="project-title">${Utils.escapeHtml(project.title)}</h3>
                            <div class="project-meta">
                                ${project.is_private ? '<span>🔒</span>' : '<span>🌐</span>'}
                            </div>
                        </div>
                        <p class="project-description">
                            ${Utils.escapeHtml(project.description || 'Без описания')}
                        </p>
                        <div class="project-actions">
                            <button class="btn btn-primary" onclick="App.joinProject('${project.hash}')">
                                Присоединиться
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Project management
    async openProject(projectHash) {
        try {
            const api = this.modules.api;
            if (!api) return;

            const projectData = await api.getProject(projectHash);
            this.currentProject = projectData.project || projectData;

            // Get project summary for stats
            const summary = await api.getProjectSummary(projectHash);

            // Render project view
            this.components.views.renderProjectView({
                ...projectData,
                summary
            });

            this.showView('projectView');

        } catch (error) {
            console.error('Error opening project:', error);
            Utils.showToast('Ошибка открытия проекта', 'error');
        }
    }

    // Добавляем метод backToProject:
    backToProject() {
        if (this.currentProject) {
            this.openProject(this.currentProject.hash);
        } else {
            this.showDashboard();
        }
    }
    async loadProjectTasks(projectHash) {
        try {
            const api = this.modules.api;
            if (!api) return;

            const response = await api.getTasks(projectHash);
            const tasks = response.tasks || [];

            this.renderProjectTasks(tasks);

        } catch (error) {
            console.error('Error loading project tasks:', error);
        }
    }

    async loadProjectMembers(projectHash) {
        try {
            const api = this.modules.api;
            if (!api) return;

            const response = await api.getProjectMembers(projectHash);
            const members = response.members || [];

            this.renderProjectMembers(members);

        } catch (error) {
            console.error('Error loading project members:', error);
        }
    }

    renderProjectTasks(tasks) {
        const container = document.getElementById('projectTasksList');
        if (!container) return;

        if (!tasks || tasks.length === 0) {
            container.innerHTML = this.createEmptyState(
                'Задач нет',
                'Создайте первую задачу в проекте',
                '✅',
                `<button class="btn btn-primary" onclick="App.components.modals.showCreateTaskModal('${this.currentProject.hash}')">
                    Создать задачу
                </button>`
            );
            return;
        }

        // Show only main tasks (no parent)
        const mainTasks = tasks.filter(task => !task.parent_task_id);

        container.innerHTML = mainTasks.map(task => `
            <div class="task-card" data-task-id="${task.id}">
                <div class="task-card-header">
                    <h4 class="task-title">${Utils.escapeHtml(task.title)}</h4>
                    <span class="task-priority priority-${task.priority}">
                        ${this.components.tasks.getPriorityText(task.priority)}
                    </span>
                </div>
                <p class="task-description">${Utils.escapeHtml(task.description || '')}</p>
                <div class="task-meta">
                    <span class="task-status status-${task.status}">
                        ${this.components.tasks.getStatusText(task.status)}
                    </span>
                    ${task.due_date ? `
                    <span class="task-date ${Utils.isOverdue(task.due_date) ? 'overdue' : ''}">
                        ${Utils.formatDate(task.due_date)}
                    </span>
                    ` : ''}
                </div>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.task-card').forEach(card => {
            card.addEventListener('click', () => {
                this.openTask(card.dataset.taskId);
            });
        });
    }

    renderProjectMembers(members) {
        const container = document.getElementById('projectMembersList');
        if (!container) return;

        if (!members || members.length === 0) {
            container.innerHTML = '<p>Участников нет</p>';
            return;
        }

        container.innerHTML = members.map(member => {
            const memberData = member.user || member;
            const displayName = memberData.full_name || `Участник #${member.user_id || memberData.id}`;
            const isCurrentUser = (member.user_id || memberData.id) === this.currentUser?.id;

            return `
                <div class="member-item">
                    <div class="member-avatar">
                        ${Utils.getInitials(displayName)}
                    </div>
                    <div class="member-info">
                        <div class="member-name">${Utils.escapeHtml(displayName)}</div>
                        <div class="member-role">
                            ${this.getRoleText(member.role)}
                            ${isCurrentUser ? ' (Вы)' : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Task management
    async openTask(taskId) {
        await this.components.tasks.openTask(taskId);
    }

    backToProject() {
        if (this.currentProject) {
            this.openProject(this.currentProject.hash);
        } else {
            this.showDashboard();
        }
    }

    // User management
    toggleUserMenu() {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) {
            dropdown.classList.toggle('show');
        }
    }

    hideUserMenu() {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }

    handleUserAction(action) {
        this.hideUserMenu();

        switch (action) {
            case 'profile':
                this.showProfile();
                break;
            case 'settings':
                this.showSettings();
                break;
            case 'logout':
                this.logout();
                break;
        }
    }

    showProfile() {
        // Implement profile view
        Utils.showToast('Профиль пользователя', 'info');
    }

    showSettings() {
        // Implement settings view
        Utils.showToast('Настройки приложения', 'info');
    }

    async logout() {
        try {
            await this.modules.auth.logout();
        } catch (error) {
            console.error('Error during logout:', error);
        }
    }

    // Notifications
    showNotifications() {
        this.showNotificationsFallback();
    }

    // Project joining
    async joinProject(projectHash) {
        try {
            const api = this.modules.api;
            if (!api) return;

            const response = await api.joinProject(projectHash);

            if (response.status === 'joined') {
                Utils.showToast('Вы успешно присоединились к проекту!', 'success');
                this.openProject(projectHash);
            } else if (response.status === 'pending_approval') {
                Utils.showToast('Заявка на вступление отправлена!', 'success');
                this.showDashboard();
            }

        } catch (error) {
            console.error('Error joining project:', error);

            if (error.message.includes('already a member')) {
                Utils.showToast('Вы уже являетесь участником этого проекта', 'info');
                this.openProject(projectHash);
            } else {
                Utils.showToast('Ошибка вступления в проект', 'error');
            }
        }
    }

    // Utility methods
    createEmptyState(title, description, icon, action = '') {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">${icon}</div>
                <h3 class="empty-state-title">${title}</h3>
                <p class="empty-state-description">${description}</p>
                ${action}
            </div>
        `;
    }

    getRoleText(role) {
        const roleMap = {
            'owner': 'Владелец',
            'admin': 'Администратор',
            'member': 'Участник',
            'guest': 'Гость'
        };
        return roleMap[role] || role;
    }

    // UI state management
    showLoading() {
        document.getElementById('loading').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    }

    showApp() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('app').style.display = 'block';
    }

    showError(message) {
        // You might want to show a more sophisticated error screen
        alert('Ошибка: ' + message);
    }

    // Background processes
    startBackgroundProcesses() {
        // Start notification polling
        this.modules.notifications.startPolling();

        // Start cache cleanup
        if (this.modules.cache.startCleanupInterval) {
            this.modules.cache.startCleanupInterval();
        }

        // Start token expiration check
        if (this.modules.auth.startTokenExpirationCheck) {
            this.modules.auth.startTokenExpirationCheck();
        }
    }

    // Event handlers
    handleGlobalError(event) {
        console.error('Global error:', event.error);
        Utils.showToast('Произошла непредвиденная ошибка', 'error');
    }

    handleUnhandledRejection(event) {
        console.error('Unhandled promise rejection:', event.reason);
        Utils.showToast('Ошибка в приложении', 'error');
    }

    handleOnline() {
        Utils.showToast('Соединение восстановлено', 'success');
        // Reload data when coming back online
        this.loadDashboardData();
    }

    handleOffline() {
        Utils.showToast('Отсутствует подключение к интернету', 'warning');
    }

    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // Tab became visible, refresh data if needed
            this.modules.notifications.checkForNewNotifications();
        }
    }

    // Cleanup
    destroy() {
        // Cleanup modules
        for (const [name, module] of Object.entries(this.modules)) {
            if (typeof module.destroy === 'function') {
                module.destroy();
            }
        }

        // Cleanup components
        for (const [name, component] of Object.entries(this.components)) {
            if (typeof component.destroy === 'function') {
                component.destroy();
            }
        }

        this.isInitialized = false;
        console.log('Project Pilot destroyed');
    }
}

// Create global app instance
window.App = new ProjectPilotApp();

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.App.init();
    });
} else {
    window.App.init();
}

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProjectPilotApp };
}
