const CreateProjectModal = ({ isOpen, onClose, onCreate }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        is_private: true,
        requires_approval: false
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) return;

        setIsLoading(true);
        try {
            await onCreate(formData);
            setFormData({
                title: '',
                description: '',
                is_private: true,
                requires_approval: false
            });
            onClose();
        } catch (error) {
            console.error('Error creating project:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return React.createElement('div', {
        className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
    },
        React.createElement(motion.div, {
            initial: { scale: 0.9, opacity: 0 },
            animate: { scale: 1, opacity: 1 },
            className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md'
        },
            React.createElement('div', {
                className: 'flex justify-between items-center mb-6'
            },
                React.createElement('h2', {
                    className: 'text-2xl font-bold text-gray-800 dark:text-white'
                }, 'Создать проект'),
                React.createElement('button', {
                    onClick: onClose,
                    className: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl'
                }, '×')
            ),

            React.createElement('form', { onSubmit: handleSubmit },
                React.createElement('div', { className: 'space-y-4' },
                    React.createElement('div', {},
                        React.createElement('label', {
                            className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                        }, 'Название проекта *'),
                        React.createElement('input', {
                            type: 'text',
                            value: formData.title,
                            onChange: (e) => setFormData(prev => ({ ...prev, title: e.target.value })),
                            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white',
                            placeholder: 'Введите название проекта',
                            required: true
                        })
                    ),

                    React.createElement('div', {},
                        React.createElement('label', {
                            className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                        }, 'Описание'),
                        React.createElement('textarea', {
                            value: formData.description,
                            onChange: (e) => setFormData(prev => ({ ...prev, description: e.target.value })),
                            rows: 3,
                            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white',
                            placeholder: 'Опишите ваш проект...'
                        })
                    ),

                    React.createElement('div', { className: 'space-y-2' },
                        React.createElement('label', {
                            className: 'flex items-center space-x-3'
                        },
                            React.createElement('input', {
                                type: 'checkbox',
                                checked: formData.is_private,
                                onChange: (e) => setFormData(prev => ({ ...prev, is_private: e.target.checked })),
                                className: 'rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                            }),
                            React.createElement('span', {
                                className: 'text-sm text-gray-700 dark:text-gray-300'
                            }, 'Приватный проект')
                        ),

                        React.createElement('label', {
                            className: 'flex items-center space-x-3'
                        },
                            React.createElement('input', {
                                type: 'checkbox',
                                checked: formData.requires_approval,
                                onChange: (e) => setFormData(prev => ({ ...prev, requires_approval: e.target.checked })),
                                className: 'rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                            }),
                            React.createElement('span', {
                                className: 'text-sm text-gray-700 dark:text-gray-300'
                            }, 'Требуется одобрение для вступления')
                        )
                    )
                ),

                React.createElement('div', {
                    className: 'flex justify-end space-x-3 mt-6'
                },
                    React.createElement('button', {
                        type: 'button',
                        onClick: onClose,
                        className: 'px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors'
                    }, 'Отмена'),
                    React.createElement('button', {
                        type: 'submit',
                        disabled: isLoading || !formData.title.trim(),
                        className: 'px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                    }, isLoading ? 'Создание...' : 'Создать проект')
                )
            )
        )
    );
};
