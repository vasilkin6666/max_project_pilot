// Основной класс приложения (исправленная версия)
class App {
    static eventHandlersSetup = false;
    static templatesLoaded = false;
    static themeUpdateDebounce = null;
    static isApplyingTheme = false;

    // ---------- ТЕМА ----------
    static applyTheme(theme) {
        if (this.isApplyingTheme) return;
        this.isApplyingTheme = true;

        try {
            // ← Объявляем переменную, чтобы не было ReferenceError
            const finalTheme = theme || CONFIG.UI.THEME.LIGHT;
            const lightTheme = document.getElementById('theme-light');
            const darkTheme  = document.getElementById('theme-dark');

            if (finalTheme === 'dark') {
                if (lightTheme) lightTheme.disabled = true;
                if (darkTheme)  darkTheme.disabled  = false;
                document.body.setAttribute('data-theme', 'dark');
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                if (lightTheme) lightTheme.disabled = false;
                if (darkTheme)  darkTheme.disabled  = true;
                document.body.removeAttribute('data-theme');
                document.documentElement.removeAttribute('data-theme');
            }

            StateManager.setTheme(finalTheme);
            localStorage.setItem('theme', finalTheme);
            this.forceThemeApplication(finalTheme);

            // Сохраняем предпочтения пользователя (если уже залогинен)
            setTimeout(async () => {
                if (typeof UsersManager !== 'undefined' && AuthManager.isUserAuthenticated()) {
                    try {
                        const prefs = await UsersManager.loadUserPreferences();
                        if (prefs.theme !== finalTheme) {
                            await UsersManager.patchUserPreferences({ theme: finalTheme });
                        }
                    } catch (err) {
                        Utils.logError('Failed to save theme preference:', err);
                    }
                }
            }, 2000);
        } finally {
            setTimeout(() => { this.isApplyingTheme = false; }, 1000);
        }

        Utils.log(`Theme changed to: ${finalTheme}`);
    }

    static forceThemeApplication(theme) {
        const mainContent = document.querySelector('.main-content');
        const notificationsView = document.getElementById('notifications-view');
        const settingsView = document.getElementById('settings-view');
        const filterBtn = document.getElementById('filter-btn');
        const sortBtn = document.getElementById('sort-btn');
        const priorityTasks = document.querySelector('.priority-tasks');
        const notificationsContainer = document.querySelector('.notifications-container');
        const settingsContainer = document.querySelector('.settings-container');

        if (mainContent) {
            mainContent.style.backgroundColor = theme === 'dark' ? '#0f1419' : '#f8f8f8';
            mainContent.style.color = theme === 'dark' ? '#ffffff' : '#2a2a2a';
        }
        if (filterBtn) {
            filterBtn.style.backgroundColor = theme === 'dark' ? '#1a1f2b' : '#ffffff';
            filterBtn.style.borderColor = theme === 'dark' ? '#3a4150' : '#e0e0e0';
            filterBtn.style.color = theme === 'dark' ? '#d0d4e0' : '#6e6b7b';
        }
        if (sortBtn) {
            sortBtn.style.backgroundColor = theme === 'dark' ? '#1a1f2b' : '#ffffff';
            sortBtn.style.borderColor = theme === 'dark' ? '#3a4150' : '#e0e0e0';
            sortBtn.style.color = theme === 'dark' ? '#d0d4e0' : '#6e6b7b';
        }
        if (priorityTasks) {
            priorityTasks.style.backgroundColor = theme === 'dark' ? '#1a1f2b' : '#ffffff';
            priorityTasks.style.borderColor = theme === 'dark' ? '#3a4150' : '#e0e0e0';
        }
        if (notificationsContainer) {
            notificationsContainer.style.backgroundColor = theme === 'dark' ? '#0f1419' : '#f8f8f8';
        }
        if (settingsContainer) {
            settingsContainer.style.backgroundColor = theme === 'dark' ? '#0f1419' : '#f8f8f8';
            settingsContainer.style.color = theme === 'dark' ? '#ffffff' : '#2a2a2a';
        }

        setTimeout(() => {
            EventManager.emit(APP_EVENTS.THEME_CHANGED, theme);
        }, 100);
    }

    static getCurrentTheme() {
        return StateManager.getState('ui.theme') ||
               localStorage.getItem('theme') ||
               CONFIG.UI.THEME.LIGHT;
    }

    static toggleTheme() {
        const newTheme = this.getCurrentTheme() === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        EventManager.emit(APP_EVENTS.THEME_CHANGED, newTheme);
        return newTheme;
    }

    // ---------- ИНИЦИАЛИЗАЦИЯ ----------
    static async init() {
        try {
            Utils.log('App initialization started');
            this.showLoadingOverlay();

            await this.checkSystemRequirements();
            await this.initializeCore();

            // 1. Сначала аутентификация – токен обязателен для всех запросов
            await AuthManager.initializeUser();

            // 2. Тема – берём сохранённую или светлую
            const savedTheme = StateManager.getState('ui.theme') ||
                               localStorage.getItem('theme') ||
                               CONFIG.UI.THEME.LIGHT;
            this.applyTheme(savedTheme);

            // 3. UI-компоненты
            if (typeof UIComponents === 'undefined') {
                throw new Error('UIComponents not loaded');
            }
            UIComponents.init();

            // 4. Данные
            await this.loadInitialData();

            this.hideLoadingOverlay();
            this.startBackgroundProcesses();
            this.activateUnusedComponents();
            this.setupCompleteEventSystem();

            Utils.log('App initialization completed');
            EventManager.emit(APP_EVENTS.DATA_LOADED);
        } catch (error) {
            Utils.logError('App initialization failed:', error);
            this.handleInitError(error);
        }
    }

    static async checkSystemRequirements() {
        const requirements = [
            { name: 'Local Storage', check: () => !!window.localStorage },
            { name: 'Fetch API', check: () => !!window.fetch },
            { name: 'Promise', check: () => !!window.Promise },
            { name: 'ES6 Support', check: () => !!window.Map && !!window.Set }
        ];
        const failed = requirements.filter(r => !r.check());
        if (failed.length) {
            throw new Error(`System requirements not met: ${failed.map(f => f.name).join(', ')}`);
        }
        Utils.log('System requirements check passed');
    }

    static async initializeCore() {
        const required = ['CONFIG', 'Utils', 'EventManager', 'APP_EVENTS', 'ApiService'];
        const missing = required.filter(c => typeof window[c] === 'undefined');
        if (missing.length) {
            throw new Error(`Missing required classes: ${missing.join(', ')}`);
        }

        const maxData = AuthManager.maxData;
        if (maxData) {
            Utils.log('MAX environment detected', {
                hasUser: !!maxData.user,
                language: maxData.user?.language_code,
                hasPhoto: !!maxData.user?.photo_url
            });
            const maxLang = AuthManager.getMaxLanguage();
            if (maxLang && maxLang !== 'ru') {
                Utils.log(`MAX language detected: ${maxLang}`);
            }
        }

        Utils.log('Starting core systems initialization...');
        const managers = [
            { name: 'StateManager', instance: StateManager },
            { name: 'CacheManager', instance: CacheManager },
            { name: 'SwipeManager', instance: SwipeManager },
            { name: 'HapticManager', instance: HapticManager },
            { name: 'UsersManager', instance: UsersManager }
        ];

        for (const m of managers) {
            if (typeof m.instance !== 'undefined' && typeof m.instance.init === 'function') {
                try {
                    await m.instance.init();
                    Utils.log(`${m.name} initialized`);
                } catch (e) {
                    Utils.logError(`Error initializing ${m.name}:`, e);
                }
            }
        }

        if (!this.eventHandlersSetup) {
            this.setupErrorHandling();
            this.setupEventHandlers();
            this.setupNetworkHandler();
            this.eventHandlersSetup = true;
        }

        Utils.log('All core systems initialized successfully');
    }

    // ---------- КОМПОНЕНТЫ ----------
    static activateUnusedComponents() {
        try {
            this.initNetworkStatus();

            if (typeof SwipeManager !== 'undefined') {
                SwipeManager.setupMemberSwipes();
                SwipeManager.setupNotificationSwipes();
            }
            if (typeof HapticManager !== 'undefined') {
                HapticManager.initHapticIntegration();
            }
            if (typeof Utils !== 'undefined') {
                Utils.initValidationSystem();
            }
            if (typeof UsersManager !== 'undefined') {
                UsersManager.initSettingsIntegration();
            }
            if (typeof TasksManager !== 'undefined') {
                TasksManager.initTaskFilters();
            }
            if (typeof DashboardManager !== 'undefined') {
                try {
                    DashboardManager.initAdvancedStats();
                } catch (e) {
                    Utils.logError('Error initializing dashboard stats:', e);
                }
            }
            if (typeof AuthManager !== 'undefined') {
                AuthManager.initPermissionSystem();
            }
        } catch (e) {
            Utils.logError('Error activating unused components:', e);
        }
    }

    static initNetworkStatus() {
        const indicator = document.createElement('div');
        indicator.id = 'network-status-indicator';
        indicator.className = 'network-status-indicator';
        indicator.innerHTML = `
            <div class="network-status online"></div>
            <span class="network-status-text">В сети</span>
        `;
        const headerActions = document.querySelector('.header-actions');
        if (headerActions) headerActions.appendChild(indicator);

        EventManager.on(APP_EVENTS.NETWORK_STATUS_CHANGED, status => {
            const statusEl = indicator.querySelector('.network-status');
            const textEl = indicator.querySelector('.network-status-text');
            statusEl.className = `network-status ${status}`;
            textEl.textContent = status === 'online' ? 'В сети' : 'Не в сети';
            if (status === 'offline') this.showOfflineIndicator();
            else this.hideOfflineIndicator();
        });
    }

    // ---------- СОБЫТИЯ ----------
    static setupCompleteEventSystem() {
        Object.values(APP_EVENTS).forEach(event => {
            EventManager.on(event, data => {
                Utils.log(`Event: ${event}`, data);
                switch (event) {
                    case APP_EVENTS.PROJECT_CREATED:
                        this.handleProjectCreated(data);
                        break;
                    case APP_EVENTS.TASK_UPDATED:
                        this.handleTaskUpdated(data);
                        break;
                    case APP_EVENTS.NETWORK_STATUS_CHANGED:
                        this.handleNetworkStatusChange(data);
                        break;
                }
            });
        });
    }

    static handleProjectCreated(project) {
        CacheManager.invalidate('projects');
        CacheManager.invalidate('dashboard');
        if (typeof DashboardManager !== 'undefined') DashboardManager.refreshProjects();
    }

    static handleTaskUpdated(task) {
        if (task.project_hash) CacheManager.invalidate(`project-${task.project_hash}`);
    }

    static setupErrorHandling() {
        window.addEventListener('error', ev => {
            Utils.logError('Global error:', ev.error);
            if (typeof HapticManager !== 'undefined') HapticManager.error();
            if (!ev.error?.message?.includes('Loading') && !ev.error?.message?.includes('Chunk')) {
                this.showErrorToast('Произошла непредвиденная ошибка');
            }
        });

        window.addEventListener('unhandledrejection', ev => {
            Utils.logError('Unhandled promise rejection:', ev.reason);
            if (typeof HapticManager !== 'undefined') HapticManager.error();
            this.showErrorToast('Ошибка выполнения операции');
            ev.preventDefault();
        });

        Utils.log('Error handlers setup completed');
    }

    static showErrorToast(msg) {
        if (typeof ToastManager !== 'undefined') ToastManager.error(msg);
        else console.error('Error:', msg);
    }

    static setupEventHandlers() {
        EventManager.on(APP_EVENTS.THEME_CHANGED, theme => {
            this.applyTheme(theme);
            if (typeof UsersManager !== 'undefined' && AuthManager.isUserAuthenticated()) {
                UsersManager.patchUserPreferences({ theme }).catch(() => {});
            }
        });

        EventManager.on(APP_EVENTS.DATA_ERROR, () => this.showErrorToast('Ошибка загрузки данных'));
        EventManager.on(APP_EVENTS.DATA_LOADED, () => {
            if (typeof HapticManager !== 'undefined') HapticManager.success();
        });

        EventManager.on('data:loaded', async () => {
            const user = AuthManager.getCurrentUser();
            if (user) {
                this.applyTheme(user.preferences?.theme || 'light');
            } else {
                const off = EventManager.on(APP_EVENTS.USER_UPDATE, u => {
                    off();
                    this.applyTheme(u.preferences?.theme || 'light');
                });
            }
        });

        EventManager.on(APP_EVENTS.PROJECTS_LOADED, projects => {
            if (typeof SearchManager !== 'undefined') SearchManager.buildSearchIndex();
            StateManager.setState('projects', projects);
        });

        EventManager.on(APP_EVENTS.TASKS_LOADED, tasks => {
            if (typeof SearchManager !== 'undefined') SearchManager.buildSearchIndex();
            StateManager.setState('tasks', tasks);
        });

        EventManager.on(APP_EVENTS.NOTIFICATIONS_LOADED, n => StateManager.setState('notifications', n));
        EventManager.on(APP_EVENTS.NETWORK_STATUS_CHANGED, s => this.handleNetworkStatusChange(s));
        EventManager.on(APP_EVENTS.USER_UPDATE, u => this.updateUserInterface(u));

        this.handleProjectJoinFromUrl();
        Utils.log('Event handlers setup completed');
    }

    static updateUserInterface(user) {
        const avatar = document.getElementById('user-avatar');
        if (avatar) {
            const initials = Utils.getInitials(user.full_name || 'Пользователь');
            avatar.textContent = initials;
            if (user.photo_url) {
                avatar.style.backgroundImage = `url(${user.photo_url})`;
                avatar.textContent = '';
            }
        }
        if (typeof UIComponents !== 'undefined') UIComponents.updateAccountSettingsInfo(user);
    }

    static setupNetworkHandler() {
        window.addEventListener('online', () => {
            EventManager.emit(APP_EVENTS.NETWORK_STATUS_CHANGED, 'online');
            if (typeof ToastManager !== 'undefined') ToastManager.success('Соединение восстановлено');
            if (typeof HapticManager !== 'undefined') HapticManager.success();
            this.syncData();
        });

        window.addEventListener('offline', () => {
            EventManager.emit(APP_EVENTS.NETWORK_STATUS_CHANGED, 'offline');
            if (typeof ToastManager !== 'undefined') ToastManager.warning('Отсутствует соединение с интернетом');
            if (typeof HapticManager !== 'undefined') HapticManager.warning();
        });

        Utils.log('Network handler setup completed');
    }

    static handleNetworkStatusChange(status) {
        if (status === 'online') this.syncData();
    }

    // ---------- ДАННЫЕ ----------
    static async loadInitialData() {
        try {
            Utils.log('Starting initial data load...');

            // Параллельная загрузка ключевых данных
            const results = await Promise.allSettled([
                DashboardManager.loadDashboard(),
                NotificationsManager.loadNotifications(),
                ProjectsManager.loadProjects?.(),
                TasksManager.loadTasks?.(),
                UsersManager.loadCurrentUser?.()
            ]);

            // Логируем результаты
            results.forEach((result, idx) => {
                if (result.status === 'rejected') {
                    Utils.logError(`Initial load failed [${idx}]:`, result.reason);
                }
            });

            // Эмитируем событие завершения (даже если были ошибки)
            EventManager.emit(APP_EVENTS.INITIAL_DATA_LOADED);

            Utils.log('Initial data load completed');
        } catch (error) {
            Utils.logError('Critical error in loadInitialData:', error);
            ToastManager?.error('Не удалось загрузить данные приложения');
            EventManager.emit(APP_EVENTS.DATA_ERROR, error);
        }
    }

    static startBackgroundProcesses() {
        if (AuthManager.isUserAuthenticated()) {
            setInterval(() => this.syncData(), 30 * 1000);
            setInterval(() => {
                if (typeof NotificationsManager !== 'undefined') NotificationsManager.loadNotifications();
            }, 60 * 1000);
            setInterval(() => {
                if (AuthManager.isUserAuthenticated()) UsersManager.updateAccountSettingsInfo();
            }, 30 * 1000);
        }

        setInterval(() => {
            if (typeof CacheManager !== 'undefined') CacheManager.cleanup();
            if (typeof PersistenceManager !== 'undefined') PersistenceManager.cleanupOldData();
        }, 5 * 60 * 1000);

        Utils.log('Background processes started');
    }

    static async syncData() {
        if (!AuthManager.isUserAuthenticated()) {
            Utils.log('Sync skipped: user not authenticated');
            return;
        }

        try {
            Utils.log('Starting data sync...');

            const results = await Promise.allSettled([
                DashboardManager.loadDashboard(),
                NotificationsManager.loadNotifications(),
                ProjectsManager.refreshProjects?.(),
                TasksManager.refreshTasks?.()
            ]);

            results.forEach((result, idx) => {
                if (result.status === 'rejected') {
                    Utils.logError(`Sync failed [${idx}]:`, result.reason);
                }
            });

            EventManager.emit(APP_EVENTS.DATA_SYNCED);
            Utils.log('Data sync completed');
        } catch (error) {
            Utils.logError('Sync error:', error);
            ToastManager?.error('Ошибка синхронизации данных');
        }
    }

    static async handleProjectJoinFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const hash = params.get('join');
        if (!hash || !AuthManager.isUserAuthenticated()) return;

        try {
            Utils.log(`Attempting to join project: ${hash}`);
            await ApiService.joinProject(hash);
            if (typeof ToastManager !== 'undefined') ToastManager.success('Вы успешно присоединились к проекту!');
            if (typeof HapticManager !== 'undefined') HapticManager.success();

            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);

            if (typeof ProjectsManager !== 'undefined') {
                await ProjectsManager.loadProjects();
                ProjectsManager.openProjectDetail(hash);
            }
        } catch (e) {
            Utils.logError('Error joining project:', e);
            if (typeof ToastManager !== 'undefined') ToastManager.error('Ошибка присоединения к проекту: ' + e.message);
            if (typeof HapticManager !== 'undefined') HapticManager.error();
        }
    }

    // ---------- UI ----------
    static showLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden');
            overlay.setAttribute('aria-busy', 'true');
        }
    }

    static hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.setAttribute('aria-busy', 'false');
            setTimeout(() => overlay.style.display = 'none', 500);
        }
    }

    static handleInitError(error) {
        this.hideLoadingOverlay();
        const container = document.getElementById('app');
        if (!container) return;

        container.innerHTML = `
            <div class="error-container" style="padding:2rem;text-align:center;">
                <div class="error-icon" style="font-size:4rem;color:var(--danger-color);margin-bottom:1rem;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h2 style="color:var(--text-primary);margin-bottom:1rem;">Ошибка загрузки приложения</h2>
                <p style="color:var(--text-secondary);margin-bottom:2rem;">Не удалось инициализировать приложение. Пожалуйста, попробуйте позже.</p>
                <div class="error-details" style="margin-bottom:2rem;">
                    <details style="text-align:left;">
                        <summary style="cursor:pointer;color:var(--primary-color);">Подробности ошибки</summary>
                        <pre style="background:var(--bg-secondary);padding:1rem;border-radius:.5rem;margin-top:1rem;font-size:.8rem;overflow:auto;">
${Utils.escapeHTML(error.message || 'Unknown error')}
                        </pre>
                    </details>
                </div>
                <div class="error-actions" style="display:flex;gap:1rem;justify-content:center;">
                    <button class="btn btn-primary" onclick="location.reload()" style="padding:.5rem 1rem;">
                        <i class="fas fa-refresh"></i> Перезагрузить
                    </button>
                    <button class="btn btn-outline" onclick="App.showDebugInfo()" style="padding:.5rem 1rem;">
                        <i class="fas fa-bug"></i> Отладка
                    </button>
                </div>
            </div>
        `;
        this.showErrorToast('Ошибка загрузки приложения');
    }

    static getNetworkStatus() {
        return navigator.onLine ? 'online' : 'offline';
    }

    static async logout() {
        try {
            await AuthManager.logout();
            EventManager.emit(APP_EVENTS.USER_LOGOUT);
            if (typeof ToastManager !== 'undefined') ToastManager.success('Вы вышли из системы');
            StateManager.clearState();
            setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
            Utils.logError('Logout error:', e);
            if (typeof ToastManager !== 'undefined') ToastManager.error('Ошибка при выходе');
        }
    }

    // ---------- ОТЛАДКА ----------
    static showDebugInfo() {
        if (typeof ModalManager === 'undefined') {
            console.error('ModalManager not available');
            return;
        }
        const state = StateManager.getState();
        const cache = typeof CacheManager !== 'undefined' ? CacheManager.getStats() : {};
        const storage = typeof PersistenceManager !== 'undefined' ? PersistenceManager.getStorageInfo() : {};
        const net = this.getNetworkStatus();
        const user = AuthManager.getCurrentUser();

        ModalManager.showModal('debug-info', {
            title: 'Информация для разработки',
            size: 'large',
            template: `
                <div class="debug-info">
                    <div class="debug-section"><h5>Системная информация</h5>
                        <div class="system-info">
                            <div><strong>Сеть:</strong> <span class="badge ${net === 'online' ? 'success' : 'warning'}">${net}</span></div>
                            <div><strong>Пользователь:</strong> ${user ? user.full_name || user.username : 'Не аутентифицирован'}</div>
                            <div><strong>MAX ID:</strong> ${user ? (user.max_id || user.id || 'неизвестен') : 'неизвестен'}</div>
                            <div><strong>Тема:</strong> ${this.getCurrentTheme()}</div>
                            <div><strong>Версия:</strong> ${CONFIG.VERSION}</div>
                        </div>
                    </div>
                    <div class="debug-section"><h5>Состояние приложения</h5>
                        < casse><code>${JSON.stringify({
                            projects: state.projects?.length || 0,
                            tasks: state.tasks?.length || 0,
                            notifications: state.notifications?.length || 0,
                            currentView: state.ui?.currentView
                        }, null, 2)}</code></pre>
                    </div>
                    <div class="debug-section"><h5>Статистика кэша</h5>
                        <pre><code>${JSON.stringify(cache, null, 2)}</code></pre>
                    </div>
                    <div class="debug-section"><h5>Хранилище</h5>
                        <pre><code>${JSON.stringify(storage, null, 2)}</code></pre>
                    </div>
                </div>
            `,
            actions: [
                { text: 'Закрыть', type: 'secondary', action: 'close' },
                { text: 'Экспорт данных', type: 'primary', action: 'custom', onClick: () => PersistenceManager?.exportData() },
                { text: 'Очистить кэш', type: 'danger', action: 'custom', onClick: () => {
                    CacheManager?.clear();
                    if (typeof ToastManager !== 'undefined') ToastManager.success('Кэш очищен');
                    ModalManager.closeCurrentModal();
                }}
            ]
        });
    }

    static async healthCheck() {
        const checks = [
            { name: 'API Health', check: () => ApiService.healthCheck() },
            { name: 'Authentication', check: () => AuthManager.isUserAuthenticated() },
            { name: 'State Manager', check: () => !!StateManager },
            { name: 'Event System', check: () => !!EventManager }
        ];
        const results = [];
        for (const c of checks) {
            try {
                const res = await c.check();
                results.push({ name: c.name, status: 'healthy', result: res });
            } catch (e) {
                results.push({ name: c.name, status: 'unhealthy', error: e.message });
            }
        }
        return results;
    }
}

// ---------- ГЛОБАЛЬНЫЕ КОНСТАНТЫ ----------
if (typeof APP_EVENTS !== 'undefined') {
    APP_EVENTS.NETWORK_STATUS_CHANGED = 'network:status-changed';
}

// ---------- ЗАПУСК ----------
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('error', ev => Utils.logError('Global error caught:', ev.error));
    window.addEventListener('unhandledrejection', ev => Utils.logError('Unhandled promise rejection:', ev.reason));

    // Применяем сохранённую тему сразу, до полной инициализации
    setTimeout(() => {
        const theme = App.getCurrentTheme();
        App.applyTheme(theme);               // ← гарантируем, что finalTheme объявлена
    }, 300);

    setTimeout(() => App.init(), 100);
});

window.App = App;
