// Task manager component
class TaskManager {
    constructor() {
        this.currentTask = null;
        this.currentSubtasks = [];
        this.taskViewModes = new Map();
    }

    async init() {
        console.log('Task manager initialized');
        this.setupEventListeners();
        this.setupTaskViewModes();
        return Promise.resolve();
    }

    setupEventListeners() {
        // Task status changes
        document.addEventListener('change', (e) => {
            if (e.target.matches('.task-status-select')) {
                this.updateTaskStatus(e.target.dataset.taskId, e.target.value);
            }
        });

        // Task priority changes
        document.addEventListener('change', (e) => {
            if (e.target.matches('.task-priority-select')) {
                this.updateTaskPriority(e.target.dataset.taskId, e.target.value);
            }
        });

        // Subtask toggles
        document.addEventListener('change', (e) => {
            if (e.target.matches('.subtask-checkbox')) {
                this.toggleSubtask(e.target.dataset.subtaskId, e.target.checked);
            }
        });
    }

    setupTaskViewModes() {
        this.taskViewModes.set('list', this.renderTaskListView.bind(this));
        this.taskViewModes.set('board', this.renderTaskBoardView.bind(this));
        this.taskViewModes.set('calendar', this.renderTaskCalendarView.bind(this));
    }

    // Task operations
    async openTask(taskId) {
        try {
            const api = window.App?.modules?.api;
            if (!api) return;

            const taskData = await api.getTask(taskId);
            this.currentTask = taskData.task || taskData;

            await this.renderTaskView(this.currentTask);
            window.App?.showView('taskView');

        } catch (error) {
            console.error('Error opening task:', error);
            Utils.showToast('Ошибка загрузки задачи', 'error');
        }
    }

    async renderTaskView(task) {
        const container = document.getElementById('taskView');
        if (!container) return;

        container.innerHTML = this.createTaskViewHTML(task);
        await this.loadTaskDetails(task.id);
        this.setupTaskViewEvents(task);
    }

    createTaskViewHTML(task) {
        return `
            <div class="task-details">
                <div class="task-main">
                    <!-- Task Header -->
                    <div class="task-header">
                        <div class="task-title-section">
                            <h1 class="task-title">${Utils.escapeHtml(task.title)}</h1>
                            <div class="task-meta">
                                <span>Создана: ${Utils.formatDateTime(task.created_at)}</span>
                                ${task.due_date ? `<span>Срок: ${Utils.formatDate(task.due_date)}</span>` : ''}
                            </div>
                        </div>
                        <div class="task-actions">
                            <button class="btn btn-info" id="createSubtaskBtn">
                                ➕ Подзадача
                            </button>
                            <button class="btn btn-warning" id="editTaskBtn">
                                ✏️ Редактировать
                            </button>
                            <button class="btn btn-danger" id="deleteTaskBtn">
                                🗑️ Удалить
                            </button>
                            <button class="btn btn-secondary" onclick="App.backToProject()">
                                ← Назад
                            </button>
                        </div>
                    </div>

                    <!-- Task Description -->
                    <section class="task-description-section">
                        <h3 class="section-title">Описание</h3>
                        <div class="task-description-content">
                            ${task.description ? Utils.escapeHtml(task.description) : '<p>Описание отсутствует</p>'}
                        </div>
                    </section>

                    <!-- Subtasks -->
                    <section class="subtasks-section" id="subtasksSection">
                        <div class="subtasks-header">
                            <h3 class="section-title">Подзадачи</h3>
                            <button class="btn btn-sm btn-primary" id="addSubtaskBtn">
                                ➕ Добавить
                            </button>
                        </div>
                        <div id="subtasksList" class="subtasks-list">
                            <!-- Subtasks will be loaded here -->
                        </div>
                    </section>

                    <!-- Comments -->
                    <section class="comments-section">
                        <h3 class="section-title">Комментарии</h3>
                        <div id="taskCommentsList" class="comments-list">
                            <!-- Comments will be loaded here -->
                        </div>
                        <div class="comment-form">
                            <textarea
                                class="comment-input"
                                id="newCommentText"
                                placeholder="Введите комментарий..."
                            ></textarea>
                            <button class="btn btn-primary" onclick="App.components.tasks.addComment()">
                                Отправить
                            </button>
                        </div>
                    </section>
                </div>

                <div class="task-sidebar">
                    <!-- Task Info -->
                    <div class="task-info-card">
                        <h3 class="section-title">Информация</h3>

                        <div class="info-group">
                            <div class="info-label">Статус</div>
                            <select
                                class="form-control task-status-select"
                                id="taskStatusSelect"
                                data-task-id="${task.id}"
                            >
                                <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>К выполнению</option>
                                <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>В работе</option>
                                <option value="done" ${task.status === 'done' ? 'selected' : ''}>Выполнено</option>
                            </select>
                        </div>

                        <div class="info-group">
                            <div class="info-label">Приоритет</div>
                            <div class="info-value">
                                <span class="info-priority priority-${task.priority}">
                                    ${this.getPriorityText(task.priority)}
                                </span>
                            </div>
                        </div>

                        <div class="info-group">
                            <div class="info-label">Создана</div>
                            <div class="info-value">${Utils.formatDateTime(task.created_at)}</div>
                        </div>

                        ${task.due_date ? `
                        <div class="info-group">
                            <div class="info-label">Срок выполнения</div>
                            <div class="info-value ${Utils.isOverdue(task.due_date) ? 'text-danger' : ''}">
                                ${Utils.formatDate(task.due_date)}
                                ${Utils.isOverdue(task.due_date) ? ' (Просрочено)' : ''}
                            </div>
                        </div>
                        ` : ''}

                        <div class="info-group">
                            <div class="info-label">Исполнитель</div>
                            <div class="info-value" id="taskAssignee">
                                <!-- Assignee will be loaded -->
                            </div>
                        </div>

                        ${task.project_hash ? `
                        <div class="info-group">
                            <div class="info-label">Проект</div>
                            <div class="info-value">
                                <a href="#" onclick="App.openProject('${task.project_hash}')">
                                    Перейти к проекту
                                </a>
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <!-- Progress -->
                    <div class="progress-section">
                        <div class="progress-header">
                            <h3 class="section-title">Прогресс</h3>
                            <span id="progressPercentage">0%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill" style="width: 0%"></div>
                        </div>
                        <div class="progress-stats" id="progressStats">
                            <!-- Progress stats will be loaded -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadTaskDetails(taskId) {
        try {
            const api = window.App?.modules?.api;
            if (!api) return;

            const [comments, subtasks] = await Promise.all([
                api.getTaskComments(taskId),
                this.loadSubtasks(taskId)
            ]);

            this.renderTaskComments(comments.comments || []);
            this.renderSubtasks(subtasks);
            await this.loadTaskAssignee();
            this.calculateProgress();

        } catch (error) {
            console.error('Error loading task details:', error);
        }
    }

    async loadSubtasks(parentTaskId) {
        try {
            const api = window.App?.modules?.api;
            if (!api) return [];

            // Get all tasks from the project and filter subtasks
            const projectHash = this.currentTask.project_hash;
            if (!projectHash) return [];

            const response = await api.getTasks(projectHash);
            const allTasks = response.tasks || [];

            return allTasks.filter(task => task.parent_task_id === parentTaskId);
        } catch (error) {
            console.error('Error loading subtasks:', error);
            return [];
        }
    }

    renderSubtasks(subtasks) {
        const container = document.getElementById('subtasksList');
        if (!container) return;

        this.currentSubtasks = subtasks;

        if (!subtasks || subtasks.length === 0) {
            container.innerHTML = '<p>Подзадач нет</p>';
            return;
        }

        container.innerHTML = subtasks.map(subtask => `
            <div class="subtask-item ${subtask.status === 'done' ? 'completed' : ''}"
                 data-subtask-id="${subtask.id}">
                <input
                    type="checkbox"
                    class="subtask-checkbox"
                    data-subtask-id="${subtask.id}"
                    ${subtask.status === 'done' ? 'checked' : ''}
                >
                <div class="subtask-content">
                    <div class="subtask-title">${Utils.escapeHtml(subtask.title)}</div>
                    <div class="subtask-meta">
                        <span class="subtask-status">${this.getStatusText(subtask.status)}</span>
                        ${subtask.due_date ? `<span class="subtask-due">${Utils.formatDate(subtask.due_date)}</span>` : ''}
                    </div>
                </div>
                <div class="subtask-actions">
                    <button class="btn btn-sm btn-secondary" onclick="App.components.tasks.editSubtask(${subtask.id})">
                        ✏️
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderTaskComments(comments) {
        const container = document.getElementById('taskCommentsList');
        if (!container) return;

        if (!comments || comments.length === 0) {
            container.innerHTML = '<p>Комментариев пока нет</p>';
            return;
        }

        container.innerHTML = comments.map(comment => `
            <div class="comment-item">
                <div class="comment-avatar">
                    ${Utils.getInitials(comment.author_name || 'Аноним')}
                </div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${Utils.escapeHtml(comment.author_name || 'Аноним')}</span>
                        <span class="comment-time">${Utils.formatDateTime(comment.created_at)}</span>
                    </div>
                    <div class="comment-text">${Utils.escapeHtml(comment.content)}</div>
                </div>
            </div>
        `).join('');
    }

    async loadTaskAssignee() {
        const container = document.getElementById('taskAssignee');
        if (!container || !this.currentTask.assigned_to_id) return;

        try {
            const api = window.App?.modules?.api;
            if (!api) return;

            // Try to get assignee from project members first
            const projectHash = this.currentTask.project_hash;
            if (projectHash) {
                const members = await api.getProjectMembers(projectHash);
                const assignee = members.members?.find(m =>
                    m.user_id === this.currentTask.assigned_to_id ||
                    (m.user && m.user.id === this.currentTask.assigned_to_id)
                );

                if (assignee) {
                    const displayName = assignee.user?.full_name || assignee.full_name;
                    container.innerHTML = `
                        <div class="info-assignee">
                            <div class="assignee-avatar">
                                ${Utils.getInitials(displayName)}
                            </div>
                            <span>${Utils.escapeHtml(displayName)}</span>
                        </div>
                    `;
                    return;
                }
            }

            // Fallback to user ID
            container.textContent = `ID: ${this.currentTask.assigned_to_id}`;

        } catch (error) {
            console.error('Error loading task assignee:', error);
            container.textContent = `ID: ${this.currentTask.assigned_to_id}`;
        }
    }

    calculateProgress() {
        if (!this.currentSubtasks || this.currentSubtasks.length === 0) {
            this.updateProgress(0, 0, 0);
            return;
        }

        const total = this.currentSubtasks.length;
        const completed = this.currentSubtasks.filter(t => t.status === 'done').length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        this.updateProgress(percentage, completed, total);
    }

    updateProgress(percentage, completed, total) {
        const percentageElement = document.getElementById('progressPercentage');
        const fillElement = document.getElementById('progressFill');
        const statsElement = document.getElementById('progressStats');

        if (percentageElement) {
            percentageElement.textContent = `${percentage}%`;
        }

        if (fillElement) {
            fillElement.style.width = `${percentage}%`;
        }

        if (statsElement) {
            statsElement.innerHTML = `
                <div class="progress-stat">
                    <div class="progress-number">${total}</div>
                    <div class="progress-label">Всего</div>
                </div>
                <div class="progress-stat">
                    <div class="progress-number">${completed}</div>
                    <div class="progress-label">Выполнено</div>
                </div>
                <div class="progress-stat">
                    <div class="progress-number">${total - completed}</div>
                    <div class="progress-label">Осталось</div>
                </div>
            `;
        }
    }

    // Task actions
    async updateTaskStatus(taskId, newStatus) {
        try {
            const api = window.App?.modules?.api;
            if (!api) return;

            await api.updateTaskStatus(taskId, newStatus);

            // Update local task object
            if (this.currentTask && this.currentTask.id === taskId) {
                this.currentTask.status = newStatus;
            }

            Utils.showToast('Статус задачи обновлен', 'success');

            // If this is a subtask, recalculate progress
            if (this.currentTask && this.currentTask.id !== taskId) {
                this.calculateProgress();
            }

        } catch (error) {
            console.error('Error updating task status:', error);
            Utils.showToast('Ошибка обновления статуса', 'error');
        }
    }

    async updateTaskPriority(taskId, newPriority) {
        try {
            const api = window.App?.modules?.api;
            if (!api) return;

            await api.updateTask(taskId, { priority: newPriority });

            if (this.currentTask && this.currentTask.id === taskId) {
                this.currentTask.priority = newPriority;
            }

            Utils.showToast('Приоритет задачи обновлен', 'success');

        } catch (error) {
            console.error('Error updating task priority:', error);
            Utils.showToast('Ошибка обновления приоритета', 'error');
        }
    }

    async toggleSubtask(subtaskId, isCompleted) {
        try {
            const newStatus = isCompleted ? 'done' : 'todo';
            await this.updateTaskStatus(subtaskId, newStatus);

            // Update local subtask
            const subtask = this.currentSubtasks.find(t => t.id === subtaskId);
            if (subtask) {
                subtask.status = newStatus;
            }

            this.calculateProgress();

        } catch (error) {
            console.error('Error toggling subtask:', error);
        }
    }

    async addComment() {
        const input = document.getElementById('newCommentText');
        if (!input || !this.currentTask) return;

        const content = input.value.trim();
        if (!content) {
            Utils.showToast('Введите текст комментария', 'error');
            return;
        }

        try {
            const api = window.App?.modules?.api;
            if (!api) return;

            await api.createTaskComment(this.currentTask.id, content);

            input.value = '';
            await this.loadTaskDetails(this.currentTask.id);
            Utils.showToast('Комментарий добавлен', 'success');

        } catch (error) {
            console.error('Error adding comment:', error);
            Utils.showToast('Ошибка добавления комментария', 'error');
        }
    }

    // View mode renderers
    renderTaskListView(tasks, container) {
        if (!tasks || tasks.length === 0) {
            container.innerHTML = this.createEmptyTaskState();
            return;
        }

        container.innerHTML = tasks.map(task => `
            <div class="task-card" data-task-id="${task.id}" data-swipeable data-swipe-left="complete">
                <div class="task-card-header">
                    <h4 class="task-title">${Utils.escapeHtml(task.title)}</h4>
                    <span class="task-priority priority-${task.priority}">
                        ${this.getPriorityText(task.priority)}
                    </span>
                </div>
                <p class="task-description">${Utils.escapeHtml(task.description || '')}</p>
                <div class="task-meta">
                    <span class="task-status status-${task.status}">
                        ${this.getStatusText(task.status)}
                    </span>
                    <span class="task-project">${Utils.escapeHtml(task.project_title || '')}</span>
                    ${task.due_date ? `
                    <span class="task-date ${Utils.isOverdue(task.due_date) ? 'overdue' : ''}">
                        ${Utils.formatDate(task.due_date)}
                    </span>
                    ` : ''}
                </div>
            </div>
        `).join('');

        this.attachTaskClickHandlers(container);
    }

    renderTaskBoardView(tasks, container) {
        const statuses = ['todo', 'in_progress', 'done'];
        const groupedTasks = this.groupTasksByStatus(tasks);

        container.innerHTML = `
            <div class="board-container">
                ${statuses.map(status => `
                    <div class="board-column">
                        <div class="board-column-header">
                            <h3 class="board-column-title">${this.getStatusText(status)}</h3>
                            <div class="board-column-count">${groupedTasks[status]?.length || 0}</div>
                        </div>
                        <div class="board-tasks" data-status="${status}">
                            ${this.renderTasksForStatus(groupedTasks[status] || [], status)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        this.makeTasksDraggable();
    }

    renderTaskCalendarView(tasks, container) {
        // Simplified calendar view implementation
        const today = new Date();
        const month = today.getMonth();
        const year = today.getFullYear();

        const tasksByDate = this.groupTasksByDate(tasks);

        container.innerHTML = `
            <div class="calendar-view">
                <div class="calendar-header">
                    <h3>${today.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</h3>
                    <div class="calendar-controls">
                        <button class="btn btn-sm btn-secondary">←</button>
                        <button class="btn btn-sm btn-secondary">→</button>
                    </div>
                </div>
                <div class="calendar-grid">
                    ${this.generateCalendarDays(year, month, tasksByDate)}
                </div>
            </div>
        `;
    }

    // Utility methods
    createEmptyTaskState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">✅</div>
                <h3 class="empty-state-title">Задач нет</h3>
                <p class="empty-state-description">Создайте первую задачу или измените фильтры</p>
            </div>
        `;
    }

    groupTasksByStatus(tasks) {
        return tasks.reduce((groups, task) => {
            if (!groups[task.status]) {
                groups[task.status] = [];
            }
            groups[task.status].push(task);
            return groups;
        }, {});
    }

    groupTasksByDate(tasks) {
        return tasks.reduce((groups, task) => {
            if (task.due_date) {
                const date = new Date(task.due_date).toDateString();
                if (!groups[date]) {
                    groups[date] = [];
                }
                groups[date].push(task);
            }
            return groups;
        }, {});
    }

    renderTasksForStatus(tasks, status) {
        if (!tasks || tasks.length === 0) {
            return '<p>Нет задач</p>';
        }

        return tasks.map(task => `
            <div class="task-card" data-task-id="${task.id}" draggable="true">
                <div class="task-title">${Utils.escapeHtml(task.title)}</div>
                <div class="task-priority priority-${task.priority}">
                    ${this.getPriorityText(task.priority)}
                </div>
            </div>
        `).join('');
    }

    generateCalendarDays(year, month, tasksByDate) {
        // Simplified calendar generation
        const days = [];
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            const dateString = date.toDateString();
            const dayTasks = tasksByDate[dateString] || [];

            days.push(`
                <div class="calendar-day">
                    <div class="calendar-day-header">${day}</div>
                    <div class="calendar-tasks">
                        ${dayTasks.slice(0, 3).map(task => `
                            <div class="calendar-task priority-${task.priority}">
                                ${Utils.escapeHtml(task.title)}
                            </div>
                        `).join('')}
                        ${dayTasks.length > 3 ? `<div class="calendar-task-more">+${dayTasks.length - 3} more</div>` : ''}
                    </div>
                </div>
            `);
        }

        return days.join('');
    }

    attachTaskClickHandlers(container) {
        container.querySelectorAll('.task-card').forEach(card => {
            card.addEventListener('click', () => {
                this.openTask(card.dataset.taskId);
            });
        });
    }

    makeTasksDraggable() {
        const tasks = document.querySelectorAll('.task-card[draggable="true"]');

        tasks.forEach(task => {
            task.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', task.dataset.taskId);
                task.classList.add('dragging');
            });

            task.addEventListener('dragend', () => {
                task.classList.remove('dragging');
            });
        });

        const columns = document.querySelectorAll('.board-tasks');

        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });

            column.addEventListener('dragleave', () => {
                column.classList.remove('drag-over');
            });

            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');

                const taskId = e.dataTransfer.getData('text/plain');
                const newStatus = column.dataset.status;

                this.updateTaskStatus(taskId, newStatus);
            });
        });
    }

    getStatusText(status) {
        const statusMap = {
            'todo': 'К выполнению',
            'in_progress': 'В работе',
            'done': 'Выполнено'
        };
        return statusMap[status] || status;
    }

    getPriorityText(priority) {
        const priorityMap = {
            'low': 'Низкий',
            'medium': 'Средний',
            'high': 'Высокий',
            'urgent': 'Срочный'
        };
        return priorityMap[priority] || priority;
    }

    showLoading() {
        document.getElementById('taskView')?.classList.add('loading');
    }

    hideLoading() {
        document.getElementById('taskView')?.classList.remove('loading');
    }

    setupTaskViewEvents(task) {
        document.getElementById('createSubtaskBtn')?.addEventListener('click', () => {
            this.createSubtask(task.id);
        });

        document.getElementById('editTaskBtn')?.addEventListener('click', () => {
            this.editTask(task.id);
        });

        document.getElementById('deleteTaskBtn')?.addEventListener('click', () => {
            this.deleteTask(task.id);
        });

        document.getElementById('addSubtaskBtn')?.addEventListener('click', () => {
            this.createSubtask(task.id);
        });
    }

    async createSubtask(parentTaskId) {
        const modalManager = window.App?.components?.modals;
        if (modalManager) {
            modalManager.showCreateTaskModal(this.currentTask.project_hash, parentTaskId);
        }
    }

    async editTask(taskId) {
        const modalManager = window.App?.components?.modals;
        if (modalManager) {
            modalManager.showEditTaskModal(taskId);
        }
    }

    async deleteTask(taskId) {
        const modalManager = window.App?.components?.modals;
        if (modalManager) {
            const confirmed = await modalManager.confirm({
                title: 'Удалить задачу',
                message: 'Вы уверены, что хотите удалить эту задачу?',
                description: 'Это действие нельзя отменить.',
                confirmText: 'Удалить',
                type: 'danger'
            });

            if (confirmed) {
                try {
                    const api = window.App?.modules?.api;
                    if (!api) return;

                    await api.deleteTask(taskId);
                    Utils.showToast('Задача удалена', 'success');
                    window.App?.backToProject();

                } catch (error) {
                    console.error('Error deleting task:', error);
                    Utils.showToast('Ошибка удаления задачи', 'error');
                }
            }
        }
    }

    // Cleanup
    destroy() {
        this.currentTask = null;
        this.currentSubtasks = [];
        this.taskViewModes.clear();
    }
}
