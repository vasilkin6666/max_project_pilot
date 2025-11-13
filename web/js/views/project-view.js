// Менеджер для полноценного просмотра проекта
class ProjectView {
    static currentProject = null;

    static async openProject(projectHash) {
        try {
            // Показываем loading
            App.showLoadingOverlay();

            // Загружаем данные проекта
            const projectData = await ApiService.getProject(projectHash);
            const tasksData = await ApiService.getProjectTasks(projectHash);

            this.currentProject = projectData;

            // Переключаемся на view проекта
            this.showProjectView(projectData, tasksData.tasks || []);

            App.hideLoadingOverlay();
        } catch (error) {
            Utils.logError('Error opening project view:', error);
            ToastManager.error('Ошибка загрузки проекта');
            App.hideLoadingOverlay();

            // Fallback: открываем старый модальный вид
            if (typeof ProjectsManager !== 'undefined') {
                ProjectsManager.showProjectDetailModal(await ApiService.getProject(projectHash));
            }
        }
    }

    static showProjectView(projectData, tasks) {
        const project = projectData.project || projectData;

        // Определяем роль пользователя
        const currentUserRole = project.current_user_role || project.user_role || 'member';
        const canManage = ['owner', 'admin'].includes(currentUserRole);
        const canCreateTasks = canManage;
        const canViewJoinRequests = canManage;

        // Создаем HTML для view проекта
        const projectHTML = `
            <div class="project-view">
                <div class="project-header">
                    <button class="btn btn-icon back-btn" onclick="ProjectView.closeProject()">
                        <i class="fas fa-arrow-left"></i>
                        <span>Назад</span>
                    </button>
                    <div class="project-title-section">
                        <h1 class="project-title">${Utils.escapeHTML(project.title)}</h1>
                        <span class="project-status">${UIComponents.getProjectStatus(project)}</span>
                    </div>
                    ${canManage ? `
                        <div class="project-actions">
                            ${canViewJoinRequests ? `
                                <button class="btn btn-outline-primary" onclick="JoinRequestsManager.showJoinRequestsModal('${project.hash}')">
                                    <i class="fas fa-user-plus"></i> Заявки на вступление
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
                            <h3>Описание проекта</h3>
                            <p class="project-description">${Utils.escapeHTML(project.description || 'Без описания')}</p>
                        </div>

                        <div class="project-meta-grid">
                            <div class="meta-card">
                                <div class="meta-icon">
                                    <i class="fas fa-users"></i>
                                </div>
                                <div class="meta-content">
                                    <div class="meta-value">${project.members?.length || 0}</div>
                                    <div class="meta-label">Участников</div>
                                </div>
                            </div>

                            <div class="meta-card">
                                <div class="meta-icon">
                                    <i class="fas fa-tasks"></i>
                                </div>
                                <div class="meta-content">
                                    <div class="meta-value">${tasks.length}</div>
                                    <div class="meta-label">Задач</div>
                                </div>
                            </div>

                            <div class="meta-card">
                                <div class="meta-icon">
                                    <i class="fas fa-user-tag"></i>
                                </div>
                                <div class="meta-content">
                                    <div class="meta-value">${UIComponents.getRoleText(currentUserRole)}</div>
                                    <div class="meta-label">Ваша роль</div>
                                </div>
                            </div>

                            <div class="meta-card">
                                <div class="meta-icon">
                                    <i class="fas fa-calendar"></i>
                                </div>
                                <div class="meta-content">
                                    <div class="meta-value">${Utils.formatDate(project.created_at)}</div>
                                    <div class="meta-label">Создан</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="project-tasks-section">
                        <div class="tasks-header">
                            <h2>Задачи проекта</h2>
                            ${canCreateTasks ? `
                                <button class="btn btn-primary" onclick="TasksManager.showCreateTaskModal('${project.hash}')">
                                    <i class="fas fa-plus"></i> Новая задача
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

        // Скрываем main content и показываем project view
        const mainContent = document.querySelector('.main-content');
        const bottomNav = document.querySelector('.bottom-nav');

        if (mainContent) {
            mainContent.style.display = 'none';
        }

        if (bottomNav) {
            bottomNav.style.display = 'none';
        }

        const projectViewContainer = document.getElementById('project-view-container') || this.createProjectViewContainer();
        projectViewContainer.innerHTML = projectHTML;
        projectViewContainer.style.display = 'block';

        // Обновляем навигацию
        this.updateNavigationForProjectView();

        // Добавляем обработчики событий для задач
        this.setupTaskEventHandlers();
    }

    static createProjectViewContainer() {
        const container = document.createElement('div');
        container.id = 'project-view-container';
        container.className = 'project-view-container';
        document.querySelector('main').appendChild(container);
        return container;
    }

    static setupTaskEventHandlers() {
        // Обработчики кликов по задачам
        document.addEventListener('click', (e) => {
            const taskCard = e.target.closest('.task-card');
            if (taskCard) {
                const taskId = taskCard.getAttribute('data-task-id');
                if (taskId && typeof TasksManager !== 'undefined') {
                    TasksManager.openTaskDetail(taskId);
                }
            }
        });

        // Обработчики свайпов
        if (typeof SwipeManager !== 'undefined') {
            SwipeManager.setupGlobalHandlers();
        }
    }

    static renderTasksList(tasks) {
        if (!tasks || tasks.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-tasks"></i>
                    </div>
                    <h3>Задач пока нет</h3>
                    <p>Создайте первую задачу для этого проекта</p>
                    <button class="btn btn-primary" onclick="TasksManager.showCreateTaskModal('${this.currentProject?.hash}')">
                        <i class="fas fa-plus"></i> Создать задачу
                    </button>
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
                        dueDate: task.due_date ? Utils.formatDate(task.due_date) : 'Нет срока',
                        isOverdue: Utils.isOverdue(task.due_date),
                        hasSubtasks: !!(task.subtasks && task.subtasks.length > 0),
                        progress: task.subtasks && task.subtasks.length > 0 ?
                            Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100) : 0
                    };

                    // Используем UIComponents для рендеринга карточки задачи
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

    static updateNavigationForProjectView() {
        // Скрываем bottom navigation при просмотре проекта
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = 'none';
        }
    }

    static closeProject() {
        const projectViewContainer = document.getElementById('project-view-container');
        const mainContent = document.querySelector('.main-content');
        const bottomNav = document.querySelector('.bottom-nav');

        if (projectViewContainer) {
            projectViewContainer.style.display = 'none';
            projectViewContainer.innerHTML = ''; // Очищаем контент
        }

        if (mainContent) {
            mainContent.style.display = 'block';
        }

        if (bottomNav) {
            bottomNav.style.display = 'flex';
        }

        // Восстанавливаем активное состояние в навигации
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            if (item.getAttribute('data-view') === 'dashboard-view') {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        this.currentProject = null;

        // Возвращаемся к главному виду
        if (typeof UIComponents !== 'undefined') {
            UIComponents.showView('dashboard-view');
        }

        // Обновляем данные дашборда
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
