// web/js/dashboard.js
// import { getProjects, getTasks } from './api.js'; // Если используем ES6 modules

async function loadDashboardData() {
    if (!currentUserId) return;
    const token = localStorage.getItem('access_token');
    try {
        const projectsData = await getProjects(currentUserId, token); // Предполагаем, что getProjects определена в api.js или импортирована
        const tasksData = await getTasks(currentUserId, token); // Предполагаем, что getTasks определена в api.js или импортирована

        const projectsCount = projectsData.projects ? projectsData.projects.length : 0;
        const tasks = tasksData.tasks || [];

        const tasksTodo = tasks.filter(t => t.status === 'todo').length;
        const tasksProgress = tasks.filter(t => t.status === 'in_progress').length;
        const tasksDone = tasks.filter(t => t.status === 'done').length;

        document.getElementById('projects-count').textContent = projectsCount;
        document.getElementById('tasks-todo-count').textContent = tasksTodo;
        document.getElementById('tasks-progress-count').textContent = tasksProgress;
        document.getElementById('tasks-done-count').textContent = tasksDone;

        const container = document.getElementById('dashboard-projects-list');
        if (projectsData.projects && projectsData.projects.length > 0) {
            container.innerHTML = projectsData.projects.map(member => {
                const project = member.project;
                const stats = project.stats || { tasks_count: 0, tasks_done: 0 };
                const progress = stats.tasks_count > 0 ? Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;
                return `
                    <div class="project-card mb-2 p-2" onclick="openProject('${project.hash}')">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">${project.title}</h6>
                            <span class="badge bg-${member.role === 'owner' ? 'primary' : 'secondary'}">${member.role}</span>
                        </div>
                        <div class="progress mb-1" style="height: 8px;">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                        <small class="text-muted">${progress}% завершено (${stats.tasks_done}/${stats.tasks_count})</small>
                    </div>
                `;
            }).join('');
        } else {
            container.innerHTML = '<p class="text-muted">Нет проектов для отображения.</p>';
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
        document.getElementById('projects-count').textContent = '0';
        document.getElementById('tasks-todo-count').textContent = '0';
        document.getElementById('tasks-progress-count').textContent = '0';
        document.getElementById('tasks-done-count').textContent = '0';
        document.getElementById('dashboard-projects-list').innerHTML = '<p class="text-muted">Ошибка загрузки данных.</p>';
    }
}
