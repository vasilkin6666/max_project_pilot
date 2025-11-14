const MyTasksView = () => {
    const { appState, setAppState } = useContext(AppContext);
    const [tasks, setTasks] = useState([]);
    const [filteredTasks, setFilteredTasks] = useState([]);
    const [filters, setFilters] = useState({
        status: '',
        project: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const [tasksResponse, projectsResponse] = await Promise.all([
                    ApiService.getUserTasks(filters),
                    ApiService.getProjects()
                ]);

                setTasks(tasksResponse.tasks || []);
                setProjects(projectsResponse.projects || []);
            } catch (error) {
                console.error('Error loading tasks:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [filters]);

    useEffect(() => {
        // Фильтрация задач на клиенте для лучшего UX
        let filtered = tasks;

        if (filters.status) {
            filtered = filtered.filter(task => task.status === filters.status);
        }

        if (filters.project) {
            filtered = filtered.filter(task => task.project_hash === filters.project);
        }

        setFilteredTasks(filtered);
    }, [tasks, filters]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'done': return 'green';
            case 'in_progress': return 'yellow';
            default: return 'gray';
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'urgent': return 'red';
            case 'high': return 'orange';
            case 'low': return 'green';
            default: return 'blue';
        }
    };

    const assignedTasks = filteredTasks.filter(task => task.assigned_to_id === appState.user?.id);
    const createdTasks = filteredTasks.filter(task =>
        task.creator_id === appState.user?.id && task.assigned_to_id !== appState.user?.id
    );

    return React.createElement('div', { className: 'space-y-6 mx-4' },
        // Заголовок и фильтры
        React.createElement('div', { className: 'flex justify-between items-center mb-6' },
            React.createElement('div', {},
                React.createElement('h1', {
                    className: 'text-3xl font-bold text-gray-800 dark:text-white mb-2'
                }, 'Мои задачи'),
                React.createElement('p', {
                    className: 'text-gray-600 dark:text-gray-300'
                }, 'Все задачи, назначенные вам или созданные вами')
            ),

            React.createElement(motion.button, {
                whileHover: { scale: 1.05 },
                whileTap: { scale: 0.95 },
                onClick: () => setAppState(prev => ({ ...prev, currentView: 'dashboard' })),
                className: 'px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors'
            }, 'Назад')
        ),

        // Фильтры
        React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg' },
            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
                React.createElement('div', {},
                    React.createElement('label', {
                        className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                    }, 'Статус'),
                    React.createElement('select', {
                        value: filters.status,
                        onChange: (e) => handleFilterChange('status', e.target.value),
                        className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                    },
                        React.createElement('option', { value: '' }, 'Все статусы'),
                        React.createElement('option', { value: 'todo' }, 'К выполнению'),
                        React.createElement('option', { value: 'in_progress' }, 'В работе'),
                        React.createElement('option', { value: 'done' }, 'Выполнено')
                    )
                ),

                React.createElement('div', {},
                    React.createElement('label', {
                        className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                    }, 'Проект'),
                    React.createElement('select', {
                        value: filters.project,
                        onChange: (e) => handleFilterChange('project', e.target.value),
                        className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                    },
                        React.createElement('option', { value: '' }, 'Все проекты'),
                        projects.map(project =>
                            React.createElement('option', {
                                key: project.hash,
                                value: project.hash
                            }, project.title)
                        )
                    )
                ),

                React.createElement('div', { className: 'flex items-end' },
                    React.createElement(motion.button, {
                        whileHover: { scale: 1.05 },
                        whileTap: { scale: 0.95 },
                        onClick: () => setFilters({ status: '', project: '' }),
                        className: 'w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors'
                    }, 'Сбросить фильтры')
                )
            )
        ),

        isLoading ?
            React.createElement('div', {
                className: 'flex items-center justify-center min-h-64'
            },
                React.createElement('div', { className: 'text-center' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto' }),
                    React.createElement('p', { className: 'mt-4 text-gray-600 dark:text-gray-400' }, 'Загрузка задач...')
                )
            ) :
            React.createElement('div', { className: 'space-y-8' },
                // Задачи, назначенные мне
                assignedTasks.length > 0 && React.createElement('div', {},
                    React.createElement('h2', {
                        className: 'text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center'
                    },
                        React.createElement('span', { className: 'mr-3' }, '👤'),
                        'Задачи назначенные мне',
                        React.createElement('span', {
                            className: 'ml-3 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1 rounded-full text-sm font-medium'
                        }, assignedTasks.length)
                    ),

                    React.createElement('div', { className: 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' },
                        assignedTasks.map((task, index) =>
                            React.createElement(TaskCard, {
                                key: task.id,
                                task: task,
                                index: index,
                                type: 'assigned',
                                onClick: () => setAppState(prev => ({
                                    ...prev,
                                    currentView: 'task-details',
                                    currentTask: task
                                }))
                            })
                        )
                    )
                ),

                // Задачи, созданные мной
                createdTasks.length > 0 && React.createElement('div', {},
                    React.createElement('h2', {
                        className: 'text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center'
                    },
                        React.createElement('span', { className: 'mr-3' }, '📝'),
                        'Задачи созданные мной',
                        React.createElement('span', {
                            className: 'ml-3 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-3 py-1 rounded-full text-sm font-medium'
                        }, createdTasks.length)
                    ),

                    React.createElement('div', { className: 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' },
                        createdTasks.map((task, index) =>
                            React.createElement(TaskCard, {
                                key: task.id,
                                task: task,
                                index: index,
                                type: 'created',
                                onClick: () => setAppState(prev => ({
                                    ...prev,
                                    currentView: 'task-details',
                                    currentTask: task
                                }))
                            })
                        )
                    )
                ),

                // Нет задач
                filteredTasks.length === 0 && React.createElement('div', { className: 'text-center py-12' },
                    React.createElement('div', { className: 'text-6xl mb-4' }, '📋'),
                    React.createElement('h3', {
                        className: 'text-xl font-bold text-gray-800 dark:text-white mb-2'
                    }, 'Задач не найдено'),
                    React.createElement('p', {
                        className: 'text-gray-600 dark:text-gray-300'
                    }, 'Попробуйте изменить параметры фильтрации')
                )
            )
    );
};

const TaskCard = ({ task, onClick, index, type }) => {
    const project = task.project_title || `Проект: ${task.project_hash?.substring(0, 8)}`;

    return React.createElement(motion.div, {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: index * 0.1 },
        onClick: onClick,
        className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl cursor-pointer transition-all duration-300 border border-gray-100 dark:border-gray-700 magnetic-hover'
    },
        React.createElement('div', { className: 'flex justify-between items-start mb-4' },
            React.createElement('h3', {
                className: 'text-lg font-semibold text-gray-800 dark:text-white line-clamp-2 flex-1'
            }, task.title),

            React.createElement('div', { className: 'flex flex-col items-end space-y-2 ml-3' },
                React.createElement('span', {
                    className: `px-2 py-1 rounded-full text-xs font-medium ${
                        task.status === 'done'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : task.status === 'in_progress'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`
                },
                    task.status === 'done' ? 'Выполнено' :
                    task.status === 'in_progress' ? 'В работе' : 'К выполнению'
                ),

                React.createElement('span', {
                    className: `px-2 py-1 rounded-full text-xs font-medium ${
                        type === 'assigned'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`
                },
                    type === 'assigned' ? 'Назначена' : 'Создана'
                )
            )
        ),

        React.createElement('p', {
            className: 'text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3'
        }, task.description || 'Без описания'),

        React.createElement('div', { className: 'space-y-2' },
            React.createElement('div', { className: 'flex justify-between items-center text-sm' },
                React.createElement('span', { className: 'text-gray-500 dark:text-gray-400' }, 'Проект:'),
                React.createElement('span', { className: 'text-gray-700 dark:text-gray-300 font-medium' }, project)
            ),

            React.createElement('div', { className: 'flex justify-between items-center text-sm' },
                React.createElement('span', { className: 'text-gray-500 dark:text-gray-400' }, 'Приоритет:'),
                React.createElement('span', {
                    className: `font-medium ${
                        task.priority === 'high' ? 'text-red-500' :
                        task.priority === 'urgent' ? 'text-red-700' :
                        task.priority === 'low' ? 'text-green-500' : 'text-yellow-500'
                    }`
                },
                    task.priority === 'high' ? 'Высокий' :
                    task.priority === 'urgent' ? 'Срочный' :
                    task.priority === 'low' ? 'Низкий' : 'Средний'
                )
            ),

            {task.due_date &&
                React.createElement('div', { className: 'flex justify-between items-center text-sm' },
                    React.createElement('span', { className: 'text-gray-500 dark:text-gray-400' }, 'Срок:'),
                    React.createElement('span', {
                        className: `font-medium ${
                            new Date(task.due_date) < new Date() && task.status !== 'done'
                                ? 'text-red-500'
                                : 'text-gray-700 dark:text-gray-300'
                        }`
                    }, new Date(task.due_date).toLocaleDateString())
                )
            },

            React.createElement('div', { className: 'flex justify-between items-center text-sm' },
                React.createElement('span', { className: 'text-gray-500 dark:text-gray-400' }, 'Создана:'),
                React.createElement('span', { className: 'text-gray-700 dark:text-gray-300' },
                    new Date(task.created_at).toLocaleDateString()
                )
            )
        )
    );
};
