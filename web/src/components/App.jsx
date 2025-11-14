const { useState, useEffect, useRef, createContext, useContext } = React;
const { motion, AnimatePresence } = window.framerMotion;

// Контекст приложения
const AppContext = createContext();

// Импорт компонентов
const PremiumLoadingScreen = () => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(timer);
                    return 100;
                }
                return prev + Math.random() * 15;
            });
        }, 200);

        return () => clearInterval(timer);
    }, []);

    return React.createElement('div', {
        className: 'fixed inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 flex flex-col items-center justify-center z-50'
    },
        // Анимированная загрузка с прогресс-баром
        React.createElement(motion.div, {
            initial: { scale: 0 },
            animate: { scale: 1 },
            transition: { type: "spring", stiffness: 200, damping: 15 },
            className: 'mb-8'
        },
            React.createElement('div', {
                className: 'text-6xl mb-4 breathing-pulse'
            }, '🚀')
        ),

        React.createElement(motion.h1, {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            transition: { delay: 0.3 },
            className: 'text-4xl font-bold text-white mb-2'
        }, 'Project Pilot MAX'),

        // Прогресс-бар
        React.createElement('div', {
            className: 'w-64 h-2 bg-white/20 rounded-full overflow-hidden'
        },
            React.createElement(motion.div, {
                initial: { width: 0 },
                animate: { width: `${progress}%` },
                className: 'h-full bg-white rounded-full transition-all duration-300'
            })
        )
    );
};

// Главный компонент приложения
const App = () => {
    const [appState, setAppState] = useState({
        isLoading: true,
        currentView: 'dashboard',
        projects: [],
        currentProject: null,
        currentTask: null,
        user: null,
        notifications: []
    });

    const [showConfetti, setShowConfetti] = useState(false);

    // Инициализация приложения
    useEffect(() => {
        const initializeApp = async () => {
            try {
                // Инициализация аутентификации
                const user = await AuthManager.initialize();

                // Загрузка данных
                const dashboardData = await ApiService.getDashboard();

                setAppState(prev => ({
                    ...prev,
                    isLoading: false,
                    user: user,
                    projects: dashboardData.projects || [],
                    notifications: dashboardData.notifications || []
                }));

                // Эффект конфетти при первой загрузке
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 3000);

            } catch (error) {
                console.error('App initialization failed:', error);
                setAppState(prev => ({ ...prev, isLoading: false }));
            }
        };

        initializeApp();
    }, []);

    const handleNavigate = (view) => {
        setAppState(prev => ({ ...prev, currentView: view }));
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

    if (appState.isLoading) {
        return React.createElement(PremiumLoadingScreen);
    }

    return React.createElement(AppContext.Provider, { value: { appState, setAppState } },
        React.createElement('div', { className: 'min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300' },
            // Эффект конфетти
            showConfetti && React.createElement(ConfettiEffect),

            // Навигация MAX UI
            React.createElement(MaxNavigation, {
                currentView: appState.currentView,
                onNavigate: handleNavigate
            }),

            // Основной контент с анимациями
            React.createElement(AnimatePresence, { mode: 'wait' },
                React.createElement(motion.div, {
                    key: appState.currentView,
                    initial: { opacity: 0, x: 100 },
                    animate: { opacity: 1, x: 0 },
                    exit: { opacity: 0, x: -100 },
                    transition: { duration: 0.3 }
                }, renderCurrentView())
            )
        )
    );
};

// Рендеринг приложения
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
