class TasksManager {
    static allTasks = [];

    static async loadProjectTasks(projectHash) {
        try {
            const data = await ApiService.apiGetProjectTasks(projectHash);
            this.allTasks = data.tasks || [];
            return this.allTasks;
        } catch (error) {
            Utils.logError('Tasks load error', error);
            throw error;
        }
    }

    static renderTaskCard(task) {
        const isOverdue = task.due_date && new Date(task.due_date) < new Date();
        const progress = task.subtasks && task.subtasks.length > 0 ?
            Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100) : 0;

        return `
            <div class="task-card max-card mb-2" data-task-id="${task.id}">
                <div class="swipe-action delete">
                    <i class="fas fa-trash"></i> Удалить
                </div>
                <div class="swipe-action edit">
                    <i class="fas fa-edit"></i> Редактировать
                </div>

                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0 flex-grow-1">${Utils.escapeHTML(task.title)}</h6>
                    <span class="priority-badge priority-${task.priority}">${this.getPriorityText(task.priority)}</span>
                </div>

                <p class="text-muted small mb-2">${Utils.escapeHTML(task.description || '')}</p>

                <div class="row small text-muted mb-2">
                    <div class="col-6">
                        <i class="fas fa-user"></i> ${Utils.escapeHTML(task.assignee?.full_name || 'Не назначен')}
                    </div>
                    <div class="col-6 text-end ${isOverdue ? 'overdue' : ''}">
                        <i class="fas fa-clock"></i> ${task.due_date ? Utils.formatDate(task.due_date) : 'Нет срока'}
                    </div>
                </div>

                <div class="d-flex justify-content-between align-items-center">
                    <span class="status-badge status-${task.status}">${Utils.getStatusText(task.status)}</span>
                    <small class="text-muted">${progress}% выполнено</small>
                </div>

                ${task.subtasks && task.subtasks.length > 0 ? `
                    <div class="progress mt-2" style="height: 4px;">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                ` : ''}
            </div>`;
    }

    static getPriorityText(priority) {
        const priorities = {
            'low': 'Низкий',
            'medium': 'Средний',
            'high': 'Высокий',
            'urgent': 'Срочный'
        };
        return priorities[priority] || priority;
    }

    static createTaskModal(projectHash) {
        // Загрузка участников проекта для выбора исполнителя
        ProjectsManager.loadProjectMembers(projectHash).then(members => {
            this.showCreateTaskModal(projectHash, members);
        });
    }

    static showCreateTaskModal(projectHash, members) {
        const membersOptions = members.map(member => `
            <option value="${member.user_id}">${Utils.escapeHTML(member.user?.full_name || 'Пользователь')}</option>
        `).join('');

        const modalHTML = `
            <div class="modal fade" id="createTaskModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Создать задачу</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="createTaskForm">
                                <div class="mb-3">
                                    <label class="form-label">Название задачи *</label>
                                    <input type="text" class="form-control" id="taskTitle" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Описание</label>
                                    <textarea class="form-control" id="taskDescription" rows="3"></textarea>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-6">
                                        <label class="form-label">Исполнитель</label>
                                        <select class="form-select" id="taskAssignee">
                                            <option value="">Не назначен</option>
                                            ${membersOptions}
                                        </select>
                                    </div>
                                    <div class="col-6">
                                        <label class="form-label">Приоритет</label>
                                        <select class="form-select" id="taskPriority">
                                            <option value="low">Низкий</option>
                                            <option value="medium" selected>Средний</option>
                                            <option value="high">Высокий</option>
                                            <option value="urgent">Срочный</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Срок выполнения</label>
                                    <input type="datetime-local" class="form-control" id="taskDueDate">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Подзадачи</label>
                                    <div id="subtasksContainer">
                                        <!-- Subtasks will be added here -->
                                    </div>
                                    <button type="button" class="btn btn-sm btn-outline-secondary mt-2" onclick="TasksManager.addSubtaskField()">
                                        <i class="fas fa-plus"></i> Добавить подзадачу
                                    </button>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                            <button type="button" class="btn max-btn-primary" onclick="TasksManager.submitTaskForm('${projectHash}')">
                                Создать задачу
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;

        const existingModal = document.getElementById('createTaskModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('createTaskModal'));
        modal.show();
    }

    static addSubtaskField() {
        const container = document.getElementById('subtasksContainer');
        const subtaskId = 'subtask_' + Date.now();

        const subtaskHTML = `
            <div class="subtask-item" id="${subtaskId}">
                <input type="checkbox" class="subtask-checkbox" disabled>
                <input type="text" class="form-control form-control-sm" placeholder="Название подзадачи">
                <button type="button" class="btn btn-sm btn-outline-danger ms-2" onclick="document.getElementById('${subtaskId}').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>`;

        container.insertAdjacentHTML('beforeend', subtaskHTML);
    }

    static async submitTaskForm(projectHash) {
        const title = document.getElementById('taskTitle').value;
        const description = document.getElementById('taskDescription').value;
        const assigneeId = document.getElementById('taskAssignee').value;
        const priority = document.getElementById('taskPriority').value;
        const dueDate = document.getElementById('taskDueDate').value;

        if (!title) {
            ToastManager.showToast('Введите название задачи', 'warning');
            return;
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
                taskData.assignee_id = assigneeId;
            }

            if (dueDate) {
                taskData.due_date = new Date(dueDate).toISOString();
            }

            // Сбор подзадач
            const subtaskInputs = document.querySelectorAll('#subtasksContainer input[type="text"]');
            const subtasks = Array.from(subtaskInputs)
                .map(input => input.value.trim())
                .filter(title => title !== '')
                .map(title => ({ title, completed: false }));

            if (subtasks.length > 0) {
                taskData.subtasks = subtasks;
            }

            const result = await ApiService.apiCreateTask(taskData);

            if (result && result.task) {
                ToastManager.showToast('Задача создана успешно!', 'success');
                bootstrap.Modal.getInstance(document.getElementById('createTaskModal')).hide();

                // Обновляем список задач в модальном окне проекта
                ProjectsManager.loadProjectTasks(projectHash);
            }
        } catch (error) {
            Utils.logError('Error creating task', error);
            ToastManager.showToast('Ошибка создания задачи: ' + error.message, 'error');
        }
    }

    static editTask(taskId) {
        const task = this.allTasks.find(t => t.id == taskId);
        if (task) {
            this.showEditTaskModal(task);
        }
    }

    static showEditTaskModal(task) {
        // Similar to create but with existing data
        // Implementation would mirror createTaskModal but with pre-filled values
    }

    static deleteTaskWithConfirmation(taskId) {
        const task = this.allTasks.find(t => t.id == taskId);
        if (task) {
            if (confirm(`Вы уверены, что хотите удалить задачу "${task.title}"?`)) {
                this.deleteTask(taskId);
            }
        }
    }

    static async deleteTask(taskId) {
        try {
            await ApiService.apiDeleteTask(taskId);
            ToastManager.showToast('Задача удалена', 'success');
            // Refresh tasks list
            const projectDetailModal = document.getElementById('projectDetailModal');
            if (projectDetailModal) {
                const projectHash = projectDetailModal.querySelector('[data-project-hash]')?.getAttribute('data-project-hash');
                if (projectHash) {
                    ProjectsManager.loadProjectTasks(projectHash);
                }
            }
        } catch (error) {
            Utils.logError('Error deleting task', error);
            ToastManager.showToast('Ошибка удаления задачи: ' + error.message, 'error');
        }
    }

    static async openTaskDetail(taskId) {
        try {
            const response = await ApiService.apiGetTaskById(taskId);
            const task = response.task || response;
            if (task) {
                this.showTaskDetailModal(task);
            }
        } catch (error) {
            Utils.logError('Error opening task detail', error);
            ToastManager.showToast('Ошибка загрузки задачи: ' + error.message, 'error');
        }
    }

    static showTaskDetailModal(task) {
        const currentUserId = AuthManager.getCurrentUserId();
        const isAssignee = task.assignee_id === currentUserId;
        const canEdit = isAssignee || task.can_edit; // Assuming task has can_edit property

        const modalHTML = `
            <div class="modal fade" id="taskDetailModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${Utils.escapeHTML(task.title)}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <p class="text-muted">${Utils.escapeHTML(task.description || 'Без описания')}</p>
                            </div>

                            <div class="row mb-3">
                                <div class="col-6">
                                    <strong>Приоритет:</strong>
                                    <span class="priority-badge priority-${task.priority} ms-2">${this.getPriorityText(task.priority)}</span>
                                </div>
                                <div class="col-6">
                                    <strong>Статус:</strong>
                                    ${canEdit ? `
                                        <select class="form-select form-select-sm d-inline-block w-auto ms-2" id="taskStatusSelect">
                                            <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>К выполнению</option>
                                            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>В работе</option>
                                            <option value="done" ${task.status === 'done' ? 'selected' : ''}>Завершено</option>
                                        </select>
                                    ` : `
                                        <span class="status-badge status-${task.status} ms-2">${Utils.getStatusText(task.status)}</span>
                                    `}
                                </div>
                            </div>

                            <div class="row mb-3">
                                <div class="col-6">
                                    <strong>Исполнитель:</strong>
                                    <span class="ms-2">${Utils.escapeHTML(task.assignee?.full_name || 'Не назначен')}</span>
                                </div>
                                <div class="col-6">
                                    <strong>Создана:</strong>
                                    <span class="ms-2">${Utils.formatDate(task.created_at)}</span>
                                </div>
                            </div>

                            ${task.due_date ? `
                                <div class="row mb-3">
                                    <div class="col-12">
                                        <strong>Срок выполнения:</strong>
                                        <span class="ms-2 ${new Date(task.due_date) < new Date() ? 'overdue' : ''}">
                                            ${Utils.formatDate(task.due_date)}
                                            ${new Date(task.due_date) < new Date() ? ' (Просрочено)' : ''}
                                        </span>
                                    </div>
                                </div>
                            ` : ''}

                            ${task.subtasks && task.subtasks.length > 0 ? `
                                <div class="mb-3">
                                    <h6>Подзадачи</h6>
                                    <div id="subtasksList">
                                        ${task.subtasks.map(subtask => `
                                            <div class="subtask-item">
                                                <input type="checkbox" class="subtask-checkbox" ${subtask.completed ? 'checked' : ''}
                                                       ${canEdit ? '' : 'disabled'} onchange="TasksManager.toggleSubtask('${task.id}', '${subtask.id}', this.checked)">
                                                <div class="subtask-content ${subtask.completed ? 'text-decoration-line-through text-muted' : ''}">
                                                    ${Utils.escapeHTML(subtask.title)}
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            <div class="mb-3">
                                <h6>Комментарии</h6>
                                <div id="commentsList">
                                    <!-- Comments will be loaded here -->
                                </div>
                                <div class="mt-2">
                                    <textarea class="form-control" id="newComment" rows="2" placeholder="Добавить комментарий..."></textarea>
                                    <button class="btn max-btn-primary btn-sm mt-2" onclick="TasksManager.addComment('${task.id}')">
                                        <i class="fas fa-paper-plane"></i> Отправить
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        const existingModal = document.getElementById('taskDetailModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Load comments
        this.loadTaskComments(task.id);

        // Add status change handler
        if (canEdit) {
            document.getElementById('taskStatusSelect').addEventListener('change', (e) => {
                this.updateTaskStatus(task.id, e.target.value);
            });
        }

        const modal = new bootstrap.Modal(document.getElementById('taskDetailModal'));
        modal.show();
    }

    static async loadTaskComments(taskId) {
        try {
            const response = await ApiService.apiGetTaskComments(taskId);
            const comments = response.comments || [];
            this.renderTaskComments(comments);
        } catch (error) {
            Utils.logError('Error loading task comments', error);
            document.getElementById('commentsList').innerHTML = '<p class="text-muted">Ошибка загрузки комментариев</p>';
        }
    }

    static renderTaskComments(comments) {
        const container = document.getElementById('commentsList');

        if (comments.length === 0) {
            container.innerHTML = '<p class="text-muted">Комментариев пока нет</p>';
            return;
        }

        container.innerHTML = comments.map(comment => `
            <div class="comment-item">
                <div class="comment-author">
                    ${Utils.escapeHTML(comment.user?.full_name || 'Пользователь')}
                    <span class="comment-date">${Utils.formatDate(comment.created_at)}</span>
                </div>
                <div class="comment-text">${Utils.escapeHTML(comment.content)}</div>
            </div>
        `).join('');
    }

    static async addComment(taskId) {
        const content = document.getElementById('newComment').value.trim();

        if (!content) {
            ToastManager.showToast('Введите текст комментария', 'warning');
            return;
        }

        try {
            await ApiService.apiAddTaskComment(taskId, content);
            document.getElementById('newComment').value = '';
            await this.loadTaskComments(taskId);
        } catch (error) {
            Utils.logError('Error adding comment', error);
            ToastManager.showToast('Ошибка добавления комментария', 'error');
        }
    }

    static async toggleSubtask(taskId, subtaskId, completed) {
        try {
            // Здесь должен быть API вызов для обновления статуса подзадачи
            // await ApiService.apiUpdateSubtask(taskId, subtaskId, { completed });
        } catch (error) {
            Utils.logError('Error toggling subtask', error);
            ToastManager.showToast('Ошибка обновления подзадачи', 'error');
        }
    }

    static async updateTaskStatus(taskId, status) {
        try {
            await ApiService.apiUpdateTaskStatus(taskId, status);
            ToastManager.showToast('Статус задачи обновлен', 'success');
        } catch (error) {
            Utils.logError('Error updating task status', error);
            ToastManager.showToast('Ошибка обновления статуса', 'error');
        }
    }
}

window.TasksManager = TasksManager;
