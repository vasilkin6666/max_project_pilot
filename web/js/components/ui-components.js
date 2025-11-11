// Компоненты пользовательского интерфейса
class UIComponents {
    static init() {
        this.initNavigation();
        this.initTheme();
        this.initSearch();
        this.initEventListeners();
        this.loadTemplates(); // Добавляем загрузку шаблонов

        Utils.log('UI components initialized');
    }

    static templates = new Map();

    static async loadTemplates() {
        try {
            const templateElements = document.querySelectorAll('script[type="text/template"]');

            for (const element of templateElements) {
                const id = element.id;
                const content = element.innerHTML;
                this.templates.set(id, content);
            }

            Utils.log('Templates loaded', { count: this.templates.size });
        } catch (error) {
            Utils.logError('Error loading templates:', error);
        }
    }

    static renderTemplate(templateId, data) {
        const template = this.templates.get(templateId);
        if (!template) {
            Utils.logError(`Template not found: ${templateId}`);
            return '';
        }

        try {
            return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
                const value = this.getNestedValue(data, key.trim());
                return value !== undefined ? Utils.escapeHTML(value) : '';
            });
        } catch (error) {
            Utils.logError(`Error rendering template ${templateId}:`, error);
            return '';
        }
    }

    static getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : '';
        }, obj);
    }

    static initNavigation() {
        // Навигация по вкладкам
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                const viewName = item.getAttribute('data-view');
                this.showView(viewName);

                // Обновляем активное состояние
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                if (typeof HapticManager !== 'undefined') {
                    HapticManager.light();
                }
            });
        });

        // Кнопка создания проекта
        const createProjectBtn = document.getElementById('create-project-btn');
        if (createProjectBtn) {
            createProjectBtn.addEventListener('click', () => {
                if (typeof ProjectsManager !== 'undefined') {
                    ProjectsManager.showCreateProjectModal();
                }
            });
        }

        // Кнопка пользователя
        const userMenuBtn = document.getElementById('user-menu-btn');
        if (userMenuBtn) {
            userMenuBtn.addEventListener('click', () => {
                this.showUserMenu();
            });
        }

        // Кнопка выхода
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                App.logout();
            });
        }

        // Кнопка экспорта данных
        const exportBtn = document.getElementById('export-data-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (typeof PersistenceManager !== 'undefined') {
                    PersistenceManager.exportData();
                }
            });
        }

        // Кнопка очистки кэша
        const clearCacheBtn = document.getElementById('clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                if (typeof CacheManager !== 'undefined') {
                    CacheManager.clear();
                }
                if (typeof ToastManager !== 'undefined') {
                    ToastManager.success('Кэш очищен');
                }
            });
        }
    }

    static initTheme() {
        // Инициализация темы
        const currentTheme = App.getCurrentTheme();
        App.applyTheme(currentTheme);

        // Переключатель темы
        const themeSwitch = document.getElementById('themeSwitch');
        if (themeSwitch) {
            themeSwitch.checked = currentTheme === 'dark';
            themeSwitch.addEventListener('change', (e) => {
                const newTheme = App.toggleTheme();
                if (typeof ToastManager !== 'undefined') {
                    ToastManager.info(`Тема изменена на ${newTheme === 'dark' ? 'тёмную' : 'светлую'}`);
                }
            });
        }
    }

    static initSearch() {
        const searchBtn = document.getElementById('search-btn');
        const searchOverlay = document.getElementById('search-overlay');
        const closeSearch = document.getElementById('close-search');
        const searchInput = document.getElementById('search-input');

        if (searchBtn && searchOverlay) {
            searchBtn.addEventListener('click', () => {
                this.showSearch();
                searchOverlay.setAttribute('aria-hidden', 'false');
            });
        }

        if (closeSearch) {
            closeSearch.addEventListener('click', () => {
                this.hideSearch();
                searchOverlay.setAttribute('aria-hidden', 'true');
            });
        }

        if (searchInput) {
            // Поиск с debounce
            const performSearch = Utils.debounce((query) => {
                if (typeof SearchManager !== 'undefined') {
                    SearchManager.performSearch(query);
                }
            }, 300);

            searchInput.addEventListener('input', (e) => {
                performSearch(e.target.value.trim());
            });

            // Обработка клавиши Enter
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (typeof SearchManager !== 'undefined') {
                        SearchManager.performSearch(e.target.value.trim());
                    }
                }
            });
        }

        // Закрытие поиска по клику вне области
        if (searchOverlay) {
            searchOverlay.addEventListener('click', (e) => {
                if (e.target === searchOverlay) {
                    this.hideSearch();
                    searchOverlay.setAttribute('aria-hidden', 'true');
                }
            });
        }
    }

    static initEventListeners() {
        // Кнопка уведомлений
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => {
                this.showView('notifications-view');
                // Обновляем навигацию
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                document.querySelector('.nav-item[data-view="notifications-view"]')?.classList.add('active');
            });
        }

        // Кнопка "Прочитать все" в уведомлениях
        const markAllReadBtn = document.getElementById('mark-all-read-btn');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => {
                if (typeof NotificationsManager !== 'undefined') {
                    NotificationsManager.markAllNotificationsRead();
                }
            });
        }

        // Обработчики глобальных событий
        EventManager.on(APP_EVENTS.USER_UPDATE, (user) => {
            this.updateUserInfo(user);
        });

        EventManager.on(APP_EVENTS.NOTIFICATIONS_LOADED, (notifications) => {
            this.updateNotificationBadge(notifications);
        });

        EventManager.on(APP_EVENTS.PROJECTS_LOADED, (projects) => {
            this.renderProjects(projects);
        });

        EventManager.on(APP_EVENTS.TASKS_LOADED, (tasks) => {
            this.renderTasks(tasks);
        });
    }

    // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ОТОБРАЖЕНИЯ ===

    static showView(viewName) {
        const views = document.querySelectorAll('.view');
        views.forEach(view => view.classList.remove('active'));
        const targetView = document.getElementById(viewName);
        if (targetView) {
            targetView.classList.add('active');
            StateManager.setCurrentView(viewName);
        }
    }

    static showSearch() {
        const overlay = document.getElementById('search-overlay');
        if (overlay) {
            overlay.classList.add('active');
            document.body.classList.add('search-open');
            const input = document.getElementById('search-input');
            if (input) setTimeout(() => input.focus(), 100);
        }
    }

    static hideSearch() {
        const overlay = document.getElementById('search-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.classList.remove('search-open');
            overlay.setAttribute('aria-hidden', 'true');
        }
        SearchManager.clearResults();
    }

    static showUserMenu() {
        const user = StateManager.getState('user');
        if (!user) return;

        ModalManager.showContextMenu({
            triggerElement: document.getElementById('user-menu-btn'),
            position: 'bottom-end',
            items: [
                {
                    text: user.full_name || user.username || 'Пользователь',
                    icon: 'fa-user',
                    action: () => {
                        UIComponents.showView('profile-view');
                    }
                },
                { type: 'separator' },
                {
                    text: 'Настройки',
                    icon: 'fa-cog',
                    action: () => {
                        UIComponents.showView('settings-view');
                    }
                },
                {
                    text: 'Выйти',
                    icon: 'fa-sign-out-alt',
                    danger: true,
                    action: () => {
                        App.logout();
                    }
                }
            ]
        });
    }

    static updateUserInfo(user) {
        const userNameEl = document.getElementById('user-name');
        const userAvatarEl = document.getElementById('user-avatar');
        if (userNameEl) userNameEl.textContent = user.full_name || user.username || 'Пользователь';
        if (userAvatarEl) userAvatarEl.textContent = (user.full_name || user.username || 'U')[0].toUpperCase();
    }

    static updateNotificationBadge(notifications) {
        const badge = document.getElementById('notifications-badge');
        const count = notifications.filter(n => !n.is_read).length;
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    static renderProjects(projects) {
        const container = document.getElementById('projects-container');
        if (!container) return;

        if (!projects || projects.length === 0) {
            this.showEmptyState(container, 'Проектов пока нет', 'fa-folder-open');
            return;
        }

        container.innerHTML = '';
        projects.forEach(projectData => {
            const cardHTML = this.renderProjectCardWithTemplate(projectData);
            const card = document.createElement('div');
            card.innerHTML = cardHTML;
            container.appendChild(card.firstElementChild);
        });
    }

    static renderTasks(tasks) {
        const container = document.getElementById('tasks-container');
        if (!container) return;

        if (!tasks || tasks.length === 0) {
            this.showEmptyState(container, 'Задач пока нет', 'fa-tasks');
            return;
        }

        container.innerHTML = '';
        tasks.forEach(task => {
            const cardHTML = this.renderTaskCardWithTemplate(task);
            const card = document.createElement('div');
            card.innerHTML = cardHTML;
            container.appendChild(card.firstElementChild);
        });
    }

    static createProjectCard(project) {
        const stats = project.stats || {};
        const progress = stats.tasks_count > 0
            ? Math.round((stats.tasks_done / stats.tasks_count) * 100)
            : 0;

        return `
            <div class="project-card" data-project-hash="${project.hash}">
                <div class="card-header">
                    <h5 class="project-title">${Utils.escapeHTML(project.title)}</h5>
                    <span class="project-status">${this.getProjectStatus(project)}</span>
                </div>
                <p class="project-description">
                    ${Utils.escapeHTML(project.description || 'Без описания')}
                </p>
                <div class="project-stats">
                    <div class="stat">
                        <i class="fas fa-users"></i>
                        <span>${stats.members_count || 0}</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-tasks"></i>
                        <span>${stats.tasks_count || 0}</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-check-circle"></i>
                        <span>${stats.tasks_done || 0}</span>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="project-footer">
                    <span class="progress-text">${progress}%</span>
                    ${project.is_private ? `
                        <button class="btn btn-sm btn-outline share-btn">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    ` : ''}
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
            <div class="task-card" data-task-id="${task.id}">
                <div class="swipe-actions">
                    <div class="swipe-action edit-action">
                        <i class="fas fa-edit"></i>
                    </div>
                    <div class="swipe-action delete-action">
                        <i class="fas fa-trash"></i>
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
                            <i class="fas fa-user"></i>
                            <span>${Utils.escapeHTML(task.assignee?.full_name || 'Не назначен')}</span>
                        </div>
                        <div class="meta-item ${isOverdue ? 'overdue' : ''}">
                            <i class="fas fa-clock"></i>
                            <span>${task.due_date ? Utils.formatDate(task.due_date) : 'Нет срока'}</span>
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

    // Методы для показа состояний загрузки/ошибок
    static showLoadingState(container) {
        if (!container) return;

        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Загрузка...</p>
            </div>
        `;
    }

    static showErrorState(container, message = 'Ошибка загрузки', retryCallback = null) {
        if (!container) return;

        let retryButton = '';
        if (retryCallback) {
            retryButton = `
                <button class="btn btn-primary" onclick="${retryCallback}">
                    <i class="fas fa-refresh"></i> Попробовать снова
                </button>
            `;
        }

        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>${Utils.escapeHTML(message)}</h3>
                ${retryButton}
            </div>
        `;
    }

    static showEmptyState(container, message = 'Данных пока нет', icon = 'fa-inbox') {
        if (!container) return;

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <h3>${Utils.escapeHTML(message)}</h3>
            </div>
        `;
    }

    // Специфичные методы рендеринга с шаблонами
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

        return this.renderTemplate('project-card-template', templateData);
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

        return this.renderTemplate('task-card-template', templateData);
    }

    static renderNotificationWithTemplate(notification) {
        const isJoinRequest = notification.type && notification.type.includes('join');
        const projectHash = typeof NotificationsManager !== 'undefined'
            ? NotificationsManager.extractProjectHashFromNotification(notification)
            : '';

        const templateData = {
            id: notification.id,
            title: notification.title,
            message: notification.message,
            type: isJoinRequest ? 'join-request' : 'system',
            icon: isJoinRequest ? 'fa-user-plus' : 'fa-info-circle',
            isRead: notification.is_read,
            time: Utils.formatDate(notification.created_at),
            isJoinRequest: isJoinRequest,
            projectHash: projectHash
        };

        return this.renderTemplate('notification-item-template', templateData);
    }
}

window.UIComponents = UIComponents;
