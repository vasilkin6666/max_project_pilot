// Менеджер дашборда
class DashboardManager {
    static async loadDashboard() {
        try {
            StateManager.setLoading(true);

            const [dashboardData, projectsData, tasksData] = await Promise.all([
                CacheManager.getWithCache(
                    'dashboard',
                    () => ApiService.getDashboard(),
                    'dashboard'
                ),
                CacheManager.getWithCache(
                    'projects',
                    () => ApiService.getProjects(),
                    'projects'
                ),
                CacheManager.getWithCache(
                    'tasks',
                    () => ApiService.getTasks({ status: 'todo' }),
                    'tasks'
                )
            ]);

            // Обновляем состояние
            StateManager.setState('dashboard', dashboardData);
            StateManager.setState('projects', projectsData.projects || []);
            StateManager.setState('tasks', tasksData.tasks || []);

            // Обновляем UI
            this.updateStats(dashboardData);
            this.renderProjects(projectsData.projects || []);
            this.renderPriorityTasks(tasksData.tasks || []);

            EventManager.emit(APP_EVENTS.DATA_LOADED);
            Utils.log('Dashboard loaded successfully');

        } catch (error) {
            Utils.logError('Dashboard load error:', error);
            EventManager.emit(APP_EVENTS.DATA_ERROR, error);
            this.showErrorState();
        } finally {
            StateManager.setLoading(false);
        }
    }

    static updateStats(data) {
        const stats = data.summary || {};

        // Обновляем счетчики
        this.updateCounter('active-projects-count', stats.active_projects || 0);
        this.updateCounter('overdue-tasks-count', stats.overdue_tasks || 0);
        this.updateCounter('total-tasks-count', stats.total_tasks || 0);
        this.updateCounter('completed-tasks-count', stats.completed_tasks || 0);
    }

    static updateCounter(elementId, count) {
        const element = document.getElementById(elementId);
        if (element) {
            // Анимация изменения числа
            this.animateCounter(element, parseInt(element.textContent) || 0, count);
        }
    }

    static animateCounter(element, from, to) {
        const duration = 500; // ms
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = Math.floor(from + (to - from) * easeOutQuart);

            element.textContent = currentValue;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = to;
            }
        }

        requestAnimationFrame(update);
    }

    static renderProjects(projects) {
        const container = document.getElementById('projects-list');
        if (!container) return;

        if (!projects || projects.length === 0) {
            container.innerHTML = this.getEmptyProjectsHTML();
            return;
        }

        this.showLoadingState(container);

        // Используем requestAnimationFrame для плавного рендеринга
        requestAnimationFrame(() => {
            container.innerHTML = '';
            projects.forEach((projectData, index) => {
                setTimeout(() => {
                    const cardHTML = this.renderProjectCardWithTemplate(projectData);
                    const card = document.createElement('div');
                    card.innerHTML = cardHTML;
                    container.appendChild(card.firstElementChild);

                    // Добавляем анимацию появления
                    card.firstElementChild.style.animationDelay = `${index * 50}ms`;
                    card.firstElementChild.classList.add('fade-in');
                }, index * 50);
            });
        });
    }

    static renderPriorityTasks(tasks) {
        const container = document.getElementById('priority-tasks-list');
        if (!container) return;

        if (!tasks || tasks.length === 0) {
            container.innerHTML = this.getEmptyTasksHTML();
            return;
        }

        this.showLoadingState(container);

        requestAnimationFrame(() => {
            container.innerHTML = '';
            tasks.forEach((task, index) => {
                setTimeout(() => {
                    const cardHTML = this.renderTaskCardWithTemplate(task);
                    const card = document.createElement('div');
                    card.innerHTML = cardHTML;
                    container.appendChild(card.firstElementChild);

                    // Добавляем анимацию появления
                    card.firstElementChild.style.animationDelay = `${index * 50}ms`;
                    card.firstElementChild.classList.add('fade-in');
                }, index * 50);
            });
        });
    }

    static getActiveProjects(projects) {
        return projects
            .filter(projectMember => {
                const project = projectMember.project || projectMember;
                const stats = project.stats || { tasks_count: 0, tasks_done: 0 };
                const progress = stats.tasks_count > 0 ?
                    Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;
                return progress < 100; // Незавершенные проекты
            })
            .sort((a, b) => {
                const projectA = a.project || a;
                const projectB = b.project || b;
                const statsA = projectA.stats || { tasks_count: 0, tasks_done: 0 };
                const statsB = projectB.stats || { tasks_count: 0, tasks_done: 0 };

                const progressA = statsA.tasks_count > 0 ?
                    Math.round((statsA.tasks_done / statsA.tasks_count) * 100) : 0;
                const progressB = statsB.tasks_count > 0 ?
                    Math.round((statsB.tasks_done / statsB.tasks_count) * 100) : 0;

                // Сортируем по убыванию прогресса
                return progressB - progressA;
            });
    }

    static getPriorityTasks(tasks) {
        return tasks
            .filter(task => {
                // Фильтруем просроченные и задачи с высоким приоритетом
                const isOverdue = Utils.isOverdue(task.due_date);
                const isHighPriority = ['high', 'urgent'].includes(task.priority);
                return isOverdue || isHighPriority;
            })
            .sort((a, b) => {
                // Сортируем: сначала просроченные, затем по приоритету
                const aOverdue = Utils.isOverdue(a.due_date);
                const bOverdue = Utils.isOverdue(b.due_date);

                if (aOverdue && !bOverdue) return -1;
                if (!aOverdue && bOverdue) return 1;

                // При равных условиях сортируем по приоритету
                const priorityOrder = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
    }

    static getEmptyProjectsHTML() {
        return `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-folder-open"></i>
                </div>
                <h3>Проектов пока нет</h3>
                <p>Создайте свой первый проект, чтобы начать работу</p>
                <button class="btn btn-primary" onclick="ProjectsManager.showCreateProjectModal()">
                    <i class="fas fa-plus"></i> Создать проект
                </button>
            </div>
        `;
    }

    static getEmptyTasksHTML() {
        return `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-tasks"></i>
                </div>
                <h3>Приоритетных задач нет</h3>
                <p>Все задачи выполнены или не требуют срочного внимания</p>
            </div>
        `;
    }

    static showErrorState() {
        const projectsContainer = document.getElementById('projects-list');
        const tasksContainer = document.getElementById('priority-tasks-list');

        if (projectsContainer) {
            projectsContainer.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Ошибка загрузки проектов</h3>
                    <button class="btn btn-primary" onclick="DashboardManager.loadDashboard()">
                        <i class="fas fa-refresh"></i> Попробовать снова
                    </button>
                </div>
            `;
        }

        if (tasksContainer) {
            tasksContainer.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Ошибка загрузки задач</h3>
                </div>
            `;
        }
    }

    // Методы для обновления отдельных компонентов дашборда
    static refreshProjects() {
        const projects = StateManager.getState('projects');
        this.renderProjects(projects);
    }

    static refreshTasks() {
        const tasks = StateManager.getState('tasks');
        this.renderPriorityTasks(tasks);
    }

    static refreshStats() {
        const dashboardData = StateManager.getState('dashboard');
        this.updateStats(dashboardData);
    }

    // Подписка на события обновления данных
    static initEventListeners() {
        EventManager.on(APP_EVENTS.PROJECTS_LOADED, (projects) => {
            this.refreshProjects();
        });

        EventManager.on(APP_EVENTS.TASKS_LOADED, (tasks) => {
            this.refreshTasks();
        });

        EventManager.on(APP_EVENTS.PROJECT_CREATED, () => {
            this.loadDashboard();
        });

        EventManager.on(APP_EVENTS.TASK_CREATED, () => {
            this.loadDashboard();
        });
    }

    // Вспомогательные методы для рендеринга с шаблонами
    static renderProjectCardWithTemplate(projectData) {
        const project = projectData.project || projectData;
        const stats = project.stats || {};
        const role = projectData.role || 'member';
        const progress = stats.tasks_count > 0
            ? Math.round((stats.tasks_done / stats.tasks_count) * 100)
            : 0;

        const templateData = {
            id: project.id,
            hash: project.hash,
            title: project.title,
            description: project.description || 'Без описания',
            role: role,
            roleText: this.getRoleText(role),
            membersCount: stats.members_count || 0,
            tasksCount: stats.tasks_count || 0,
            userTasks: stats.user_tasks || 0,
            progress: progress,
            status: this.getProjectStatus(project),
            canInvite: ['owner', 'admin'].includes(role)
        };

        // Используем UIComponents для рендеринга
        if (typeof UIComponents !== 'undefined' && UIComponents.templates.has('project-card-template')) {
            return UIComponents.renderTemplate('project-card-template', templateData);
        } else {
            // Fallback на стандартный рендеринг
            return this.createProjectCard(projectData);
        }
    }

    static renderTaskCardWithTemplate(task) {
        const isOverdue = Utils.isOverdue(task.due_date);
        const progress = task.subtasks && task.subtasks.length > 0
            ? Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)
            : 0;

        const templateData = {
            id: task.id,
            title: task.title,
            description: task.description || '',
            priority: task.priority,
            priorityText: Utils.getPriorityText(task.priority),
            status: task.status,
            statusText: Utils.getStatusText(task.status),
            assignee: task.assignee?.full_name || 'Не назначен',
            dueDate: task.due_date ? Utils.formatDate(task.due_date) : 'Нет срока',
            isOverdue: isOverdue,
            hasSubtasks: !!(task.subtasks && task.subtasks.length > 0),
            progress: progress
        };

        // Используем UIComponents для рендеринга
        if (typeof UIComponents !== 'undefined' && UIComponents.templates.has('task-card-template')) {
            return UIComponents.renderTemplate('task-card-template', templateData);
        } else {
            // Fallback на стандартный рендеринг
            return this.createTaskCard(task);
        }
    }

    static createProjectCard(project) {
        const stats = project.stats || {};
        const progress = stats.tasks_count > 0
            ? Math.round((stats.tasks_done / stats.tasks_count) * 100)
            : 0;

        return `
            <div class="project-card" data-project-hash="${project.hash}" tabindex="0"
                 aria-label="Проект ${Utils.escapeHTML(project.title)}">
                <div class="swipe-actions">
                    <div class="swipe-action edit-action" aria-label="Редактировать проект">
                        <i class="fas fa-edit" aria-hidden="true"></i>
                    </div>
                    <div class="swipe-action delete-action" aria-label="Удалить проект">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                    </div>
                </div>

                <div class="card-content">
                    <div class="card-header">
                        <h5 class="project-title">${Utils.escapeHTML(project.title)}</h5>
                        <span class="project-status">${this.getProjectStatus(project)}</span>
                    </div>
                    <p class="project-description">
                        ${Utils.escapeHTML(project.description || 'Без описания')}
                    </p>
                    <div class="project-stats">
                        <div class="stat">
                            <i class="fas fa-users" aria-hidden="true"></i>
                            <span>${stats.members_count || 0}</span>
                            <span class="sr-only">участников</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-tasks" aria-hidden="true"></i>
                            <span>${stats.tasks_count || 0}</span>
                            <span class="sr-only">задач</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-check-circle" aria-hidden="true"></i>
                            <span>${stats.tasks_done || 0}</span>
                            <span class="sr-only">выполнено</span>
                        </div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"
                             aria-label="Прогресс: ${progress}%"></div>
                    </div>
                    <div class="project-footer">
                        <span class="progress-text">${progress}%</span>
                        ${project.is_private ? `
                            <button class="btn btn-sm btn-outline share-btn"
                                    onclick="ProjectsManager.showInviteDialog('${project.hash}')"
                                    aria-label="Поделиться проектом">
                                <i class="fas fa-share-alt" aria-hidden="true"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    static createTaskCard(task) {
        const isOverdue = task.due_date && Utils.isOverdue(task.due_date);
        const progress = task.subtasks && task.subtasks.length > 0
            ? Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)
            : 0;

        return `
            <div class="task-card" data-task-id="${task.id}" tabindex="0"
                 aria-label="Задача ${Utils.escapeHTML(task.title)}">
                <div class="swipe-actions">
                    <div class="swipe-action edit-action" aria-label="Редактировать задачу">
                        <i class="fas fa-edit" aria-hidden="true"></i>
                    </div>
                    <div class="swipe-action delete-action" aria-label="Удалить задачу">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                    </div>
                </div>

                <div class="card-content">
                    <div class="card-header">
                        <h4 class="task-title">${Utils.escapeHTML(task.title)}</h4>
                        <span class="priority-badge priority-${task.priority}">
                            ${Utils.escapeHTML(Utils.getPriorityText(task.priority))}
                        </span>
                    </div>

                    <p class="task-description">
                        ${Utils.escapeHTML(task.description || '')}
                    </p>

                    <div class="task-meta">
                        <div class="meta-item">
                            <i class="fas fa-user" aria-hidden="true"></i>
                            <span>${Utils.escapeHTML(task.assignee?.full_name || 'Не назначен')}</span>
                        </div>
                        <div class="meta-item ${isOverdue ? 'overdue' : ''}">
                            <i class="fas fa-clock" aria-hidden="true"></i>
                            <span>${task.due_date ? Utils.formatDate(task.due_date) : 'Нет срока'}</span>
                            ${isOverdue ? '<span class="sr-only">Просрочено</span>' : ''}
                        </div>
                    </div>

                    <div class="task-footer">
                        <span class="status-badge status-${task.status}">
                            ${Utils.escapeHTML(Utils.getStatusText(task.status))}
                        </span>

                        ${task.subtasks && task.subtasks.length > 0 ? `
                            <div class="task-progress">
                                <span class="progress-text">${progress}%</span>
                                <div class="progress-bar small">
                                    <div class="progress-fill" style="width: ${progress}%"></div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    static getRoleText(role) {
        const roles = {
            'owner': 'Владелец',
            'admin': 'Админ',
            'member': 'Участник',
            'guest': 'Гость'
        };
        return roles[role] || role;
    }

    static getProjectStatus(project) {
        if (project.is_private) {
            return project.requires_approval ? 'Приватный (требует одобрения)' : 'Приватный';
        }
        return 'Публичный';
    }

    static showLoadingState(container) {
        if (!container) return;

        container.innerHTML = `
            <div class="loading-state" aria-live="polite" aria-busy="true">
                <div class="spinner" aria-hidden="true"></div>
                <p>Загрузка...</p>
            </div>
        `;
    }
}

window.DashboardManager = DashboardManager;
