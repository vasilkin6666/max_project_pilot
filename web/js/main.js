class App {
    static async init() {
        Utils.log('App initialization started');

        // Инициализация UI
        UI.init();

        // Инициализация пользователя
        await AuthManager.initializeUser();

        // Инициализация дополнительных компонентов
        this.initComponents();

        // Обработка присоединения к проекту
        await this.handleProjectJoin();

        // Скрываем loading overlay
        UI.hideLoadingOverlay();

        // Загружаем начальные данные
        await DashboardManager.loadDashboardData();

        Utils.log('App initialization completed');
        UI.isInitialized = true;
    }

    static initComponents() {
        // Инициализация меню действий
        ActionMenuManager.initTaskActionMenu();

        // Инициализация счетчиков
        CountersManager.init();

        // Инициализация поиска
        TasksManager.initSearch();
        ProjectsManager.initSearch();

        // Инициализация вкладок приоритета
        TasksManager.initPriorityTabs();

        // Инициализация обработчиков уведомлений
        NotificationsManager.initNotificationHandlers();
        NotificationsManager.initPersistentBadge();

        Utils.log('All components initialized');
    }

    static async handleProjectJoin() {
        const urlParams = new URLSearchParams(window.location.search);
        const projectHash = urlParams.get('join');

        if (projectHash && AuthManager.isAuthenticated()) {
            try {
                Utils.log(`Attempting to join project: ${projectHash}`);
                await ApiService.apiJoinProject(projectHash);
                ToastManager.showToast('Вы успешно присоединились к проекту!', 'success');

                // Убираем параметр из URL
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            } catch (error) {
                Utils.logError('Error joining project', error);
                ToastManager.showToast('Ошибка присоединения к проекту: ' + error.message, 'error');
            }
        }
    }
}

// Инициализация при загрузке страницы
window.addEventListener('load', async () => {
    await App.init();
});

// Глобальные обработчики для фильтров задач
document.addEventListener('DOMContentLoaded', function() {
    // Обработчики для фильтрации задач из dropdown
    document.querySelectorAll('.filter-tasks').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const filter = this.getAttribute('data-filter');
            TasksManager.loadTasks(filter);
        });
    });

    // Обработчик для пустой кнопки создания проекта
    document.addEventListener('click', function(e) {
        if (e.target.id === 'create-project-btn-empty') {
            ProjectsManager.createProject();
        }
    });
});
