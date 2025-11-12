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
                    </button>
                    <div class="project-title-section">
                        <h1 class="project-title">${Utils.escapeHTML(project.title)}</h1>
                        <span class="project-status">${UIComponents.getProjectStatus(project)}</span>
                    </div>
                    ${canManage ? `
                        <div class="project-actions">
                            ${canViewJoinRequests ? `
                                <button class="btn btn-outline" onclick="JoinRequestsManager.showJoinRequestsModal('${project.hash}')">
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
                    <div class="project-info">
                        <div class="project-description">
                            <h3>Описание</h3>
                            <p>${Utils.escapeHTML(project.description || 'Без описания')}</p>
                        </div>

                        <div class="project-meta-grid">
                            <div class="meta-item">
                                <strong>Статус:</strong>
                                <span>${UIComponents.getProjectStatus(project)}</span>
                            </div>
                            <div class="meta-item">
                                <strong>Участников:</strong>
                                <span>${project.members?.length || 0}</span>
                            </div>
                            <div class="meta-item">
                                <strong>Ваша роль:</strong>
                                <span class="role-badge role-${currentUserRole}">
                                    ${UIComponents.getRoleText(currentUserRole)}
                                </span>
                            </div>
                            <div class="meta-item">
                                <strong>Создан:</strong>
                                <span>${Utils.formatDate(project.created_at)}</span>
                            </div>
                        </div>

                        ${canViewJoinRequests ? `
                            <div class="project-join-requests">
                                <button class="btn btn-outline-primary" onclick="JoinRequestsManager.showJoinRequestsModal('${project.hash}')">
                                    <i class="fas fa-user-plus"></i> Просмотреть заявки на вступление
                                </button>
                            </div>
                        ` : ''}
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
        mainContent.style.display = 'none';

        const projectViewContainer = document.getElementById('project-view-container') || this.createProjectViewContainer();
        projectViewContainer.innerHTML = projectHTML;
        projectViewContainer.style.display = 'block';

        // Обновляем навигацию
        this.updateNavigationForProjectView();
    }

    static createProjectViewContainer() {
        const container = document.createElement('div');
        container.id = 'project-view-container';
        container.className = 'project-view-container';
        document.querySelector('main').appendChild(container);
        return container;
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
                </div>
            `;
        }

        return `
            <div class="tasks-list">
                ${tasks.map(task => UIComponents.renderTemplate('task-card-template', {
                    ...task,
                    priorityText: Utils.getPriorityText(task.priority),
                    statusText: Utils.getStatusText(task.status),
                    assignee: task.assignee?.full_name || 'Не назначен',
                    dueDate: task.due_date ? Utils.formatDate(task.due_date) : 'Нет срока',
                    isOverdue: Utils.isOverdue(task.due_date),
                    hasSubtasks: !!(task.subtasks && task.subtasks.length > 0),
                    progress: task.subtasks && task.subtasks.length > 0 ?
                        Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100) : 0
                })).join('')}
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

        if (projectViewContainer) {
            projectViewContainer.style.display = 'none';
        }

        if (mainContent) {
            mainContent.style.display = 'block';
        }

        // Показываем обратно bottom navigation
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = 'flex';
        }

        this.currentProject = null;
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
