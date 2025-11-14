const DashboardView = () => {
    const { appState, setAppState } = useContext(AppContext);
    const [aiSuggestions, setAiSuggestions] = useState([]);

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
            }
        ];
        setAiSuggestions(suggestions);
    }, []);

    const stats = [
        {
            label: 'Активных проектов',
            value: appState.projects?.length || 0,
            color: 'blue',
            icon: '📁'
        },
        {
            label: 'Всего задач',
            value: appState.projects?.reduce((sum, p) => sum + (p.stats?.tasks_count || 0), 0) || 0,
            color: 'green',
            icon: '✅'
        }
    ];

    return React.createElement('div', { className: 'container mx-auto px-4 py-6 max-w-7xl' },
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
            )
        ),

        // Статистика
        React.createElement('div', {
            className: 'grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8'
        },
            stats.map((stat, index) =>
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

        // Проекты
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
                    appState.projects.map((project, index) =>
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
                    }, 'Создайте свой первый проект и начните работу')
                )
        )
    );
};
