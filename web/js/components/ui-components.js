// Компоненты пользовательского интерфейса
class UIComponents {
    static init() {
        this.initNavigation();
        this.initTheme();
        this.initSearch();
        this.initEventListeners();

        Utils.log('UI components initialized');
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

                HapticManager.light();
            });
        });

        // Кнопка создания проекта
        const createProjectBtn = document.getElementById('create-project-btn');
        if (createProjectBtn) {
            createProjectBtn.addEventListener('click', () => {
                ProjectsManager.showCreateProjectModal();
            });
        }

        // Кнопка пользователя
        const userMenuBtn = document.getElementById('user-menu-btn');
        if (userMenuBtn) {
            userMenuBtn.addEventListener('click', () => {
                this.showUserMenu();
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
                ToastManager.info(`Тема изменена на ${newTheme === 'dark' ? 'тёмную' : 'светлую'}`);
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
            });
        }

        if (closeSearch) {
            closeSearch.addEventListener('click', () => {
                this.hideSearch();
            });
        }

        if (searchInput) {
            // Поиск с debounce
            const performSearch = Utils.debounce((query) => {
                SearchManager.performSearch(query);
            }, 300);

            searchInput.addEventListener('input', (e) => {
                performSearch(e.target.value.trim());
            });

            // Обработка клавиши Enter
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    SearchManager.performSearch(e.target.value.trim());
                }
            });
        }

        // Закрытие поиска по клику вне области
        if (searchOverlay) {
            searchOverlay.addEventListener('click', (e) => {
                if (e.target === searchOverlay) {
                    this.hideSearch();
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
                NotificationsManager.markAllNotificationsRead();
            });
        }

        // Обработчики глобальных событий
        EventManager.on(APP_EVENTS.USER_UPDATE, (user) => {
            this.updateUserInfo(user);
        });

        EventManager.on(APP_EVENTS.NOTIFICATIONS_LOADED, (notifications) => {
            this.updateNotificationBadge(notifications);
        });

        EventManager.on(APP_EVENTS.THEME_CHANGED, (theme) => {
            this.updateTheme(theme);
        });
    }

    static showView(viewName) {
        // Скрываем все вью
        const views = document.querySelectorAll('.view');
        views.forEach(view => view.classList.remove('active'));

        // Показываем выбранную вью
        const targetView = document.getElementById(viewName);
        if (targetView) {
            targetView.classList.add('active');
            StateManager.setCurrentView(viewName);

            // Загружаем данные для вью, если необходимо
            this.loadViewData(viewName);

            EventManager.emit(APP_EVENTS.VIEW_CHANGED, viewName);
        }
    }

    static loadViewData(viewName) {
        switch (viewName) {
            case 'dashboard-view':
                DashboardManager.loadDashboard();
                break;
            case 'notifications-view':
                NotificationsManager.loadNotifications();
                break;
            case 'settings-view':
                // Данные настроек загружаются автоматически
                break;
        }
    }

    static showSearch() {
        const searchOverlay = document.getElementById('search-overlay');
        const searchInput = document.getElementById('search-input');

        if (searchOverlay && searchInput) {
            searchOverlay.classList.add('active');
            searchInput.focus();
            StateManager.updateState('ui.search', { active: true });

            EventManager.emit(APP_EVENTS.MODAL_OPENED, 'search');
        }
    }

    static hideSearch() {
        const searchOverlay = document.getElementById('search-overlay');
        const searchInput = document.getElementById('search-input');

        if (searchOverlay && searchInput) {
            searchOverlay.classList.remove('active');
            searchInput.value = '';
            StateManager.updateState('ui.search', {
                active: false,
                query: '',
                results: []
            });

            EventManager.emit(APP_EVENTS.MODAL_CLOSED, 'search');
        }
    }

    static updateUserInfo(user) {
        const userAvatar = document.getElementById('user-avatar');
        if (userAvatar && user) {
            const initials = Utils.getInitials(user.full_name || 'Пользователь');
            userAvatar.textContent = initials;
        }
    }

    static updateNotificationBadge(notifications) {
        const badge = document.getElementById('notification-count');
        const navBadge = document.getElementById('nav-notification-count');

        const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        if (navBadge) {
            if (unreadCount > 0) {
                navBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                navBadge.style.display = 'flex';
            } else {
                navBadge.style.display = 'none';
            }
        }
    }

    static updateTheme(theme) {
        const themeSwitch = document.getElementById('themeSwitch');
        if (themeSwitch) {
            themeSwitch.checked = theme === 'dark';
        }
    }

    static showUserMenu() {
        const user = AuthManager.getCurrentUser();
        if (!user) return;

        const menuItems = [
            {
                text: 'Мой профиль',
                icon: 'fa-user',
                action: () => this.showUserProfile()
            },
            {
                text: 'Настройки',
                icon: 'fa-cog',
                action: () => this.showView('settings-view')
            },
            { type: 'separator' },
            {
                text: 'Выйти',
                icon: 'fa-sign-out-alt',
                action: () => App.logout(),
                danger: true
            }
        ];

        ModalManager.showContextMenu({
            title: user.full_name || 'Пользователь',
            items: menuItems,
            position: 'bottom-end'
        });
    }

    static showUserProfile() {
        const user = AuthManager.getCurrentUser();
        if (!user) return;

        ModalManager.showModal('user-profile', {
            title: 'Мой профиль',
            size: 'medium',
            template: `
                <div class="user-profile">
                    <div class="profile-header">
                        <div class="profile-avatar large">
                            ${Utils.getInitials(user.full_name || 'Пользователь')}
                        </div>
                        <div class="profile-info">
                            <h3>${Utils.escapeHTML(user.full_name || 'Пользователь')}</h3>
                            <p class="text-muted">${Utils.escapeHTML(user.username || 'Без username')}</p>
                        </div>
                    </div>

                    <div class="profile-details">
                        <div class="detail-item">
                            <label>ID пользователя:</label>
                            <span>${user.id}</span>
                        </div>
                        <div class="detail-item">
                            <label>Роль:</label>
                            <span class="role-badge role-${user.role || 'member'}">
                                ${Utils.escapeHTML(AuthManager.getRoleText(user.role || 'member'))}
                            </span>
                        </div>
                        <div class="detail-item">
                            <label>Дата регистрации:</label>
                            <span>${Utils.formatDate(user.created_at)}</span>
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

    // Вспомогательные методы для создания UI элементов
    static createProjectCard(projectData) {
        const project = projectData.project || projectData;
        const stats = project.stats || {};
        const role = projectData.role || 'member';
        const progress = stats.tasks_count > 0 ?
            Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;

        return `
            <div class="project-card"
                 data-project-id="${project.id}"
                 data-project-hash="${project.hash}"
                 data-user-role="${role}">

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
                        <h3 class="project-title">${Utils.escapeHTML(project.title)}</h3>
                        <span class="role-badge role-${role}">
                            ${Utils.escapeHTML(this.getRoleText(role))}
                        </span>
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
                            <i class="fas fa-user-check"></i>
                            <span>${stats.user_tasks || 0}</span>
                        </div>
                    </div>

                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%"></div>
                        </div>
                        <span class="progress-text">${progress}%</span>
                    </div>

                    <div class="card-footer">
                        <span class="project-status">
                            ${this.getProjectStatus(project)}
                        </span>
                        ${['owner', 'admin'].includes(role) ? `
                            <button class="btn btn-sm btn-outline invite-btn"
                                    onclick="ProjectsManager.showInviteDialog('${project.hash}')">
                                <i class="fas fa-share-alt"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    static createTaskCard(task) {
        const isOverdue = task.due_date && Utils.isOverdue(task.due_date);
        const progress = task.subtasks && task.subtasks.length > 0 ?
            Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100) : 0;

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
            return project.requires_approval ? '🔒 Приватный (требует одобрения)' : '🔒 Приватный';
        }
        return '🌐 Публичный';
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

    // Специфичные методы рендеринга с шаблонами
    static renderProjectCardWithTemplate(projectData) {
        const project = projectData.project || projectData;
        const stats = project.stats || {};
        const role = projectData.role || 'member';
        const progress = stats.tasks_count > 0 ?
            Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;

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
        const progress = task.subtasks && task.subtasks.length > 0 ?
            Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100) : 0;

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
        const projectHash = NotificationsManager.extractProjectHashFromNotification(notification);

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

// Загрузка шаблонов при инициализации
UIComponents.loadTemplates();

window.UIComponents = UIComponents;
