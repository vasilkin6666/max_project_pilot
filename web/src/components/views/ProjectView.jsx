const ProjectView = () => {
    const { appState, setAppState } = useContext(AppContext);
    const [projectData, setProjectData] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [members, setMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadProjectData = async () => {
            if (!appState.currentProject) return;

            setIsLoading(true);
            try {
                const [projectResponse, tasksResponse, membersResponse] = await Promise.all([
                    ApiService.getProject(appState.currentProject.hash),
                    ApiService.getTasks(appState.currentProject.hash),
                    ApiService.getProjectMembers(appState.currentProject.hash)
                ]);

                setProjectData(projectResponse.project);
                setTasks(tasksResponse.tasks || []);
                setMembers(membersResponse.members || []);
            } catch (error) {
                console.error('Error loading project data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadProjectData();
    }, [appState.currentProject]);

    const handleCreateTask = async (taskData) => {
        try {
            const response = await ApiService.createTask(taskData);
            setTasks(prev => [...prev, response.task]);
            setAppState(prev => ({ ...prev, showCreateTaskModal: false }));
        } catch (error) {
            console.error('Error creating task:', error);
            alert('Ошибка при создании задачи: ' + error.message);
        }
    };

    const handleDeleteProject = async () => {
        if (!projectData) return;

        if (confirm(`Вы уверены, что хотите удалить проект "${projectData.title}"? Это действие нельзя отменить.`)) {
            try {
                await ApiService.deleteProject(projectData.hash);
                setAppState(prev => ({
                    ...prev,
                    currentView: 'dashboard',
                    currentProject: null,
                    projects: prev.projects.filter(p => p.hash !== projectData.hash)
                }));
            } catch (error) {
                console.error('Error deleting project:', error);
                alert('Ошибка при удалении проекта: ' + error.message);
            }
        }
    };

    if (isLoading) {
        return React.createElement('div', {
            className: 'flex items-center justify-center min-h-64'
        },
            React.createElement('div', { className: 'text-center' },
                React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto' }),
                React.createElement('p', { className: 'mt-4 text-gray-600 dark:text-gray-400' }, 'Загрузка проекта...')
            )
        );
    }

    if (!projectData) {
        return React.createElement('div', { className: 'text-center py-12' },
            React.createElement('p', { className: 'text-gray-600 dark:text-gray-400' }, 'Проект не найден')
        );
    }

    const stats = projectData.stats || {};
    const userRole = projectData.current_user_role;
    const canEdit = userRole === 'owner';
    const canManage = userRole === 'owner' || userRole === 'admin';

    return React.createElement('div', { className: 'space-y-6 mx-4' },
        // Заголовок проекта
        React.createElement('div', {
            className: 'flex justify-between items-start mb-6'
        },
            React.createElement('div', { className: 'flex-1' },
                React.createElement('h1', {
                    className: 'text-3xl font-bold text-gray-800 dark:text-white mb-2'
                }, projectData.title),
                React.createElement('p', {
                    className: 'text-gray-600 dark:text-gray-300 mb-4'
                }, projectData.description || 'Без описания'),

                React.createElement('div', {
                    className: 'flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400'
                },
                    React.createElement('span', {}, `Участников: ${stats.members_count || 0}`),
                    React.createElement('span', {}, `Всего задач: ${stats.tasks_count || 0}`),
                    React.createElement('span', {}, `Выполнено: ${stats.tasks_done || 0}`),
                    React.createElement('span', {}, `В работе: ${stats.tasks_in_progress || 0}`),
                    React.createElement('span', {
                        className: `px-2 py-1 rounded-full text-xs ${
                            projectData.is_private
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`
                    }, projectData.is_private ? 'Приватный' : 'Публичный')
                )
            ),

            React.createElement('div', {
                className: 'flex flex-wrap gap-2 ml-4'
            },
                canManage && React.createElement(motion.button, {
                    whileHover: { scale: 1.05 },
                    whileTap: { scale: 0.95 },
                    onClick: () => setAppState(prev => ({ ...prev, showProjectMembersModal: true })),
                    className: 'px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm'
                }, 'Участники'),

                canManage && React.createElement(motion.button, {
                    whileHover: { scale: 1.05 },
                    whileTap: { scale: 0.95 },
                    onClick: () => setAppState(prev => ({ ...prev, showJoinRequestsModal: true })),
                    className: 'px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm'
                }, 'Заявки'),

                canEdit && React.createElement(motion.button, {
                    whileHover: { scale: 1.05 },
                    whileTap: { scale: 0.95 },
                    onClick: () => setAppState(prev => ({ ...prev, showEditProjectModal: true })),
                    className: 'px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm'
                }, 'Редактировать'),

                canEdit && React.createElement(motion.button, {
                    whileHover: { scale: 1.05 },
                    whileTap: { scale: 0.95 },
                    onClick: handleDeleteProject,
                    className: 'px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm'
                }, 'Удалить'),

                React.createElement(motion.button, {
                    whileHover: { scale: 1.05 },
                    whileTap: { scale: 0.95 },
                    onClick: () => setAppState(prev => ({ ...prev, currentView: 'dashboard', currentProject: null })),
                    className: 'px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm'
                }, 'Назад')
            )
        ),

        // Задачи проекта
        React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg' },
            React.createElement('div', {
                className: 'flex justify-between items-center mb-6'
            },
                React.createElement('h2', {
                    className: 'text-2xl font-bold text-gray-800 dark:text-white'
                }, 'Задачи проекта'),

                React.createElement(motion.button, {
                    whileHover: { scale: 1.05 },
                    whileTap: { scale: 0.95 },
                    onClick: () => setAppState(prev => ({ ...prev, showCreateTaskModal: true })),
                    className: 'px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors'
                }, 'Создать задачу')
            ),

            tasks.length === 0 ?
                React.createElement('div', { className: 'text-center py-8 text-gray-500 dark:text-gray-400' },
                    React.createElement('div', { className: 'text-6xl mb-4' }, '📝'),
                    React.createElement('p', { className: 'text-lg' }, 'Задач пока нет'),
                    React.createElement('p', { className: 'text-sm mt-2' }, 'Создайте первую задачу для этого проекта')
                ) :
                React.createElement('div', { className: 'space-y-3' },
                    tasks.filter(task => !task.parent_task_id).map((task, index) =>
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
                            className: 'p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors'
                        },
                            React.createElement('div', {
                                className: 'flex justify-between items-start mb-2'
                            },
                                React.createElement('h3', {
                                    className: 'font-semibold text-gray-800 dark:text-white'
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
                                className: 'text-gray-600 dark:text-gray-300 text-sm mb-3 line-clamp-2'
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

        // Участники проекта
        React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg' },
            React.createElement('h2', {
                className: 'text-2xl font-bold text-gray-800 dark:text-white mb-6'
            }, 'Участники проекта'),

            members.length === 0 ?
                React.createElement('p', {
                    className: 'text-gray-500 dark:text-gray-400 text-center py-4'
                }, 'Участников нет') :
                React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' },
                    members.map((member, index) =>
                        React.createElement(motion.div, {
                            key: member.user_id,
                            initial: { opacity: 0, y: 20 },
                            animate: { opacity: 1, y: 0 },
                            transition: { delay: index * 0.1 },
                            className: 'p-4 border border-gray-200 dark:border-gray-600 rounded-lg'
                        },
                            React.createElement('div', { className: 'flex items-center space-x-3' },
                                React.createElement('div', {
                                    className: 'w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold'
                                }, member.full_name?.charAt(0) || 'U'),
                                React.createElement('div', { className: 'flex-1' },
                                    React.createElement('p', {
                                        className: 'font-medium text-gray-800 dark:text-white'
                                    }, member.full_name || `Участник ${member.user_id}`),
                                    React.createElement('p', {
                                        className: 'text-sm text-gray-600 dark:text-gray-400'
                                    },
                                        member.role === 'owner' ? 'Владелец' :
                                        member.role === 'admin' ? 'Администратор' :
                                        member.role === 'member' ? 'Участник' : 'Гость'
                                    )
                                )
                            ),
                            {member.user_id === appState.user?.id &&
                                React.createElement('span', {
                                    className: 'text-xs text-blue-500 mt-2 block'
                                }, 'Вы')
                            }
                        )
                    )
                )
        ),

        // Модальные окна
        React.createElement(CreateTaskModal, {
            isOpen: appState.showCreateTaskModal,
            onClose: () => setAppState(prev => ({ ...prev, showCreateTaskModal: false })),
            onCreate: handleCreateTask,
            project: projectData
        })
    );
};
