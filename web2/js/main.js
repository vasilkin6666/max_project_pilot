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
        await ProjectsManager.loadProjects();

        Utils.log('App initialization completed');
        UI.isInitialized = true;
    }

    static initComponents() {
        // Инициализация свайпов
        SwipeManager.init();

        // Инициализация обработчиков уведомлений
        NotificationsManager.initNotificationHandlers();

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

                // Обновляем список проектов
                await ProjectsManager.loadProjects();
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
