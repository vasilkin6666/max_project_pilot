// app.js
class App {
    static currentUser = null;
    static currentProject = null;
    static currentTask = null;
    static userSettings = {};
    static tempParentTaskId = null; // For creating subtasks

    static async init() {
        console.log('Initializing Project Pilot Pro...');
        try {
            // Load current user
            this.currentUser = await ApiService.getCurrentUser();
            console.log('Current user:', this.currentUser);

            // Setup event listeners
            this.setupEventListeners();

            // Load initial data
            await this.loadData();

            // Hide loading, show app
            document.getElementById('loading').style.display = 'none';
            document.getElementById('app').style.display = 'block';

            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Initialization failed:', error);
            this.showError('Ошибка инициализации приложения: ' + error.message);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('app').style.display = 'block'; // Show app anyway to allow user interaction
        }
    }

    static setupEventListeners() {
        // Navigation
        document.getElementById('dashboardBtn').addEventListener('click', () => {
            this.showDashboard();
        });
        document.getElementById('createProjectBtn').addEventListener('click', () => {
            this.showModal('createProjectModal');
        });
        document.getElementById('searchProjectsBtn').addEventListener('click', () => {
            this.showSearchProjects();
        });
        document.getElementById('notificationsBtn').addEventListener('click', () => {
            this.showNotifications();
        });
        document.getElementById('myTasksBtn').addEventListener('click', () => {
            this.showMyTasks();
        });
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettings();
        });

        // Project View Actions
        document.getElementById('manageMembersBtn').addEventListener('click', () => {
            this.showProjectMembersManagement();
        });
        document.getElementById('joinRequestsBtn').addEventListener('click', () => {
            this.showJoinRequests();
        });
        document.getElementById('editProjectBtn').addEventListener('click', () => {
            this.showEditProjectModal();
        });
        document.getElementById('deleteProjectBtn').addEventListener('click', () => {
            this.showDeleteProjectModal();
        });

        // Task View Actions
        document.getElementById('createTaskBtn').addEventListener('click', () => {
            this.showCreateTaskModal();
        });
        document.getElementById('createSubtaskBtn').addEventListener('click', () => {
            this.showCreateSubtaskModal();
        });
        document.getElementById('editTaskBtn').addEventListener('click', () => {
            this.showEditTaskModal();
        });
        document.getElementById('deleteTaskBtn').addEventListener('click', () => {
            this.showDeleteTaskModal();
        });
        document.getElementById('addCommentBtn').addEventListener('click', () => {
            this.addComment();
        });

        // My Tasks Filters
        document.getElementById('tasksFilterStatus').addEventListener('change', () => {
            this.showMyTasks();
        });
        document.getElementById('tasksFilterProject').addEventListener('change', () => {
            this.showMyTasks();
        });

        // Search Projects
        document.getElementById('searchProjectsSubmitBtn').addEventListener('click', () => {
            this.searchProjects();
        });

        // Form submissions
        document.getElementById('submitCreateProjectBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.createProject();
        });
        document.getElementById('submitEditProjectBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.updateProject();
        });
        document.getElementById('confirmDeleteProjectBtn').addEventListener('click', () => {
            this.deleteProject();
        });
        document.getElementById('submitCreateTaskBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.createTask();
        });
        document.getElementById('submitEditTaskBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.updateTask();
        });
        document.getElementById('confirmDeleteTaskBtn').addEventListener('click', () => {
            this.deleteTask();
        });
        document.getElementById('joinProjectFromPreviewBtn').addEventListener('click', () => {
            this.joinProjectFromPreview();
        });
    }

    static async loadData() {
        try {
            const dashboardData = await ApiService.getDashboard();
            const projects = dashboardData.projects || [];
            const settings = dashboardData.settings || {};
            const recentTasks = dashboardData.recent_tasks || [];

            // Save settings
            this.userSettings = settings;
            this.applyUserSettings(settings);

            this.renderProjects(projects);
            this.updateStats(projects, recentTasks);
            this.renderRecentTasks(recentTasks);
            console.log('Data loaded successfully');
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Ошибка загрузки данных: ' + error.message);
        }
    }

    // Применение настроек пользователя
    static applyUserSettings(settings) {
        if (settings.theme) {
            document.documentElement.setAttribute('data-theme', settings.theme);
        }
    }

    static renderProjects(projects) {
        const container = document.getElementById('projectsList');
        if (!projects || projects.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>Проектов пока нет</p>
                <button class="btn btn-primary" onclick="App.showModal('createProjectModal')">Создать первый проект</button>
            </div>`;
            return;
        }

        container.innerHTML = projects.map(project => {
            const projectData = project.project || project;
            const stats = project.stats || projectData.stats || {};
            const membersCount = stats.members_count || stats.membersCount || 0;
            const tasksCount = stats.tasks_count || stats.tasksCount || 0;
            const doneTasks = stats.tasks_done || stats.done_tasks || stats.doneTasks || 0;

            return `
            <div class="project-card hover-lift" onclick="App.openProject('${projectData.hash}')">
                <div class="project-card-header">
                    <h3 class="project-title">${this.escapeHtml(projectData.title)}</h3>
                    <span class="project-type-badge">${projectData.is_private ? '🔒' : '🌐'}</span>
                </div>
                <p class="project-description">${this.escapeHtml(projectData.description || 'Без описания')}</p>
                <div class="project-stats">
                    <span>Участников: ${membersCount}</span>
                    <span>Задач: ${tasksCount}</span>
                    <span>Выполнено: ${doneTasks}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${tasksCount > 0 ? (doneTasks / tasksCount) * 100 : 0}%"></div>
                </div>
            </div>`;
        }).join('');
    }

    static updateStats(projects, recentTasks) {
        // Update dashboard stats if needed
    }

    static renderRecentTasks(tasks) {
        const container = document.getElementById('recentTasksList');
        if (!tasks || tasks.length === 0) {
            container.innerHTML = '<p>Нет недавних задач</p>';
            return;
        }

        container.innerHTML = tasks.map(task => {
            return `
            <div class="task-card">
                <div class="task-card-header">
                    <h4 class="task-card-title">${this.escapeHtml(task.title)}</h4>
                    <span class="task-card-status ${task.status}">${this.getStatusText(task.status)}</span>
                </div>
                <p class="task-card-priority">Приоритет: ${this.getPriorityText(task.priority)}</p>
                <p class="task-card-due-date">Срок: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Не указан'}</p>
                <div class="task-card-footer">
                    <span>Проект: ${this.escapeHtml(task.project_title || 'N/A')}</span>
                </div>
            </div>`;
        }).join('');
    }

    static getStatusText(status) {
        const statusMap = {
            'todo': 'К выполнению',
            'in_progress': 'В работе',
            'done': 'Выполнено'
        };
        return statusMap[status] || status;
    }

    static getPriorityText(priority) {
        const priorityMap = {
            'low': 'Низкий',
            'medium': 'Средний',
            'high': 'Высокий',
            'critical': 'Критический'
        };
        return priorityMap[priority] || priority;
    }

    static escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Navigation methods
    static showDashboard() {
        document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
        document.getElementById('dashboardView').style.display = 'block';
        this.loadData(); // Reload data for dashboard
    }

    static showSearchProjects() {
        document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
        document.getElementById('searchProjectsView').style.display = 'block';
        document.getElementById('searchProjectsInput').value = '';
        document.getElementById('searchResultsList').innerHTML = '';
    }

    static showNotifications() {
        alert('Функция уведомлений будет реализована позже.');
    }

    static showMyTasks() {
        document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
        document.getElementById('myTasksView').style.display = 'block';
        this.loadMyTasks();
    }

    static showSettings() {
        alert('Функция настроек будет реализована позже.');
    }

    // Project methods
    static async openProject(projectHash) {
        try {
            this.currentProject = await ApiService.getProject(projectHash);
            console.log('Opened project:', this.currentProject);

            // Load project summary for stats
            const projectSummary = await ApiService.getProjectSummary(projectHash);
            console.log('Project summary:', projectSummary);

            // Update project view
            document.getElementById('projectTitleHeader').textContent = this.currentProject.title;
            document.getElementById('projectDescriptionText').textContent = this.currentProject.description || 'Без описания';
            document.getElementById('projectHashValue').textContent = this.currentProject.hash;
            document.getElementById('projectHashInfo').style.display = 'block';

            // Update stats
            document.getElementById('projectMembersCount').textContent = projectSummary.members_count || 0;
            document.getElementById('projectTotalTasks').textContent = projectSummary.tasks_count || 0;
            document.getElementById('projectDoneTasks').textContent = projectSummary.tasks_done || 0;
            document.getElementById('projectInProgressTasks').textContent = (projectSummary.tasks_count || 0) - (projectSummary.tasks_done || 0);

            // Load tasks and members
            await this.loadProjectTasks(projectHash);
            await this.loadProjectMembers(projectHash);

            // Switch view
            document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
            document.getElementById('projectView').style.display = 'block';
        } catch (error) {
            console.error('Error opening project:', error);
            this.showError('Ошибка открытия проекта: ' + error.message);
        }
    }

    static async loadProjectTasks(projectHash) {
        try {
            const response = await ApiService.getTasks(projectHash);
            const tasks = response.tasks || [];
            const container = document.getElementById('projectTasksList');

            if (!tasks || tasks.length === 0) {
                container.innerHTML = '<p>Задач нет</p>';
                return;
            }

            // Show only main tasks (without parent_task_id)
            const mainTasks = tasks.filter(task => task.parent_task_id === null);
            container.innerHTML = mainTasks.map(task => {
                const taskClass = `task-card ${task.status === 'done' ? 'completed' : ''}`;
                return `
                <div class="${taskClass}" onclick="App.openTask(${task.id})">
                    <div class="task-card-header">
                        <h4 class="task-card-title">${this.escapeHtml(task.title)}</h4>
                        <span class="task-card-status ${task.status}">${this.getStatusText(task.status)}</span>
                    </div>
                    <p class="task-card-priority">Приоритет: ${this.getPriorityText(task.priority)}</p>
                    <p class="task-card-due-date">Срок: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Не указан'}</p>
                    <div class="task-card-footer">
                        <span>Исполнитель: ${task.assigned_to_name || 'Не назначен'}</span>
                    </div>
                </div>`;
            }).join('');

        } catch (error) {
            console.error('Error loading project tasks:', error);
            this.showError('Ошибка загрузки задач проекта: ' + error.message);
        }
    }

    static async loadProjectMembers(projectHash) {
        try {
            const response = await ApiService.getProjectMembers(projectHash);
            const members = response.members || [];
            const container = document.getElementById('projectMembersList');

            if (!members || members.length === 0) {
                container.innerHTML = '<p>Участников нет</p>';
                return;
            }

            container.innerHTML = members.map(member => {
                return `
                <div class="member-item">
                    <span class="member-name">${this.escapeHtml(member.name)}</span>
                    <span class="member-role">${this.escapeHtml(member.role)}</span>
                </div>`;
            }).join('');

        } catch (error) {
            console.error('Error loading project members:', error);
            this.showError('Ошибка загрузки участников проекта: ' + error.message);
        }
    }

    static backToProject() {
        if (this.currentProject) {
            this.openProject(this.currentProject.hash);
        } else {
            this.showDashboard();
        }
    }

    static backToDashboard() {
        this.showDashboard();
    }

    // Task methods
    static async openTask(taskId) {
        try {
            const response = await ApiService.getTask(taskId);
            this.currentTask = response.task || response;

            // Update task view
            document.getElementById('taskTitleView').textContent = this.currentTask.title;
            document.getElementById('taskDescriptionView').textContent = this.currentTask.description || 'Без описания';
            document.getElementById('taskStatusView').textContent = this.getStatusText(this.currentTask.status);
            document.getElementById('taskPriorityView').textContent = this.getPriorityText(this.currentTask.priority);
            document.getElementById('taskDueDateView').textContent = this.currentTask.due_date ? new Date(this.currentTask.due_date).toLocaleDateString() : '-';
            document.getElementById('taskAssignedToText').textContent = this.currentTask.assigned_to_name || '-';

            // Show/hide create subtask button based on permissions or task type
            const createSubtaskBtn = document.getElementById('createSubtaskBtn');
            if (this.currentTask.parent_task_id === null) { // Only main tasks can have subtasks created directly from this view?
                createSubtaskBtn.style.display = 'inline-block';
            } else {
                createSubtaskBtn.style.display = 'none';
            }

            // Load comments
            await this.loadTaskComments(taskId);

            // Load subtasks
            await this.loadSubtasks(taskId);

            // Switch view
            document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
            document.getElementById('taskView').style.display = 'block';
        } catch (error) {
            console.error('Error opening task:', error);
            this.showError('Ошибка открытия задачи: ' + error.message);
        }
    }

    static async loadTaskComments(taskId) {
        try {
            const response = await ApiService.getComments(taskId);
            const comments = response.comments || [];
            const container = document.getElementById('commentsList');

            if (!comments || comments.length === 0) {
                container.innerHTML = '<p>Комментариев нет</p>';
                return;
            }

            container.innerHTML = comments.map(comment => {
                return `
                <div class="comment-item">
                    <div class="comment-header">
                        <strong>${this.escapeHtml(comment.author_name)}</strong>
                        <span class="comment-date">${new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                    <p class="comment-text">${this.escapeHtml(comment.content)}</p>
                </div>`;
            }).join('');
        } catch (error) {
            console.error('Error loading comments:', error);
            // Don't show error for comments as it's not critical
        }
    }

    static async addComment() {
        const input = document.getElementById('newCommentText');
        const content = input.value.trim();
        if (!content) return;

        if (!this.currentTask || !this.currentTask.id) {
            this.showError('Задача не выбрана');
            return;
        }

        try {
            await ApiService.addComment(this.currentTask.id, content);
            input.value = '';
            await this.loadTaskComments(this.currentTask.id); // Reload comments
        } catch (error) {
            console.error('Error adding comment:', error);
            this.showError('Ошибка добавления комментария: ' + error.message);
        }
    }

    static async loadSubtasks(parentTaskId, level = 0, container = null) {
        try {
            if (!this.currentProject || !this.currentProject.hash) {
                console.error('No current project for loading subtasks');
                document.getElementById('subtasksList').innerHTML = '<p>Ошибка загрузки подзадач: проект не выбран</p>';
                return;
            }

            const response = await ApiService.getTasks(this.currentProject.hash);
            const tasks = response.tasks || [];
            const subtasks = tasks.filter(task => task.parent_task_id === parentTaskId);

            const targetContainer = container || document.getElementById('subtasksList');

            if (subtasks.length === 0 && level === 0) {
                targetContainer.innerHTML = '<p>Подзадач нет</p>';
                return;
            }

            let subtasksHtml = '';
            subtasks.forEach(subtask => {
                const paddingLeft = level * 20;
                const childSubtasks = tasks.filter(task => task.parent_task_id === subtask.id);
                const hasChildren = childSubtasks.length > 0;

                subtasksHtml += `
                <div class="subtask-item" style="margin-left: ${paddingLeft}px;">
                    <div class="task-card" onclick="App.openTask(${subtask.id})">
                        <div class="task-card-header">
                            <h4 class="task-card-title">${this.escapeHtml(subtask.title)}</h4>
                            <span class="task-card-status ${subtask.status}">${this.getStatusText(subtask.status)}</span>
                        </div>
                        <p class="task-card-priority">Приоритет: ${this.getPriorityText(subtask.priority)}</p>
                        <p class="task-card-due-date">Срок: ${subtask.due_date ? new Date(subtask.due_date).toLocaleDateString() : 'Не указан'}</p>
                    </div>
                </div>`;

                // Recursively add child subtasks
                if (hasChildren) {
                    const childContainer = document.createElement('div');
                    childContainer.className = 'subtask-children';
                    this.loadSubtasks(subtask.id, level + 1, childContainer);
                    subtasksHtml += childContainer.outerHTML;
                }
            });

            targetContainer.innerHTML = subtasksHtml;
        } catch (error) {
            console.error('Error loading subtasks:', error);
            this.showError('Ошибка загрузки подзадач: ' + error.message);
        }
    }

    static async loadMyTasks() {
        try {
            const statusFilter = document.getElementById('tasksFilterStatus').value;
            const projectFilter = document.getElementById('tasksFilterProject').value;

            const filters = {};
            if (statusFilter) filters.status = statusFilter;
            if (projectFilter) filters.project_hash = projectFilter;

            const response = await ApiService.getUserTasks(filters);
            const tasks = response.tasks || [];
            const container = document.getElementById('myTasksList');

            if (!tasks || tasks.length === 0) {
                container.innerHTML = '<p>Задач нет</p>';
                return;
            }

            // Separate assigned and created tasks (example logic, adjust as needed)
            const assignedTasks = tasks.filter(task => task.assigned_to_id === this.currentUser.id);
            const createdTasks = tasks.filter(task => task.created_by_id === this.currentUser.id && task.assigned_to_id !== this.currentUser.id);

            let html = '';

            if (assignedTasks.length > 0) {
                html += '<h4>Назначенные мне</h4>';
                html += assignedTasks.map(task => {
                    return `
                    <div class="task-card" onclick="App.openTask(${task.id})">
                        <div class="task-card-header">
                            <h4 class="task-card-title">${this.escapeHtml(task.title)}</h4>
                            <span class="task-card-status ${task.status}">${this.getStatusText(task.status)}</span>
                        </div>
                        <p class="task-card-priority">Приоритет: ${this.getPriorityText(task.priority)}</p>
                        <p class="task-card-due-date">Срок: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Не указан'}</p>
                        <div class="task-card-footer">
                            <span>Проект: ${this.escapeHtml(task.project_title || 'N/A')}</span>
                        </div>
                    </div>`;
                }).join('');
            }

            if (createdTasks.length > 0) {
                if (assignedTasks.length > 0) html += '<h4 style="margin-top: var(--space-6);">Созданные мной</h4>';
                else html += '<h4>Созданные мной</h4>';

                html += createdTasks.map(task => {
                    return `
                    <div class="task-card" onclick="App.openTask(${task.id})">
                        <div class="task-card-header">
                            <h4 class="task-card-title">${this.escapeHtml(task.title)}</h4>
                            <span class="task-card-status ${task.status}">${this.getStatusText(task.status)}</span>
                        </div>
                        <p class="task-card-priority">Приоритет: ${this.getPriorityText(task.priority)}</p>
                        <p class="task-card-due-date">Срок: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Не указан'}</p>
                        <div class="task-card-footer">
                            <span>Исполнитель: ${task.assigned_to_name || 'Не назначен'}</span>
                        </div>
                    </div>`;
                }).join('');
            }

            container.innerHTML = html;
        } catch (error) {
            console.error('Error loading my tasks:', error);
            this.showError('Ошибка загрузки моих задач: ' + error.message);
        }
    }

    // Project management methods
    static showCreateProjectModal() {
        document.getElementById('createProjectForm').reset();
        this.showModal('createProjectModal');
    }

    static async createProject() {
        const title = document.getElementById('projectTitle').value.trim();
        const description = document.getElementById('projectDescription').value.trim();
        const isPrivate = document.getElementById('projectIsPrivate').checked;
        const requiresApproval = document.getElementById('projectRequiresApproval').checked;

        if (!title) {
            this.showError('Введите название проекта');
            return;
        }

        try {
            console.log('Creating project:', { title, description, isPrivate, requiresApproval });
            await ApiService.createProject({
                title,
                description,
                is_private: isPrivate,
                requires_approval: requiresApproval
            });

            this.hideModal('createProjectModal');
            document.getElementById('createProjectForm').reset();
            await this.loadData(); // Reload dashboard
            this.showSuccess('Проект создан успешно!');
        } catch (error) {
            console.error('Error creating project:', error);
            this.showError('Ошибка создания проекта: ' + error.message);
        }
    }

    static showEditProjectModal() {
        if (!this.currentProject) {
            this.showError('Проект не выбран');
            return;
        }

        document.getElementById('editProjectTitle').value = this.currentProject.title;
        document.getElementById('editProjectDescription').value = this.currentProject.description || '';
        document.getElementById('editProjectIsPrivate').checked = this.currentProject.is_private;

        this.showModal('editProjectModal');
    }

    static async updateProject() {
        if (!this.currentProject) {
            this.showError('Проект не выбран');
            return;
        }

        const title = document.getElementById('editProjectTitle').value.trim();
        const description = document.getElementById('editProjectDescription').value.trim();
        const isPrivate = document.getElementById('editProjectIsPrivate').checked;

        if (!title) {
            this.showError('Введите название проекта');
            return;
        }

        try {
            await ApiService.updateProject(this.currentProject.hash, {
                title,
                description,
                is_private: isPrivate
            });

            this.hideModal('editProjectModal');
            await this.openProject(this.currentProject.hash); // Reload project view
            this.showSuccess('Проект обновлен успешно!');
        } catch (error) {
            console.error('Error updating project:', error);
            this.showError('Ошибка обновления проекта: ' + error.message);
        }
    }

    static showDeleteProjectModal() {
        if (!this.currentProject) {
            this.showError('Проект не выбран');
            return;
        }

        document.getElementById('deleteProjectName').textContent = this.currentProject.title;
        this.showModal('deleteProjectModal');
    }

    static async deleteProject() {
        if (!this.currentProject) {
            this.showError('Проект не выбран');
            return;
        }

        try {
            await ApiService.deleteProject(this.currentProject.hash);

            this.hideModal('deleteProjectModal');
            this.currentProject = null;
            this.showDashboard(); // Go back to dashboard
            this.showSuccess('Проект удален успешно!');
        } catch (error) {
            console.error('Error deleting project:', error);
            this.showError('Ошибка удаления проекта: ' + error.message);
        }
    }

    // Task management methods
    static async showCreateTaskModal() {
        if (!this.currentProject) return;

        try {
            // Load project members for assignee dropdown
            const membersResponse = await ApiService.getProjectMembers(this.currentProject.hash);
            const members = membersResponse.members || [];

            const assignedToSelect = document.getElementById('taskAssignedTo');
            assignedToSelect.innerHTML = '<option value="">Не назначена</option>';
            members.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = member.name;
                assignedToSelect.appendChild(option);
            });

            // Load main tasks for parent task dropdown
            const tasksResponse = await ApiService.getTasks(this.currentProject.hash);
            const tasks = tasksResponse.tasks || [];

            const parentTaskSelect = document.getElementById('taskParentId');
            parentTaskSelect.innerHTML = '<option value="">Основная задача (без родителя)</option>';
            tasks.forEach(task => {
                if (task.parent_task_id === null) { // Only main tasks can be parents
                    const option = document.createElement('option');
                    option.value = task.id;
                    option.textContent = task.title;
                    parentTaskSelect.appendChild(option);
                }
            });

            // Set default due date to today
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('taskDueDate').value = today;

            this.showModal('createTaskModal');
        } catch (error) {
            console.error('Error loading task creation data:', error);
            this.showError('Ошибка загрузки данных: ' + error.message);
        }
    }

    static showCreateSubtaskModal() {
        if (!this.currentProject || !this.currentTask) return;

        // Use the current task as the parent
        this.tempParentTaskId = this.currentTask.id;

        // Pre-fill the parent task in the modal if possible, or hide the parent selection
        // For simplicity in this case, we'll assume subtasks are always created under the current task
        // and hide the parent selection in the createTaskModal or use a separate subtask modal logic
        // Here we reuse the createTaskModal but set the parent task ID internally
        document.getElementById('createTaskForm').reset();
        document.getElementById('taskTitle').focus();

        // We need to modify the createTask logic slightly to use tempParentTaskId if set
        // For now, just show the modal, the createTask function will handle the parent ID
        this.showModal('createTaskModal');
    }

    static async createTask() {
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const priority = document.getElementById('taskPriority').value;
        const dueDate = document.getElementById('taskDueDate').value;
        const parentTaskId = this.tempParentTaskId || document.getElementById('taskParentId').value || null; // Use temp ID first
        const assignedTo = document.getElementById('taskAssignedTo').value || null;

        if (!title) {
            this.showError('Введите название задачи');
            return;
        }

        try {
            const taskData = {
                title,
                description,
                priority,
                project_hash: this.currentProject.hash // Ensure project hash is included
            };

            if (dueDate) taskData.due_date = dueDate;
            if (parentTaskId) taskData.parent_task_id = parseInt(parentTaskId);
            if (assignedTo) taskData.assigned_to_id = parseInt(assignedTo);

            console.log('Creating task with data:', taskData);
            await ApiService.createTask(taskData);

            this.hideModal('createTaskModal');
            // Reset form
            const form = document.getElementById('createTaskForm');
            if (form) form.reset();
            // Clear temp parent ID
            this.tempParentTaskId = null;

            // Reload tasks for the current view (project or task)
            if (this.currentProject && !this.currentTask) {
                await this.loadProjectTasks(this.currentProject.hash);
            } else if (this.currentTask) {
                // Reload the current task view to reflect changes, or just subtasks if applicable
                await this.loadSubtasks(this.currentTask.id); // If we are viewing the parent task
                // Or reload the specific task details view if needed
            }

            this.showSuccess('Задача создана успешно!');
        } catch (error) {
            console.error('Error creating task:', error);
            this.showError('Ошибка создания задачи: ' + error.message);
        }
    }

    static showEditTaskModal() {
        if (!this.currentTask || !this.currentTask.id) {
            console.error('No current task for editing:', this.currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        // Populate form fields
        document.getElementById('editTaskTitle').value = this.currentTask.title || '';
        document.getElementById('editTaskDescription').value = this.currentTask.description || '';
        document.getElementById('editTaskPriority').value = this.currentTask.priority || 'medium';
        document.getElementById('editTaskDueDate').value = this.currentTask.due_date ? this.currentTask.due_date.split('T')[0] : '';
        document.getElementById('editTaskStatus').value = this.currentTask.status || 'todo';

        this.showModal('editTaskModal');
    }

    static async updateTask() {
        if (!this.currentTask || !this.currentTask.id) {
            this.showError('Задача не выбрана');
            return;
        }

        const title = document.getElementById('editTaskTitle').value.trim();
        const description = document.getElementById('editTaskDescription').value.trim();
        const priority = document.getElementById('editTaskPriority').value;
        const dueDate = document.getElementById('editTaskDueDate').value;
        const status = document.getElementById('editTaskStatus').value;

        if (!title) {
            this.showError('Введите название задачи');
            return;
        }

        try {
            const taskData = {
                title,
                description,
                priority,
                status // Include status in update
            };

            if (dueDate) {
                taskData.due_date = dueDate;
            } else {
                taskData.due_date = null; // Explicitly set to null if cleared
            }

            console.log('Updating task:', this.currentTask.id, taskData);
            await ApiService.updateTask(this.currentTask.id, taskData);

            this.hideModal('editTaskModal');
            await this.openTask(this.currentTask.id); // Reload task view
            this.showSuccess('Задача обновлена успешно!');
        } catch (error) {
            console.error('Error updating task:', error);
            this.showError('Ошибка обновления задачи: ' + error.message);
        }
    }

    static showDeleteTaskModal() {
        if (!this.currentTask || !this.currentTask.id) {
            this.showError('Задача не выбрана');
            return;
        }

        document.getElementById('deleteTaskName').textContent = this.currentTask.title;
        this.showModal('deleteTaskModal');
    }

    static async deleteTask() {
        if (!this.currentTask || !this.currentTask.id) {
            this.showError('Задача не выбрана');
            return;
        }

        try {
            await ApiService.deleteTask(this.currentTask.id);

            this.hideModal('deleteTaskModal');
            // Go back to project view or wherever appropriate
            if (this.currentProject) {
                this.openProject(this.currentProject.hash);
            } else {
                this.showDashboard();
            }
            this.showSuccess('Задача удалена успешно!');
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showError('Ошибка удаления задачи: ' + error.message);
        }
    }

    // Search projects
    static async searchProjects() {
        const query = document.getElementById('searchProjectsInput').value.trim();
        if (!query) {
            document.getElementById('searchResultsList').innerHTML = '<p>Введите поисковый запрос</p>';
            return;
        }

        try {
            const response = await ApiService.searchProjects(query);
            const results = response.results || [];
            const exactMatchData = response.exact_match_data; // This might contain user-specific info like is_member, can_join
            const title = response.title || query; // Use returned title if available (e.g., for hash search)

            if (!results || results.length === 0) {
                document.getElementById('searchResultsList').innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🔍</div>
                        <p>Проекты не найдены</p>
                        <p>Попробуйте изменить поисковый запрос</p>
                    </div>`;
                return;
            }

            let html = `<div class="search-results-header"><h3>${this.escapeHtml(title)}</h3>${exactMatchData ? '<span class="search-type-badge">По хэшу</span>' : '<span class="search-type-badge">По названию</span>'}</div>`;
            html += results.map(project => {
                const stats = project.stats || {};
                const requiresApproval = project.requires_approval;
                const isPrivate = project.is_private;

                // Determine button text and action
                let buttonText = 'Присоединиться';
                let buttonAction = `App.handleJoinProject('${project.hash}')`;
                let buttonClass = 'btn-primary';

                // FIRST: Check exactMatchData for user status
                if (exactMatchData) {
                    if (exactMatchData.is_member) {
                        buttonText = 'Открыть проект';
                        buttonAction = `App.openProject('${project.hash}')`;
                        buttonClass = 'btn-success';
                    } else if (!exactMatchData.can_join) {
                        buttonText = 'Доступ закрыт';
                        buttonAction = '';
                        buttonClass = 'btn-secondary disabled';
                    }
                } else {
                    // SECOND: If no exactMatchData, check project settings
                    if (isPrivate && !requiresApproval) {
                        // Private without approval - check if user can join (might require invitation, logic depends on backend)
                        // For now, assume can't join without exact match data indicating otherwise
                        buttonText = 'Доступ закрыт';
                        buttonAction = '';
                        buttonClass = 'btn-secondary disabled';
                    } else if (isPrivate && requiresApproval) {
                        buttonText = 'Отправить заявку';
                        // buttonAction remains joinProject
                    }
                    // Public projects remain 'Присоединиться'
                }

                return `
                <div class="search-result-item">
                    <div class="project-card">
                        <div class="project-card-header">
                            <h3 class="project-title">${this.escapeHtml(project.title)}</h3>
                            <span class="project-type-badge">${isPrivate ? '🔒' : '🌐'}</span>
                        </div>
                        <p class="project-description">${this.escapeHtml(project.description || 'Без описания')}</p>
                        <div class="project-stats">
                            <span>Участников: ${stats.members_count || 0}</span>
                            <span>Задач: ${stats.tasks_count || 0}</span>
                            <span>Выполнено: ${stats.tasks_done || 0}</span>
                            <span>Тип: ${isPrivate ? 'Приватный' : 'Публичный'}</span>
                            ${isPrivate ? `<span>Одобрение: ${requiresApproval ? 'Требуется' : 'Не требуется'}</span>` : ''}
                        </div>
                        <div class="project-actions">
                            <button class="btn ${buttonClass}" ${buttonAction ? `onclick="${buttonAction}"` : 'disabled'}>${buttonText}</button>
                        </div>
                    </div>
                </div>`;
            }).join('');

            document.getElementById('searchResultsList').innerHTML = html;
        } catch (error) {
            console.error('Error searching projects:', error);
            this.showError('Ошибка поиска проектов: ' + error.message);
        }
    }

    static async handleJoinProject(projectHash) {
        try {
            await ApiService.joinProject(projectHash);
            this.showSuccess('Заявка на вступление отправлена успешно!');
            // Optionally, reload the search results or update the button state
        } catch (error) {
            console.error('Error joining project:', error);
            if (error.message.includes('409') && error.message.includes('already member')) {
                this.showError('Вы уже являетесь участником этого проекта');
            } else if (error.message.includes('400') && error.message.includes('already pending')) {
                this.showError('Заявка на вступление уже отправлена');
            } else {
                this.showError('Ошибка вступления в проект: ' + error.message);
            }
        }
    }

    static showProjectPreviewModal(project, projectData) {
        const stats = project.stats || {};
        const modalBody = document.getElementById('projectPreviewBody');
        const joinBtn = document.getElementById('joinProjectFromPreviewBtn');

        modalBody.innerHTML = `
            <div class="project-preview-info">
                <h3 class="project-title">${this.escapeHtml(project.title)}</h3>
                <p class="project-description">${this.escapeHtml(project.description || 'Без описания')}</p>
                <div class="project-stats">
                    <span>Участников: ${stats.members_count || 0}</span>
                    <span>Задач: ${stats.tasks_count || 0}</span>
                    <span>Выполнено: ${stats.tasks_done || 0}</span>
                    <span>Тип: ${project.is_private ? 'Приватный' : 'Публичный'}</span>
                    ${project.is_private ? `<span>Одобрение: ${project.requires_approval ? 'Требуется' : 'Не требуется'}</span>` : ''}
                </div>
                <div class="project-hash-info">
                    Хэш проекта: <span>${project.hash}</span>
                </div>
            </div>`;

        // Show/hide join button based on project data
        if (projectData && projectData.can_join && !projectData.is_member) {
            joinBtn.style.display = 'inline-block';
            joinBtn.onclick = () => this.joinProjectFromPreview(project.hash);
        } else {
            joinBtn.style.display = 'none';
        }

        this.showModal('projectPreviewModal');
    }

    static async openProjectPreview(projectHash) {
        try {
            const response = await ApiService.getProjectByHashExact(projectHash);
            const project = response.project;

            // Show modal with project info
            this.showProjectPreviewModal(project, response);
        } catch (error) {
            console.error('Error opening project preview:', error);
            this.showError('Ошибка загрузки информации о проекте: ' + error.message);
        }
    }

    static async joinProjectFromPreview(projectHash) {
        try {
            await ApiService.joinProject(projectHash);
            this.hideModal('projectPreviewModal');
            this.showSuccess('Заявка на вступление отправлена успешно!');
        } catch (error) {
            console.error('Error joining project from preview:', error);
            if (error.message.includes('409') && error.message.includes('already member')) {
                this.showError('Вы уже являетесь участником этого проекта');
            } else if (error.message.includes('400') && error.message.includes('already pending')) {
                this.showError('Заявка на вступление уже отправлена');
            } else {
                this.showError('Ошибка вступления в проект: ' + error.message);
            }
        }
    }

    // Project members management
    static showProjectMembersManagement() {
        document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
        document.getElementById('projectMembersView').style.display = 'block';
        this.loadProjectMembersManagement();
    }

    static async loadProjectMembersManagement() {
        if (!this.currentProject) return;

        try {
            const response = await ApiService.getProjectMembers(this.currentProject.hash);
            const members = response.members || [];
            const container = document.getElementById('projectMembersManagementList');

            if (!members || members.length === 0) {
                container.innerHTML = '<p>Участников нет</p>';
                return;
            }

            container.innerHTML = members.map(member => {
                return `
                <div class="member-management-item">
                    <div class="member-info">
                        <span class="member-name">${this.escapeHtml(member.name)}</span>
                        <span class="member-role">${this.escapeHtml(member.role)}</span>
                        <span class="member-email">${this.escapeHtml(member.email)}</span>
                    </div>
                    <div class="member-actions">
                        <select class="role-select" onchange="App.updateMemberRole('${this.currentProject.hash}', ${member.id}, this.value)">
                            <option value="member" ${member.role === 'member' ? 'selected' : ''}>Участник</option>
                            <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Администратор</option>
                        </select>
                        <button class="btn btn-danger btn-sm" onclick="App.removeMember('${this.currentProject.hash}', ${member.id})">Удалить</button>
                    </div>
                </div>`;
            }).join('');

        } catch (error) {
            console.error('Error loading project members management:', error);
            this.showError('Ошибка загрузки участников: ' + error.message);
        }
    }

    static async updateMemberRole(projectHash, memberId, newRole) {
        try {
            await ApiService.manageProjectMember(projectHash, memberId, 'update_role', newRole);
            this.showSuccess('Роль участника обновлена');
            // Reload the management list
            this.loadProjectMembersManagement();
        } catch (error) {
            console.error('Error updating member role:', error);
            this.showError('Ошибка обновления роли: ' + error.message);
        }
    }

    static async removeMember(projectHash, memberId) {
        if (!confirm('Вы уверены, что хотите удалить этого участника?')) return;

        try {
            await ApiService.manageProjectMember(projectHash, memberId, 'remove');
            this.showSuccess('Участник удален');
            // Reload the management list
            this.loadProjectMembersManagement();
        } catch (error) {
            console.error('Error removing member:', error);
            this.showError('Ошибка удаления участника: ' + error.message);
        }
    }

    // Join requests
    static showJoinRequests() {
        document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
        document.getElementById('joinRequestsView').style.display = 'block';
        this.loadJoinRequests();
    }

    static async loadJoinRequests() {
        if (!this.currentProject) return;

        try {
            const response = await ApiService.getJoinRequests(this.currentProject.hash);
            const requests = response.requests || [];
            const container = document.getElementById('joinRequestsList');

            if (!requests || requests.length === 0) {
                container.innerHTML = '<p>Заявок нет</p>';
                return;
            }

            container.innerHTML = requests.map(request => {
                return `
                <div class="join-request-item">
                    <div class="request-info">
                        <span class="requester-name">${this.escapeHtml(request.user_name)}</span>
                        <span class="requester-email">${this.escapeHtml(request.user_email)}</span>
                        <span class="request-date">${new Date(request.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="request-actions">
                        <button class="btn btn-success btn-sm" onclick="App.handleJoinRequest('${this.currentProject.hash}', ${request.id}, 'approve')">Одобрить</button>
                        <button class="btn btn-danger btn-sm" onclick="App.handleJoinRequest('${this.currentProject.hash}', ${request.id}, 'reject')">Отклонить</button>
                    </div>
                </div>`;
            }).join('');

        } catch (error) {
            console.error('Error loading join requests:', error);
            this.showError('Ошибка загрузки заявок: ' + error.message);
        }
    }

    static async handleJoinRequest(projectHash, requestId, action) {
        try {
            await ApiService.handleJoinRequest(projectHash, requestId, action);
            this.showSuccess(action === 'approve' ? 'Заявка одобрена' : 'Заявка отклонена');
            // Reload the requests list
            this.loadJoinRequests();
        } catch (error) {
            console.error('Error handling join request:', error);
            this.showError(`Ошибка ${action === 'approve' ? 'одобрения' : 'отклонения'} заявки: ` + error.message);
        }
    }

    // Modal helpers
    static showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            // Trap focus? Add event listener for Escape key?
        }
    }

    static hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    // Notification helpers
    static showSuccess(message) {
        // Implement success notification (e.g., toast)
        console.log('Success:', message);
        // Example using a simple alert, replace with proper UI component
        alert(message);
    }

    static showError(message) {
        // Implement error notification (e.g., toast)
        console.error('Error:', message);
        // Example using a simple alert, replace with proper UI component
        alert('Ошибка: ' + message);
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
