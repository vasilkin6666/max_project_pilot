// View manager component
class ViewManager {
    constructor() {
        this.currentView = 'dashboard';
        this.viewHistory = [];
        this.viewStates = new Map();
    }

    async init() {
        console.log('View manager initialized');
        this.setupEventListeners();
        this.setupViewTransitions();
        return Promise.resolve();
    }

    setupEventListeners() {
        // Navigation buttons
        document.addEventListener('click', (e) => {
            const navBtn = e.target.closest('[data-view]');
            if (navBtn) {
                const viewName = navBtn.dataset.view;
                this.showView(viewName);
            }
        });

        // Back button handling
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="back"]') ||
                e.target.closest('[data-action="back"]')) {
                e.preventDefault();
                this.goBack();
            }
        });

        // Browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.view) {
                this.showView(e.state.view, false);
            }
        });
    }

    setupViewTransitions() {
        // Add CSS for view transitions
        const style = document.createElement('style');
        style.textContent = `
            .view {
                opacity: 0;
                transform: translateY(20px);
                transition: opacity 0.3s ease, transform 0.3s ease;
            }

            .view.active {
                opacity: 1;
                transform: translateY(0);
            }

            .view.exiting {
                opacity: 0;
                transform: translateY(-20px);
            }
        `;
        document.head.appendChild(style);
    }

    // View management
    async showView(viewName, addToHistory = true) {
        if (viewName === this.currentView) return;

        console.log(`Showing view: ${viewName}`);

        // Save current view state
        this.saveViewState(this.currentView);

        // Hide current view
        await this.hideView(this.currentView);

        // Show new view
        await this.displayView(viewName);

        // Update navigation
        this.updateNavigation(viewName);

        // Add to history
        if (addToHistory) {
            this.viewHistory.push(this.currentView);
            window.history.pushState({ view: viewName }, '', `#${viewName}`);
        }

        this.currentView = viewName;

        // Load view data
        await this.loadViewData(viewName);

        // Trigger view change event
        this.triggerViewChange(viewName);
    }

    async hideView(viewName) {
        const viewElement = document.getElementById(`${viewName}View`);
        if (!viewElement) return;

        viewElement.classList.add('exiting');
        await Utils.wait(300);
        viewElement.classList.remove('active', 'exiting');
    }

    async displayView(viewName) {
        const viewElement = document.getElementById(`${viewName}View`);
        if (!viewElement) {
            console.error(`View element not found: ${viewName}View`);
            return;
        }

        // Restore view state
        this.restoreViewState(viewName);

        viewElement.classList.add('active');
        await Utils.wait(10); // Ensure DOM update
    }

    goBack() {
        if (this.viewHistory.length > 0) {
            const previousView = this.viewHistory.pop();
            this.showView(previousView, false);
            window.history.back();
        } else {
            // Default fallback
            this.showView('dashboard');
        }
    }

    // View state management
    saveViewState(viewName) {
        const viewElement = document.getElementById(`${viewName}View`);
        if (!viewElement) return;

        const state = {
            scrollPosition: viewElement.scrollTop,
            formData: this.getFormData(viewElement),
            customState: this.viewStates.get(viewName) || {}
        };

        Utils.setStorage(`viewState_${viewName}`, state);
    }

    restoreViewState(viewName) {
        const state = Utils.getStorage(`viewState_${viewName}`, {});
        const viewElement = document.getElementById(`${viewName}View`);

        if (!viewElement) return;

        if (state.scrollPosition) {
            viewElement.scrollTop = state.scrollPosition;
        }

        this.setFormData(viewElement, state.formData);
    }

    getFormData(container) {
        if (!container) return {};

        const formData = {};
        const inputs = container.querySelectorAll('input, select, textarea');

        inputs.forEach(input => {
            if (input.name || input.id) {
                const key = input.name || input.id;
                if (input.type === 'checkbox' || input.type === 'radio') {
                    formData[key] = input.checked;
                } else {
                    formData[key] = input.value;
                }
            }
        });

        return formData;
    }

    setFormData(container, formData) {
        if (!container || !formData || typeof formData !== 'object') return;

        for (const [key, value] of Object.entries(formData)) {
            const input = container.querySelector(`[name="${key}"], #${key}`);
            if (input) {
                if (input.type === 'checkbox' || input.type === 'radio') {
                    input.checked = Boolean(value);
                } else {
                    input.value = value || '';
                }
            }
        }
    }

    // Navigation updates
    updateNavigation(currentView) {
        // Update nav buttons
        const navButtons = document.querySelectorAll('[data-view]');
        navButtons.forEach(btn => {
            if (btn.dataset.view === currentView) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update document title
        this.updateDocumentTitle(currentView);
    }

    updateDocumentTitle(viewName) {
        const titles = {
            dashboard: 'Project Pilot - Дашборд',
            myTasks: 'Project Pilot - Мои задачи',
            projectView: 'Project Pilot - Проект',
            taskView: 'Project Pilot - Задача',
            searchProjects: 'Project Pilot - Поиск проектов',
            profile: 'Project Pilot - Профиль',
            settings: 'Project Pilot - Настройки'
        };

        document.title = titles[viewName] || 'Project Pilot';
    }

    // View data loading
    async loadViewData(viewName) {
        const app = window.App;
        if (!app) return;

        try {
            switch (viewName) {
                case 'dashboard':
                    await app.loadDashboardData();
                    break;

                case 'myTasks':
                    await app.loadMyTasks();
                    break;

                case 'searchProjects':
                    await app.loadSearchProjects();
                    break;

                case 'profile':
                    await app.loadProfileData();
                    break;

                case 'settings':
                    await app.loadSettingsData();
                    break;
            }
        } catch (error) {
            console.error(`Error loading data for view ${viewName}:`, error);
            Utils.showToast('Ошибка загрузки данных', 'error');
        }
    }

    // Specific view renderers
    renderDashboard(data) {
        const container = document.getElementById('dashboardView');
        if (!container) return;

        const { projects = [], recentTasks = [], stats = {} } = data;

        // Update stats
        this.updateDashboardStats(stats);

        // Render recent tasks
        this.renderRecentTasks(recentTasks);

        // Render projects
        this.renderProjects(projects);

        // Update view mode
        this.setupViewModeToggle();
    }

    updateDashboardStats(stats) {
        const elements = {
            projectsCount: stats.projectsCount || 0,
            tasksCount: stats.tasksCount || 0,
            recentTasksCount: stats.recentTasksCount || 0,
            completedTasksCount: stats.completedTasksCount || 0
        };

        for (const [id, value] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) {
                this.animateCounter(element, value);
            }
        }
    }

    animateCounter(element, targetValue) {
        const currentValue = parseInt(element.textContent) || 0;
        const duration = 500;
        const steps = 20;
        const stepValue = (targetValue - currentValue) / steps;
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            const value = Math.round(currentValue + (stepValue * currentStep));
            element.textContent = value;

            if (currentStep >= steps) {
                element.textContent = targetValue;
                clearInterval(timer);
            }
        }, duration / steps);
    }

    renderRecentTasks(tasks) {
        const container = document.getElementById('recentTasksList');
        if (!container) return;

        if (!tasks || tasks.length === 0) {
            container.innerHTML = this.createEmptyState(
                'Нет недавних задач',
                'Задачи, над которыми вы работали, появятся здесь',
                '📝'
            );
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
                    <span class="task-date">
                        ${Utils.formatDateTime(task.updated_at)}
                    </span>
                </div>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.task-card').forEach(card => {
            card.addEventListener('click', () => {
                window.App?.openTask(card.dataset.taskId);
            });
        });
    }

    renderProjects(projects) {
        const container = document.getElementById('projectsList');
        if (!container) return;

        if (!projects || projects.length === 0) {
            container.innerHTML = this.createEmptyState(
                'Проектов пока нет',
                'Создайте первый проект для начала работы',
                '📁',
                '<button class="btn btn-primary" onclick="App.components.modals.showCreateProjectModal()">Создать проект</button>'
            );
            return;
        }

        const viewMode = document.getElementById('projectsViewMode')?.value || 'list';
        container.className = `projects-container ${viewMode}`;

        container.innerHTML = projects.map(project => {
            const projectData = project.project || project;
            const stats = project.stats || projectData.stats || {};

            return `
                <div class="project-card"
                     data-project-hash="${projectData.hash}"
                     data-swipeable
                     data-swipe-left="edit"
                     data-swipe-right="delete"
                     data-long-press
                     data-context="project">

                    <div class="project-card-header">
                        <h3 class="project-title">${Utils.escapeHtml(projectData.title)}</h3>
                        <div class="project-meta">
                            <span>${Utils.formatDate(projectData.created_at)}</span>
                            ${projectData.is_private ? '<span>🔒</span>' : ''}
                        </div>
                    </div>

                    <p class="project-description">
                        ${Utils.escapeHtml(projectData.description || 'Без описания')}
                    </p>

                    <div class="project-stats">
                        <div class="project-stat">
                            <span>👥</span>
                            <span>${stats.members_count || 0}</span>
                        </div>
                        <div class="project-stat">
                            <span>✅</span>
                            <span>${stats.tasks_count || 0}</span>
                        </div>
                        <div class="project-stat">
                            <span>🎯</span>
                            <span>${stats.tasks_done || 0}</span>
                        </div>
                    </div>

                    <div class="project-actions">
                        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); App.components.modals.showEditProjectModal('${projectData.hash}')">
                            ✏️
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.project-card').forEach(card => {
            card.addEventListener('click', () => {
                window.App?.openProject(card.dataset.projectHash);
            });
        });
    }

    setupViewModeToggle() {
        const viewModeSelect = document.getElementById('projectsViewMode');
        if (viewModeSelect) {
            viewModeSelect.addEventListener('change', (e) => {
                this.renderProjects(window.App?.currentProjects || []);
            });
        }
    }

    // Project view
    renderProjectView(projectData) {
        const container = document.getElementById('projectView');
        if (!container) return;

        const project = projectData.project || projectData;
        const summary = projectData.summary || {};

        container.innerHTML = `
            <div class="view-header">
                <div>
                    <h2>${Utils.escapeHtml(project.title)}</h2>
                    <div class="project-hash" style="display: ${this.shouldShowHash(project) ? 'block' : 'none'};">
                        Хэш проекта: <code>${project.hash}</code>
                    </div>
                </div>
                <div class="view-actions">
                    ${this.renderProjectActions(project)}
                    <button class="btn btn-secondary" onclick="App.showDashboard()">
                        ← Назад
                    </button>
                </div>
            </div>

            <div class="project-overview">
                <p class="project-description">${Utils.escapeHtml(project.description || 'Без описания')}</p>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">👥</div>
                        <div class="stat-content">
                            <div class="stat-number">${summary.members_count || 0}</div>
                            <div class="stat-label">Участников</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">✅</div>
                        <div class="stat-content">
                            <div class="stat-number">${summary.tasks_count || 0}</div>
                            <div class="stat-label">Всего задач</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">🎯</div>
                        <div class="stat-content">
                            <div class="stat-number">${summary.tasks_done || 0}</div>
                            <div class="stat-label">Выполнено</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">🔄</div>
                        <div class="stat-content">
                            <div class="stat-number">${summary.tasks_in_progress || 0}</div>
                            <div class="stat-label">В работе</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="project-sections">
                <section class="section">
                    <div class="section-header">
                        <h3>Задачи проекта</h3>
                        <button class="btn btn-primary" id="createTaskBtn">
                            ➕ Создать задачу
                        </button>
                    </div>
                    <div id="projectTasksList"></div>
                </section>

                <section class="section">
                    <div class="section-header">
                        <h3>Участники</h3>
                        <button class="btn btn-secondary" id="manageMembersBtn">
                            👥 Управление
                        </button>
                    </div>
                    <div id="projectMembersList"></div>
                </section>
            </div>
        `;

        // Setup event listeners
        this.setupProjectViewEvents(project);
    }

    shouldShowHash(project) {
        const userRole = project.current_user_role;
        return userRole === 'owner' || userRole === 'admin';
    }

    renderProjectActions(project) {
        const userRole = project.current_user_role;
        const actions = [];

        if (userRole === 'owner' || userRole === 'admin') {
            actions.push(`
                <button class="btn btn-info" id="joinRequestsBtn">
                    📨 Заявки
                </button>
            `);
        }

        if (userRole === 'owner' || userRole === 'admin') {
            actions.push(`
                <button class="btn btn-info" id="manageMembersBtn">
                    👥 Участники
                </button>
            `);
        }

        if (userRole === 'owner') {
            actions.push(`
                <button class="btn btn-warning" id="editProjectBtn">
                    ✏️ Редактировать
                </button>
            `);
        }

        if (userRole === 'owner') {
            actions.push(`
                <button class="btn btn-danger" id="deleteProjectBtn">
                    🗑️ Удалить
                </button>
            `);
        }

        return actions.join('');
    }

    setupProjectViewEvents(project) {
        document.getElementById('createTaskBtn')?.addEventListener('click', () => {
            window.App?.components.modals.showCreateTaskModal(project.hash);
        });

        document.getElementById('manageMembersBtn')?.addEventListener('click', () => {
            window.App?.showProjectMembersManagement(project.hash);
        });

        document.getElementById('joinRequestsBtn')?.addEventListener('click', () => {
            window.App?.showJoinRequests(project.hash);
        });

        document.getElementById('editProjectBtn')?.addEventListener('click', () => {
            window.App?.components.modals.showEditProjectModal(project.hash);
        });

        document.getElementById('deleteProjectBtn')?.addEventListener('click', () => {
            window.App?.components.modals.showDeleteProjectModal(project.hash);
        });
    }

    // Utility methods
    createEmptyState(title, description, icon, action = '') {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">${icon}</div>
                <h3 class="empty-state-title">${title}</h3>
                <p class="empty-state-description">${description}</p>
                ${action}
            </div>
        `;
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

    triggerViewChange(viewName) {
        const event = new CustomEvent('viewchange', {
            detail: { viewName, previousView: this.currentView }
        });
        document.dispatchEvent(event);
    }

    // Cleanup
    destroy() {
        this.viewHistory = [];
        this.viewStates.clear();
    }
}
