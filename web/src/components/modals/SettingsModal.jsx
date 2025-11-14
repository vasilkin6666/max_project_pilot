const SettingsModal = ({ isOpen, onClose, user, onSave }) => {
    const [formData, setFormData] = useState({
        full_name: '',
        username: '',
        theme: 'auto',
        notifications_enabled: true,
        compact_view: false
    });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                full_name: user.full_name || '',
                username: user.username || ''
            }));
        }

        // Загрузка настроек
        const loadSettings = async () => {
            try {
                const preferences = await ApiService.getUserPreferences();
                setFormData(prev => ({ ...prev, ...preferences }));
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        };
        loadSettings();
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Error saving settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = async () => {
        if (confirm('Вы уверены, что хотите сбросить все настройки к значениям по умолчанию?')) {
            try {
                await ApiService.resetUserPreferences();
                const defaultSettings = {
                    theme: 'auto',
                    notifications_enabled: true,
                    compact_view: false
                };
                setFormData(prev => ({ ...prev, ...defaultSettings }));
                await onSave(defaultSettings);
            } catch (error) {
                console.error('Error resetting settings:', error);
            }
        }
    };

    if (!isOpen) return null;

    return React.createElement('div', {
        className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
    },
        React.createElement(motion.div, {
            initial: { scale: 0.9, opacity: 0 },
            animate: { scale: 1, opacity: 1 },
            className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'
        },
            React.createElement('div', {
                className: 'flex justify-between items-center mb-6'
            },
                React.createElement('h2', {
                    className: 'text-2xl font-bold text-gray-800 dark:text-white'
                }, 'Настройки'),
                React.createElement('button', {
                    onClick: onClose,
                    className: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl'
                }, '×')
            ),

            React.createElement('form', { onSubmit: handleSubmit },
                React.createElement('div', { className: 'space-y-6' },
                    React.createElement('div', {},
                        React.createElement('h3', {
                            className: 'text-lg font-semibold text-gray-800 dark:text-white mb-4'
                        }, 'Профиль пользователя'),

                        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                            React.createElement('div', {},
                                React.createElement('label', {
                                    className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                                }, 'Полное имя'),
                                React.createElement('input', {
                                    type: 'text',
                                    value: formData.full_name,
                                    onChange: (e) => setFormData(prev => ({ ...prev, full_name: e.target.value })),
                                    className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white',
                                    placeholder: 'Введите ваше имя'
                                })
                            ),

                            React.createElement('div', {},
                                React.createElement('label', {
                                    className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                                }, 'Имя пользователя'),
                                React.createElement('input', {
                                    type: 'text',
                                    value: formData.username,
                                    onChange: (e) => setFormData(prev => ({ ...prev, username: e.target.value })),
                                    className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white',
                                    placeholder: 'Введите имя пользователя'
                                })
                            )
                        )
                    ),

                    React.createElement('div', {},
                        React.createElement('h3', {
                            className: 'text-lg font-semibold text-gray-800 dark:text-white mb-4'
                        }, 'Внешний вид'),

                        React.createElement('div', { className: 'space-y-4' },
                            React.createElement('div', {},
                                React.createElement('label', {
                                    className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                                }, 'Тема'),
                                React.createElement('select', {
                                    value: formData.theme,
                                    onChange: (e) => setFormData(prev => ({ ...prev, theme: e.target.value })),
                                    className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                                },
                                    React.createElement('option', { value: 'light' }, 'Светлая'),
                                    React.createElement('option', { value: 'dark' }, 'Темная'),
                                    React.createElement('option', { value: 'auto' }, 'Авто')
                                )
                            ),

                            React.createElement('div', { className: 'space-y-2' },
                                React.createElement('label', {
                                    className: 'flex items-center space-x-3'
                                },
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        checked: formData.notifications_enabled,
                                        onChange: (e) => setFormData(prev => ({ ...prev, notifications_enabled: e.target.checked })),
                                        className: 'rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                                    }),
                                    React.createElement('span', {
                                        className: 'text-sm text-gray-700 dark:text-gray-300'
                                    }, 'Уведомления включены')
                                ),

                                React.createElement('label', {
                                    className: 'flex items-center space-x-3'
                                },
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        checked: formData.compact_view,
                                        onChange: (e) => setFormData(prev => ({ ...prev, compact_view: e.target.checked })),
                                        className: 'rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                                    }),
                                    React.createElement('span', {
                                        className: 'text-sm text-gray-700 dark:text-gray-300'
                                    }, 'Компактный вид')
                                )
                            )
                        )
                    )
                ),

                React.createElement('div', {
                    className: 'flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-600'
                },
                    React.createElement('button', {
                        type: 'button',
                        onClick: handleReset,
                        className: 'px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors'
                    }, 'Сбросить настройки'),

                    React.createElement('div', { className: 'flex space-x-3' },
                        React.createElement('button', {
                            type: 'button',
                            onClick: onClose,
                            className: 'px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors'
                        }, 'Отмена'),
                        React.createElement('button', {
                            type: 'submit',
                            disabled: isLoading,
                            className: 'px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                        }, isLoading ? 'Сохранение...' : 'Сохранить')
                    )
                )
            )
        )
    );
};
