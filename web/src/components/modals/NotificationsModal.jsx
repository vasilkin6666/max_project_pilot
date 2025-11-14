const NotificationsModal = ({ isOpen, onClose, notifications, onMarkAllRead }) => {
    const [localNotifications, setLocalNotifications] = useState([]);

    useEffect(() => {
        setLocalNotifications(notifications || []);
    }, [notifications]);

    const handleMarkAllRead = async () => {
        try {
            await onMarkAllRead();
            setLocalNotifications(prev =>
                prev.map(notification => ({ ...notification, read: true }))
            );
        } catch (error) {
            console.error('Error marking notifications as read:', error);
        }
    };

    const unreadCount = localNotifications.filter(n => !n.read).length;

    if (!isOpen) return null;

    return React.createElement('div', {
        className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
    },
        React.createElement(motion.div, {
            initial: { scale: 0.9, opacity: 0 },
            animate: { scale: 1, opacity: 1 },
            className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col'
        },
            React.createElement('div', {
                className: 'flex justify-between items-center mb-6'
            },
                React.createElement('h2', {
                    className: 'text-2xl font-bold text-gray-800 dark:text-white'
                }, 'Уведомления'),
                React.createElement('button', {
                    onClick: onClose,
                    className: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl'
                }, '×')
            ),

            React.createElement('div', {
                className: 'flex-1 overflow-y-auto custom-scrollbar mb-4'
            },
                localNotifications.length === 0 ?
                    React.createElement('div', {
                        className: 'text-center py-8 text-gray-500 dark:text-gray-400'
                    },
                        React.createElement('div', { className: 'text-6xl mb-4' }, '🔔'),
                        React.createElement('p', { className: 'text-lg' }, 'Уведомлений нет')
                    ) :
                    React.createElement('div', { className: 'space-y-3' },
                        localNotifications.map((notification, index) =>
                            React.createElement(motion.div, {
                                key: notification.id || index,
                                initial: { opacity: 0, y: 10 },
                                animate: { opacity: 1, y: 0 },
                                transition: { delay: index * 0.1 },
                                className={`p-4 rounded-lg border ${
                                    notification.read
                                        ? 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                }`}
                            },
                                React.createElement('div', { className: 'flex justify-between items-start' },
                                    React.createElement('div', { className: 'flex-1' },
                                        React.createElement('h3', {
                                            className: `font-semibold ${
                                                notification.read
                                                    ? 'text-gray-800 dark:text-gray-200'
                                                    : 'text-blue-800 dark:text-blue-200'
                                            }`
                                        }, notification.title),
                                        React.createElement('p', {
                                            className: `mt-1 ${
                                                notification.read
                                                    ? 'text-gray-600 dark:text-gray-400'
                                                    : 'text-blue-600 dark:text-blue-300'
                                            }`
                                        }, notification.message)
                                    ),
                                    !notification.read && React.createElement('div', {
                                        className: 'w-2 h-2 bg-blue-500 rounded-full ml-2 flex-shrink-0'
                                    })
                                ),
                                React.createElement('p', {
                                    className: `text-xs mt-2 ${
                                        notification.read
                                            ? 'text-gray-500 dark:text-gray-500'
                                            : 'text-blue-500 dark:text-blue-400'
                                    }`
                                }, new Date(notification.created_at).toLocaleString())
                            )
                        )
                    )
            ),

            React.createElement('div', {
                className: 'flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-600'
            },
                React.createElement('p', {
                    className: 'text-sm text-gray-600 dark:text-gray-400'
                }, `Не прочитано: ${unreadCount}`),

                React.createElement('div', { className: 'flex space-x-3' },
                    unreadCount > 0 && React.createElement('button', {
                        onClick: handleMarkAllRead,
                        className: 'px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm'
                    }, 'Отметить все как прочитанные'),
                    React.createElement('button', {
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors text-sm'
                    }, 'Закрыть')
                )
            )
        )
    );
};
