const MaxNavigation = ({ currentView, onNavigate }) => {
    const { appState } = useContext(AppContext);
    const [notificationsCount, setNotificationsCount] = useState(0);

    useEffect(() => {
        const unreadCount = appState.notifications?.filter(n => !n.read).length || 0;
        setNotificationsCount(unreadCount);
    }, [appState.notifications]);

    const navItems = [
        { id: 'dashboard', label: 'Дашборд', icon: '📊', badge: null },
        { id: 'my-tasks', label: 'Мои задачи', icon: '✅', badge: null },
        { id: 'search', label: 'Поиск', icon: '🔍', badge: null },
        { id: 'notifications', label: 'Уведомления', icon: '🔔', badge: notificationsCount },
        { id: 'settings', label: 'Настройки', icon: '⚙️', badge: null }
    ];

    return React.createElement('nav', {
        className: 'glass-morphism rounded-2xl p-4 mb-6 mx-4 mt-4'
    },
        React.createElement('div', {
            className: 'flex space-x-2 overflow-x-auto custom-scrollbar'
        },
            navItems.map(item =>
                React.createElement(motion.button, {
                    key: item.id,
                    whileHover: { scale: 1.05 },
                    whileTap: { scale: 0.95 },
                    onClick: () => {
                        if (item.id === 'notifications') {
                            onNavigate('notifications-modal');
                        } else if (item.id === 'settings') {
                            onNavigate('settings-modal');
                        } else {
                            onNavigate(item.id);
                        }
                    },
                    className: `flex items-center space-x-2 px-4 py-3 rounded-xl transition-all duration-200 relative ${
                        currentView === item.id
                            ? 'bg-blue-500 text-white shadow-lg'
                            : 'bg-white/50 text-gray-700 hover:bg-white/80 dark:bg-gray-800/50 dark:text-gray-200 dark:hover:bg-gray-700/80'
                    }`
                },
                    React.createElement('span', { className: 'text-lg' }, item.icon),
                    React.createElement('span', { className: 'font-medium' }, item.label),
                    item.badge && item.badge > 0 && React.createElement('span', {
                        className: 'absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center'
                    }, item.badge > 9 ? '9+' : item.badge)
                )
            )
        )
    );
};
