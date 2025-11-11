class ProjectsManager {
    static allProjects = [];

    static async loadProjects() {
        Utils.log('Loading projects from API');

        try {
            const data = await ApiService.apiGetUserProjects();
            this.allProjects = data.projects || [];
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
        const project = member.project || member;
        const role = member.role || 'member';
        const stats = project.stats || { tasks_count: 0, tasks_done: 0, user_tasks: 0 };
        const progress = stats.tasks_count > 0 ? Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;
        const membersCount = project.members ? project.members.length : 0;

        return `
            <div class="project-card max-card" data-project-id="${project.id}" data-project-hash="${project.hash}">
                <div class="swipe-action delete">
                    <i class="fas fa-trash"></i> Удалить
                </div>
                <div class="swipe-action edit">
                    <i class="fas fa-edit"></i> Редактировать
                </div>
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0 flex-grow-1">${Utils.escapeHTML(project.title)}</h6>
                    <span class="role-badge role-${role}">${this.getRoleText(role)}</span>
                </div>
                <p class="text-muted small mb-2">${Utils.escapeHTML(project.description || 'Без описания')}</p>

                <div class="row small text-muted mb-2">
                    <div class="col-6">
                        <i class="fas fa-users"></i> ${membersCount} участников
                    </div>
                    <div class="col-6">
                        <i class="fas fa-tasks"></i> ${stats.tasks_count || 0} задач
                    </div>
                </div>

                <div class="row small text-muted mb-2">
                    <div class="col-6">
                        <i class="fas fa-user-check"></i> ${stats.user_tasks || 0} ваших
                    </div>
                    <div class="col-6 text-end">
                        ${progress}% завершено
                    </div>
                </div>

                <div class="progress mb-2" style="height: 6px;">
                    <div class="progress-bar" style="width: ${progress}%"></div>
                </div>

                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${this.getProjectStatus(project)}</small>
                    ${(role === 'owner' || role === 'admin') ? `
                        <button class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); ProjectsManager.showInviteDialog('${project.hash}')">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    ` : ''}
                </div>
            </div>`;
    }

    static getRoleText(role) {
        const roles = {
            'owner': 'Владелец',
            'admin': 'Админ',
            'member': 'Участник'
        };
        return roles[role] || role;
    }

    static getProjectStatus(project) {
        if (project.is_private) {
            return project.requires_approval ? '🔒 Приватный (требует одобрения)' : '🔒 Приватный';
        }
        return '🌐 Публичный';
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

    static createProject() {
        this.showCreateProjectModal();
    }

    static showCreateProjectModal() {
        const modalHTML = `
            <div class="modal fade" id="createProjectModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Создать новый проект</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="createProjectForm">
                                <div class="mb-3">
                                    <label class="form-label">Название проекта *</label>
                                    <input type="text" class="form-control" id="projectTitle" required
                                           placeholder="Введите название проекта">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Описание</label>
                                    <textarea class="form-control" id="projectDescription" rows="3"
                                              placeholder="Введите описание проекта (необязательно)"></textarea>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" id="projectIsPrivate" checked>
                                        <label class="form-check-label" for="projectIsPrivate">
                                            Приватный проект
                                        </label>
                                        <div class="form-text">Только приглашенные пользователи смогут увидеть проект</div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" id="projectRequiresApproval">
                                        <label class="form-check-label" for="projectRequiresApproval">
                                            Требовать одобрение для присоединения
                                        </label>
                                        <div class="form-text">Новые участники должны быть одобрены владельцем/админом</div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                            <button type="button" class="btn max-btn-primary" onclick="ProjectsManager.submitCreateProjectForm()">
                                <i class="fas fa-plus"></i> Создать проект
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;

        const existingModal = document.getElementById('createProjectModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('createProjectModal'));
        modal.show();

        setTimeout(() => {
            document.getElementById('projectTitle').focus();
        }, 500);
    }

    static async submitCreateProjectForm() {
        const title = document.getElementById('projectTitle').value.trim();
        const description = document.getElementById('projectDescription').value.trim();
        const isPrivate = document.getElementById('projectIsPrivate').checked;
        const requiresApproval = document.getElementById('projectRequiresApproval').checked;

        if (!title) {
            ToastManager.showToast('Введите название проекта', 'warning');
            document.getElementById('projectTitle').focus();
            return;
        }

        try {
            const projectData = {
                title: title,
                description: description,
                is_private: isPrivate,
                requires_approval: requiresApproval
            };

            const result = await ApiService.apiCreateProject(projectData);

            if (result && result.project) {
                ToastManager.showToast(`Проект "${result.project.title}" создан!`, 'success');
                bootstrap.Modal.getInstance(document.getElementById('createProjectModal')).hide();
                await this.loadProjects();
            }
        } catch (error) {
            Utils.logError('Project creation error', error);
            ToastManager.showToast('Ошибка при создании проекта: ' + error.message, 'error');
        }
    }

    static editProject(projectId) {
        const project = this.allProjects.find(p => p.project.id == projectId || p.id == projectId);
        if (project) {
            this.showEditProjectModal(project);
        }
    }

    static showEditProjectModal(project) {
        const projectData = project.project || project;

        const modalHTML = `
            <div class="modal fade" id="editProjectModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Редактировать проект</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editProjectForm">
                                <div class="mb-3">
                                    <label class="form-label">Название проекта *</label>
                                    <input type="text" class="form-control" id="editProjectTitle" required
                                           value="${Utils.escapeHTML(projectData.title)}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Описание</label>
                                    <textarea class="form-control" id="editProjectDescription" rows="3">${Utils.escapeHTML(projectData.description || '')}</textarea>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" id="editProjectIsPrivate" ${projectData.is_private ? 'checked' : ''}>
                                        <label class="form-check-label" for="editProjectIsPrivate">
                                            Приватный проект
                                        </label>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <div class="form-check form-switch">
                                        <input class="form-check-input" type="checkbox" id="editProjectRequiresApproval" ${projectData.requires_approval ? 'checked' : ''}>
                                        <label class="form-check-label" for="editProjectRequiresApproval">
                                            Требовать одобрение для присоединения
                                        </label>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                            <button type="button" class="btn max-btn-primary" onclick="ProjectsManager.submitEditProjectForm('${projectData.hash}')">
                                <i class="fas fa-save"></i> Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;

        const existingModal = document.getElementById('editProjectModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('editProjectModal'));
        modal.show();
    }

    static async submitEditProjectForm(projectHash) {
        const title = document.getElementById('editProjectTitle').value.trim();
        const description = document.getElementById('editProjectDescription').value.trim();
        const isPrivate = document.getElementById('editProjectIsPrivate').checked;
        const requiresApproval = document.getElementById('editProjectRequiresApproval').checked;

        if (!title) {
            ToastManager.showToast('Введите название проекта', 'warning');
            return;
        }

        try {
            const updateData = {
                title: title,
                description: description,
                is_private: isPrivate,
                requires_approval: requiresApproval
            };

            await ApiService.apiUpdateProject(projectHash, updateData);
            ToastManager.showToast('Проект обновлен!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editProjectModal')).hide();
            await this.loadProjects();
        } catch (error) {
            Utils.logError('Project update error', error);
            ToastManager.showToast('Ошибка при обновлении проекта: ' + error.message, 'error');
        }
    }

    static deleteProjectWithConfirmation(projectId) {
        const project = this.allProjects.find(p => p.project.id == projectId || p.id == projectId);
        if (project) {
            const projectData = project.project || project;

            if (confirm(`Вы уверены, что хотите удалить проект "${projectData.title}"? Все связанные задачи также будут удалены.`)) {
                this.deleteProject(projectData.hash);
            }
        }
    }

    static async deleteProject(projectHash) {
        try {
            await ApiService.apiDeleteProject(projectHash);
            ToastManager.showToast('Проект удален', 'success');
            await this.loadProjects();
        } catch (error) {
            Utils.logError('Project deletion error', error);
            ToastManager.showToast('Ошибка при удалении проекта: ' + error.message, 'error');
        }
    }

    static showInviteDialog(projectHash) {
        const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${projectHash}`;

        if (navigator.share) {
            navigator.share({
                title: 'Присоединяйтесь к моему проекту в Project Pilot!',
                url: inviteUrl
            });
        } else {
            navigator.clipboard.writeText(inviteUrl);
            ToastManager.showToast('Ссылка скопирована в буфер обмена', 'success');
        }
    }

    static async openProjectDetail(projectHash) {
        try {
            const projectData = await ApiService.apiGetProjectByHash(projectHash);
            this.showProjectDetailModal(projectData);
        } catch (error) {
            Utils.logError('Error opening project detail', error);
            ToastManager.showToast('Ошибка загрузки проекта: ' + error.message, 'error');
        }
    }

    static showProjectDetailModal(projectData) {
        const project = projectData.project || projectData;
        const currentUserMember = project.members.find(m => m.user_id === AuthManager.getCurrentUserId());
        const isOwnerOrAdmin = currentUserMember && (currentUserMember.role === 'owner' || currentUserMember.role === 'admin');

        const modalHTML = `
            <div class="modal fade" id="projectDetailModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${Utils.escapeHTML(project.title)}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <p class="text-muted">${Utils.escapeHTML(project.description || 'Без описания')}</p>
                            </div>

                            <div class="row mb-3">
                                <div class="col-6">
                                    <strong>Статус:</strong> ${this.getProjectStatus(project)}
                                </div>
                                <div class="col-6">
                                    <strong>Участников:</strong> ${project.members ? project.members.length : 0}
                                </div>
                            </div>

                            ${isOwnerOrAdmin ? `
                                <div class="mb-3">
                                    <button class="btn btn-outline-primary btn-sm" onclick="ProjectsManager.showMembersManagement('${project.hash}')">
                                        <i class="fas fa-users"></i> Управление участниками
                                    </button>
                                </div>
                            ` : ''}

                            <div class="mb-3">
                                <div class="d-flex justify-content-between align-items-center">
                                    <h6>Задачи проекта</h6>
                                    ${isOwnerOrAdmin ? `
                                        <button class="btn max-btn-primary btn-sm" onclick="TasksManager.createTaskModal('${project.hash}')">
                                            <i class="fas fa-plus"></i> Новая задача
                                        </button>
                                    ` : ''}
                                </div>
                                <div id="projectTasksList">
                                    <!-- Tasks will be loaded here -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        const existingModal = document.getElementById('projectDetailModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Load project tasks
        this.loadProjectTasks(project.hash);

        const modal = new bootstrap.Modal(document.getElementById('projectDetailModal'));
        modal.show();
    }

    static async loadProjectTasks(projectHash) {
        try {
            const tasksData = await ApiService.apiGetProjectTasks(projectHash);
            const tasks = tasksData.tasks || [];
            this.renderProjectTasks(tasks);
        } catch (error) {
            Utils.logError('Error loading project tasks', error);
            document.getElementById('projectTasksList').innerHTML = '<p class="text-muted">Ошибка загрузки задач</p>';
        }
    }

    static renderProjectTasks(tasks) {
        const container = document.getElementById('projectTasksList');

        if (tasks.length === 0) {
            container.innerHTML = '<p class="text-muted">Задач пока нет</p>';
            return;
        }

        container.innerHTML = tasks.map(task => TasksManager.renderTaskCard(task)).join('');
    }

    static async showMembersManagement(projectHash) {
        try {
            const projectData = await ApiService.apiGetProjectByHash(projectHash);
            this.showMembersModal(projectData);
        } catch (error) {
            Utils.logError('Error loading members', error);
            ToastManager.showToast('Ошибка загрузки участников', 'error');
        }
    }

    static showMembersModal(projectData) {
        const project = projectData.project || projectData;
        const currentUserMember = project.members.find(m => m.user_id === AuthManager.getCurrentUserId());
        const isOwner = currentUserMember && currentUserMember.role === 'owner';

        const modalHTML = `
            <div class="modal fade" id="membersModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Участники проекта</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div id="membersList">
                                ${project.members.map(member => `
                                    <div class="member-item max-card mb-2" data-member-id="${member.user_id}">
                                        <div class="swipe-action delete">
                                            <i class="fas fa-trash"></i> Удалить
                                        </div>
                                        <div class="swipe-action edit">
                                            <i class="fas fa-edit"></i> Роль
                                        </div>
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div>
                                                <strong>${Utils.escapeHTML(member.user?.full_name || 'Пользователь')}</strong>
                                                <span class="role-badge role-${member.role} ms-2">${this.getRoleText(member.role)}</span>
                                            </div>
                                            ${(isOwner && member.role !== 'owner') ? `
                                                <div class="dropdown">
                                                    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                                        <i class="fas fa-cog"></i>
                                                    </button>
                                                    <ul class="dropdown-menu">
                                                        <li><a class="dropdown-item" href="#" onclick="ProjectsManager.changeMemberRole('${project.hash}', '${member.user_id}', 'admin')">Сделать админом</a></li>
                                                        <li><a class="dropdown-item" href="#" onclick="ProjectsManager.changeMemberRole('${project.hash}', '${member.user_id}', 'member')">Сделать участником</a></li>
                                                        ${member.role === 'owner' ? `
                                                            <li><a class="dropdown-item" href="#" onclick="ProjectsManager.transferOwnership('${project.hash}', '${member.user_id}')">Передать владение</a></li>
                                                        ` : ''}
                                                        <li><hr class="dropdown-divider"></li>
                                                        <li><a class="dropdown-item text-danger" href="#" onclick="ProjectsManager.removeMember('${project.hash}', '${member.user_id}')">Удалить из проекта</a></li>
                                                    </ul>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        const existingModal = document.getElementById('membersModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('membersModal'));
        modal.show();
    }

    static async changeMemberRole(projectHash, userId, newRole) {
        try {
            // Здесь должен быть API вызов для изменения роли
            ToastManager.showToast('Роль участника изменена', 'success');
            bootstrap.Modal.getInstance(document.getElementById('membersModal')).hide();
        } catch (error) {
            Utils.logError('Error changing member role', error);
            ToastManager.showToast('Ошибка изменения роли', 'error');
        }
    }

    static async removeMember(projectHash, userId) {
        if (confirm('Вы уверены, что хотите удалить этого участника из проекта?')) {
            try {
                // Здесь должен быть API вызов для удаления участника
                ToastManager.showToast('Участник удален из проекта', 'success');
                bootstrap.Modal.getInstance(document.getElementById('membersModal')).hide();
            } catch (error) {
                Utils.logError('Error removing member', error);
                ToastManager.showToast('Ошибка удаления участника', 'error');
            }
        }
    }

    static async transferOwnership(projectHash, newOwnerId) {
        if (confirm('Вы уверены, что хотите передать владение проектом этому участнику?')) {
            try {
                // Здесь должен быть API вызов для передачи владения
                ToastManager.showToast('Владение проектом передано', 'success');
                bootstrap.Modal.getInstance(document.getElementById('membersModal')).hide();
                await this.loadProjects();
            } catch (error) {
                Utils.logError('Error transferring ownership', error);
                ToastManager.showToast('Ошибка передачи владения', 'error');
            }
        }
    }
}

window.ProjectsManager = ProjectsManager;
