// Основной класс приложения (обновленная версия)
class App {
    static async init() {
        try {
            Utils.log('App initialization started');

            // Показываем loading screen
            this.showLoadingOverlay();

            // Инициализация ядра
            await this.initializeCore();

            // Аутентификация пользователя
            await AuthManager.initializeUser();

            // Инициализация UI компонентов
            UIComponents.init();

            // Загрузка начальных данных
            await this.loadInitialData();

            // Скрываем loading screen
            this.hideLoadingOverlay();

            // Запускаем фоновые процессы
            this.startBackgroundProcesses();

            Utils.log('App initialization completed');

            // Триггерим событие успешной инициализации
            EventManager.emit(APP_EVENTS.DATA_LOADED);

        } catch (error) {
            Utils.logError('App initialization failed:', error);
            this.handleInitError(error);
        }
    }

    static async initializeCore() {
        // Инициализация State Manager
        StateManager.init();

        // Инициализация Cache Manager
        CacheManager.init();

        // Инициализация Swipe Manager
        SwipeManager.init();

        // Инициализация Haptic Manager
        HapticManager.init();

        // Инициализация Search Manager
        SearchManager.buildSearchIndex();

        // Настройка обработчиков ошибок
        this.setupErrorHandling();

        // Настройка обработчиков событий
        this.setupEventHandlers();

        Utils.log('Core systems initialized');
    }

    static setupErrorHandling() {
        // Глобальный обработчик ошибок
        window.addEventListener('error', (event) => {
            Utils.logError('Global error:', event.error);
            HapticManager.error();
        });

        // Обработчик необработанных promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            Utils.logError('Unhandled promise rejection:', event.reason);
            HapticManager.error();
            event.preventDefault();
        });
    }

    static setupEventHandlers() {
        // Обработка изменения темы
        EventManager.on(APP_EVENTS.THEME_CHANGED, (theme) => {
            this.applyTheme(theme);
        });

        // Обработка ошибок загрузки данных
        EventManager.on(APP_EVENTS.DATA_ERROR, (error) => {
            ToastManager.error('Ошибка загрузки данных');
            HapticManager.error();
        });

        // Обработка успешной загрузки данных
        EventManager.on(APP_EVENTS.DATA_LOADED, () => {
            HapticManager.success();
        });

        // Обновление поискового индекса при изменении данных
        EventManager.on(APP_EVENTS.PROJECTS_LOADED, () => {
            SearchManager.buildSearchIndex();
        });

        EventManager.on(APP_EVENTS.TASKS_LOADED, () => {
            SearchManager.buildSearchIndex();
        });

        // Обработка присоединения к проекту по ссылке
        this.handleProjectJoinFromUrl();
    }

    static async loadInitialData() {
        const loaders = [
            DashboardManager.loadDashboard(),
            NotificationsManager.loadNotifications()
        ];

        await Promise.all(loaders);
        Utils.log('Initial data loaded');
    }

    static startBackgroundProcesses() {
        // Периодическая синхронизация данных
        setInterval(() => {
            this.syncData();
        }, 30 * 1000); // Каждые 30 секунд

        // Обновление уведомлений
        setInterval(() => {
            NotificationsManager.loadNotifications();
        }, 60 * 1000); // Каждую минуту

        // Очистка старого кэша
        setInterval(() => {
            CacheManager.cleanup();
            PersistenceManager.cleanupOldData();
        }, 5 * 60 * 1000); // Каждые 5 минут

        Utils.log('Background processes started');
    }

    static async syncData() {
        try {
            EventManager.emit(APP_EVENTS.SYNC_STARTED);

            await Promise.all([
                DashboardManager.loadDashboard(),
                ProjectsManager.loadProjects(),
                NotificationsManager.loadNotifications()
            ]);

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

                ToastManager.success('Вы успешно присоединились к проекту!');
                HapticManager.success();

                // Убираем параметр из URL
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);

                // Обновляем список проектов
                await ProjectsManager.loadProjects();

            } catch (error) {
                Utils.logError('Error joining project:', error);
                ToastManager.error('Ошибка присоединения к проекту: ' + error.message);
                HapticManager.error();
            }
        }
    }

    static showLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden');
        }
    }

    static hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
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
                <div class="error-container">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2>Ошибка загрузки приложения</h2>
                    <p>Не удалось инициализировать приложение. Пожалуйста, попробуйте позже.</p>
                    <div class="error-actions">
                        <button class="btn btn-primary" onclick="location.reload()">
                            <i class="fas fa-refresh"></i> Перезагрузить
                        </button>
                        <button class="btn btn-outline" onclick="App.showErrorDetails('${Utils.escapeHTML(error.message)}')">
                            <i class="fas fa-info-circle"></i> Подробности
                        </button>
                    </div>
                </div>
            `;
        }

        ToastManager.error('Ошибка загрузки приложения');
        HapticManager.error();
    }

    static showErrorDetails(errorMessage) {
        ModalManager.showModal('error-details', {
            title: 'Подробности ошибки',
            size: 'medium',
            template: `
                <div class="error-details">
                    <p>Произошла ошибка при инициализации приложения:</p>
                    <div class="error-message">
                        <code>${Utils.escapeHTML(errorMessage)}</code>
                    </div>
                    <p class="text-muted mt-3">
                        Если ошибка повторяется, попробуйте очистить кэш браузера или обратитесь в поддержку.
                    </p>
                </div>
            `,
            actions: [
                {
                    text: 'Закрыть',
                    type: 'secondary',
                    action: 'close'
                },
                {
                    text: 'Очистить кэш',
                    type: 'primary',
                    action: 'custom',
                    onClick: () => {
                        PersistenceManager.clearAll();
                        location.reload();
                    }
                }
            ]
        });
    }

    static applyTheme(theme) {
        const lightTheme = document.getElementById('theme-light');
        const darkTheme = document.getElementById('theme-dark');

        if (theme === 'dark') {
            lightTheme.disabled = true;
            darkTheme.disabled = false;
            document.body.setAttribute('data-theme', 'dark');
        } else {
            lightTheme.disabled = false;
            darkTheme.disabled = true;
            document.body.removeAttribute('data-theme');
        }

        // Сохраняем тему в localStorage
        localStorage.setItem('theme', theme);

        Utils.log(`Theme changed to: ${theme}`);
    }

    static getCurrentTheme() {
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

    static setupNetworkHandler() {
        window.addEventListener('online', () => {
            ToastManager.success('Соединение восстановлено');
            HapticManager.success();
            this.syncData();
        });

        window.addEventListener('offline', () => {
            ToastManager.warning('Отсутствует соединение с интернетом');
            HapticManager.warning();
        });
    }

    static async logout() {
        try {
            await AuthManager.logout();
            EventManager.emit(APP_EVENTS.USER_LOGOUT);

            ToastManager.success('Вы вышли из системы');

            // Перезагружаем страницу для очистки состояния
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            Utils.logError('Logout error:', error);
            ToastManager.error('Ошибка при выходе');
        }
    }

    // Методы для разработки и отладки
    static showDebugInfo() {
        const state = StateManager.getState();
        const cacheStats = CacheManager.getStats();
        const storageInfo = PersistenceManager.getStorageInfo();

        ModalManager.showModal('debug-info', {
            title: 'Информация для разработки',
            size: 'large',
            template: `
                <div class="debug-info">
                    <div class="debug-section">
                        <h5>Состояние приложения</h5>
                        <pre><code>${JSON.stringify(state, null, 2)}</code></pre>
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
                    onClick: () => PersistenceManager.exportData()
                },
                {
                    text: 'Очистить кэш',
                    type: 'danger',
                    action: 'custom',
                    onClick: () => {
                        CacheManager.clear();
                        ToastManager.success('Кэш очищен');
                        ModalManager.closeCurrentModal();
                    }
                }
            ]
        });
    }
}

// Запуск приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    // Инициализация обработчика сети
    App.setupNetworkHandler();

    // Глобальные горячие клавиши для разработки
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            e.preventDefault();
            App.showDebugInfo();
        }
    });

    // Запуск приложения
    App.init();
});

// Глобальные обработчики ошибок для улучшения UX
window.addEventListener('error', (event) => {
    Utils.logError('Global error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    Utils.logError('Unhandled promise rejection:', event.reason);
});

// Экспорт глобальных объектов для отладки
window.App = App;
