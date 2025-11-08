// web/js/projects.js
// import { getProjects, createProject } from './api.js'; // Если используем ES6 modules

async function loadProjects() {
    if (!currentUserId) {
        document.getElementById('projects-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Необходима авторизация</h6>
                <p class="text-muted">Для просмотра проектов войдите в систему</p>
            </div>`;
        return;
    }
    const token = localStorage.getItem('access_token');
    try {
        const data = await getProjects(currentUserId, token); // Предполагаем, что getProjects определена в api.js или импортирована
        const container = document.getElementById('projects-list');

        if (!data.projects || data.projects.length === 0) {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-folder-open fa-2x text-muted mb-3"></i>
                    <h6>Проектов пока нет</h6>
                    <p class="text-muted">Создайте свой первый проект!</p>
                    <button class="btn max-btn-primary" onclick="createProject()"><i class="fas fa-plus"></i> Создать проект</button>
                </div>`;
            return;
        }

        container.innerHTML = data.projects.map(member => {
            const project = member.project;
            const stats = project.stats || { tasks_count: 0, tasks_done: 0 };
            const progress = stats.tasks_count > 0 ? Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;
            return `
                <div class="project-card max-card" onclick="openProject('${project.hash}')">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="mb-0">${project.title}</h6>
                        <span class="badge bg-${member.role === 'owner' ? 'primary' : 'secondary'}">${member.role}</span>
                    </div>
                    <p class="text-muted mb-1">${project.description || 'Без описания'}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">Участников: ${project.members ? project.members.length : 0}</small>
                        <small class="text-muted">Задач: ${stats.tasks_count}</small>
                    </div>
                    <div class="progress mt-2" style="height: 8px;">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <small class="text-muted">${progress}% завершено</small>
                </div>`;
        }).join('');

    } catch (error) {
        console.error('Projects load error:', error);
        document.getElementById('projects-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить проекты</p>
            </div>`;
    }
}

async function createProject() {
    if (!currentUserId) {
        alert('Необходима авторизация для создания проекта');
        return;
    }
    const title = prompt('Введите название проекта:');
    if (!title) return;
    const description = prompt('Введите описание проекта (необязательно):') || '';

    const token = localStorage.getItem('access_token');
    try {
        const result = await createProject(title, description, token); // Предполагаем, что createProject определена в api.js или импортирована
        alert(`Проект "${result.project.title}" создан!`);
        if (currentSection === 'projects') {
            await loadProjects();
        }
        await loadDashboardData(); // Обновить счётчики
    } catch (error) {
        console.error('Project creation error:', error);
        alert('Ошибка при создании проекта: ' + error.message);
    }
}

function openProject(projectHash) {
    // Здесь можно открыть модальное окно с деталями проекта или перейти на страницу проекта
    // Пока просто покажем QR-код для приглашения
    showProjectInviteQR(projectHash);
}

function showProjectInviteQR(projectHash) {
    const inviteUrl = `${window.location.origin}/?join=${projectHash}`;
    const modal = new bootstrap.Modal(document.createElement('div'));
    const modalHTML = `
        <div class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Пригласить в проект</h5>
                        <button type="button" class="btn-close" onclick="this.closest('.modal').remove()"></button>
                    </div>
                    <div class="modal-body text-center">
                        <p>Отправьте этот QR-код пользователю:</p>
                        <div id="qrCodeContainer"></div>
                        <p class="mt-2">Или поделитесь ссылкой: <code>${inviteUrl}</code></p>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalElement = document.querySelector('.modal.show');
    new QRCode(document.getElementById('qrCodeContainer'), { text: inviteUrl, width: 200, height: 200 });
    modalElement.querySelector('.btn-close').addEventListener('click', () => modalElement.remove());
}
