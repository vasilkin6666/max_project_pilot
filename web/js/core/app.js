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
        if (typeof StateManager !== 'undefined') {
            StateManager.init();
        }

        // Инициализация Cache Manager
        if (typeof CacheManager !== 'undefined') {
            CacheManager.init();
        }

        // Инициализация Swipe Manager
        if (typeof SwipeManager !== 'undefined') {
            SwipeManager.init();
        }

        // Инициализация Haptic Manager
        if (typeof HapticManager !== 'undefined') {
            HapticManager.init();
        }

        // Инициализация Search Manager
        if (typeof SearchManager !== 'undefined') {
            SearchManager.buildSearchIndex();
        }

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
            if (typeof HapticManager !== 'undefined') {
                HapticManager.error();
            }
        });

        // Обработчик необработанных promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            Utils.logError('Unhandled promise rejection:', event.reason);
            if (typeof HapticManager !== 'undefined') {
                HapticManager.error();
            }
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
            if (typeof ToastManager !== 'undefined') {
                ToastManager.error('Ошибка загрузки данных');
            }
            if (typeof HapticManager !== 'undefined') {
                HapticManager.error();
            }
        });

        // Обработка успешной загрузки данных
        EventManager.on(APP_EVENTS.DATA_LOADED, () => {
            if (typeof HapticManager !== 'undefined') {
                HapticManager.success();
            }
        });

        // Обновление поискового индекса при изменении данных
        EventManager.on(APP_EVENTS.PROJECTS_LOADED, () => {
            if (typeof SearchManager !== 'undefined') {
                SearchManager.buildSearchIndex();
            }
        });

        EventManager.on(APP_EVENTS.TASKS_LOADED, () => {
            if (typeof SearchManager !== 'undefined') {
                SearchManager.buildSearchIndex();
            }
        });

        // Обработка присоединения к проекту по ссылке
        this.handleProjectJoinFromUrl();
    }

    static async loadInitialData() {
        try {
            const loaders = [];

            if (typeof DashboardManager !== 'undefined') {
                loaders.push(DashboardManager.loadDashboard());
            }

            if (typeof NotificationsManager !== 'undefined') {
                loaders.push(NotificationsManager.loadNotifications());
            }

            if (loaders.length > 0) {
                await Promise.all(loaders);
            }

            Utils.log('Initial data loaded');
        } catch (error) {
            Utils.logError('Error loading initial data:', error);
            // Не прерываем инициализацию из-за ошибок загрузки данных
        }
    }

    static startBackgroundProcesses() {
        // Периодическая синхронизация данных
        setInterval(() => {
            this.syncData();
        }, 30 * 1000); // Каждые 30 секунд

        // Обновление уведомлений
        setInterval(() => {
            if (typeof NotificationsManager !== 'undefined') {
                NotificationsManager.loadNotifications();
            }
        }, 60 * 1000); // Каждую минуту

        // Очистка старого кэша
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
                await Promise.all(syncTasks);
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
                <div class="error-container" style="padding: 2rem; text-align: center;">
                    <div class="error-icon" style="font-size: 4rem; color: var(--danger-color); margin-bottom: 1rem;">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2 style="color: var(--text-primary); margin-bottom: 1rem;">Ошибка загрузки приложения</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem;">Не удалось инициализировать приложение. Пожалуйста, попробуйте позже.</p>
                    <div class="error-actions" style="display: flex; gap: 1rem; justify-content: center;">
                        <button class="btn btn-primary" onclick="location.reload()" style="padding: 0.5rem 1rem;">
                            <i class="fas fa-refresh"></i> Перезагрузить
                        </button>
                    </div>
                </div>
            `;
        }

        // Показываем toast только если ToastManager доступен
        if (typeof ToastManager !== 'undefined') {
            ToastManager.error('Ошибка загрузки приложения');
        }

        // Haptic feedback только если доступен
        if (typeof HapticManager !== 'undefined') {
            HapticManager.error();
        }
    }

    static showErrorDetails(errorMessage) {
        if (typeof ModalManager === 'undefined') {
            console.error('ModalManager not available');
            return;
        }

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
                        if (typeof PersistenceManager !== 'undefined') {
                            PersistenceManager.clearAll();
                        }
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
            if (lightTheme) lightTheme.disabled = true;
            if (darkTheme) darkTheme.disabled = false;
            document.body.setAttribute('data-theme', 'dark');
        } else {
            if (lightTheme) lightTheme.disabled = false;
            if (darkTheme) darkTheme.disabled = true;
            document.body.removeAttribute('data-theme');
        }

        // Сохраняем тему в localStorage
        localStorage.setItem('theme', theme);

        Utils.log(`Theme changed to: ${theme}`);
    }

    static getCurrentTheme() {
        // Сначала из StateManager, потом из localStorage
        const stateTheme = StateManager.getState('ui.theme');
        if (stateTheme && stateTheme !== 'light') return stateTheme;
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
            if (typeof ToastManager !== 'undefined') {
                ToastManager.success('Соединение восстановлено');
            }
            if (typeof HapticManager !== 'undefined') {
                HapticManager.success();
            }
            this.syncData();
        });

        window.addEventListener('offline', () => {
            if (typeof ToastManager !== 'undefined') {
                ToastManager.warning('Отсутствует соединение с интернетом');
            }
            if (typeof HapticManager !== 'undefined') {
                HapticManager.warning();
            }
        });
    }

    static async logout() {
        try {
            await AuthManager.logout();
            EventManager.emit(APP_EVENTS.USER_LOGOUT);

            if (typeof ToastManager !== 'undefined') {
                ToastManager.success('Вы вышли из системы');
            }

            // Перезагружаем страницу для очистки состояния
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

        const state = typeof StateManager !== 'undefined' ? StateManager.getState() : {};
        const cacheStats = typeof CacheManager !== 'undefined' ? CacheManager.getStats() : {};
        const storageInfo = typeof PersistenceManager !== 'undefined' ? PersistenceManager.getStorageInfo() : {};

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
                        if (typeof ModalManager !== 'undefined') {
                            ModalManager.closeCurrentModal();
                        }
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
