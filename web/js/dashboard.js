class DashboardManager {
    static async loadDashboardData() {
        Utils.log('Loading dashboard data from API');

        try {
            // Загружаем проекты и задачи параллельно
            const [projectsData, tasksData] = await Promise.all([
                ApiService.apiGetUserProjects(),
                ApiService.apiGetAllTasks()
            ]);

            this.updateStats(projectsData, tasksData);
            this.renderDashboardProjects(projectsData);
            Utils.log('Dashboard data loaded successfully');
        } catch (error) {
            Utils.logError('Dashboard load error', error);
            ToastManager.showToast('Ошибка загрузки дашборда: ' + error.message, 'error');
            this.renderError();
        }
    }

    static updateStats(projectsData, tasksData) {
        const projectsCount = projectsData.projects ? projectsData.projects.length : 0;
        const tasks = tasksData.tasks || [];
        const tasksTodo = tasks.filter(t => t.status === 'todo').length;
        const tasksProgress = tasks.filter(t => t.status === 'in_progress').length;
        const tasksDone = tasks.filter(t => t.status === 'done').length;

        document.getElementById('projects-count').textContent = projectsCount;
        document.getElementById('tasks-todo-count').textContent = tasksTodo;
        document.getElementById('tasks-progress-count').textContent = tasksProgress;
        document.getElementById('tasks-done-count').textContent = tasksDone;
    }

    static renderDashboardProjects(projectsData) {
        const container = document.getElementById('dashboard-projects-list');

        if (!projectsData.projects || projectsData.projects.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }

        // Показываем только первые 3 проекта
        const projectsToShow = projectsData.projects.slice(0, 3);

        container.innerHTML = projectsToShow.map(member => {
            const project = member.project;
            const stats = project.stats || { tasks_count: 0, tasks_done: 0 };
            const progress = stats.tasks_count > 0 ? Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;

            return `
                <div class="project-card max-card mb-3" onclick="ProjectsManager.openProjectDetail('${project.hash}')">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6 class="mb-0">${Utils.escapeHTML(project.title)}</h6>
                        <span class="badge bg-${member.role === 'owner' ? 'primary' : 'secondary'}">${member.role}</span>
                    </div>
                    <p class="text-muted small mb-2">${Utils.escapeHTML(project.description || 'Без описания')}</p>
                    <div class="progress mb-2" style="height: 8px;">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">${progress}% завершено</small>
                        <small class="text-muted">${stats.tasks_done || 0}/${stats.tasks_count || 0} задач</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    static getEmptyStateHTML() {
        return `
            <div class="max-card text-center">
                <i class="fas fa-project-diagram fa-2x text-muted mb-3"></i>
                <h6>Проектов пока нет</h6>
                <p class="text-muted">Создайте свой первый проект!</p>
                <button class="btn max-btn-primary" onclick="ProjectsManager.createProject()">
                    <i class="fas fa-plus"></i> Создать проект
                </button>
            </div>`;
    }

    static renderError() {
        document.getElementById('dashboard-projects-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить данные</p>
                <button class="btn max-btn-primary btn-sm" onclick="DashboardManager.loadDashboardData()">
                    <i class="fas fa-refresh"></i> Попробовать снова
                </button>
            </div>`;
    }
}

window.DashboardManager = DashboardManager;
