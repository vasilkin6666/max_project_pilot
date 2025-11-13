class ProjectView {
    static currentProject = null;
    static isOpening = false;

    static async openProject(projectHash) {
        if (this.currentProject?.hash === projectHash) {
            Utils.log('Project already open, skipping reload');
            return;
        }

        if (this.isOpening) {
            Utils.log('Project opening in progress, skipping duplicate call');
            return;
        }

        this.isOpening = true;

        try {
            App.showLoadingOverlay();

            const [projectData, tasksData] = await Promise.all([
                ApiService.getProject(projectHash),
                ApiService.getProjectTasks(projectHash)
            ]);

            this.currentProject = projectData;

            this.showProjectView(projectData, tasksData.tasks || []);

            App.hideLoadingOverlay();
        } catch (error) {
            Utils.logError('Error opening project view:', error);
            ToastManager.error('Ошибка загрузки проекта');
            App.hideLoadingOverlay();

            if (typeof ProjectsManager !== 'undefined') {
                ProjectsManager.showProjectDetailModal(await ApiService.getProject(projectHash).catch(() => null));
            }
        } finally {
            this.isOpening = false;
        }
    }


    static showProjectView(projectData, tasks) {
        const project = projectData.project || projectData;
        const currentUserRole = project.current_user_role || project.user_role || 'member';
        const canManage = ['owner', 'admin'].includes(currentUserRole);
        const canCreateTasks = canManage;
        const canViewJoinRequests = canManage;

        const projectHTML = `
            <div class="project-view">
                <div class="project-header">
                    <button class="btn btn-icon back-btn" onclick="ProjectView.closeProject()">
                        <i class="fas fa-arrow-left"></i>
                        <span class="d-none d-sm-inline">Назад</span>
                    </button>
                    <div class="project-title-section">
                        <h1 class="project-title">${Utils.escapeHTML(project.title)}</h1>
                        <span class="project-status">${UIComponents.getProjectStatus(project)}</span>
                    </div>
                    ${canManage ? `
                        <div class="project-actions">
                            ${canViewJoinRequests ? `
                                <button class="btn btn-outline-primary" onclick="JoinRequestsManager.showJoinRequestsModal('${project.hash}')">
                                    <i class="fas fa-user-plus"></i> Заявки
                                </button>
                            ` : ''}
                            <button class="btn btn-outline" onclick="ProjectsManager.showMembersManagement('${project.hash}')">
                                <i class="fas fa-users"></i> Участники
                            </button>
                            <button class="btn btn-outline" onclick="ProjectsManager.showProjectSettings('${project.hash}')">
                                <i class="fas fa-cog"></i> Настройки
                            </button>
                        </div>
                    ` : ''}
                </div>

                <div class="project-content">
                    <div class="project-info-section">
                        <div class="project-description-card">
                            <h3>Описание</h3>
                            <p class="project-description">${Utils.escapeHTML(project.description || 'Без описания')}</p>
                        </div>

                        <div class="project-meta-grid">
                            <div class="meta-card">
                                <div class="meta-icon"><i class="fas fa-users"></i></div>
                                <div class="meta-content">
                                    <div class="meta-value">${project.members?.length || 0}</div>
                                    <div class="meta-label">Участников</div>
                                </div>
                            </div>
                            <div class="meta-card">
                                <div class="meta-icon"><i class="fas fa-tasks"></i></div>
                                <div class="meta-content">
                                    <div class="meta-value">${tasks.length}</div>
                                    <div class="meta-label">Задач</div>
                                </div>
                            </div>
                            <div class="meta-card">
                                <div class="meta-icon"><i class="fas fa-user-tag"></i></div>
                                <div class="meta-content">
                                    <div class="meta-value">${UIComponents.getRoleText(currentUserRole)}</div>
                                    <div class="meta-label">Ваша роль</div>
                                </div>
                            </div>
                            <div class="meta-card">
                                <div class="meta-icon"><i class="fas fa-calendar"></i></div>
                                <div class="meta-content">
                                    <div class="meta-value">${Utils.formatDate(project.created_at)}</div>
                                    <div class="meta-label">Создан</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="project-tasks-section">
                        <div class="tasks-header">
                            <h2>Задачи</h2>
                            ${canCreateTasks ? `
                                <button class="btn btn-primary" onclick="TasksManager.showCreateTaskModal('${project.hash}')">
                                    <i class="fas fa-plus"></i> <span class="d-none d-sm-inline">Новая задача</span>
                                </button>
                            ` : ''}
                        </div>

                        <div id="project-tasks-container" class="tasks-container">
                            ${this.renderTasksList(tasks)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        let container = document.getElementById('project-view-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'project-view-container';
            container.className = 'project-view-container';
            document.querySelector('main').appendChild(container);
        }

        container.innerHTML = projectHTML;
        container.style.display = 'block';

        const views = document.querySelectorAll('.view');
        views.forEach(v => v.classList.remove('active'));

        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-view') === 'dashboard-view') {
                item.classList.add('active');
            }
        });

        this.setupTaskEventHandlers();
    }

    static setupTaskEventHandlers() {
        document.removeEventListener('click', this.taskClickHandler);
        this.taskClickHandler = (e) => {
            const taskCard = e.target.closest('.task-card');
            if (taskCard) {
                const taskId = taskCard.getAttribute('data-task-id');
                if (taskId && typeof TasksManager !== 'undefined') {
                    TasksManager.openTaskDetail(taskId);
                }
            }
        };
        document.addEventListener('click', this.taskClickHandler);

        if (typeof SwipeManager !== 'undefined') {
            SwipeManager.setupGlobalHandlers();
        }
    }

    static renderTasksList(tasks) {
        if (!tasks || tasks.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon"><i class="fas fa-tasks"></i></div>
                    <h3>Задач нет</h3>
                    <p>Создайте первую задачу</p>
                </div>
            `;
        }

        return `
            <div class="tasks-list">
                ${tasks.map(task => {
                    const taskData = {
                        ...task,
                        priorityText: Utils.getPriorityText(task.priority),
                        statusText: Utils.getStatusText(task.status),
                        assignee: task.assignee?.full_name || 'Не назначен',
                        dueDate: task.due_date ? Utils.formatDate(task.due_date) : 'Без срока',
                        isOverdue: Utils.isOverdue(task.due_date),
                        hasSubtasks: !!(task.subtasks && task.subtasks.length > 0),
                        progress: task.subtasks?.length > 0 ?
                            Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100) : 0
                    };

                    return typeof UIComponents !== 'undefined' ?
                        UIComponents.renderTemplate('task-card-template', taskData) :
                        this.createFallbackTaskCard(taskData);
                }).join('')}
            </div>
        `;
    }

    static createFallbackTaskCard(task) {
        return `
            <div class="task-card" data-task-id="${task.id}">
                <div class="card-content">
                    <div class="card-header">
                        <h4 class="task-title">${Utils.escapeHTML(task.title)}</h4>
                        <span class="priority-badge priority-${task.priority}">
                            ${Utils.escapeHTML(task.priorityText)}
                        </span>
                    </div>
                    <p class="task-description">${Utils.escapeHTML(task.description || '')}</p>
                    <div class="task-meta">
                        <div class="meta-item">
                            <i class="fas fa-user"></i>
                            <span>${Utils.escapeHTML(task.assignee)}</span>
                        </div>
                        <div class="meta-item ${task.isOverdue ? 'overdue' : ''}">
                            <i class="fas fa-clock"></i>
                            <span>${task.dueDate}</span>
                        </div>
                    </div>
                    <div class="task-footer">
                        <span class="status-badge status-${task.status}">
                            ${Utils.escapeHTML(task.statusText)}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    static closeProject() {
        const container = document.getElementById('project-view-container');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }

        const dashboardView = document.getElementById('dashboard-view');
        if (dashboardView) {
            dashboardView.classList.add('active');
        }

        this.currentProject = null;

        if (typeof DashboardManager !== 'undefined') {
            DashboardManager.loadDashboard();
        }
    }

    static async refreshProjectTasks() {
        if (!this.currentProject) return;

        try {
            const tasksData = await ApiService.getProjectTasks(this.currentProject.hash);
            const tasksContainer = document.getElementById('project-tasks-container');
            if (tasksContainer) {
                tasksContainer.innerHTML = this.renderTasksList(tasksData.tasks || []);
            }
        } catch (error) {
            Utils.logError('Error refreshing project tasks:', error);
        }
    }
}

window.ProjectView = ProjectView;
