const CreateTaskModal = ({ isOpen, onClose, onCreate, project }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        parent_task_id: '',
        assigned_to_id: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [availableTasks, setAvailableTasks] = useState([]);
    const [availableMembers, setAvailableMembers] = useState([]);

    useEffect(() => {
        if (project) {
            // Загрузка доступных задач и участников
            const loadData = async () => {
                try {
                    const tasksResponse = await ApiService.getTasks(project.hash);
                    const membersResponse = await ApiService.getProjectMembers(project.hash);

                    setAvailableTasks(tasksResponse.tasks || []);
                    setAvailableMembers(membersResponse.members || []);
                } catch (error) {
                    console.error('Error loading modal data:', error);
                }
            };
            loadData();
        }
    }, [project]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) return;

        setIsLoading(true);
        try {
            const taskData = {
                ...formData,
                project_hash: project.hash
            };
            await onCreate(taskData);
            setFormData({
                title: '',
                description: '',
                priority: 'medium',
                due_date: '',
                parent_task_id: '',
                assigned_to_id: ''
            });
            onClose();
        } catch (error) {
            console.error('Error creating task:', error);
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
            className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'
        },
            React.createElement('div', {
                className: 'flex justify-between items-center mb-6'
            },
                React.createElement('h2', {
                    className: 'text-2xl font-bold text-gray-800 dark:text-white'
                }, 'Создать задачу'),
                React.createElement('button', {
                    onClick: onClose,
                    className: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl'
                }, '×')
            ),

            React.createElement('form', { onSubmit: handleSubmit },
                React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                    React.createElement('div', { className: 'md:col-span-2' },
                        React.createElement('label', {
                            className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                        }, 'Название задачи *'),
                        React.createElement('input', {
                            type: 'text',
                            value: formData.title,
                            onChange: (e) => setFormData(prev => ({ ...prev, title: e.target.value })),
                            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white',
                            placeholder: 'Введите название задачи',
                            required: true
                        })
                    ),

                    React.createElement('div', { className: 'md:col-span-2' },
                        React.createElement('label', {
                            className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                        }, 'Описание'),
                        React.createElement('textarea', {
                            value: formData.description,
                            onChange: (e) => setFormData(prev => ({ ...prev, description: e.target.value })),
                            rows: 3,
                            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white',
                            placeholder: 'Опишите задачу...'
                        })
                    ),

                    React.createElement('div', {},
                        React.createElement('label', {
                            className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                        }, 'Приоритет'),
                        React.createElement('select', {
                            value: formData.priority,
                            onChange: (e) => setFormData(prev => ({ ...prev, priority: e.target.value })),
                            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                        },
                            React.createElement('option', { value: 'low' }, 'Низкий'),
                            React.createElement('option', { value: 'medium' }, 'Средний'),
                            React.createElement('option', { value: 'high' }, 'Высокий'),
                            React.createElement('option', { value: 'urgent' }, 'Срочный')
                        )
                    ),

                    React.createElement('div', {},
                        React.createElement('label', {
                            className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                        }, 'Срок выполнения'),
                        React.createElement('input', {
                            type: 'date',
                            value: formData.due_date,
                            onChange: (e) => setFormData(prev => ({ ...prev, due_date: e.target.value })),
                            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                        })
                    ),

                    React.createElement('div', {},
                        React.createElement('label', {
                            className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                        }, 'Родительская задача'),
                        React.createElement('select', {
                            value: formData.parent_task_id,
                            onChange: (e) => setFormData(prev => ({ ...prev, parent_task_id: e.target.value })),
                            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                        },
                            React.createElement('option', { value: '' }, 'Основная задача (без родителя)'),
                            availableTasks.map(task =>
                                React.createElement('option', {
                                    key: task.id,
                                    value: task.id
                                }, task.title)
                            )
                        )
                    ),

                    React.createElement('div', {},
                        React.createElement('label', {
                            className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                        }, 'Исполнитель'),
                        React.createElement('select', {
                            value: formData.assigned_to_id,
                            onChange: (e) => setFormData(prev => ({ ...prev, assigned_to_id: e.target.value })),
                            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                        },
                            React.createElement('option', { value: '' }, 'Не назначена'),
                            availableMembers.map(member =>
                                React.createElement('option', {
                                    key: member.user_id,
                                    value: member.user_id
                                }, member.full_name || `Участник ${member.user_id}`)
                            )
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
                    }, isLoading ? 'Создание...' : 'Создать задачу')
                )
            )
        )
    );
};
