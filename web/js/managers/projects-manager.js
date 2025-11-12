// Менеджер проектов
class ProjectsManager {
    static async loadProjects() {
        try {
            StateManager.setLoading(true);
            const data = await CacheManager.getWithCache(
                'projects',
                () => ApiService.getProjects(),
                'projects'
            );
            const projects = data.projects || [];
            StateManager.setState('projects', projects);
            EventManager.emit(APP_EVENTS.PROJECTS_LOADED, projects);
            Utils.log('Projects loaded successfully', { count: projects.length });
            return projects;
        } catch (error) {
            Utils.logError('Projects load error:', error);
            EventManager.emit(APP_EVENTS.DATA_ERROR, error);
            throw error;
        } finally {
            StateManager.setLoading(false);
        }
    }

    // Защита от перезагрузки при GET-параметрах
    static clearUrlParams() {
        if (window.location.search.includes('title=')) {
            const url = new URL(window.location);
            url.search = '';
            window.history.replaceState({}, '', url);
        }
    }

    static showCreateProjectModal() {
        // Очищаем URL от параметров формы
        this.clearUrlParams();

        ModalManager.showModal('create-project', {
            title: 'Создание проекта',
            size: 'medium',
            template: `
                <form id="create-project-form">
                    <div class="form-group">
                        <label for="project-title" class="form-label">Название проекта *</label>
                        <input type="text" class="form-control" id="project-title" name="title" required
                               placeholder="Введите название проекта">
                    </div>
                    <div class="form-group">
                        <label for="project-description" class="form-label">Описание</label>
                        <textarea class="form-control" id="project-description" name="description" rows="3"
                                  placeholder="Опишите ваш проект (необязательно)"></textarea>
                    </div>
                    <div class="form-group">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="project-private" name="is_private" checked>
                            <label class="form-check-label" for="project-private">
                                Приватный проект
                            </label>
                            <div class="form-text">
                                Только приглашенные пользователи смогут увидеть проект
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="project-approval" name="requires_approval">
                            <label class="form-check-label" for="project-approval">
                                Требовать одобрение для присоединения
                            </label>
                            <div class="form-text">
                                Новые участники должны быть одобрены владельцем/админом
                            </div>
                        </div>
                    </div>
                </form>
            `,
            actions: [
                {
                    text: 'Отмена',
                    type: 'secondary',
                    action: 'close'
                },
                {
                    text: 'Создать проект',
                    type: 'primary',
                    action: 'submit',
                    onClick: () => this.handleCreateProjectSubmit()
                }
            ],
            onShow: () => {
                const form = document.getElementById('create-project-form');
                if (form) {
                    form.addEventListener('submit', (e) => {
                        e.preventDefault();
                        this.handleCreateProjectSubmit();
                    });
                }
            }
        });
    }

    static async handleCreateProjectSubmit() {
        const form = document.getElementById('create-project-form');
        if (!form) return;

        const formData = new FormData(form);
        const title = formData.get('title')?.toString().trim();
        const description = formData.get('description')?.toString().trim();
        const isPrivate = !!formData.get('is_private');
        const requiresApproval = !!formData.get('requires_approval');

        if (!title) {
            ToastManager.error('Введите название проекта');
            document.getElementById('project-title')?.focus();
            return;
        }

        // Блокируем кнопку
        const modal = ModalManager.getCurrentModal?.() || document.querySelector('.modal.show');
        const submitBtn = modal?.querySelector('[data-action="submit"]') || modal?.querySelector('button[type="submit"]');
        const originalText = submitBtn?.innerHTML || 'Создать проект';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание...';
        }

        try {
            const projectData = {
                title,
                description: description || '',
                is_private: isPrivate,
                requires_approval: requiresApproval
            };

            Utils.log('API Call: POST /api/projects/', projectData);
            const result = await ApiService.createProject(projectData);

            // Проверка ответа
            if (!result || !result.project) {
                throw new Error(result?.error || 'Сервер не вернул проект');
            }

            // ДОБАВЛЯЕМ РОЛЬ ВЛАДЕЛЬЦА К ПРОЕКТУ
            const projectWithRole = {
                ...result.project,
                role: 'owner' // Принудительно устанавливаем роль владельца
            };

            ToastManager.success(`Проект "${result.project.title}" создан!`);
            HapticManager.projectCreated();

            // ИСПРАВЛЕНИЕ: ОБНОВЛЯЕМ СПИСОК ПРОЕКТОВ
            await this.loadProjects(); // Загружаем свежий список проектов

            // Инвалидируем кэш
            CacheManager.invalidate('projects');
            CacheManager.invalidate('dashboard');

            EventManager.emit(APP_EVENTS.PROJECT_CREATED, projectWithRole);
            ModalManager.closeCurrentModal();
            form.reset();
        } catch (error) {
            Utils.logError('Project creation error:', error);
            ToastManager.error('Ошибка при создании проекта: ' + (error.message || 'неизвестная ошибка'));
            HapticManager.error();
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    }

    static async openProjectDetail(projectHash) {
        try {
            const projectData = await CacheManager.getWithCache(
                `project-${projectHash}`,
                () => ApiService.getProject(projectHash),
                'projects'
            );
            this.showProjectDetailModal(projectData);
        } catch (error) {
            Utils.logError('Error opening project detail:', error);
            ToastManager.error('Ошибка загрузки проекта');
        }
    }

    static showProjectDetailModal(projectData) {
        const project = projectData.project || projectData;
        const currentUserMember = project.members?.find(m => m.user_id === AuthManager.getCurrentUserId());

        // ИСПРАВЛЕНИЕ: Если проект только что создан, используем роль из данных проекта
        const currentUserRole = project.role || currentUserMember?.role || 'member';
        const canManage = ['owner', 'admin'].includes(currentUserRole);

        ModalManager.showModal('project-detail', {
            title: project.title,
            size: 'large',
            template: `
                <div class="project-detail">
                    <div class="project-info">
                        <p class="project-description">${Utils.escapeHTML(project.description || 'Без описания')}</p>
                        <div class="project-meta">
                            <div class="meta-item">
                                <strong>Статус:</strong> ${UIComponents.getProjectStatus(project)}
                            </div>
                            <div class="meta-item">
                                <strong>Участников:</strong> ${project.members?.length || 0}
                            </div>
                            <div class="meta-item">
                                <strong>Ваша роль:</strong> ${UIComponents.getRoleText(currentUserRole)}
                            </div>
                        </div>
                        ${canManage ? `
                            <div class="project-actions">
                                <button class="btn btn-outline-primary" onclick="ProjectsManager.showMembersManagement('${project.hash}')">
                                    <i class="fas fa-users"></i> Участники
                                </button>
                                <button class="btn btn-outline-secondary" onclick="ProjectsManager.showProjectSettings('${project.hash}')">
                                    <i class="fas fa-cog"></i> Настройки
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    <div class="project-tasks">
                        <div class="tasks-header">
                            <h3>Задачи проекта</h3>
                            ${canManage ? `
                                <button class="btn btn-primary" onclick="TasksManager.showCreateTaskModal('${project.hash}')">
                                    <i class="fas fa-plus"></i> Новая задача
                                </button>
                            ` : ''}
                        </div>
                        <div id="project-tasks-list" class="tasks-list">
                            <!-- Tasks will be loaded here -->
                        </div>
                    </div>
                </div>
            `
        });
        this.loadProjectTasks(project.hash);
    }

    static async loadProjectTasks(projectHash) {
        try {
            const tasksData = await ApiService.getProjectTasks(projectHash);
            const tasks = tasksData.tasks || [];
            this.renderProjectTasks(tasks);
        } catch (error) {
            Utils.logError('Error loading project tasks:', error);
            const container = document.getElementById('project-tasks-list');
            if (container) {
                container.innerHTML = '<p class="text-muted">Ошибка загрузки задач</p>';
            }
        }
    }

    static renderProjectTasks(tasks) {
        const container = document.getElementById('project-tasks-list');
        if (!container) return;
        if (tasks.length === 0) {
            container.innerHTML = '<p class="text-muted">Задач пока нет</p>';
            return;
        }
        container.innerHTML = tasks.map(task =>
            UIComponents.createTaskCard(task)
        ).join('');
    }

    static async editProject(projectHash) {
        try {
            const projectData = await ApiService.getProject(projectHash);
            const project = projectData.project || projectData;
            const currentUserMember = project.members?.find(m => m.user_id === AuthManager.getCurrentUserId());

            // ПРОВЕРКА ПРАВ: только владелец и админ могут редактировать
            if (!currentUserMember || !['owner', 'admin'].includes(currentUserMember.role)) {
                ToastManager.error('Недостаточно прав для редактирования проекта');
                HapticManager.error();
                return;
            }

            this.showEditProjectModal(projectData);
        } catch (error) {
            Utils.logError('Error loading project for edit:', error);
            ToastManager.error('Ошибка загрузки проекта');
        }
    }

    static showEditProjectModal(projectData) {
        const project = projectData.project || projectData;
        ModalManager.showModal('edit-project', {
            title: 'Редактирование проекта',
            size: 'medium',
            template: `
                <form id="edit-project-form">
                    <div class="form-group">
                        <label for="edit-project-title" class="form-label">Название проекта *</label>
                        <input type="text" class="form-control" id="edit-project-title" name="title" required
                               value="${Utils.escapeHTML(project.title)}">
                    </div>
                    <div class="form-group">
                        <label for="edit-project-description" class="form-label">Описание</label>
                        <textarea class="form-control" id="edit-project-description" name="description" rows="3">${Utils.escapeHTML(project.description || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="edit-project-private" name="is_private" ${project.is_private ? 'checked' : ''}>
                            <label class="form-check-label" for="edit-project-private">
                                Приватный проект
                            </label>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="edit-project-approval" name="requires_approval" ${project.requires_approval ? 'checked' : ''}>
                            <label class="form-check-label" for="edit-project-approval">
                                Требовать одобрение для присоединения
                            </label>
                        </div>
                    </div>
                </form>
            `,
            actions: [
                {
                    text: 'Отмена',
                    type: 'secondary',
                    action: 'close'
                },
                {
                    text: 'Сохранить',
                    type: 'primary',
                    action: 'submit',
                    onClick: () => this.handleEditProjectSubmit(project.hash)
                }
            ],
            onShow: () => {
                const form = document.getElementById('edit-project-form');
                if (form) {
                    form.addEventListener('submit', (e) => {
                        e.preventDefault();
                        this.handleEditProjectSubmit(project.hash);
                    });
                }
            }
        });
    }

    static async handleEditProjectSubmit(projectHash) {
        const form = document.getElementById('edit-project-form');
        if (!form) return;

        const formData = new FormData(form);
        const title = formData.get('title')?.toString().trim();
        const description = formData.get('description')?.toString().trim();
        const isPrivate = !!formData.get('is_private');
        const requiresApproval = !!formData.get('requires_approval');

        if (!title) {
            ToastManager.error('Введите название проекта');
            return;
        }

        const modal = ModalManager.getCurrentModal?.() || document.querySelector('.modal.show');
        const submitBtn = modal?.querySelector('[data-action="submit"]') || modal?.querySelector('button[type="submit"]');
        const originalText = submitBtn?.innerHTML || 'Сохранить';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
        }

        try {
            const updateData = {
                title,
                description: description || '',
                is_private: isPrivate,
                requires_approval: requiresApproval
            };

            await ApiService.updateProject(projectHash, updateData);

            ToastManager.success('Проект обновлен!');
            HapticManager.success();

            // ИСПРАВЛЕНИЕ: ОБНОВЛЯЕМ СПИСОК ПРОЕКТОВ
            await this.loadProjects(); // Загружаем свежий список проектов

            // Инвалидируем кэш
            CacheManager.invalidate('projects');
            CacheManager.invalidate(`project-${projectHash}`);

            EventManager.emit(APP_EVENTS.PROJECT_UPDATED, { hash: projectHash, ...updateData });
            ModalManager.closeCurrentModal();
        } catch (error) {
            Utils.logError('Project update error:', error);
            ToastManager.error('Ошибка при обновлении проекта: ' + error.message);
            HapticManager.error();
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    }

    static deleteProjectWithConfirmation(projectHash) {
        const project = StateManager.getProjectByHash(projectHash);
        if (!project) return;

        const projectData = project.project || project;
        const currentUserMember = project.members?.find(m => m.user_id === AuthManager.getCurrentUserId());

        // ПРОВЕРКА ПРАВ: только владелец может удалять
        if (!currentUserMember || currentUserMember.role !== 'owner') {
            ToastManager.error('Только владелец может удалить проект');
            HapticManager.error();
            return;
        }

        ModalManager.showConfirmation({
            title: 'Удаление проекта',
            message: `Вы уверены, что хотите удалить проект "${projectData.title}"? Все связанные задачи также будут удалены.`,
            confirmText: 'Удалить',
            cancelText: 'Отмена',
            type: 'danger',
            onConfirm: () => this.deleteProject(projectHash)
        });
    }

    static async deleteProject(projectHash) {
        try {
            await ApiService.deleteProject(projectHash);

            ToastManager.success('Проект удален');
            HapticManager.projectDeleted();

            // ИСПРАВЛЕНИЕ: ОБНОВЛЯЕМ СПИСОК ПРОЕКТОВ
            await this.loadProjects(); // Загружаем свежий список проектов

            // Инвалидируем кэш
            CacheManager.invalidate('projects');
            CacheManager.invalidate('dashboard');

            EventManager.emit(APP_EVENTS.PROJECT_DELETED, projectHash);

            // Закрываем модальное окно если открыто
            ModalManager.closeCurrentModal();

        } catch (error) {
            Utils.logError('Project deletion error:', error);
            ToastManager.error('Ошибка при удалении проекта: ' + error.message);
            HapticManager.error();
            throw error; // Пробрасываем ошибку дальше для обработки в вызывающем коде
        }
    }

    static showInviteDialog(projectHash) {
        const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${projectHash}`;
        if (navigator.share) {
            navigator.share({
                title: 'Присоединяйтесь к моему проекту в Project Pilot!',
                text: 'Присоединяйтесь к моему проекту для совместной работы над задачами',
                url: inviteUrl
            }).then(() => {
                ToastManager.success('Приглашение отправлено');
            }).catch((error) => {
                Utils.logError('Share error:', error);
                this.copyInviteLink(inviteUrl);
            });
        } else {
            this.copyInviteLink(inviteUrl);
        }
    }

    static copyInviteLink(inviteUrl) {
        navigator.clipboard.writeText(inviteUrl).then(() => {
            ToastManager.success('Ссылка скопирована в буфер обмена');
            HapticManager.success();
        }).catch((error) => {
            Utils.logError('Copy to clipboard error:', error);
            ToastManager.error('Не удалось скопировать ссылку');
        });
    }

    static async showMembersManagement(projectHash) {
        try {
            const projectData = await ApiService.getProject(projectHash);
            this.showMembersModal(projectData);
        } catch (error) {
            Utils.logError('Error loading members:', error);
            ToastManager.error('Ошибка загрузки участников');
        }
    }

    static showMembersModal(projectData) {
        const project = projectData.project || projectData;
        const currentUserMember = project.members?.find(m => m.user_id === AuthManager.getCurrentUserId());
        const isOwner = currentUserMember?.role === 'owner';
        ModalManager.showModal('members-management', {
            title: 'Участники проекта',
            size: 'medium',
            template: `
                <div class="members-management">
                    <div class="members-list">
                        ${project.members?.map(member => `
                            <div class="member-item" data-member-id="${member.user_id}">
                                <div class="member-info">
                                    <div class="member-avatar">
                                        ${Utils.getInitials(member.user?.full_name || 'Пользователь')}
                                    </div>
                                    <div class="member-details">
                                        <h6>${Utils.escapeHTML(member.user?.full_name || 'Пользователь')}</h6>
                                        <span class="role-badge role-${member.role}">
                                            ${UIComponents.getRoleText(member.role)}
                                        </span>
                                    </div>
                                </div>
                                ${isOwner && member.role !== 'owner' ? `
                                    <div class="member-actions">
                                        <button class="btn btn-sm btn-outline-secondary"
                                                onclick="ProjectsManager.showMemberRoleModal('${project.hash}', '${member.user_id}', '${member.role}')">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('') || '<p class="text-muted">Участников нет</p>'}
                    </div>
                    ${isOwner ? `
                        <div class="invite-section">
                            <button class="btn btn-primary" onclick="ProjectsManager.showInviteDialog('${project.hash}')">
                                <i class="fas fa-share-alt"></i> Пригласить участников
                            </button>
                        </div>
                    ` : ''}
                </div>
            `
        });
    }

    static showMemberRoleModal(projectHash, userId, currentRole) {
        ModalManager.showModal('member-role', {
            title: 'Изменение роли участника',
            size: 'small',
            template: `
                <div class="role-selection">
                    <div class="form-group">
                        <label class="form-label">Выберите роль:</label>
                        <select class="form-select" id="member-role-select">
                            <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Админ</option>
                            <option value="member" ${currentRole === 'member' ? 'selected' : ''}>Участник</option>
                        </select>
                    </div>
                </div>
            `,
            actions: [
                {
                    text: 'Отмена',
                    type: 'secondary',
                    action: 'close'
                },
                {
                    text: 'Сохранить',
                    type: 'primary',
                    action: 'submit',
                    onClick: () => this.updateMemberRole(projectHash, userId)
                }
            ]
        });
    }

    static async updateMemberRole(projectHash, userId) {
        const newRole = document.getElementById('member-role-select').value;
        try {
            await ApiService.updateMemberRole(projectHash, userId, newRole);
            ToastManager.success('Роль участника изменена');
            HapticManager.success();
            ModalManager.closeCurrentModal();
            await this.showMembersManagement(projectHash);
        } catch (error) {
            Utils.logError('Error updating member role:', error);
            ToastManager.error('Ошибка изменения роли');
            HapticManager.error();
        }
    }

    static async showProjectSettings(projectHash) {
        try {
            const projectData = await ApiService.getProject(projectHash);
            this.showSettingsModal(projectData);
        } catch (error) {
            Utils.logError('Error loading project settings:', error);
            ToastManager.error('Ошибка загрузки настроек');
        }
    }

    static async getProjectsWithFilters(filters = {}) {
        try {
            // Здесь можно добавить параметры фильтрации к API вызову
            const data = await ApiService.getProjects();
            let projects = data.projects || [];

            // Применяем фильтры локально
            if (filters.status) {
                projects = projects.filter(project => {
                    const stats = project.stats || {};
                    const progress = stats.tasks_count > 0 ?
                        Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;

                    if (filters.status === 'active') return progress < 100;
                    if (filters.status === 'completed') return progress === 100;
                    return true;
                });
            }

            if (filters.role) {
                projects = projects.filter(project => project.role === filters.role);
            }

            // Применяем сортировку
            if (filters.sortBy) {
                projects = this.sortProjects(projects, filters.sortBy, filters.sortOrder);
            }

            StateManager.setState('projects', projects);
            EventManager.emit(APP_EVENTS.PROJECTS_LOADED, projects);

            return projects;
        } catch (error) {
            Utils.logError('Error loading projects with filters:', error);
            throw error;
        }
    }

    static sortProjects(projects, sortBy, sortOrder = 'asc') {
        return projects.sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'title':
                    aValue = a.title?.toLowerCase() || '';
                    bValue = b.title?.toLowerCase() || '';
                    break;
                case 'progress':
                    const aStats = a.stats || {};
                    const bStats = b.stats || {};
                    aValue = aStats.tasks_count > 0 ?
                        Math.round((aStats.tasks_done / aStats.tasks_count) * 100) : 0;
                    bValue = bStats.tasks_count > 0 ?
                        Math.round((bStats.tasks_done / bStats.tasks_count) * 100) : 0;
                    break;
                case 'tasks':
                    aValue = (a.stats?.tasks_count || 0);
                    bValue = (b.stats?.tasks_count || 0);
                    break;
                case 'updated':
                    aValue = new Date(a.updated_at || a.created_at);
                    bValue = new Date(b.updated_at || b.created_at);
                    break;
                default:
                    return 0;
            }

            if (sortOrder === 'desc') {
                [aValue, bValue] = [bValue, aValue];
            }

            if (aValue < bValue) return -1;
            if (aValue > bValue) return 1;
            return 0;
        });
    }

    static showSettingsModal(projectData) {
        const project = projectData.project || projectData;
        ModalManager.showModal('project-settings', {
            title: 'Настройки проекта',
            size: 'medium',
            template: `
                <div class="project-settings">
                    <div class="setting-group">
                        <h4>Опасная зона</h4>
                        <div class="danger-actions">
                            <button class="btn btn-danger" onclick="ProjectsManager.deleteProjectWithConfirmation('${project.hash}')">
                                <i class="fas fa-trash"></i> Удалить проект
                            </button>
                        </div>
                    </div>
                </div>
            `,
            actions: [
                {
                    text: 'Закрыть',
                    type: 'secondary',
                    action: 'close'
                }
            ]
        });
    }
}

window.ProjectsManager = ProjectsManager;
