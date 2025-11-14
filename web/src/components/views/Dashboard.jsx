const DashboardView = () => {
    const { appState, setAppState } = useContext(AppContext);
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [stats, setStats] = useState({
        projects: 0,
        tasks: 0,
        members: 0,
        productivity: '87%'
    });

    useEffect(() => {
        // AI рекомендации
        const suggestions = [
            {
                title: 'Оптимизируйте рабочие процессы',
                description: 'Добавьте шаблоны задач для повторяющихся процессов'
            },
            {
                title: 'Пригласите команду',
                description: 'Добавьте участников для совместной работы над проектами'
            },
            {
                title: 'Настройте уведомления',
                description: 'Включите напоминания о приближающихся дедлайнах'
            }
        ];
        setAiSuggestions(suggestions);

        // Расчет статистики
        const projects = appState.projects || [];
        const totalTasks = projects.reduce((sum, p) => sum + (p.stats?.tasks_count || 0), 0);
        const totalMembers = projects.reduce((sum, p) => sum + (p.stats?.members_count || 0), 0);

        setStats({
            projects: projects.length,
            tasks: totalTasks,
            members: totalMembers,
            productivity: '87%'
        });
    }, [appState.projects]);

    const statCards = [
        {
            label: 'Активных проектов',
            value: stats.projects,
            color: 'blue',
            icon: '📁'
        },
        {
            label: 'Всего задач',
            value: stats.tasks,
            color: 'green',
            icon: '✅'
        },
        {
            label: 'Участников',
            value: stats.members,
            color: 'purple',
            icon: '👥'
        },
        {
            label: 'Продуктивность',
            value: stats.productivity,
            color: 'orange',
            icon: '📈'
        }
    ];

    const handleCreateProject = async (projectData) => {
        try {
            const response = await ApiService.createProject(projectData);
            setAppState(prev => ({
                ...prev,
                projects: [...prev.projects, response.project],
                showCreateProjectModal: false
            }));
        } catch (error) {
            console.error('Error creating project:', error);
            alert('Ошибка при создании проекта: ' + error.message);
        }
    };

    return React.createElement('div', { className: 'space-y-6 mx-4' },
        // Заголовок
        React.createElement(motion.header, {
            initial: { opacity: 0, y: -20 },
            animate: { opacity: 1, y: 0 },
            className: 'flex justify-between items-center mb-8'
        },
            React.createElement('div', {},
                React.createElement('h1', {
                    className: 'text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'
                }, 'Project Pilot MAX'),
                React.createElement('p', {
                    className: 'text-gray-600 dark:text-gray-300'
                }, 'Премиум управление проектами')
            ),

            React.createElement('div', {
                className: 'flex items-center space-x-4'
            },
                React.createElement(motion.button, {
                    whileHover: { scale: 1.05 },
                    whileTap: { scale: 0.95 },
                    onClick: () => setAppState(prev => ({ ...prev, showNotificationsModal: true })),
                    className: 'p-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all relative'
                },
                    '🔔',
                    appState.notifications?.filter(n => !n.read).length > 0 &&
                    React.createElement('span', {
                        className: 'absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center'
                    }, appState.notifications.filter(n => !n.read).length)
                ),

                React.createElement(motion.div, {
                    whileHover: { scale: 1.05 },
                    className: 'flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg cursor-pointer'
                },
                    React.createElement('div', {
                        className: 'w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold'
                    }, appState.user?.full_name?.charAt(0) || 'U'),
                    React.createElement('div', { className: 'hidden sm:block' },
                        React.createElement('p', {
                            className: 'font-medium text-gray-800 dark:text-white'
                        }, appState.user?.full_name || 'Пользователь'),
                        React.createElement('p', {
                            className: 'text-sm text-gray-600 dark:text-gray-300'
                        }, appState.user?.username || 'user')
                    )
                )
            )
        ),

        // Статистика
        React.createElement('div', {
            className: 'grid grid-cols-2 lg:grid-cols-4 gap-6'
        },
            statCards.map((stat, index) =>
                React.createElement(motion.div, {
                    key: stat.label,
                    initial: { opacity: 0, y: 20 },
                    animate: { opacity: 1, y: 0 },
                    transition: { delay: index * 0.1 },
                    className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg'
                },
                    React.createElement('div', {
                        className: 'flex items-center justify-between'
                    },
                        React.createElement('div', {},
                            React.createElement('p', {
                                className: 'text-3xl font-bold text-gray-800 dark:text-white'
                            }, stat.value),
                            React.createElement('p', {
                                className: 'text-gray-600 dark:text-gray-300 text-sm mt-1'
                            }, stat.label)
                        ),
                        React.createElement('div', {
                            className: `text-2xl p-3 rounded-xl bg-${stat.color}-100 dark:bg-${stat.color}-900 text-${stat.color}-600 dark:text-${stat.color}-300`
                        }, stat.icon)
                    )
                )
            )
        ),

        // AI Ассистент
        React.createElement(AIAssistant, { suggestions: aiSuggestions }),

        // Недавние проекты
        React.createElement('div', {},
            React.createElement('div', {
                className: 'flex justify-between items-center mb-6'
            },
                React.createElement('h2', {
                    className: 'text-2xl font-bold text-gray-800 dark:text-white'
                }, 'Мои проекты'),

                React.createElement(motion.button, {
                    whileHover: { scale: 1.05 },
                    whileTap: { scale: 0.95 },
                    onClick: () => setAppState(prev => ({ ...prev, showCreateProjectModal: true })),
                    className: 'px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors'
                }, 'Создать проект')
            ),

            appState.projects && appState.projects.length > 0 ?
                React.createElement('div', {
                    className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                },
                    appState.projects.slice(0, 6).map((project, index) =>
                        React.createElement(ProjectCard, {
                            key: project.hash,
                            project: project,
                            index: index,
                            onClick: () => setAppState(prev => ({
                                ...prev,
                                currentView: 'project-details',
                                currentProject: project
                            }))
                        })
                    )
                ) :
                React.createElement(motion.div, {
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    className: 'text-center py-12'
                },
                    React.createElement('div', {
                        className: 'text-6xl mb-4'
                    }, '📁'),
                    React.createElement('h3', {
                        className: 'text-xl font-bold text-gray-800 dark:text-white mb-2'
                    }, 'Проектов пока нет'),
                    React.createElement('p', {
                        className: 'text-gray-600 dark:text-gray-300 mb-6'
                    }, 'Создайте свой первый проект и начните работу'),
                    React.createElement(motion.button, {
                        whileHover: { scale: 1.05 },
                        whileTap: { scale: 0.95 },
                        onClick: () => setAppState(prev => ({ ...prev, showCreateProjectModal: true })),
                        className: 'px-8 py-4 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors'
                    }, 'Создать проект')
                )
        ),

        // Недавние задачи
        appState.recentTasks && appState.recentTasks.length > 0 &&
        React.createElement('div', {},
            React.createElement('h2', {
                className: 'text-2xl font-bold text-gray-800 dark:text-white mb-6'
            }, 'Недавние задачи'),

            React.createElement('div', {
                className: 'grid grid-cols-1 md:grid-cols-2 gap-6'
            },
                appState.recentTasks.slice(0, 4).map((task, index) =>
                    React.createElement(motion.div, {
                        key: task.id,
                        initial: { opacity: 0, y: 20 },
                        animate: { opacity: 1, y: 0 },
                        transition: { delay: index * 0.1 },
                        onClick: () => setAppState(prev => ({
                            ...prev,
                            currentView: 'task-details',
                            currentTask: task
                        })),
                        className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl cursor-pointer transition-all duration-300 border border-gray-100 dark:border-gray-700'
                    },
                        React.createElement('div', {
                            className: 'flex justify-between items-start mb-3'
                        },
                            React.createElement('h3', {
                                className: 'text-lg font-semibold text-gray-800 dark:text-white truncate flex-1'
                            }, task.title),
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
                            )
                        ),

                        React.createElement('p', {
                            className: 'text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2'
                        }, task.description || 'Без описания'),

                        React.createElement('div', {
                            className: 'flex justify-between items-center text-sm text-gray-500 dark:text-gray-400'
                        },
                            React.createElement('span', {},
                                task.due_date ? `Срок: ${new Date(task.due_date).toLocaleDateString()}` : 'Без срока'
                            ),
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
                        )
                    )
                )
            )
        ),

        // Модальные окна
        React.createElement(CreateProjectModal, {
            isOpen: appState.showCreateProjectModal,
            onClose: () => setAppState(prev => ({ ...prev, showCreateProjectModal: false })),
            onCreate: handleCreateProject
        }),

        React.createElement(NotificationsModal, {
            isOpen: appState.showNotificationsModal,
            onClose: () => setAppState(prev => ({ ...prev, showNotificationsModal: false })),
            notifications: appState.notifications,
            onMarkAllRead: async () => {
                await ApiService.markAllNotificationsRead();
                setAppState(prev => ({
                    ...prev,
                    notifications: prev.notifications.map(n => ({ ...n, read: true }))
                }));
            }
        }),

        React.createElement(SettingsModal, {
            isOpen: appState.showSettingsModal,
            onClose: () => setAppState(prev => ({ ...prev, showSettingsModal: false })),
            user: appState.user,
            onSave: async (settings) => {
                await ApiService.updateUserPreferences(settings);
                // Применяем настройки темы
                if (settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            }
        })
    );
};
