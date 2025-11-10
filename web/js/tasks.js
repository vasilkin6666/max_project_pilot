class TasksManager {
    static allTasks = [];
    static currentTaskFilter = null;

    static async loadTasks(status = null) {
        Utils.log('Loading tasks from API', { status });

        try {
            const data = await ApiService.apiGetAllTasks(status);
            // ИСПРАВЛЕНО: Правильная обработка структуры ответа
            this.allTasks = data.tasks || [];

            // Отладочное логирование
            console.log('Tasks loaded:', this.allTasks);
            if (this.allTasks.length > 0) {
                console.log('First task structure:', this.allTasks[0]);
                console.log('Task ID:', this.allTasks[0].id, 'Type:', typeof this.allTasks[0].id);
            }

            this.renderTasks(this.allTasks);
            Utils.log('Tasks loaded successfully', { count: this.allTasks.length });
        } catch (error) {
            Utils.logError('Tasks load error', error);
            ToastManager.showToast('Ошибка загрузки задач: ' + error.message, 'error');
            this.renderError();
        }
    }

    static renderTasks(tasks) {
        console.log('Rendering tasks:', tasks); // Отладочное логирование

        const container = document.getElementById('tasks-list');

        if (tasks.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }

        // Проверить структуру первой задачи
        if (tasks[0]) {
            console.log('First task structure:', tasks[0]);
            console.log('Task ID:', tasks[0].id, 'Type:', typeof tasks[0].id);
        }

        container.innerHTML = tasks.map((task, index) => this.renderTaskCard(task, index)).join('');
    }

    static renderTaskCard(task, index) {
        // ИСПРАВЛЕНО: Используем task.id или временный идентификатор
        const taskIdentifier = task.id || `temp_${index}`;
        const statusColor = Utils.getStatusColor(task.status);
        const statusText = Utils.getStatusText(task.status);

        return `
            <div class="task-item task-${task.status} max-card mb-3" onclick="TasksManager.openTaskDetail('${taskIdentifier}')">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${Utils.escapeHTML(task.title)}</h6>
                        <p class="text-muted small mb-2">${Utils.escapeHTML(task.description || '')}</p>
                        <div class="d-flex align-items-center flex-wrap gap-2">
                            <span class="badge bg-${statusColor}">${statusText}</span>
                            <span class="badge bg-${Utils.getPriorityColor(task.priority)}">${task.priority}</span>
                            <span class="text-muted small">Проект: ${Utils.escapeHTML(task.project?.title || 'Неизвестно')}</span>
                            <span class="text-muted small">${Utils.formatDate(task.created_at)}</span>
                        </div>
                    </div>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" onclick="event.stopPropagation()">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="#" onclick="TasksManager.updateTaskStatus('${taskIdentifier}', 'todo')">К выполнению</a></li>
                            <li><a class="dropdown-item" href="#" onclick="TasksManager.updateTaskStatus('${taskIdentifier}', 'in_progress')">В работу</a></li>
                            <li><a class="dropdown-item" href="#" onclick="TasksManager.updateTaskStatus('${taskIdentifier}', 'done')">Завершить</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item text-danger" href="#" onclick="TasksManager.deleteTask('${taskIdentifier}')">Удалить</a></li>
                        </ul>
                    </div>
                </div>
            </div>`;
    }

    static getEmptyStateHTML() {
        return `
            <div class="max-card text-center">
                <i class="fas fa-tasks fa-2x text-muted mb-3"></i>
                <h6>Задач пока нет</h6>
                <p class="text-muted">Создайте проект и добавьте задачи!</p>
                <button class="btn max-btn-primary" data-section="projects">
                    <i class="fas fa-project-diagram"></i> Перейти к проектам
                </button>
            </div>`;
    }

    static renderError() {
        document.getElementById('tasks-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить задачи</p>
                <button class="btn max-btn-primary btn-sm" onclick="TasksManager.loadTasks()">
                    <i class="fas fa-refresh"></i> Попробовать снова
                </button>
            </div>`;
    }

    static loadTasksWithFilter(status) {
        this.currentTaskFilter = status;
        UI.showSection('tasks');
    }

    static async updateTaskStatus(taskId, status) {
        // ИСПРАВЛЕНО: Валидация ID
        if (!taskId || taskId === 'undefined' || taskId.toString().startsWith('temp_')) {
            Utils.logError('Invalid task ID', taskId);
            ToastManager.showToast('Ошибка: неверный ID задачи', 'error');
            return;
        }

        try {
            await ApiService.apiUpdateTaskStatus(taskId, status);
            ToastManager.showToast(`Статус задачи обновлен на: ${Utils.getStatusText(status)}`, 'success');

            // Обновляем интерфейс
            await this.loadTasks(this.currentTaskFilter);
            if (UI.currentSection === 'dashboard') {
                await DashboardManager.loadDashboardData();
            }
        } catch (error) {
            Utils.logError('Error updating task status', error);
            ToastManager.showToast('Ошибка обновления статуса: ' + error.message, 'error');
        }
    }

    static async deleteTask(taskId) {
        // ИСПРАВЛЕНО: Валидация ID
        if (!taskId || taskId === 'undefined' || taskId.toString().startsWith('temp_')) {
            Utils.logError('Invalid task ID for deletion', taskId);
            ToastManager.showToast('Ошибка: неверный ID задачи', 'error');
            return;
        }

        if (!confirm('Вы уверены, что хотите удалить эту задачу?')) {
            return;
        }

        try {
            await ApiService.apiDeleteTask(taskId);
            ToastManager.showToast('Задача удалена', 'success');

            // Обновляем интерфейс
            await this.loadTasks(this.currentTaskFilter);
            if (UI.currentSection === 'dashboard') {
                await DashboardManager.loadDashboardData();
            }
        } catch (error) {
            Utils.logError('Error deleting task', error);
            ToastManager.showToast('Ошибка удаления задачи: ' + error.message, 'error');
        }
    }

    static async openTaskDetail(taskId) {
        // ИСПРАВЛЕНО: Валидация ID
        if (!taskId || taskId === 'undefined' || taskId.toString().startsWith('temp_')) {
            Utils.logError('Invalid task ID for detail', taskId);
            ToastManager.showToast('Ошибка: неверный ID задачи', 'error');
            return;
        }

        try {
            const task = await ApiService.apiGetTaskById(taskId);
            if (task) {
                this.showTaskModal(task);
            }
        } catch (error) {
            Utils.logError('Error opening task detail', error);
            ToastManager.showToast('Ошибка загрузки задачи: ' + error.message, 'error');
        }
    }

    static showTaskModal(task) {
        // ИСПРАВЛЕНО: Используем task.task если структура вложенная
        const taskData = task.task || task;
        const taskId = taskData.id;

        const modalHTML = `
            <div class="modal fade" id="taskModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${Utils.escapeHTML(taskData.title)}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <h6>Описание</h6>
                                <p class="text-muted">${Utils.escapeHTML(taskData.description || 'Без описания')}</p>
                            </div>

                            <div class="row mb-3">
                                <div class="col-6">
                                    <strong>Статус:</strong>
                                    <span class="badge bg-${Utils.getStatusColor(taskData.status)} ms-2">${Utils.getStatusText(taskData.status)}</span>
                                </div>
                                <div class="col-6">
                                    <strong>Приоритет:</strong>
                                    <span class="badge bg-${Utils.getPriorityColor(taskData.priority)} ms-2">${taskData.priority}</span>
                                </div>
                            </div>

                            <div class="row mb-3">
                                <div class="col-6">
                                    <strong>Проект:</strong>
                                    <span class="ms-2">${Utils.escapeHTML(taskData.project?.title || 'Неизвестно')}</span>
                                </div>
                                <div class="col-6">
                                    <strong>Создана:</strong>
                                    <span class="ms-2">${Utils.formatDate(taskData.created_at)}</span>
                                </div>
                            </div>

                            ${taskData.due_date ? `
                            <div class="row mb-3">
                                <div class="col-12">
                                    <strong>Срок выполнения:</strong>
                                    <span class="ms-2 ${this.isOverdue(taskData.due_date) ? 'text-danger' : ''}">
                                        ${Utils.formatDate(taskData.due_date)}
                                        ${this.isOverdue(taskData.due_date) ? ' (Просрочено)' : ''}
                                    </span>
                                </div>
                            </div>
                            ` : ''}

                            <div class="d-grid gap-2 mb-3">
                                <div class="btn-group">
                                    <button class="btn btn-outline-warning" onclick="TasksManager.updateTaskStatus('${taskId}', 'todo')">К выполнению</button>
                                    <button class="btn btn-outline-info" onclick="TasksManager.updateTaskStatus('${taskId}', 'in_progress')">В работу</button>
                                    <button class="btn btn-outline-success" onclick="TasksManager.updateTaskStatus('${taskId}', 'done')">Завершить</button>
                                </div>
                            </div>

                            <div class="row mb-3">
                                <div class="col-4">
                                    <button class="btn btn-outline-primary w-100" onclick="TasksManager.showTaskDependencies('${taskId}')">
                                        <i class="fas fa-link"></i> Зависимости
                                    </button>
                                </div>
                                <div class="col-4">
                                    <button class="btn btn-outline-info w-100" onclick="TasksManager.showTaskComments('${taskId}')">
                                        <i class="fas fa-comments"></i> Комментарии
                                    </button>
                                </div>
                                <div class="col-4">
                                    <button class="btn btn-outline-danger w-100" onclick="TasksManager.deleteTask('${taskId}')">
                                        <i class="fas fa-trash"></i> Удалить
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        const existingModal = document.getElementById('taskModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('taskModal'));
        modal.show();
    }

    static isOverdue(dueDate) {
        if (!dueDate) return false;
        return new Date(dueDate) < new Date();
    }

    static createTaskModal() {
        if (!ProjectsManager.allProjects || ProjectsManager.allProjects.length === 0) {
            ToastManager.showToast('Сначала создайте проект', 'warning');
            UI.showSection('projects');
            return;
        }

        const projectOptions = ProjectsManager.allProjects.map(p =>
            `<option value="${p.project.hash}">${p.project.title}</option>`
        ).join('');

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
                                <div class="mb-3">
                                    <label class="form-label">Проект *</label>
                                    <select class="form-select" id="taskProject" required>
                                        <option value="">Выберите проект</option>
                                        ${projectOptions}
                                    </select>
                                </div>
                                <div class="row mb-3">
                                    <div class="col-6">
                                        <label class="form-label">Статус</label>
                                        <select class="form-select" id="taskStatus">
                                            <option value="todo">К выполнению</option>
                                            <option value="in_progress">В работе</option>
                                            <option value="done">Завершено</option>
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
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                            <button type="button" class="btn max-btn-primary" onclick="TasksManager.submitTaskForm()">Создать</button>
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

    static async submitTaskForm() {
        const title = document.getElementById('taskTitle').value;
        const description = document.getElementById('taskDescription').value;
        const projectHash = document.getElementById('taskProject').value;
        const status = document.getElementById('taskStatus').value;
        const priority = document.getElementById('taskPriority').value;
        const dueDate = document.getElementById('taskDueDate')?.value;

        if (!title || !projectHash) {
            ToastManager.showToast('Заполните обязательные поля', 'warning');
            return;
        }

        try {
            const taskData = {
                title: title,
                project_hash: projectHash,
                description: description,
                status: status,
                priority: priority
            };

            // Добавляем опциональные поля
            if (dueDate) {
                taskData.due_date = new Date(dueDate).toISOString();
            }

            const result = await ApiService.apiCreateTask(taskData);

            if (result && result.task) {
                ToastManager.showToast('Задача создана успешно!', 'success');
                bootstrap.Modal.getInstance(document.getElementById('createTaskModal')).hide();

                // Обновляем интерфейс
                await this.loadTasks();
                if (UI.currentSection === 'dashboard') {
                    await DashboardManager.loadDashboardData();
                }
            }
        } catch (error) {
            Utils.logError('Error creating task', error);
            ToastManager.showToast('Ошибка создания задачи: ' + error.message, 'error');
        }
    }

    static async showTaskDependencies(taskId) {
        // ИСПРАВЛЕНО: Валидация ID
        if (!taskId || taskId === 'undefined' || taskId.toString().startsWith('temp_')) {
            Utils.logError('Invalid task ID for dependencies', taskId);
            ToastManager.showToast('Ошибка: неверный ID задачи', 'error');
            return;
        }

        try {
            const dependencies = await ApiService.apiGetTaskDependencies(taskId);
            this.showDependenciesModal(dependencies, taskId);
        } catch (error) {
            Utils.logError('Error loading task dependencies', error);
            ToastManager.showToast('Ошибка загрузки зависимостей', 'error');
        }
    }

    static showDependenciesModal(dependencies, taskId) {
        const modalHTML = `
            <div class="modal fade" id="dependenciesModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Зависимости задачи</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-6">
                                    <h6>Зависимости (блокирующие):</h6>
                                    ${dependencies.dependencies && dependencies.dependencies.length > 0 ?
                                        dependencies.dependencies.map(dep => `
                                            <div class="max-card mb-2">
                                                <h6 class="mb-1">${Utils.escapeHTML(dep.title)}</h6>
                                                <span class="badge bg-${Utils.getStatusColor(dep.status)}">${Utils.getStatusText(dep.status)}</span>
                                            </div>
                                        `).join('') :
                                        '<p class="text-muted">Нет зависимостей</p>'
                                    }
                                </div>
                                <div class="col-6">
                                    <h6>Зависимые задачи:</h6>
                                    ${dependencies.dependents && dependencies.dependents.length > 0 ?
                                        dependencies.dependents.map(dep => `
                                            <div class="max-card mb-2">
                                                <h6 class="mb-1">${Utils.escapeHTML(dep.title)}</h6>
                                                <span class="badge bg-${Utils.getStatusColor(dep.status)}">${Utils.getStatusText(dep.status)}</span>
                                            </div>
                                        `).join('') :
                                        '<p class="text-muted">Нет зависимых задач</p>'
                                    }
                                </div>
                            </div>

                            <div class="mt-4">
                                <h6>Добавить зависимость</h6>
                                <div class="input-group">
                                    <input type="number" class="form-control" id="dependencyTaskId" placeholder="ID задачи-зависимости">
                                    <button class="btn max-btn-primary" onclick="TasksManager.addTaskDependency('${taskId}')">
                                        <i class="fas fa-link"></i> Добавить
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        const existingModal = document.getElementById('dependenciesModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('dependenciesModal'));
        modal.show();
    }

    static async addTaskDependency(taskId) {
        // ИСПРАВЛЕНО: Валидация ID
        if (!taskId || taskId === 'undefined' || taskId.toString().startsWith('temp_')) {
            Utils.logError('Invalid task ID for adding dependency', taskId);
            ToastManager.showToast('Ошибка: неверный ID задачи', 'error');
            return;
        }

        const dependsOnId = document.getElementById('dependencyTaskId').value;

        if (!dependsOnId) {
            ToastManager.showToast('Введите ID задачи', 'warning');
            return;
        }

        try {
            Utils.provideHapticFeedback('medium');
            await ApiService.apiAddTaskDependency(taskId, dependsOnId);
            ToastManager.showToast('Зависимость добавлена', 'success');

            // Закрываем модальное окно
            bootstrap.Modal.getInstance(document.getElementById('dependenciesModal'))?.hide();
        } catch (error) {
            Utils.logError('Error adding task dependency', error);
            ToastManager.showToast('Ошибка добавления зависимости: ' + error.message, 'error');
        }
    }

    static async showTaskComments(taskId) {
        // ИСПРАВЛЕНО: Валидация ID
        if (!taskId || taskId === 'undefined' || taskId.toString().startsWith('temp_')) {
            Utils.logError('Invalid task ID for comments', taskId);
            ToastManager.showToast('Ошибка: неверный ID задачи', 'error');
            return;
        }

        try {
            const comments = await ApiService.apiGetTaskComments(taskId);
            this.showCommentsModal(comments, taskId);
        } catch (error) {
            Utils.logError('Error loading task comments', error);
            ToastManager.showToast('Ошибка загрузки комментариев', 'error');
        }
    }

    static showCommentsModal(comments, taskId) {
        const modalHTML = `
            <div class="modal fade" id="commentsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Комментарии к задаче</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-4" style="max-height: 400px; overflow-y: auto;">
                                ${comments.length === 0 ? `
                                    <div class="text-center text-muted">
                                        <i class="fas fa-comments fa-3x mb-3"></i>
                                        <p>Комментариев пока нет</p>
                                    </div>
                                ` : comments.map(comment => `
                                    <div class="max-card mb-3">
                                        <div class="d-flex justify-content-between align-items-start mb-2">
                                            <div>
                                                <h6 class="mb-0">${Utils.escapeHTML(comment.user?.full_name || 'Пользователь')}</h6>
                                                <small class="text-muted">${Utils.formatDate(comment.created_at)}</small>
                                            </div>
                                        </div>
                                        <p class="mb-0">${Utils.escapeHTML(comment.content)}</p>
                                    </div>
                                `).join('')}
                            </div>

                            <div class="mt-4">
                                <h6>Добавить комментарий</h6>
                                <div class="mb-3">
                                    <textarea class="form-control" id="commentContent" rows="3" placeholder="Введите ваш комментарий..."></textarea>
                                </div>
                                <button class="btn max-btn-primary" onclick="TasksManager.addTaskComment('${taskId}')">
                                    <i class="fas fa-paper-plane"></i> Отправить
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        const existingModal = document.getElementById('commentsModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('commentsModal'));
        modal.show();
    }

    static async addTaskComment(taskId) {
        // ИСПРАВЛЕНО: Валидация ID
        if (!taskId || taskId === 'undefined' || taskId.toString().startsWith('temp_')) {
            Utils.logError('Invalid task ID for adding comment', taskId);
            ToastManager.showToast('Ошибка: неверный ID задачи', 'error');
            return;
        }

        const content = document.getElementById('commentContent').value;

        if (!content.trim()) {
            ToastManager.showToast('Введите текст комментария', 'warning');
            return;
        }

        try {
            Utils.provideHapticFeedback('medium');
            await ApiService.apiAddTaskComment(taskId, content);
            ToastManager.showToast('Комментарий добавлен', 'success');

            // Очищаем поле ввода
            document.getElementById('commentContent').value = '';

            // Перезагружаем комментарии
            await this.showTaskComments(taskId);
        } catch (error) {
            Utils.logError('Error adding task comment', error);
            ToastManager.showToast('Ошибка добавления комментария: ' + error.message, 'error');
        }
    }

    // Поиск задач
    static searchTasks() {
        const searchInput = document.getElementById('searchTasksInput');
        const query = searchInput.value.trim();

        Utils.log(`Searching tasks with query: "${query}"`);

        if (!query) {
            this.loadTasks(this.currentTaskFilter);
            return;
        }

        ToastManager.showToast(`Поиск задач: "${query}"`, 'info');

        const searchResults = this.allTasks.filter(task =>
            task.title.toLowerCase().includes(query.toLowerCase()) ||
            (task.description && task.description.toLowerCase().includes(query.toLowerCase())) ||
            (task.project && task.project.title.toLowerCase().includes(query.toLowerCase()))
        );

        this.displaySearchResults(searchResults, query);
    }

    static displaySearchResults(results, query) {
        const container = document.getElementById('tasks-list');

        if (results.length === 0) {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-search fa-2x text-muted mb-3"></i>
                    <h6>Задачи не найдены</h6>
                    <p class="text-muted">По запросу "${Utils.escapeHTML(query)}" ничего не найдено</p>
                    <button class="btn max-btn-primary btn-sm" onclick="TasksManager.clearSearch()">
                        <i class="fas fa-times"></i> Очистить поиск
                    </button>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="mb-0">Найдено задач: ${results.length}</h6>
                <button class="btn btn-outline-secondary btn-sm" onclick="TasksManager.clearSearch()">
                    <i class="fas fa-times"></i> Очистить поиск
                </button>
            </div>
            ${results.map((task, index) => this.renderTaskCard(task, index)).join('')}
        `;
    }

    static clearSearch() {
        const searchInput = document.getElementById('searchTasksInput');
        searchInput.value = '';
        this.loadTasks(this.currentTaskFilter);
    }
}

window.TasksManager = TasksManager;
