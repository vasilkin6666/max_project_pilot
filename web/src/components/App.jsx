const { useState, useEffect, useRef, createContext, useContext } = React;
const { motion, AnimatePresence } = window.framerMotion;

// Контекст приложения
const AppContext = createContext();

// Главный компонент приложения
const App = () => {
    const [appState, setAppState] = useState({
        isLoading: true,
        currentView: 'dashboard',
        projects: [],
        currentProject: null,
        currentTask: null,
        user: null,
        notifications: [],
        recentTasks: [],
        showCreateProjectModal: false,
        showCreateTaskModal: false,
        showCreateSubtaskModal: false,
        showSettingsModal: false,
        showNotificationsModal: false,
        showEditProjectModal: false,
        showEditTaskModal: false,
        showProjectMembersModal: false,
        showJoinRequestsModal: false
    });

    const [showConfetti, setShowConfetti] = useState(false);
    const [networkStatus, setNetworkStatus] = useState(navigator.onLine);

    // Отслеживание сетевого статуса
    useEffect(() => {
        const handleOnline = () => {
            setNetworkStatus(true);
            console.log('App: Online');
        };

        const handleOffline = () => {
            setNetworkStatus(false);
            console.log('App: Offline');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Инициализация приложения
    useEffect(() => {
        const initializeApp = async () => {
            try {
                console.log('App: Initializing...');

                // Инициализация аутентификации
                const user = await AuthManager.initialize();

                // Загрузка данных дашборда
                const dashboardData = await ApiService.getDashboard();

                setAppState(prev => ({
                    ...prev,
                    isLoading: false,
                    user: user,
                    projects: dashboardData.projects || [],
                    notifications: dashboardData.notifications || [],
                    recentTasks: dashboardData.recent_tasks || []
                }));

                // Эффект конфетти при первой загрузке
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 3000);

                console.log('App: Initialized successfully');

            } catch (error) {
                console.error('App: Initialization failed:', error);
                setAppState(prev => ({ ...prev, isLoading: false }));

                // Показываем ошибку загрузки
                alert('Ошибка загрузки приложения: ' + error.message);
            }
        };

        initializeApp();
    }, []);

    // Применение темы из настроек
    useEffect(() => {
        const applyTheme = async () => {
            try {
                const preferences = await ApiService.getUserPreferences();
                const theme = preferences.theme || 'auto';

                if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            } catch (error) {
                console.error('Error applying theme:', error);
            }
        };

        if (!appState.isLoading) {
            applyTheme();
        }
    }, [appState.isLoading]);

    const handleNavigate = (view) => {
        console.log('Navigation:', view);

        if (view.includes('modal')) {
            // Обработка модальных окон
            const modalName = view.replace('-modal', '');
            setAppState(prev => ({ ...prev, [`show${modalName.charAt(0).toUpperCase() + modalName.slice(1)}Modal`]: true }));
        } else {
            // Навигация по вью
            setAppState(prev => ({ ...prev, currentView: view }));
        }
    };

    const renderCurrentView = () => {
        switch (appState.currentView) {
            case 'dashboard':
                return React.createElement(DashboardView);
            case 'project-details':
                return React.createElement(ProjectView);
            case 'task-details':
                return React.createElement(TaskView);
            case 'my-tasks':
                return React.createElement(MyTasksView);
            default:
                return React.createElement(DashboardView);
        }
    };

    const handleCloseModal = (modalName) => {
        setAppState(prev => ({ ...prev, [modalName]: false }));
    };

    if (appState.isLoading) {
        return React.createElement(PremiumLoadingScreen);
    }

    return React.createElement(AppContext.Provider, {
        value: {
            appState,
            setAppState: (updater) => {
                if (typeof updater === 'function') {
                    setAppState(prev => {
                        const newState = updater(prev);
                        console.log('App State Updated:', newState);
                        return newState;
                    });
                } else {
                    console.log('App State Updated:', updater);
                    setAppState(updater);
                }
            }
        }
    },
        React.createElement('div', { className: 'min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300' },
            // Индикатор сетевого статуса
            !networkStatus && React.createElement('div', {
                className: 'bg-yellow-500 text-white text-center py-2 px-4 fixed top-0 left-0 right-0 z-40'
            },
                React.createElement('div', { className: 'flex items-center justify-center space-x-2' },
                    React.createElement('span', {}, '⚠️'),
                    React.createElement('span', { className: 'font-medium' }, 'Оффлайн режим'),
                    React.createElement('span', { className: 'text-sm' }, ' - некоторые функции могут быть ограничены')
                )
            ),

            // Эффект конфетти
            showConfetti && React.createElement(motion.div, {
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                exit: { opacity: 0 },
                className: 'confetti-container'
            },
                React.createElement('div', { className: 'flex items-center justify-center h-full' },
                    React.createElement(motion.div, {
                        initial: { scale: 0 },
                        animate: { scale: 1 },
                        transition: { type: "spring", stiffness: 200, damping: 15 },
                        className: 'text-8xl'
                    }, '🎉')
                )
            ),

            // Навигация MAX UI
            React.createElement(MaxNavigation, {
                currentView: appState.currentView,
                onNavigate: handleNavigate
            }),

            // Основной контент с анимациями
            React.createElement(AnimatePresence, { mode: 'wait' },
                React.createElement(motion.div, {
                    key: appState.currentView,
                    initial: { opacity: 0, x: 50 },
                    animate: { opacity: 1, x: 0 },
                    exit: { opacity: 0, x: -50 },
                    transition: {
                        duration: 0.3,
                        ease: "easeInOut"
                    },
                    className: 'pb-8'
                }, renderCurrentView())
            ),

            // Глобальные модальные окна
            React.createElement(SettingsModal, {
                isOpen: appState.showSettingsModal,
                onClose: () => handleCloseModal('showSettingsModal'),
                user: appState.user,
                onSave: async (settings) => {
                    try {
                        await ApiService.updateUserPreferences(settings);

                        // Применяем настройки темы
                        if (settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                            document.documentElement.classList.add('dark');
                        } else {
                            document.documentElement.classList.remove('dark');
                        }

                        handleCloseModal('showSettingsModal');
                    } catch (error) {
                        console.error('Error saving settings:', error);
                        alert('Ошибка сохранения настроек: ' + error.message);
                    }
                }
            }),

            React.createElement(NotificationsModal, {
                isOpen: appState.showNotificationsModal,
                onClose: () => handleCloseModal('showNotificationsModal'),
                notifications: appState.notifications,
                onMarkAllRead: async () => {
                    try {
                        await ApiService.markAllNotificationsRead();
                        setAppState(prev => ({
                            ...prev,
                            notifications: prev.notifications.map(n => ({ ...n, read: true }))
                        }));
                    } catch (error) {
                        console.error('Error marking notifications as read:', error);
                        alert('Ошибка при обновлении уведомлений: ' + error.message);
                    }
                }
            }),

            // Футер
            React.createElement('footer', {
                className: 'bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-6 mt-12'
            },
                React.createElement('div', { className: 'container mx-auto px-4' },
                    React.createElement('div', { className: 'flex flex-col md:flex-row justify-between items-center' },
                        React.createElement('div', { className: 'mb-4 md:mb-0' },
                            React.createElement('p', {
                                className: 'text-gray-600 dark:text-gray-400 text-sm'
                            }, '© 2024 Project Pilot MAX. Все права защищены.')
                        ),
                        React.createElement('div', { className: 'flex space-x-6' },
                            React.createElement('button', {
                                onClick: () => handleNavigate('settings-modal'),
                                className: 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors text-sm'
                            }, 'Настройки'),
                            React.createElement('button', {
                                onClick: () => {
                                    if (confirm('Вы уверены, что хотите выйти?')) {
                                        AuthManager.logout();
                                    }
                                },
                                className: 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors text-sm'
                            }, 'Выйти')
                        )
                    ),
                    React.createElement('div', { className: 'text-center mt-4' },
                        React.createElement('p', {
                            className: 'text-gray-500 dark:text-gray-500 text-xs'
                        }, `Версия 1.0.0 | ${networkStatus ? '🟢 Онлайн' : '🟡 Оффлайн'}`)
                    )
                )
            )
        )
    );
};

// Рендеринг приложения
const Root = () => {
    return React.createElement(App);
};

// Инициализация приложения после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(Root));
    });
} else {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(Root));
}
