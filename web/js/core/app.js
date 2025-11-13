// Основной класс приложения (исправленная версия)
class App {
    // Добавьте свойство для отслеживания настройки обработчиков ДО всех методов
    static eventHandlersSetup = false;
    static templatesLoaded = false;
    static themeUpdateDebounce = null;
    static isApplyingTheme = false;

    static async init() {
        try {
            Utils.log('App initialization started');

            // Показываем loading screen
            this.showLoadingOverlay();

            // Проверяем системные требования
            await this.checkSystemRequirements();

            // Инициализация ядра
            await this.initializeCore();

            // Аутентификация пользователя
            await AuthManager.initializeUser();

            // Инициализация UI компонентов (теперь после auth)
            if (typeof UIComponents !== 'undefined') {
                UIComponents.init();
            } else {
                throw new Error('UIComponents not loaded');
            }

            // Загрузка начальных данных
            await this.loadInitialData();

            // Скрываем loading screen
            this.hideLoadingOverlay();

            // Запускаем фоновые процессы
            this.startBackgroundProcesses();

            this.activateUnusedComponents();
            this.setupCompleteEventSystem();

            Utils.log('App initialization completed');

            // Триггерим событие успешной инициализации
            EventManager.emit(APP_EVENTS.DATA_LOADED);

        } catch (error) {
            Utils.logError('App initialization failed:', error);
            this.handleInitError(error);
        }
    }

    static activateUnusedComponents() {
        try {
            // Сетевой статус
            this.initNetworkStatus();

            // Расширенные свайпы
            if (typeof SwipeManager !== 'undefined') {
                SwipeManager.setupMemberSwipes();
                SwipeManager.setupNotificationSwipes();
            }

            // Тактильная обратная связь
            if (typeof HapticManager !== 'undefined') {
                HapticManager.initHapticIntegration();
            }

            // Валидация
            if (typeof Utils !== 'undefined') {
                Utils.initValidationSystem();
            }

            // Настройки
            if (typeof UsersManager !== 'undefined') {
                UsersManager.initSettingsIntegration();
            }

            // Фильтры
            if (typeof TasksManager !== 'undefined') {
                TasksManager.initTaskFilters();
            }

            // Статистика - С ОБРАБОТКОЙ ОШИБОК
            if (typeof DashboardManager !== 'undefined') {
                try {
                    DashboardManager.initAdvancedStats();
                } catch (error) {
                    Utils.logError('Error initializing dashboard stats:', error);
                }
            }

            // Разрешения
            if (typeof AuthManager !== 'undefined') {
                AuthManager.initPermissionSystem();
            }
        } catch (error) {
            Utils.logError('Error activating unused components:', error);
        }
    }

    static initNetworkStatus() {
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'network-status-indicator';
        statusIndicator.className = 'network-status-indicator';
        statusIndicator.innerHTML = `
            <div class="network-status online"></div>
            <span class="network-status-text">В сети</span>
        `;

        // Добавляем в header
        const headerActions = document.querySelector('.header-actions');
        if (headerActions) {
            headerActions.appendChild(statusIndicator);
        }

        // Обработчик изменений сетевого статуса
        EventManager.on(APP_EVENTS.NETWORK_STATUS_CHANGED, (status) => {
            const statusElement = statusIndicator.querySelector('.network-status');
            const textElement = statusIndicator.querySelector('.network-status-text');

            statusElement.className = `network-status ${status}`;
            textElement.textContent = status === 'online' ? 'В сети' : 'Не в сети';

            if (status === 'offline') {
                this.showOfflineIndicator();
            } else {
                this.hideOfflineIndicator();
            }
        });
    }

    static setupCompleteEventSystem() {
        // Активируем все события
        Object.values(APP_EVENTS).forEach(event => {
            EventManager.on(event, (data) => {
                Utils.log(`📢 Event: ${event}`, data);

                // Специфичная обработка для ключевых событий
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

    // Обработчики событий
    static handleProjectCreated(project) {
        // Автоматически обновляем кэш и UI
        CacheManager.invalidate('projects');
        CacheManager.invalidate('dashboard');

        if (typeof DashboardManager !== 'undefined') {
            DashboardManager.refreshProjects();
        }
    }

    static handleTaskUpdated(task) {
        // Обновляем связанные данные
        if (task.project_hash) {
            CacheManager.invalidate(`project-${task.project_hash}`);
        }
    }


    static async checkSystemRequirements() {
        const requirements = [
            { name: 'Local Storage', check: () => !!window.localStorage },
            { name: 'Fetch API', check: () => !!window.fetch },
            { name: 'Promise', check: () => !!window.Promise },
            { name: 'ES6 Support', check: () => !!window.Map && !!window.Set }
        ];

        const failed = requirements.filter(req => !req.check());

        if (failed.length > 0) {
            throw new Error(`System requirements not met: ${failed.map(f => f.name).join(', ')}`);
        }

        Utils.log('System requirements check passed');
    }

    static async initializeCore() {
        // Проверка обязательных зависимостей
        const requiredClasses = ['CONFIG', 'Utils', 'EventManager', 'APP_EVENTS', 'ApiService'];
        const missing = requiredClasses.filter(cls => typeof window[cls] === 'undefined');
        if (missing.length > 0) {
            throw new Error(`Missing required classes: ${missing.join(', ')}`);
        }

        const maxData = AuthManager.maxData;
        if (maxData) {
            Utils.log('MAX environment detected', {
                hasUser: !!maxData.user,
                language: maxData.user?.language_code,
                hasPhoto: !!maxData.user?.photo_url
            });

            // Можно установить язык на основе MAX данных
            const maxLanguage = AuthManager.getMaxLanguage();
            if (maxLanguage && maxLanguage !== 'ru') {
                // В будущем можно добавить мультиязычность
                Utils.log(`MAX language detected: ${maxLanguage}`);
            }
        }

        Utils.log('Starting core systems initialization...');

        // Инициализируем менеджеры последовательно
        const managers = [
            { name: 'StateManager', instance: StateManager },
            { name: 'CacheManager', instance: CacheManager },
            { name: 'SwipeManager', instance: SwipeManager },
            { name: 'HapticManager', instance: HapticManager },
            { name: 'UsersManager', instance: UsersManager }
        ];

        for (const manager of managers) {
            if (typeof manager.instance !== 'undefined' && typeof manager.instance.init === 'function') {
                try {
                    await manager.instance.init();
                    Utils.log(`${manager.name} initialized`);
                } catch (error) {
                    Utils.logError(`Error initializing ${manager.name}:`, error);
                }
            }
        }

        // Настройка обработчиков (только один раз)
        if (!this.eventHandlersSetup) {
            this.setupErrorHandling();
            this.setupEventHandlers();
            this.setupNetworkHandler();
            this.eventHandlersSetup = true;
        }

        Utils.log('All core systems initialized successfully');
    }

    static startDataRefreshInterval() {
        // Обновляем данные каждые 2 минуты для предотвращения устаревания
        setInterval(async () => {
            if (AuthManager.isUserAuthenticated()) {
                try {
                    // Обновляем проекты
                    if (typeof ProjectsManager !== 'undefined') {
                        await ProjectsManager.loadProjects(true);
                    }
                    // Обновляем уведомления
                    if (typeof NotificationsManager !== 'undefined') {
                        await NotificationsManager.loadNotifications();
                    }
                    Utils.log('Background data refresh completed');
                } catch (error) {
                    Utils.logError('Background data refresh failed:', error);
                }
            }
        }, 2 * 60 * 1000); // 2 минуты
    }

    static setupErrorHandling() {
        // Глобальный обработчик ошибок
        window.addEventListener('error', (event) => {
            Utils.logError('Global error:', event.error);
            if (typeof HapticManager !== 'undefined') {
                HapticManager.error();
            }

            // Показываем пользовательское сообщение только для критических ошибок
            if (!event.error?.message?.includes('Loading') &&
                !event.error?.message?.includes('Chunk')) {
                this.showErrorToast('Произошла непредвиденная ошибка');
            }
        });

        // Обработчик необработанных promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            Utils.logError('Unhandled promise rejection:', event.reason);
            if (typeof HapticManager !== 'undefined') {
                HapticManager.error();
            }

            this.showErrorToast('Ошибка выполнения операции');
            event.preventDefault();
        });

        Utils.log('Error handlers setup completed');
    }

    static showErrorToast(message) {
        if (typeof ToastManager !== 'undefined') {
            ToastManager.error(message);
        } else {
            console.error('Error:', message);
        }
    }

    static setupEventHandlers() {
        // Обработка изменения темы
        EventManager.on(APP_EVENTS.THEME_CHANGED, (theme) => {
            this.applyTheme(theme);

            // Сохраняем тему в настройках пользователя, если доступен UsersManager
            if (typeof UsersManager !== 'undefined' && AuthManager.isUserAuthenticated()) {
                UsersManager.patchUserPreferences({ theme }).catch(() => {
                    // Игнорируем ошибки сохранения темы
                });
            }
        });

        // Обработка ошибок загрузки данных
        EventManager.on(APP_EVENTS.DATA_ERROR, (error) => {
            this.showErrorToast('Ошибка загрузки данных');
        });

        // Обработка успешной загрузки данных
        EventManager.on(APP_EVENTS.DATA_LOADED, () => {
            if (typeof HapticManager !== 'undefined') {
                HapticManager.success();
            }
        });

        EventManager.on('data:loaded', async () => {
            // Ждём, пока AuthManager полностью загрузит пользователя
            if (AuthManager.getCurrentUser()) {
                applyTheme(AuthManager.getCurrentUser().preferences?.theme || 'light');
            } else {
                // Если пользователь ещё не загружен — ждём
                const unwatch = EventManager.on(APP_EVENTS.USER_UPDATE, (user) => {
                    unwatch();
                    applyTheme(user.preferences?.theme || 'light');
                });
            }
        });

        // Обновление поискового индекса при изменении данных
        EventManager.on(APP_EVENTS.PROJECTS_LOADED, (projects) => {
            if (typeof SearchManager !== 'undefined') {
                SearchManager.buildSearchIndex();
            }

            // Обновляем статистику в StateManager
            StateManager.setState('projects', projects);
        });

        EventManager.on(APP_EVENTS.TASKS_LOADED, (tasks) => {
            if (typeof SearchManager !== 'undefined') {
                SearchManager.buildSearchIndex();
            }

            StateManager.setState('tasks', tasks);
        });

        EventManager.on(APP_EVENTS.NOTIFICATIONS_LOADED, (notifications) => {
            StateManager.setState('notifications', notifications);
        });

        // Обработка присоединения к проекту по ссылке
        this.handleProjectJoinFromUrl();

        // Обработка изменения онлайн-статуса
        EventManager.on(APP_EVENTS.NETWORK_STATUS_CHANGED, (status) => {
            this.handleNetworkStatusChange(status);
        });

        // Обработка обновления пользователя
        EventManager.on(APP_EVENTS.USER_UPDATE, (user) => {
            this.updateUserInterface(user);
        });

        Utils.log('Event handlers setup completed');
    }

    static updateUserInterface(user) {
        // Обновляем аватар в хедере
        const userAvatar = document.getElementById('user-avatar');
        if (userAvatar) {
            const initials = Utils.getInitials(user.full_name || 'Пользователь');
            userAvatar.textContent = initials;

            // Добавляем фото если есть
            if (user.photo_url) {
                userAvatar.style.backgroundImage = `url(${user.photo_url})`;
                userAvatar.textContent = '';
            }
        }

        // Обновляем информацию в настройках
        if (typeof UIComponents !== 'undefined') {
            UIComponents.updateAccountSettingsInfo(user);
        }
    }

    static setupNetworkHandler() {
        window.addEventListener('online', () => {
            EventManager.emit(APP_EVENTS.NETWORK_STATUS_CHANGED, 'online');

            if (typeof ToastManager !== 'undefined') {
                ToastManager.success('Соединение восстановлено');
            }
            if (typeof HapticManager !== 'undefined') {
                HapticManager.success();
            }

            // Автоматическая синхронизация при восстановлении соединения
            this.syncData();
        });

        window.addEventListener('offline', () => {
            EventManager.emit(APP_EVENTS.NETWORK_STATUS_CHANGED, 'offline');

            if (typeof ToastManager !== 'undefined') {
                ToastManager.warning('Отсутствует соединение с интернетом');
            }
            if (typeof HapticManager !== 'undefined') {
                HapticManager.warning();
            }
        });

        Utils.log('Network handler setup completed');
    }

    static handleNetworkStatusChange(status) {
        if (status === 'online') {
            // Автоматическая синхронизация при восстановлении связи
            this.syncData();
        }
    }

    static async loadInitialData() {
        try {
            const loaders = [];

            // Загружаем шаблоны только один раз
            if (typeof UIComponents !== 'undefined' && !this.templatesLoaded) {
                await UIComponents.loadTemplates();
                this.templatesLoaded = true;
            }

            // Загружаем дашборд если пользователь аутентифицирован
            if (AuthManager.isUserAuthenticated()) {
                if (typeof DashboardManager !== 'undefined') {
                    loaders.push(DashboardManager.loadDashboard().catch(error => {
                        Utils.logError('Dashboard load failed:', error);
                        return null;
                    }));
                }

                if (typeof NotificationsManager !== 'undefined') {
                    loaders.push(NotificationsManager.loadNotifications().catch(error => {
                        Utils.logError('Notifications load failed:', error);
                        return [];
                    }));
                }

                // Загружаем настройки пользователя
                if (typeof UsersManager !== 'undefined') {
                    loaders.push(UsersManager.loadUserPreferences().then(prefs => {
                        // Применяем сохраненную тему
                        if (prefs.theme && prefs.theme !== this.getCurrentTheme()) {
                            this.applyTheme(prefs.theme);
                        }
                        return prefs;
                    }).catch(error => {
                        Utils.logError('User preferences load failed:', error);
                        return {};
                    }));
                }

                // Загружаем проекты с принудительным обновлением после создания
                if (typeof ProjectsManager !== 'undefined') {
                    const forceRefresh = localStorage.getItem('force_refresh_projects') === 'true';
                    loaders.push(ProjectsManager.loadProjects(forceRefresh).catch(error => {
                        Utils.logError('Projects preload failed:', error);
                        return [];
                    }).finally(() => {
                        // Сбрасываем флаг принудительного обновления
                        localStorage.removeItem('force_refresh_projects');
                    }));
                }
            }

            if (loaders.length > 0) {
                await Promise.allSettled(loaders);
            }

            Utils.log('Initial data loaded successfully');
        } catch (error) {
            Utils.logError('Error loading initial data:', error);
        }
    }

    static startBackgroundProcesses() {
        // Периодическая синхронизация данных (только для аутентифицированных пользователей)
        if (AuthManager.isUserAuthenticated()) {
            setInterval(() => {
                this.syncData();
            }, 30 * 1000); // Каждые 30 секунд

            // Обновление уведомлений
            setInterval(() => {
                if (typeof NotificationsManager !== 'undefined') {
                    NotificationsManager.loadNotifications();
                }
            }, 60 * 1000); // Каждую минуту

            // Периодически обновляем информацию пользователя
            setInterval(() => {
                if (AuthManager.isUserAuthenticated()) {
                    UsersManager.updateAccountSettingsInfo();
                }
            }, 30000); // Каждые 30 секунд
        }

        // Очистка старого кэша (для всех пользователей)
        setInterval(() => {
            if (typeof CacheManager !== 'undefined') {
                CacheManager.cleanup();
            }
            if (typeof PersistenceManager !== 'undefined') {
                PersistenceManager.cleanupOldData();
            }
        }, 5 * 60 * 1000); // Каждые 5 минут

        Utils.log('Background processes started');
    }

    static async syncData() {
        // Синхронизация только при онлайн-статусе и аутентификации
        if (!navigator.onLine || !AuthManager.isUserAuthenticated()) {
            return;
        }

        try {
            EventManager.emit(APP_EVENTS.SYNC_STARTED);

            const syncTasks = [];

            if (typeof DashboardManager !== 'undefined') {
                syncTasks.push(DashboardManager.loadDashboard());
            }

            if (typeof ProjectsManager !== 'undefined') {
                syncTasks.push(ProjectsManager.loadProjects());
            }

            if (typeof NotificationsManager !== 'undefined') {
                syncTasks.push(NotificationsManager.loadNotifications());
            }

            if (syncTasks.length > 0) {
                await Promise.allSettled(syncTasks);
            }

            EventManager.emit(APP_EVENTS.SYNC_COMPLETED);
            Utils.log('Data sync completed');
        } catch (error) {
            EventManager.emit(APP_EVENTS.SYNC_FAILED, error);
            Utils.logError('Data sync failed:', error);
        }
    }

    static async handleProjectJoinFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const projectHash = urlParams.get('join');

        if (projectHash && AuthManager.isUserAuthenticated()) {
            try {
                Utils.log(`Attempting to join project: ${projectHash}`);
                await ApiService.joinProject(projectHash);

                if (typeof ToastManager !== 'undefined') {
                    ToastManager.success('Вы успешно присоединились к проекту!');
                }
                if (typeof HapticManager !== 'undefined') {
                    HapticManager.success();
                }

                // Убираем параметр из URL
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);

                // Обновляем список проектов
                if (typeof ProjectsManager !== 'undefined') {
                    await ProjectsManager.loadProjects();
                }

                // Показываем детали проекта
                if (typeof ProjectsManager !== 'undefined') {
                    ProjectsManager.openProjectDetail(projectHash);
                }

            } catch (error) {
                Utils.logError('Error joining project:', error);
                if (typeof ToastManager !== 'undefined') {
                    ToastManager.error('Ошибка присоединения к проекту: ' + error.message);
                }
                if (typeof HapticManager !== 'undefined') {
                    HapticManager.error();
                }
            }
        }
    }

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
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 500);
        }
    }

    static handleInitError(error) {
        this.hideLoadingOverlay();

        // Показываем ошибку инициализации
        const appContainer = document.getElementById('app');
        if (appContainer) {
            appContainer.innerHTML = `
                <div class="error-container" style="padding: 2rem; text-align: center;">
                    <div class="error-icon" style="font-size: 4rem; color: var(--danger-color); margin-bottom: 1rem;">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2 style="color: var(--text-primary); margin-bottom: 1rem;">Ошибка загрузки приложения</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem;">Не удалось инициализировать приложение. Пожалуйста, попробуйте позже.</p>
                    <div class="error-details" style="margin-bottom: 2rem;">
                        <details style="text-align: left;">
                            <summary style="cursor: pointer; color: var(--primary-color);">Подробности ошибки</summary>
                            <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; margin-top: 1rem; font-size: 0.8rem; overflow: auto;">
${Utils.escapeHTML(error.message || 'Unknown error')}
                            </pre>
                        </details>
                    </div>
                    <div class="error-actions" style="display: flex; gap: 1rem; justify-content: center;">
                        <button class="btn btn-primary" onclick="location.reload()" style="padding: 0.5rem 1rem;">
                            <i class="fas fa-refresh"></i> Перезагрузить
                        </button>
                        <button class="btn btn-outline" onclick="App.showDebugInfo()" style="padding: 0.5rem 1rem;">
                            <i class="fas fa-bug"></i> Отладка
                        </button>
                    </div>
                </div>
            `;
        }

        this.showErrorToast('Ошибка загрузки приложения');
    }

    // В app.js исправляем applyTheme
    static applyTheme(theme) {
        // Предотвращаем циклические вызовы
        if (this.isApplyingTheme) {
            return;
        }

        this.isApplyingTheme = true;

        try {
            const lightTheme = document.getElementById('theme-light');
            const darkTheme = document.getElementById('theme-dark');

            if (theme === 'dark') {
                if (lightTheme) lightTheme.disabled = true;
                if (darkTheme) darkTheme.disabled = false;
                document.body.setAttribute('data-theme', 'dark');
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                if (lightTheme) lightTheme.disabled = false;
                if (darkTheme) darkTheme.disabled = true;
                document.body.removeAttribute('data-theme');
                document.documentElement.removeAttribute('data-theme');
            }

            // Сохраняем тему в StateManager
            StateManager.setTheme(theme);

            // Сохраняем тему в localStorage для быстрого доступа
            localStorage.setItem('theme', theme);

            // Принудительно применяем тему ко всем элементам
            this.forceThemeApplication(theme);

            // Сохраняем тему в настройках пользователя с задержкой
            setTimeout(async () => {
                if (typeof UsersManager !== 'undefined' && AuthManager.isUserAuthenticated()) {
                    try {
                        const currentPrefs = await UsersManager.loadUserPreferences();
                        // Сохраняем только если тема изменилась
                        if (currentPrefs.theme !== theme) {
                            await UsersManager.patchUserPreferences({ theme });
                        }
                    } catch (error) {
                        // Игнорируем ошибки сохранения темы - это не критично
                        Utils.logError('Failed to save theme preference:', error);
                    }
                }
            }, 2000); // Увеличиваем задержку до 2 секунд

        } finally {
            // Сбрасываем флаг с задержкой чтобы предотвратить циклические вызовы
            setTimeout(() => {
                this.isApplyingTheme = false;
            }, 1000);
        }

        Utils.log(`Theme changed to: ${theme}`);
    }

    static forceThemeApplication(theme) {
        // Принудительно обновляем основные элементы
        const mainContent = document.querySelector('.main-content');
        const notificationsView = document.getElementById('notifications-view');
        const settingsView = document.getElementById('settings-view');

        if (mainContent) {
            mainContent.style.backgroundColor = theme === 'dark' ? '#0f1419' : '#f8f8f8';
            mainContent.style.color = theme === 'dark' ? '#ffffff' : '#2a2a2a';
        }

        // Обновляем кнопки фильтров и сортировки
        const filterBtn = document.getElementById('filter-btn');
        const sortBtn = document.getElementById('sort-btn');

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

        // Обновляем секцию приоритетных задач
        const priorityTasks = document.querySelector('.priority-tasks');
        if (priorityTasks) {
            priorityTasks.style.backgroundColor = theme === 'dark' ? '#1a1f2b' : '#ffffff';
            priorityTasks.style.borderColor = theme === 'dark' ? '#3a4150' : '#e0e0e0';
        }

        // Обновляем контейнер уведомлений
        const notificationsContainer = document.querySelector('.notifications-container');
        if (notificationsContainer) {
            notificationsContainer.style.backgroundColor = theme === 'dark' ? '#0f1419' : '#f8f8f8';
        }

        // Обновляем настройки
        const settingsContainer = document.querySelector('.settings-container');
        if (settingsContainer) {
            settingsContainer.style.backgroundColor = theme === 'dark' ? '#0f1419' : '#f8f8f8';
            settingsContainer.style.color = theme === 'dark' ? '#ffffff' : '#2a2a2a';
        }

        // Триггерим событие изменения темы для всех подписчиков
        setTimeout(() => {
            EventManager.emit(APP_EVENTS.THEME_CHANGED, theme);
        }, 100);
    }

    static getCurrentTheme() {
        // Сначала из StateManager, потом из localStorage
        const stateTheme = StateManager.getState('ui.theme');
        if (stateTheme) return stateTheme;

        return localStorage.getItem('theme') || 'light';
    }

    static toggleTheme() {
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        this.applyTheme(newTheme);
        EventManager.emit(APP_EVENTS.THEME_CHANGED, newTheme);

        return newTheme;
    }

    static getNetworkStatus() {
        return navigator.onLine ? 'online' : 'offline';
    }

    static async logout() {
        try {
            await AuthManager.logout();
            EventManager.emit(APP_EVENTS.USER_LOGOUT);

            if (typeof ToastManager !== 'undefined') {
                ToastManager.success('Вы вышли из системы');
            }

            // Очищаем состояние приложения
            StateManager.clearState();

            // Перезагружаем страницу для полной очистки состояния
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            Utils.logError('Logout error:', error);
            if (typeof ToastManager !== 'undefined') {
                ToastManager.error('Ошибка при выходе');
            }
        }
    }

    // Методы для разработки и отладки
    static showDebugInfo() {
        if (typeof ModalManager === 'undefined') {
            console.error('ModalManager not available');
            return;
        }

        const state = StateManager.getState();
        const cacheStats = typeof CacheManager !== 'undefined' ? CacheManager.getStats() : {};
        const storageInfo = typeof PersistenceManager !== 'undefined' ? PersistenceManager.getStorageInfo() : {};
        const networkStatus = this.getNetworkStatus();
        const user = AuthManager.getCurrentUser();

        ModalManager.showModal('debug-info', {
            title: 'Информация для разработки',
            size: 'large',
            template: `
                <div class="debug-info">
                    <div class="debug-section">
                        <h5>Системная информация</h5>
                        <div class="system-info">
                            <div><strong>Сеть:</strong> <span class="badge ${networkStatus === 'online' ? 'success' : 'warning'}">${networkStatus}</span></div>
                            <div><strong>Пользователь:</strong> ${user ? user.full_name || user.username : 'Не аутентифицирован'}</div>
                            <div><strong>MAX ID:</strong> ${user ? (user.max_id || user.id || 'неизвестен') : 'неизвестен'}</div>
                            <div><strong>Тема:</strong> ${this.getCurrentTheme()}</div>
                            <div><strong>Версия:</strong> ${CONFIG.VERSION}</div>
                        </div>
                    </div>

                    <div class="debug-section">
                        <h5>Состояние приложения</h5>
                        <pre><code>${JSON.stringify({
                            projects: state.projects?.length || 0,
                            tasks: state.tasks?.length || 0,
                            notifications: state.notifications?.length || 0,
                            currentView: state.ui?.currentView
                        }, null, 2)}</code></pre>
                    </div>

                    <div class="debug-section">
                        <h5>Статистика кэша</h5>
                        <pre><code>${JSON.stringify(cacheStats, null, 2)}</code></pre>
                    </div>

                    <div class="debug-section">
                        <h5>Хранилище</h5>
                        <pre><code>${JSON.stringify(storageInfo, null, 2)}</code></pre>
                    </div>
                </div>
            `,
            actions: [
                {
                    text: 'Закрыть',
                    type: 'secondary',
                    action: 'close'
                },
                {
                    text: 'Экспорт данных',
                    type: 'primary',
                    action: 'custom',
                    onClick: () => {
                        if (typeof PersistenceManager !== 'undefined') {
                            PersistenceManager.exportData();
                        }
                    }
                },
                {
                    text: 'Очистить кэш',
                    type: 'danger',
                    action: 'custom',
                    onClick: () => {
                        if (typeof CacheManager !== 'undefined') {
                            CacheManager.clear();
                        }
                        if (typeof ToastManager !== 'undefined') {
                            ToastManager.success('Кэш очищен');
                        }
                        ModalManager.closeCurrentModal();
                    }
                }
            ]
        });
    }

    // Health check приложения
    static async healthCheck() {
        const checks = [
            { name: 'API Health', check: () => ApiService.healthCheck() },
            { name: 'Authentication', check: () => AuthManager.isUserAuthenticated() },
            { name: 'State Manager', check: () => !!StateManager },
            { name: 'Event System', check: () => !!EventManager }
        ];

        const results = [];
        for (const check of checks) {
            try {
                const result = await check.check();
                results.push({ name: check.name, status: 'healthy', result });
            } catch (error) {
                results.push({ name: check.name, status: 'unhealthy', error: error.message });
            }
        }

        return results;
    }
}

// Глобальные события для сетевого статуса
if (typeof APP_EVENTS !== 'undefined') {
    APP_EVENTS.NETWORK_STATUS_CHANGED = 'network:status-changed';
}

// Запуск приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    // Устанавливаем глобальные обработчики ошибок
    window.addEventListener('error', (event) => {
        Utils.logError('Global error caught:', event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
        Utils.logError('Unhandled promise rejection:', event.reason);
    });

    // Глобальные горячие клавиши для разработки
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            e.preventDefault();
            App.showDebugInfo();
        }

        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            App.healthCheck().then(results => {
                console.log('Health Check Results:', results);
                ToastManager.info('Health check completed');
            });
        }
    });

    // Принудительно применяем тему при загрузке
    setTimeout(() => {
        const currentTheme = App.getCurrentTheme();
        App.forceThemeApplication(currentTheme);
    }, 1000);

    // Запуск приложения с небольшой задержкой для полной загрузки DOM
    setTimeout(() => {
        App.init();
    }, 100);
});

// Экспорт глобальных объектов для отладки
window.App = App;
