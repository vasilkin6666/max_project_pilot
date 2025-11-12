// Менеджер задач
class TasksManager {
    static async loadProjectTasks(projectHash) {
        try {
            const data = await ApiService.getProjectTasks(projectHash);
            const tasks = data.tasks || [];

            // Обновляем глобальное состояние задач
            const currentTasks = StateManager.getState('tasks');
            const updatedTasks = currentTasks.filter(t => t.project_hash !== projectHash).concat(tasks);
            StateManager.setState('tasks', updatedTasks);

            EventManager.emit(APP_EVENTS.TASKS_LOADED, tasks);
            Utils.log('Project tasks loaded', { projectHash, count: tasks.length });

            return tasks;
        } catch (error) {
            Utils.logError('Error loading project tasks:', error);
            throw error;
        }
    }

    static async showCreateTaskModal(projectHash) {
        try {
            // Загружаем участников проекта для выбора исполнителя
            const projectData = await ApiService.getProject(projectHash);
            const members = projectData.members || [];

            ModalManager.showModal('create-task', {
                title: 'Создание задачи',
                size: 'large',
                template: `
                    <form id="create-task-form">
                        <div class="form-group">
                            <label for="task-title" class="form-label">Название задачи *</label>
                            <input type="text" class="form-control" id="task-title" required
                                   placeholder="Введите название задачи">
                        </div>

                        <div class="form-group">
                            <label for="task-description" class="form-label">Описание</label>
                            <textarea class="form-control" id="task-description" rows="3"
                                      placeholder="Опишите задачу (необязательно)"></textarea>
                        </div>

                        <div class="row">
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="task-assignee" class="form-label">Исполнитель</label>
                                    <select class="form-select" id="task-assignee">
                                        <option value="">Не назначен</option>
                                        ${members.map(member => `
                                            <option value="${member.user_id}">
                                                ${Utils.escapeHTML(member.user?.full_name || 'Пользователь')}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="task-priority" class="form-label">Приоритет</label>
                                    <select class="form-select" id="task-priority">
                                        <option value="low">Низкий</option>
                                        <option value="medium" selected>Средний</option>
                                        <option value="high">Высокий</option>
                                        <option value="urgent">Срочный</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="task-due-date" class="form-label">Срок выполнения</label>
                            <input type="datetime-local" class="form-control" id="task-due-date">
                        </div>

                        <div class="form-group">
                            <label class="form-label">Подзадачи</label>
                            <div id="subtasks-container">
                                <!-- Подзадачи будут добавляться динамически -->
                            </div>
                            <button type="button" class="btn btn-outline-secondary btn-sm mt-2"
                                    onclick="TasksManager.addSubtaskField()">
                                <i class="fas fa-plus"></i> Добавить подзадачу
                            </button>
                        </div>
                    </form>
                `,
                actions: [
                    {
                        text: 'Отмена',
                        type: 'secondary',
                        action: 'close'
                    },
                    {
                        text: 'Создать задачу',
                        type: 'primary',
                        action: 'submit',
                        onClick: () => this.handleCreateTaskSubmit(projectHash)
                    }
                ]
            });

            // Добавляем первое поле подзадачи
            this.addSubtaskField();

        } catch (error) {
            Utils.logError('Error loading task creation data:', error);
            ToastManager.error('Ошибка загрузки данных');
        }
    }

    static addSubtaskField() {
        const container = document.getElementById('subtasks-container');
        if (!container) return;

        const subtaskId = 'subtask_' + Date.now();
        const subtaskHTML = `
            <div class="subtask-item" id="${subtaskId}">
                <div class="subtask-content">
                    <input type="checkbox" class="subtask-checkbox" disabled>
                    <input type="text" class="form-control form-control-sm" placeholder="Название подзадачи">
                    <button type="button" class="btn btn-sm btn-outline-danger"
                            onclick="document.getElementById('${subtaskId}').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', subtaskHTML);
    }

    static async handleCreateTaskSubmit(projectHash) {
        const form = document.getElementById('create-task-form');
        if (!form) return;

        const title = document.getElementById('task-title').value.trim();
        const description = document.getElementById('task-description').value.trim();
        const assigneeId = document.getElementById('task-assignee').value;
        const priority = document.getElementById('task-priority').value;
        const dueDate = document.getElementById('task-due-date').value;

        // Валидация
        const titleError = Utils.validateTaskTitle(title);
        if (titleError) {
            ToastManager.error(titleError);
            document.getElementById('task-title').focus();
            return;
        }

        const descriptionError = Utils.validateTaskDescription(description);
        if (descriptionError) {
            ToastManager.error(descriptionError);
            document.getElementById('task-description').focus();
            return;
        }

        // Блокируем кнопку
        const modal = ModalManager.getCurrentModal?.() || document.querySelector('.modal.show');
        const submitBtn = modal?.querySelector('[data-action="submit"]') || modal?.querySelector('button[type="submit"]');
        const originalText = submitBtn?.innerHTML || 'Создать задачу';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание...';
        }

        try {
            const taskData = {
                title: title,
                project_hash: projectHash,
                description: description,
                priority: priority,
                status: 'todo'
            };

            if (assigneeId) {
                taskData.assigned_to_ids = [parseInt(assigneeId)];
            }

            if (dueDate) {
                taskData.due_date = new Date(dueDate).toISOString();
            }

            // Сбор подзадач
            const subtaskInputs = document.querySelectorAll('#subtasks-container input[type="text"]');
            const subtasks = Array.from(subtaskInputs)
                .map(input => input.value.trim())
                .filter(title => title !== '')
                .map(title => ({ title, completed: false }));

            if (subtasks.length > 0) {
                taskData.subtasks = subtasks;
            }

            const result = await ApiService.createTask(taskData);

            if (result && result.task) {
                ToastManager.success('Задача создана успешно!');
                HapticManager.taskCompleted();

                // ИСПРАВЛЕНИЕ: ОБНОВЛЯЕМ СПИСОК ЗАДАЧ ПРОЕКТА
                await this.loadProjectTasks(projectHash);

                // Инвалидируем кэш
                CacheManager.invalidate('tasks');
                CacheManager.invalidate('dashboard');

                EventManager.emit(APP_EVENTS.TASK_CREATED, result.task);

                ModalManager.closeCurrentModal();
            } else {
                throw new Error('Не удалось создать задачу');
            }
        } catch (error) {
            Utils.logError('Error creating task:', error);
            ToastManager.error('Ошибка создания задачи: ' + error.message);
            HapticManager.error();
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    }

    static async openTaskDetail(taskId) {
        try {
            const taskData = await ApiService.getTask(taskId);
            const task = taskData.task || taskData;

            if (task) {
                this.showTaskDetailModal(task);
            }
        } catch (error) {
            Utils.logError('Error opening task detail:', error);
            ToastManager.error('Ошибка загрузки задачи');
        }
    }

    static showTaskDetailModal(task) {
        const currentUserId = AuthManager.getCurrentUserId();
        const isAssignee = task.assignee_id === currentUserId;
        const canEdit = isAssignee || task.can_edit;

        ModalManager.showModal('task-detail', {
            title: task.title,
            size: 'large',
            template: `
                <div class="task-detail">
                    <div class="task-info">
                        <p class="task-description">${Utils.escapeHTML(task.description || 'Без описания')}</p>

                        <div class="task-meta-grid">
                            <div class="meta-item">
                                <strong>Приоритет:</strong>
                                <span class="priority-badge priority-${task.priority}">
                                    ${Utils.getPriorityText(task.priority)}
                                </span>
                            </div>
                            <div class="meta-item">
                                <strong>Статус:</strong>
                                ${canEdit ? `
                                    <select class="form-select form-select-sm d-inline-block w-auto" id="task-status-select">
                                        <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>К выполнению</option>
                                        <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>В работе</option>
                                        <option value="done" ${task.status === 'done' ? 'selected' : ''}>Завершено</option>
                                    </select>
                                ` : `
                                    <span class="status-badge status-${task.status}">
                                        ${Utils.getStatusText(task.status)}
                                    </span>
                                `}
                            </div>
                            <div class="meta-item">
                                <strong>Исполнитель:</strong>
                                <span>${Utils.escapeHTML(task.assignee?.full_name || 'Не назначен')}</span>
                            </div>
                            <div class="meta-item">
                                <strong>Создана:</strong>
                                <span>${Utils.formatDate(task.created_at)}</span>
                            </div>
                            ${task.due_date ? `
                                <div class="meta-item">
                                    <strong>Срок выполнения:</strong>
                                    <span class="${Utils.isOverdue(task.due_date) ? 'overdue' : ''}">
                                        ${Utils.formatDate(task.due_date)}
                                        ${Utils.isOverdue(task.due_date) ? ' (Просрочено)' : ''}
                                    </span>
                                </div>
                            ` : ''}
                        </div>

                        ${task.subtasks && task.subtasks.length > 0 ? `
                            <div class="subtasks-section">
                                <h5>Подзадачи</h5>
                                <div id="subtasks-list" class="subtasks-list">
                                    ${task.subtasks.map(subtask => `
                                        <div class="subtask-item">
                                            <input type="checkbox" class="subtask-checkbox" ${subtask.completed ? 'checked' : ''}
                                                   ${canEdit ? '' : 'disabled'}
                                                   onchange="TasksManager.toggleSubtask('${task.id}', '${subtask.id}', this.checked)">
                                            <div class="subtask-content ${subtask.completed ? 'completed' : ''}">
                                                ${Utils.escapeHTML(subtask.title)}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <div class="task-comments">
                        <h5>Комментарии</h5>
                        <div id="comments-list" class="comments-list">
                            <!-- Комментарии будут загружены динамически -->
                        </div>
                        <div class="comment-form">
                            <textarea class="form-control" id="new-comment" rows="2"
                                      placeholder="Добавить комментарий..."></textarea>
                            <button class="btn btn-primary btn-sm mt-2"
                                    onclick="TasksManager.addComment('${task.id}')">
                                <i class="fas fa-paper-plane"></i> Отправить
                            </button>
                        </div>
                    </div>
                </div>
            `
        });

        // Загружаем комментарии
        this.loadTaskComments(task.id);

        // Настраиваем обработчик изменения статуса
        if (canEdit) {
            const statusSelect = document.getElementById('task-status-select');
            if (statusSelect) {
                statusSelect.addEventListener('change', (e) => {
                    this.updateTaskStatus(task.id, e.target.value);
                });
            }
        }
    }

    static async loadTaskComments(taskId) {
        try {
            const response = await ApiService.getTaskComments(taskId);
            const comments = response.comments || [];
            this.renderTaskComments(comments);
        } catch (error) {
            Utils.logError('Error loading task comments:', error);
            const container = document.getElementById('comments-list');
            if (container) {
                container.innerHTML = '<p class="text-muted">Ошибка загрузки комментариев</p>';
            }
        }
    }

    static renderTaskComments(comments) {
        const container = document.getElementById('comments-list');
        if (!container) return;

        if (comments.length === 0) {
            container.innerHTML = '<p class="text-muted">Комментариев пока нет</p>';
            return;
        }

        container.innerHTML = comments.map(comment => `
            <div class="comment-item">
                <div class="comment-header">
                    <strong>${Utils.escapeHTML(comment.user?.full_name || 'Пользователь')}</strong>
                    <span class="comment-date">${Utils.formatDate(comment.created_at)}</span>
                </div>
                <div class="comment-text">${Utils.escapeHTML(comment.content)}</div>
            </div>
        `).join('');
    }

    static async addComment(taskId) {
        const contentInput = document.getElementById('new-comment');
        const content = contentInput?.value.trim();

        if (!content) {
            ToastManager.error('Введите текст комментария');
            return;
        }

        try {
            await ApiService.addTaskComment(taskId, content);

            // Очищаем поле ввода
            contentInput.value = '';

            // Перезагружаем комментарии
            await this.loadTaskComments(taskId);

            ToastManager.success('Комментарий добавлен');
            HapticManager.success();

        } catch (error) {
            Utils.logError('Error adding comment:', error);
            ToastManager.error('Ошибка добавления комментария');
            HapticManager.error();
        }
    }

    static async toggleSubtask(taskId, subtaskId, completed) {
        try {
            // Здесь должен быть API вызов для обновления статуса подзадачи
            // await ApiService.updateSubtask(taskId, subtaskId, { completed });

            // Временно обновляем UI
            const subtaskElement = document.querySelector(`[onchange*="${subtaskId}"]`).closest('.subtask-item');
            const contentElement = subtaskElement.querySelector('.subtask-content');

            if (completed) {
                contentElement.classList.add('completed');
            } else {
                contentElement.classList.remove('completed');
            }

            HapticManager.selection();

        } catch (error) {
            Utils.logError('Error toggling subtask:', error);
            ToastManager.error('Ошибка обновления подзадачи');
        }
    }

    static async updateTaskStatus(taskId, status) {
        try {
            await ApiService.updateTaskStatus(taskId, status);

            // Обновляем состояние задачи
            StateManager.updateTask(taskId, { status });

            ToastManager.success('Статус задачи обновлен');
            HapticManager.success();

            EventManager.emit(APP_EVENTS.TASK_UPDATED, { id: taskId, status });

        } catch (error) {
            Utils.logError('Error updating task status:', error);
            ToastManager.error('Ошибка обновления статуса');
            HapticManager.error();
        }
    }

    static editTask(taskId) {
        const task = StateManager.getState('tasks').find(t => t.id == taskId);
        if (!task) return;

        // ПРОВЕРКА ПРАВ: можно редактировать свои задачи или если есть права
        const currentUserId = AuthManager.getCurrentUserId();
        if (task.assignee_id !== currentUserId && !task.can_edit) {
            ToastManager.error('Недостаточно прав для редактирования этой задачи');
            HapticManager.error();
            return;
        }

        this.showEditTaskModal(task);
    }

    static showEditTaskModal(task) {
        ModalManager.showModal('edit-task', {
            title: 'Редактирование задачи',
            size: 'large',
            template: `
                <form id="edit-task-form">
                    <div class="form-group">
                        <label for="edit-task-title" class="form-label">Название задачи *</label>
                        <input type="text" class="form-control" id="edit-task-title" required
                               value="${Utils.escapeHTML(task.title)}">
                    </div>

                    <div class="form-group">
                        <label for="edit-task-description" class="form-label">Описание</label>
                        <textarea class="form-control" id="edit-task-description" rows="3">${Utils.escapeHTML(task.description || '')}</textarea>
                    </div>

                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group">
                                <label for="edit-task-priority" class="form-label">Приоритет</label>
                                <select class="form-select" id="edit-task-priority">
                                    <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Низкий</option>
                                    <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Средний</option>
                                    <option value="high" ${task.priority === 'high' ? 'selected' : ''}>Высокий</option>
                                    <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>Срочный</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group">
                                <label for="edit-task-due-date" class="form-label">Срок выполнения</label>
                                <input type="datetime-local" class="form-control" id="edit-task-due-date"
                                       value="${task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : ''}">
                            </div>
                        </div>
                    </div>
                </form>
            `,
            actions: [
                {
                    text: 'Отмена',
                    type: 'secondary',
                    action: 'close'
                },
                {
                    text: 'Сохранить',
                    type: 'primary',
                    action: 'submit',
                    onClick: () => this.handleEditTaskSubmit(task.id)
                }
            ]
        });
    }

    static async handleEditTaskSubmit(taskId) {
        const title = document.getElementById('edit-task-title').value.trim();
        const description = document.getElementById('edit-task-description').value.trim();
        const priority = document.getElementById('edit-task-priority').value;
        const dueDate = document.getElementById('edit-task-due-date').value;

        // Валидация
        const titleError = Utils.validateTaskTitle(title);
        if (titleError) {
            ToastManager.error(titleError);
            return;
        }

        const descriptionError = Utils.validateTaskDescription(description);
        if (descriptionError) {
            ToastManager.error(descriptionError);
            return;
        }

        // Блокируем кнопку
        const modal = ModalManager.getCurrentModal?.() || document.querySelector('.modal.show');
        const submitBtn = modal?.querySelector('[data-action="submit"]') || modal?.querySelector('button[type="submit"]');
        const originalText = submitBtn?.innerHTML || 'Сохранить';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
        }

        try {
            const updateData = {
                title,
                description: description || '',
                priority,
                due_date: dueDate ? new Date(dueDate).toISOString() : null
            };

            await ApiService.updateTask(taskId, updateData);

            ToastManager.success('Задача обновлена');
            HapticManager.success();

            // ИСПРАВЛЕНИЕ: ОБНОВЛЯЕМ СПИСОК ЗАДАЧ ПРОЕКТА
            const task = StateManager.getState('tasks').find(t => t.id == taskId);
            if (task && task.project_hash) {
                await this.loadProjectTasks(task.project_hash);
            }

            // Инвалидируем кэш
            CacheManager.invalidate('tasks');
            CacheManager.invalidate('dashboard');

            // Обновляем состояние
            StateManager.updateTask(taskId, updateData);

            EventManager.emit(APP_EVENTS.TASK_UPDATED, { id: taskId, ...updateData });

            ModalManager.closeCurrentModal();

        } catch (error) {
            Utils.logError('Error updating task:', error);
            ToastManager.error('Ошибка обновления задачи: ' + error.message);
            HapticManager.error();
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    }
    
    static deleteTaskWithConfirmation(taskId) {
        const task = StateManager.getState('tasks').find(t => t.id == taskId);
        if (!task) return;

        // ПРОВЕРКА ПРАВ: можно удалять свои задачи или если есть права
        const currentUserId = AuthManager.getCurrentUserId();
        if (task.assignee_id !== currentUserId && !task.can_edit) {
            ToastManager.error('Недостаточно прав для удаления этой задачи');
            HapticManager.error();
            return;
        }

        ModalManager.showConfirmation({
            title: 'Удаление задачи',
            message: `Вы уверены, что хотите удалить задачу "${task.title}"?`,
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            type: 'danger',
            onConfirm: () => this.deleteTask(taskId)
        });
    }

    static async deleteTask(taskId) {
        try {
            // Получаем информацию о задаче перед удалением для обновления списка
            const task = StateManager.getState('tasks').find(t => t.id == taskId);
            const projectHash = task?.project_hash;

            await ApiService.deleteTask(taskId);

            ToastManager.success('Задача удалена');
            HapticManager.success();

            // ИСПРАВЛЕНИЕ: ОБНОВЛЯЕМ СПИСОК ЗАДАЧ ПРОЕКТА
            if (projectHash) {
                await this.loadProjectTasks(projectHash);
            }

            // Инвалидируем кэш
            CacheManager.invalidate('tasks');
            CacheManager.invalidate('dashboard');

            // Обновляем состояние
            StateManager.removeTask(taskId);

            EventManager.emit(APP_EVENTS.TASK_DELETED, taskId);

            // Закрываем модальное окно если открыто
            ModalManager.closeCurrentModal();

        } catch (error) {
            Utils.logError('Error deleting task:', error);
            ToastManager.error('Ошибка удаления задачи: ' + error.message);
            HapticManager.error();
            throw error; // Пробрасываем ошибку дальше для обработки в вызывающем коде
        }
    }

    // Методы для работы с фильтрами задач
    static async getTasksWithFilters(filters = {}) {
        try {
            const data = await ApiService.getTasks(filters);
            const tasks = data.tasks || [];

            StateManager.setState('tasks', tasks);
            EventManager.emit(APP_EVENTS.TASKS_LOADED, tasks);

            return tasks;
        } catch (error) {
            Utils.logError('Error loading tasks with filters:', error);
            throw error;
        }
    }

    static getTasksByStatus(tasks, status) {
        return tasks.filter(task => task.status === status);
    }

    static getTasksByPriority(tasks, priority) {
        return tasks.filter(task => task.priority === priority);
    }

    static getOverdueTasks(tasks) {
        return tasks.filter(task => Utils.isOverdue(task.due_date));
    }

    static getTasksAssignedToUser(tasks, userId) {
        return tasks.filter(task => task.assignee_id === userId);
    }
}

window.TasksManager = TasksManager;
