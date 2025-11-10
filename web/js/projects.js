class ProjectsManager {
    static allProjects = [];

    static async loadProjects() {
        Utils.log('Loading projects from API');

        try {
            const data = await ApiService.apiGetUserProjects();
            // ИСПРАВЛЕНО: Универсальная обработка структуры ответа
            this.allProjects = Array.isArray(data.projects) ? data.projects :
                             Array.isArray(data) ? data : [];
            this.renderProjects(this.allProjects);
            Utils.log('Projects loaded successfully', { count: this.allProjects.length });
        } catch (error) {
            Utils.logError('Projects load error', error);
            ToastManager.showToast('Ошибка загрузки проектов: ' + error.message, 'error');
            this.renderError();
        }
    }

    static renderProjects(projects) {
        const container = document.getElementById('projects-list');

        if (projects.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }

        container.innerHTML = projects.map(member => this.renderProjectCard(member)).join('');
    }

    static renderProjectCard(member) {
        // ИСПРАВЛЕНО: Универсальная обработка структуры проекта
        const project = member.project || member;
        const role = member.role || 'member';
        const stats = project.stats || { tasks_count: 0, tasks_done: 0 };
        const progress = stats.tasks_count > 0 ? Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;

        return `
            <div class="project-card max-card mb-3" onclick="ProjectsManager.openProjectDetail('${project.hash}')">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0">${Utils.escapeHTML(project.title)}</h6>
                    <span class="badge bg-${role === 'owner' ? 'primary' : role === 'admin' ? 'info' : 'secondary'}">${role}</span>
                </div>
                <p class="text-muted mb-2">${Utils.escapeHTML(project.description || 'Без описания')}</p>
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <small class="text-muted">Участников: ${project.members ? project.members.length : 0}</small>
                    <small class="text-muted">Задач: ${stats.tasks_count || 0}</small>
                </div>
                <div class="progress mb-2" style="height: 8px;">
                    <div class="progress-bar" style="width: ${progress}%"></div>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${progress}% завершено</small>
                    <button class="btn btn-outline-secondary btn-sm" onclick="event.stopPropagation(); ProjectsManager.showProjectInviteQR('${project.hash}')">
                        <i class="fas fa-share-alt"></i>
                    </button>
                </div>
            </div>`;
    }

    static getEmptyStateHTML() {
        return `
            <div class="max-card text-center">
                <i class="fas fa-folder-open fa-2x text-muted mb-3"></i>
                <h6>Проектов пока нет</h6>
                <p class="text-muted">Создайте свой первый проект!</p>
                <button class="btn max-btn-primary" onclick="ProjectsManager.createProject()">
                    <i class="fas fa-plus"></i> Создать проект
                </button>
            </div>`;
    }

    static renderError() {
        document.getElementById('projects-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить проекты</p>
                <button class="btn max-btn-primary btn-sm" onclick="ProjectsManager.loadProjects()">
                    <i class="fas fa-refresh"></i> Попробовать снова
                </button>
            </div>`;
    }

    static async createProject() {
        const title = prompt('Введите название проекта:');
        if (!title) {
            Utils.log('Project creation cancelled - no title');
            return;
        }

        const description = prompt('Введите описание проекта (необязательно):') || '';
        const isPrivate = confirm('Сделать проект приватным?');
        const requiresApproval = confirm('Требовать одобрение для присоединения?');

        try {
            Utils.log(`Creating project: "${title}"`);

            const projectData = {
                title: title,
                description: description,
                is_private: isPrivate,
                requires_approval: requiresApproval
            };

            const result = await ApiService.apiCreateProject(projectData);

            if (result && result.project) {
                ToastManager.showToast(`Проект "${result.project.title}" создан!`, 'success');
                Utils.log('Project created successfully', result);

                // Обновляем интерфейс
                await this.loadProjects();
                if (UI.currentSection === 'dashboard') {
                    await DashboardManager.loadDashboardData();
                }
            } else {
                throw new Error('Не удалось создать проект');
            }
        } catch (error) {
            Utils.logError('Project creation error', error);
            ToastManager.showToast('Ошибка при создании проекта: ' + error.message, 'error');
        }
    }

    static async openProjectDetail(projectHash) {
        try {
            Utils.log(`Opening project detail: ${projectHash}`);
            const projectData = await ApiService.apiGetProjectByHash(projectHash);
            this.showProjectModal(projectData);
        } catch (error) {
            Utils.logError('Error opening project detail', error);
            ToastManager.showToast('Ошибка загрузки проекта: ' + error.message, 'error');
        }
    }

    static showProjectModal(projectData) {
        const project = projectData.project || projectData;
        const members = project.members || [];
        const stats = project.stats || { tasks_count: 0, tasks_done: 0 };
        const progress = stats.tasks_count > 0 ? Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;

        // Проверяем права пользователя
        const currentUserMember = members.find(m => m.user_id === AuthManager.getCurrentUserId());
        const canManageRequests = currentUserMember && (currentUserMember.role === 'owner' || currentUserMember.role === 'admin');
        const isOwner = currentUserMember && currentUserMember.role === 'owner';

        const modalHTML = `
            <div class="modal fade" id="projectModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${Utils.escapeHTML(project.title)}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <h6>Описание</h6>
                                <p class="text-muted">${Utils.escapeHTML(project.description || 'Без описания')}</p>
                            </div>

                            <div class="row mb-3">
                                <div class="col-6">
                                    <div class="stats-card">
                                        <i class="fas fa-tasks fa-2x mb-2" style="color: var(--primary-color);"></i>
                                        <h5>${stats.tasks_count || 0}</h5>
                                        <p class="text-muted mb-0">Всего задач</p>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="stats-card">
                                        <i class="fas fa-check-circle fa-2x mb-2" style="color: var(--success-color);"></i>
                                        <h5>${progress}%</h5>
                                        <p class="text-muted mb-0">Прогресс</p>
                                    </div>
                                </div>
                            </div>

                            <div class="mb-3">
                                <h6>Участники (${members.length})</h6>
                                <div class="d-flex flex-wrap gap-2">
                                    ${members.map(member => `
                                        <span class="badge bg-light text-dark">
                                            ${Utils.escapeHTML(member.user?.full_name || 'Неизвестный')}
                                            ${member.role === 'owner' ? ' 👑' : member.role === 'admin' ? ' ⚡' : ''}
                                        </span>
                                    `).join('')}
                                </div>
                            </div>

                            <div class="d-grid gap-2">
                                <button class="btn max-btn-primary" onclick="ProjectsManager.showProjectTasks('${project.hash}')">
                                    <i class="fas fa-tasks"></i> Просмотреть задачи
                                </button>
                                <button class="btn btn-outline-primary" onclick="ProjectsManager.showProjectInviteQR('${project.hash}')">
                                    <i class="fas fa-share-alt"></i> Пригласить участников
                                </button>
                                ${canManageRequests ? `
                                    <button class="btn btn-outline-info" onclick="ProjectsManager.showJoinRequests('${project.hash}')">
                                        <i class="fas fa-user-plus"></i> Запросы на присоединение
                                    </button>
                                ` : ''}
                                ${isOwner ? `
                                    <button class="btn btn-outline-warning" onclick="ProjectsManager.regenerateInviteHash('${project.hash}')">
                                        <i class="fas fa-refresh"></i> Обновить ссылку
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        const existingModal = document.getElementById('projectModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('projectModal'));
        modal.show();
    }

    static async showProjectTasks(projectHash) {
        try {
            const tasksData = await ApiService.apiGetProjectTasks(projectHash);
            this.showTasksModal(tasksData.tasks || [], `Задачи проекта`);
        } catch (error) {
            Utils.logError('Error loading project tasks', error);
            ToastManager.showToast('Ошибка загрузки задач проекта: ' + error.message, 'error');
        }
    }

    static showTasksModal(tasks, title) {
        const modalHTML = `
            <div class="modal fade" id="tasksModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${tasks.length === 0 ? `
                                <div class="text-center text-muted">
                                    <i class="fas fa-tasks fa-3x mb-3"></i>
                                    <p>Задач пока нет</p>
                                </div>
                            ` : tasks.map(task => `
                                <div class="task-item task-${task.status} max-card mb-2" onclick="TasksManager.openTaskDetail(${task.id})">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div class="flex-grow-1">
                                            <h6 class="mb-1">${Utils.escapeHTML(task.title)}</h6>
                                            <p class="text-muted small mb-1">${Utils.escapeHTML(task.description || '')}</p>
                                            <div class="d-flex align-items-center">
                                                <span class="badge bg-${Utils.getStatusColor(task.status)} me-2">${Utils.getStatusText(task.status)}</span>
                                                <span class="badge bg-${Utils.getPriorityColor(task.priority)} me-2">${task.priority}</span>
                                                <span class="text-muted small">${Utils.formatDate(task.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>`;

        const existingModal = document.getElementById('tasksModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('tasksModal'));
        modal.show();
    }

    static showProjectInviteQR(projectHash) {
        const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${projectHash}`;

        const modalHTML = `
            <div class="modal fade" id="qrModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Пригласить в проект</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center">
                            <p>Отсканируйте QR-код для присоединения к проекту:</p>
                            <div id="qrCodeContainer" class="mb-3"></div>
                            <div class="input-group mb-3">
                                <input type="text" class="form-control" value="${inviteUrl}" id="inviteUrl" readonly>
                                <button class="btn btn-outline-secondary" type="button" onclick="ProjectsManager.copyInviteUrl()">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                            <button class="btn max-btn-primary" onclick="ProjectsManager.shareProject('${project.hash}')">
                                <i class="fas fa-share"></i> Поделиться
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;

        const existingModal = document.getElementById('qrModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('qrModal'));

        modal.show();
        document.getElementById('qrModal').addEventListener('shown.bs.modal', function () {
            const container = document.getElementById('qrCodeContainer');
            container.innerHTML = '';
            new QRCode(container, {
                text: inviteUrl,
                width: 200,
                height: 200,
                colorDark: UI.currentTheme === 'dark' ? '#ffffff' : '#000000',
                colorLight: UI.currentTheme === 'dark' ? '#343d55' : '#ffffff'
            });
        });
    }

    static copyInviteUrl() {
        const input = document.getElementById('inviteUrl');
        input.select();
        document.execCommand('copy');
        ToastManager.showToast('Ссылка скопирована в буфер обмена', 'success');
    }

    static shareProject(projectHash) {
        const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${projectHash}`;
        const shareText = `Присоединяйтесь к моему проекту в MAX Project Pilot!`;

        if (AuthManager.isMaxEnvironment) {
            try {
                window.WebApp.shareContent(shareText, inviteUrl);
            } catch (error) {
                Utils.logError('Share content error', error);
                navigator.clipboard.writeText(inviteUrl);
                ToastManager.showToast('Ссылка скопирована в буфер обмена', 'success');
            }
        } else {
            if (navigator.share) {
                navigator.share({
                    title: shareText,
                    url: inviteUrl
                });
            } else {
                navigator.clipboard.writeText(inviteUrl);
                ToastManager.showToast('Ссылка скопирована в буфер обмена', 'success');
            }
        }
    }

    static async regenerateInviteHash(projectHash) {
        try {
            const result = await ApiService.apiRegenerateProjectInvite(projectHash);
            ToastManager.showToast('Ссылка приглашения обновлена', 'success');

            // Закрываем текущий модал и показываем новый с обновленной ссылкой
            bootstrap.Modal.getInstance(document.getElementById('projectModal'))?.hide();
            setTimeout(() => {
                this.showProjectInviteQR(projectHash);
            }, 300);
        } catch (error) {
            Utils.logError('Error regenerating invite hash', error);
            ToastManager.showToast('Ошибка обновления ссылки: ' + error.message, 'error');
        }
    }

    static async showJoinRequests(projectHash) {
        try {
            const requests = await ApiService.apiGetProjectJoinRequests(projectHash);
            this.showJoinRequestsModal(requests, projectHash);
        } catch (error) {
            Utils.logError('Error loading join requests', error);
            ToastManager.showToast('Ошибка загрузки запросов на присоединение: ' + error.message, 'error');
        }
    }

    static showJoinRequestsModal(requests, projectHash) {
        const modalHTML = `
            <div class="modal fade" id="joinRequestsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Запросы на присоединение</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${requests.length === 0 ? `
                                <div class="text-center text-muted">
                                    <i class="fas fa-inbox fa-3x mb-3"></i>
                                    <p>Запросов на присоединение нет</p>
                                </div>
                            ` : requests.map(request => `
                                <div class="max-card mb-3">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div class="flex-grow-1">
                                            <h6 class="mb-1">${Utils.escapeHTML(request.user?.full_name || 'Пользователь')}</h6>
                                            <p class="text-muted small mb-2">
                                                <i class="fas fa-clock"></i> ${Utils.formatDate(request.created_at)}
                                            </p>
                                            <p class="mb-0">${Utils.escapeHTML(request.message || 'Хочет присоединиться к проекту')}</p>
                                        </div>
                                        <div class="btn-group">
                                            <button class="btn btn-success btn-sm" onclick="ProjectsManager.approveJoinRequest('${projectHash}', ${request.id})">
                                                <i class="fas fa-check"></i> Одобрить
                                            </button>
                                            <button class="btn btn-danger btn-sm" onclick="ProjectsManager.rejectJoinRequest('${projectHash}', ${request.id})">
                                                <i class="fas fa-times"></i> Отклонить
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>`;

        const existingModal = document.getElementById('joinRequestsModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('joinRequestsModal'));
        modal.show();
    }

    static async approveJoinRequest(projectHash, requestId) {
        try {
            await ApiService.apiApproveJoinRequest(projectHash, requestId);
            ToastManager.showToast('Запрос одобрен', 'success');

            // Закрываем модальное окно
            bootstrap.Modal.getInstance(document.getElementById('joinRequestsModal'))?.hide();

            // Обновляем данные проекта
            await this.loadProjects();
        } catch (error) {
            Utils.logError('Error approving join request', error);
            ToastManager.showToast('Ошибка одобрения запроса: ' + error.message, 'error');
        }
    }

    static async rejectJoinRequest(projectHash, requestId) {
        try {
            await ApiService.apiRejectJoinRequest(projectHash, requestId);
            ToastManager.showToast('Запрос отклонен', 'success');

            // Закрываем модальное окно
            bootstrap.Modal.getInstance(document.getElementById('joinRequestsModal'))?.hide();
        } catch (error) {
            Utils.logError('Error rejecting join request', error);
            ToastManager.showToast('Ошибка отклонения запроса: ' + error.message, 'error');
        }
    }

    // Поиск проектов
    static searchProjects() {
        const searchInput = document.getElementById('searchProjectsInput');
        const query = searchInput.value.trim();

        if (!query) {
            this.loadProjects();
            return;
        }

        ToastManager.showToast(`Поиск проектов: "${query}"`, 'info');

        const searchResults = this.allProjects.filter(projectMember => {
            const project = projectMember.project;
            const searchLower = query.toLowerCase();

            return project.title.toLowerCase().includes(searchLower) ||
                   (project.description && project.description.toLowerCase().includes(searchLower)) ||
                   projectMember.role.toLowerCase().includes(searchLower);
        });

        this.displayProjectSearchResults(searchResults, query);
    }

    static displayProjectSearchResults(results, query) {
        const container = document.getElementById('projects-list');

        if (results.length === 0) {
            container.innerHTML = `
                <div class="max-card text-center">
                    <i class="fas fa-search fa-2x text-muted mb-3"></i>
                    <h6>Проекты не найдены</h6>
                    <p class="text-muted">По запросу "${Utils.escapeHTML(query)}" ничего не найдено</p>
                    <button class="btn max-btn-primary btn-sm" onclick="ProjectsManager.clearProjectSearch()">
                        <i class="fas fa-times"></i> Очистить поиск
                    </button>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="mb-0">Найдено проектов: ${results.length}</h6>
                <button class="btn btn-outline-secondary btn-sm" onclick="ProjectsManager.clearProjectSearch()">
                    <i class="fas fa-times"></i> Очистить поиск
                </button>
            </div>
            ${results.map(member => this.renderProjectCard(member)).join('')}
        `;
    }

    static clearProjectSearch() {
        const searchInput = document.getElementById('searchProjectsInput');
        searchInput.value = '';
        this.loadProjects();
    }
}

window.ProjectsManager = ProjectsManager;
