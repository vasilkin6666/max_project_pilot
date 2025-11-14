const TaskView = () => {
    const { appState, setAppState } = useContext(AppContext);
    const [taskData, setTaskData] = useState(null);
    const [subtasks, setSubtasks] = useState([]);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadTaskData = async () => {
            if (!appState.currentTask) return;

            setIsLoading(true);
            try {
                const [taskResponse, commentsResponse] = await Promise.all([
                    ApiService.getTask(appState.currentTask.id),
                    ApiService.getTaskComments(appState.currentTask.id)
                ]);

                setTaskData(taskResponse.task);
                setComments(commentsResponse.comments || []);

                // Загрузка подзадач
                if (taskResponse.task.project_hash) {
                    const tasksResponse = await ApiService.getTasks(taskResponse.task.project_hash);
                    const allSubtasks = tasksResponse.tasks?.filter(t => t.parent_task_id === taskResponse.task.id) || [];
                    setSubtasks(allSubtasks);
                }
            } catch (error) {
                console.error('Error loading task data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadTaskData();
    }, [appState.currentTask]);

    const handleAddComment = async () => {
        if (!newComment.trim() || !taskData) return;

        try {
            const response = await ApiService.createTaskComment(taskData.id, newComment);
            setComments(prev => [...prev, response.comment]);
            setNewComment('');
        } catch (error) {
            console.error('Error adding comment:', error);
            alert('Ошибка при добавлении комментария: ' + error.message);
        }
    };

    const handleStatusChange = async (newStatus) => {
        if (!taskData) return;

        try {
            await ApiService.updateTaskStatus(taskData.id, newStatus);
            setTaskData(prev => ({ ...prev, status: newStatus }));
        } catch (error) {
            console.error('Error updating task status:', error);
            alert('Ошибка при обновлении статуса: ' + error.message);
        }
    };

    const handleCreateSubtask = async (subtaskData) => {
        if (!taskData) return;

        try {
            const taskDataWithParent = {
                ...subtaskData,
                parent_task_id: taskData.id,
                project_hash: taskData.project_hash
            };
            const response = await ApiService.createTask(taskDataWithParent);
            setSubtasks(prev => [...prev, response.task]);
            setAppState(prev => ({ ...prev, showCreateSubtaskModal: false }));
        } catch (error) {
            console.error('Error creating subtask:', error);
            alert('Ошибка при создании подзадачи: ' + error.message);
        }
    };

    const handleDeleteTask = async () => {
        if (!taskData) return;

        if (confirm(`Вы уверены, что хотите удалить задачу "${taskData.title}"? Это действие нельзя отменить.`)) {
            try {
                await ApiService.deleteTask(taskData.id);
                setAppState(prev => ({
                    ...prev,
                    currentView: 'project-details',
                    currentTask: null
                }));
            } catch (error) {
                console.error('Error deleting task:', error);
                alert('Ошибка при удалении задачи: ' + error.message);
            }
        }
    };

    if (isLoading) {
        return React.createElement('div', {
            className: 'flex items-center justify-center min-h-64'
        },
            React.createElement('div', { className: 'text-center' },
                React.createElement('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto' }),
                React.createElement('p', { className: 'mt-4 text-gray-600 dark:text-gray-400' }, 'Загрузка задачи...')
            )
        );
    }

    if (!taskData) {
        return React.createElement('div', { className: 'text-center py-12' },
            React.createElement('p', { className: 'text-gray-600 dark:text-gray-400' }, 'Задача не найдена')
        );
    }

    const canEdit = true; // В реальном приложении проверять права

    return React.createElement('div', { className: 'space-y-6 mx-4' },
        // Заголовок задачи
        React.createElement('div', {
            className: 'flex justify-between items-start mb-6'
        },
            React.createElement('div', { className: 'flex-1' },
                React.createElement('h1', {
                    className: 'text-3xl font-bold text-gray-800 dark:text-white mb-2'
                }, taskData.title),
                React.createElement('div', {
                    className: 'flex flex-wrap gap-2 mb-4'
                },
                    React.createElement('span', {
                        className: `px-3 py-1 rounded-full text-sm font-medium ${
                            taskData.status === 'done'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : taskData.status === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`
                    },
                        taskData.status === 'done' ? 'Выполнено' :
                        taskData.status === 'in_progress' ? 'В работе' : 'К выполнению'
                    ),
                    React.createElement('span', {
                        className: `px-3 py-1 rounded-full text-sm font-medium ${
                            taskData.priority === 'high'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : taskData.priority === 'urgent'
                                ? 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100'
                                : taskData.priority === 'low'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`
                    },
                        taskData.priority === 'high' ? 'Высокий приоритет' :
                        taskData.priority === 'urgent' ? 'Срочный' :
                        taskData.priority === 'low' ? 'Низкий приоритет' : 'Средний приоритет'
                    )
                )
            ),

            React.createElement('div', {
                className: 'flex flex-wrap gap-2 ml-4'
            },
                React.createElement(motion.button, {
                    whileHover: { scale: 1.05 },
                    whileTap: { scale: 0.95 },
                    onClick: () => setAppState(prev => ({ ...prev, showCreateSubtaskModal: true })),
                    className: 'px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm'
                }, 'Создать подзадачу'),

                canEdit && React.createElement(motion.button, {
                    whileHover: { scale: 1.05 },
                    whileTap: { scale: 0.95 },
                    onClick: () => setAppState(prev => ({ ...prev, showEditTaskModal: true })),
                    className: 'px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm'
                }, 'Редактировать'),

                canEdit && React.createElement(motion.button, {
                    whileHover: { scale: 1.05 },
                    whileTap: { scale: 0.95 },
                    onClick: handleDeleteTask,
                    className: 'px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm'
                }, 'Удалить'),

                React.createElement(motion.button, {
                    whileHover: { scale: 1.05 },
                    whileTap: { scale: 0.95 },
                    onClick: () => setAppState(prev => ({
                        ...prev,
                        currentView: 'project-details',
                        currentTask: null
                    })),
                    className: 'px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm'
                }, 'Назад к проекту')
            )
        ),

        // Основной контент
        React.createElement('div', { className: 'grid grid-cols-1 lg:grid-cols-3 gap-6' },
            // Левая колонка - описание и подзадачи
            React.createElement('div', { className: 'lg:col-span-2 space-y-6' },
                // Описание задачи
                React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg' },
                    React.createElement('h2', {
                        className: 'text-xl font-bold text-gray-800 dark:text-white mb-4'
                    }, 'Описание'),
                    React.createElement('p', {
                        className: 'text-gray-600 dark:text-gray-300 whitespace-pre-wrap'
                    }, taskData.description || 'Описание отсутствует')
                ),

                // Подзадачи
                subtasks.length > 0 && React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg' },
                    React.createElement('h2', {
                        className: 'text-xl font-bold text-gray-800 dark:text-white mb-4'
                    }, 'Подзадачи'),
                    React.createElement('div', { className: 'space-y-3' },
                        subtasks.map((subtask, index) =>
                            React.createElement(motion.div, {
                                key: subtask.id,
                                initial: { opacity: 0, y: 10 },
                                animate: { opacity: 1, y: 0 },
                                transition: { delay: index * 0.1 },
                                onClick: () => setAppState(prev => ({
                                    ...prev,
                                    currentView: 'task-details',
                                    currentTask: subtask
                                })),
                                className: 'p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors'
                            },
                                React.createElement('div', { className: 'flex items-center space-x-3' },
                                    React.createElement('input', {
                                        type: 'checkbox',
                                        checked: subtask.status === 'done',
                                        onChange: (e) => handleStatusChange(subtask.id, e.target.checked ? 'done' : 'todo'),
                                        onClick: (e) => e.stopPropagation(),
                                        className: 'rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                                    }),
                                    React.createElement('div', { className: 'flex-1' },
                                        React.createElement('h3', {
                                            className: `font-medium ${
                                                subtask.status === 'done'
                                                    ? 'text-gray-500 dark:text-gray-500 line-through'
                                                    : 'text-gray-800 dark:text-white'
                                            }`
                                        }, subtask.title),
                                        {subtask.description &&
                                            React.createElement('p', {
                                                className: 'text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-1'
                                            }, subtask.description)
                                        }
                                    ),
                                    React.createElement('span', {
                                        className: `px-2 py-1 rounded-full text-xs ${
                                            subtask.status === 'done'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                        }`
                                    },
                                        subtask.status === 'done' ? 'Выполнено' : 'К выполнению'
                                    )
                                )
                            )
                        )
                    )
                ),

                // Комментарии
                React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg' },
                    React.createElement('h2', {
                        className: 'text-xl font-bold text-gray-800 dark:text-white mb-4'
                    }, 'Комментарии'),

                    React.createElement('div', { className: 'space-y-4 mb-6' },
                        comments.length === 0 ?
                            React.createElement('p', {
                                className: 'text-gray-500 dark:text-gray-400 text-center py-4'
                            }, 'Комментариев пока нет') :
                            comments.map((comment, index) =>
                                React.createElement(motion.div, {
                                    key: comment.id || index,
                                    initial: { opacity: 0, y: 10 },
                                    animate: { opacity: 1, y: 0 },
                                    transition: { delay: index * 0.1 },
                                    className: 'p-4 border border-gray-200 dark:border-gray-600 rounded-lg'
                                },
                                    React.createElement('div', { className: 'flex justify-between items-start mb-2' },
                                        React.createElement('p', {
                                            className: 'font-medium text-gray-800 dark:text-white'
                                        }, comment.author_name || 'Аноним'),
                                        React.createElement('p', {
                                            className: 'text-sm text-gray-500 dark:text-gray-400'
                                        }, new Date(comment.created_at).toLocaleString())
                                    ),
                                    React.createElement('p', {
                                        className: 'text-gray-600 dark:text-gray-300'
                                    }, comment.content)
                                )
                            )
                    ),

                    React.createElement('div', { className: 'flex space-x-3' },
                        React.createElement('input', {
                            type: 'text',
                            value: newComment,
                            onChange: (e) => setNewComment(e.target.value),
                            placeholder: 'Введите комментарий...',
                            className: 'flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                        }),
                        React.createElement(motion.button, {
                            whileHover: { scale: 1.05 },
                            whileTap: { scale: 0.95 },
                            onClick: handleAddComment,
                            disabled: !newComment.trim(),
                            className: 'px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                        }, 'Добавить')
                    )
                )
            ),

            // Правая колонка - информация о задаче
            React.createElement('div', { className: 'space-y-6' },
                React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg' },
                    React.createElement('h2', {
                        className: 'text-xl font-bold text-gray-800 dark:text-white mb-4'
                    }, 'Информация'),

                    React.createElement('div', { className: 'space-y-4' },
                        React.createElement('div', {},
                            React.createElement('label', {
                                className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
                            }, 'Статус'),
                            React.createElement('select', {
                                value: taskData.status,
                                onChange: (e) => handleStatusChange(e.target.value),
                                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                            },
                                React.createElement('option', { value: 'todo' }, 'К выполнению'),
                                React.createElement('option', { value: 'in_progress' }, 'В работе'),
                                React.createElement('option', { value: 'done' }, 'Выполнено')
                            )
                        ),

                        React.createElement('div', {},
                            React.createElement('p', {
                                className: 'text-sm font-medium text-gray-700 dark:text-gray-300'
                            }, 'Приоритет'),
                            React.createElement('p', {
                                className: `mt-1 font-medium ${
                                    taskData.priority === 'high' ? 'text-red-500' :
                                    taskData.priority === 'urgent' ? 'text-red-700' :
                                    taskData.priority === 'low' ? 'text-green-500' : 'text-yellow-500'
                                }`
                            },
                                taskData.priority === 'high' ? 'Высокий' :
                                taskData.priority === 'urgent' ? 'Срочный' :
                                taskData.priority === 'low' ? 'Низкий' : 'Средний'
                            )
                        ),

                        React.createElement('div', {},
                            React.createElement('p', {
                                className: 'text-sm font-medium text-gray-700 dark:text-gray-300'
                            }, 'Создана'),
                            React.createElement('p', {
                                className: 'mt-1 text-gray-600 dark:text-gray-400'
                            }, new Date(taskData.created_at).toLocaleString())
                        ),

                        {taskData.due_date &&
                            React.createElement('div', {},
                                React.createElement('p', {
                                    className: 'text-sm font-medium text-gray-700 dark:text-gray-300'
                                }, 'Срок выполнения'),
                                React.createElement('p', {
                                    className: 'mt-1 text-gray-600 dark:text-gray-400'
                                }, new Date(taskData.due_date).toLocaleDateString())
                            )
                        },

                        {taskData.assigned_to &&
                            React.createElement('div', {},
                                React.createElement('p', {
                                    className: 'text-sm font-medium text-gray-700 dark:text-gray-300'
                                }, 'Исполнитель'),
                                React.createElement('p', {
                                    className: 'mt-1 text-gray-600 dark:text-gray-400'
                                }, taskData.assigned_to.full_name || taskData.assigned_to.username)
                            )
                        }
                    )
                ),

                // Быстрые действия
                React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg' },
                    React.createElement('h2', {
                        className: 'text-xl font-bold text-gray-800 dark:text-white mb-4'
                    }, 'Быстрые действия'),

                    React.createElement('div', { className: 'space-y-3' },
                        React.createElement(motion.button, {
                            whileHover: { scale: 1.02 },
                            whileTap: { scale: 0.98 },
                            onClick: () => setAppState(prev => ({ ...prev, showCreateSubtaskModal: true })),
                            className: 'w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-left'
                        },
                            React.createElement('span', { className: 'font-medium' }, '➕ Создать подзадачу')
                        ),

                        React.createElement(motion.button, {
                            whileHover: { scale: 1.02 },
                            whileTap: { scale: 0.98 },
                            onClick: () => navigator.share?.({
                                title: taskData.title,
                                text: taskData.description,
                                url: window.location.href
                            }),
                            className: 'w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-left'
                        },
                            React.createElement('span', { className: 'font-medium' }, '📤 Поделиться задачей')
                        ),

                        React.createElement(motion.button, {
                            whileHover: { scale: 1.02 },
                            whileTap: { scale: 0.98 },
                            onClick: () => {
                                const taskUrl = window.location.href;
                                navigator.clipboard.writeText(taskUrl);
                                alert('Ссылка на задачу скопирована в буфер обмена');
                            },
                            className: 'w-full px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-left'
                        },
                            React.createElement('span', { className: 'font-medium' }, '📎 Копировать ссылку')
                        )
                    )
                )
            )
        ),

        // Модальные окна
        React.createElement(CreateTaskModal, {
            isOpen: appState.showCreateSubtaskModal,
            onClose: () => setAppState(prev => ({ ...prev, showCreateSubtaskModal: false })),
            onCreate: handleCreateSubtask,
            project: appState.currentProject
        })
    );
};
