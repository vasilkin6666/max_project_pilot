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

        // Фильтруем и сортируем проекты
        const activeProjects = this.getActiveProjects(projects);
        const projectsToShow = activeProjects.slice(0, 6); // Показываем до 6 проектов

        container.innerHTML = projectsToShow.map(project =>
            UIComponents.createProjectCard(project)
        ).join('');

        // Инициализируем свайпы для новых карточек
        SwipeManager.setupProjectSwipes();
    }

    static renderPriorityTasks(tasks) {
        const container = document.getElementById('priority-tasks-list');
        if (!container) return;

        if (!tasks || tasks.length === 0) {
            container.innerHTML = this.getEmptyTasksHTML();
            return;
        }

        // Сортируем задачи по приоритету и сроку
        const priorityTasks = this.getPriorityTasks(tasks);
        const tasksToShow = priorityTasks.slice(0, 5); // Показываем до 5 задач

        container.innerHTML = tasksToShow.map(task =>
            UIComponents.createTaskCard(task)
        ).join('');

        // Инициализируем свайпы для новых карточек
        SwipeManager.setupTaskSwipes();
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
}

window.DashboardManager = DashboardManager;
