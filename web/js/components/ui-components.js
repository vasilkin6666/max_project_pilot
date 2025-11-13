//ui-components.js
class UIComponents {
  static init() {
      this.initNavigation();
      this.initTheme();
      this.initSearch();
      this.initEventListeners();
      this.loadTemplates();
      this.setupGlobalHandlers();

      Utils.log('UI components initialized');
  }

    static templates = new Map();

    static async loadTemplates() {
        try {
            // Проверяем, не загружены ли уже шаблоны
            if (this.templates.size > 0) {
                Utils.log('Templates already loaded, skipping');
                return;
            }

            // Загружаем шаблоны из существующих script элементов в index.html
            const templateElements = document.querySelectorAll('script[type="text/template"]');
            let loadedCount = 0;

            for (const element of templateElements) {
                const id = element.id;
                const content = element.innerHTML.trim();

                if (id && content) {
                    this.templates.set(id, content);
                    loadedCount++;
                    Utils.log(`Loaded inline template: ${id}`);
                }
            }

            Utils.log('Templates loaded from inline scripts', { count: loadedCount });
            this.ensureRequiredTemplates();

        } catch (error) {
            Utils.logError('Error loading templates:', error);
            this.createFallbackTemplates();
        }
    }

    static ensureRequiredTemplates() {
        const requiredTemplates = {
            'project-card-template': `
                <div class="project-card" data-project-hash="{{hash}}">
                    <div class="card-header">
                        <h3 class="project-title">{{title}}</h3>
                        <div class="project-badges">
                            <span class="project-privacy {{#if isPrivate}}private{{else}}public{{/if}}">
                                {{#if isPrivate}}🔒 Приватный{{else}}🌐 Публичный{{/if}}
                            </span>
                            <span class="project-role {{role}}">{{roleText}}</span>
                        </div>
                    </div>
                    <p class="project-description">{{description}}</p>
                    <div class="project-stats">
                        <div class="stat">
                            <i class="fas fa-users"></i>
                            <span>{{membersCount}}</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-tasks"></i>
                            <span>{{tasksCount}}</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-check-circle"></i>
                            <span>{{tasksDone}}</span>
                        </div>
                    </div>
                    {{#if tasksCount}}
                    <div class="progress-section">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: {{progress}}%"></div>
                        </div>
                        <span class="progress-text">{{progress}}%</span>
                    </div>
                    {{/if}}
                    <div class="project-footer">
                        <div class="task-breakdown">
                            <span class="task-todo">{{tasksTodo}} к выполнению</span>
                            <span class="task-in-progress">{{tasksInProgress}} в работе</span>
                        </div>
                        {{#if canInvite}}
                        {{#if isPrivate}}
                        <button class="btn btn-sm btn-outline share-btn" onclick="ProjectsManager.showInviteDialog('{{hash}}')">
                            <i class="fas fa-share-alt"></i>
                        </button>
                        {{/if}}
                        {{/if}}
                    </div>
                </div>
            `,
            'task-card-template': `
                <div class="task-card" data-task-id="{{id}}">
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
                            <h4 class="task-title">{{title}}</h4>
                            <span class="priority-badge priority-{{priority}}">{{priorityText}}</span>
                        </div>
                        <p class="task-description">{{description}}</p>
                        <div class="task-meta">
                            <div class="meta-item">
                                <i class="fas fa-user"></i>
                                <span>{{assignee}}</span>
                            </div>
                            <div class="meta-item {{#if isOverdue}}overdue{{/if}}">
                                <i class="fas fa-clock"></i>
                                <span>{{dueDate}}</span>
                            </div>
                        </div>
                        <div class="task-footer">
                            <span class="status-badge status-{{status}}">{{statusText}}</span>
                            {{#if hasSubtasks}}
                            <div class="task-progress">
                                <span class="progress-text">{{progress}}%</span>
                                <div class="progress-bar small">
                                    <div class="progress-fill" style="width: {{progress}}%"></div>
                                </div>
                            </div>
                            {{/if}}
                        </div>
                    </div>
                </div>
            `,
            'create-project-modal-template': this.getCreateProjectFallbackTemplate(),
            'create-task-modal-template': this.getCreateTaskFallbackTemplate(),
            'settings-modal-template': this.getSettingsFallbackTemplate()
        };

        Object.entries(requiredTemplates).forEach(([templateId, templateContent]) => {
            if (!this.templates.has(templateId)) {
                console.warn(`Creating fallback template: ${templateId}`);
                this.templates.set(templateId, templateContent);
            } else {
                console.log(`✅ Required template available: ${templateId}`);
            }
        });
    }

    static getCreateProjectFallbackTemplate() {
        return `
            <form id="create-project-form">
                <div class="form-group">
                    <label for="project-title" class="form-label">Название проекта *</label>
                    <input type="text" class="form-control" id="project-title" name="title" required
                           placeholder="Введите название проекта" maxlength="100">
                    <div class="form-text">Максимум 100 символов</div>
                </div>
                <div class="form-group">
                    <label for="project-description" class="form-label">Описание</label>
                    <textarea class="form-control" id="project-description" name="description" rows="3"
                              placeholder="Опишите ваш проект (необязательно)" maxlength="500"></textarea>
                    <div class="form-text">Максимум 500 символов</div>
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
        `;
    }

    static getCreateTaskFallbackTemplate() {
        return `
            <form id="create-task-form">
                <div class="form-group">
                    <label for="task-title" class="form-label">Название задачи *</label>
                    <input type="text" class="form-control" id="task-title" required
                           placeholder="Введите название задачи">
                </div>

                <div class="form-group">
                    <label for="task-description" class="form-label">Описание</label>
                    <textarea class="form-control" id="task-description" rows="3"
                              placeholder="Опишите задачу (необязательно)"></textarea>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="task-assignee" class="form-label">Исполнитель</label>
                            <select class="form-select" id="task-assignee">
                                <option value="">Не назначен</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="task-priority" class="form-label">Приоритет</label>
                            <select class="form-select" id="task-priority">
                                <option value="low">Низкий</option>
                                <option value="medium" selected>Средний</option>
                                <option value="high">Высокий</option>
                                <option value="urgent">Срочный</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="task-due-date" class="form-label">Срок выполнения</label>
                    <input type="datetime-local" class="form-control" id="task-due-date">
                </div>

                <div class="form-group">
                    <label class="form-label">Подзадачи</label>
                    <div id="subtasks-container">
                        <!-- Подзадачи будут добавляться динамически -->
                    </div>
                    <button type="button" class="btn btn-outline-secondary btn-sm mt-2"
                            onclick="TasksManager.addSubtaskField()">
                        <i class="fas fa-plus"></i> Добавить подзадачу
                    </button>
                </div>
            </form>
        `;
    }

    static getSettingsFallbackTemplate() {
        return `
            <div class="user-preferences">
                <div id="preferences-content">
                    <div class="loading-state">
                        <div class="spinner"></div>
                        <p>Загрузка настроек...</p>
                    </div>
                </div>
            </div>
        `;
    }

    static createFallbackTemplates() {
        this.ensureRequiredTemplates();
    }

    static renderTemplate(templateId, data) {
        const template = this.templates.get(templateId);
        if (!template) {
            Utils.logError(`Template not found: ${templateId}`);
            return this.getFallbackTemplate(templateId, data);
        }

        try {
            let result = template;

            // Обработка условных блоков {{#if condition}} ... {{/if}}
            result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
                const value = this.getNestedValue(data, condition);
                return value ? content : '';
            });

            // Обработка отрицательных условий {{#unless condition}} ... {{/unless}}
            result = result.replace(/\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (match, condition, content) => {
                const value = this.getNestedValue(data, condition);
                return !value ? content : '';
            });

            // Обработка функций типа truncate title 50
            result = result.replace(/\{\{truncate\s+(\w+)\s+(\d+)\}\}/g, (match, property, length) => {
                const text = this.getNestedValue(data, property) || '';
                return Utils.truncateText(text, parseInt(length));
            });

            // Простая замена переменных {{variable}}
            result = result.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
                const trimmedKey = key.trim();
                const value = this.getNestedValue(data, trimmedKey);
                return value !== undefined && value !== null ? Utils.escapeHTML(String(value)) : '';
            });

            return result;

        } catch (error) {
            Utils.logError(`Error rendering template ${templateId}:`, error);
            return this.getFallbackTemplate(templateId, data);
        }
    }

    static getFallbackTemplate(templateId, data) {
        switch(templateId) {
            case 'project-card-template':
                return this.createProjectCardFallback(data);
            case 'task-card-template':
                return this.createTaskCard(data);
            case 'create-project-modal-template':
                return this.getCreateProjectFallbackTemplate();
            case 'create-task-modal-template':
                return this.getCreateTaskFallbackTemplate();
            case 'settings-modal-template':
                return this.getSettingsFallbackTemplate();
            case 'notification-item-template':
                return `<div class="notification-item">${data.message || 'Уведомление'}</div>`;
            default:
                return `<div class="template-error">Шаблон ${templateId} не найден</div>`;
        }
    }

    static async preloadModalTemplates() {
        const modalTemplates = [
            'create-project-modal-template',
            'create-task-modal-template',
            'settings-modal-template'
        ];

        let needsReload = false;
        for (const templateId of modalTemplates) {
            if (!this.templates.has(templateId)) {
                needsReload = true;
                break;
            }
        }

        if (needsReload) {
            Utils.log('Some modal templates missing, reloading templates...');
            await this.loadTemplates();
        }
    }

    static getNestedValue(obj, path) {
        if (!obj || !path) return '';
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
                if (viewName) {
                    this.showView(viewName);

                    // Обновляем активное состояние
                    navItems.forEach(nav => nav.classList.remove('active'));
                    item.classList.add('active');

                    if (typeof HapticManager !== 'undefined') {
                        HapticManager.light();
                    }
                }
            });
        });

        // Кнопка создания проекта теперь в header
        const createProjectBtn = document.getElementById('create-project-btn');
        if (createProjectBtn) {
            createProjectBtn.addEventListener('click', () => {
                if (typeof ProjectsManager !== 'undefined') {
                    ProjectsManager.showCreateProjectModal();
                } else {
                    Utils.logError('ProjectsManager not available');
                }
            });
        }

        this.adjustContentPadding();
        window.addEventListener('resize', () => this.adjustContentPadding());

        Utils.log('Navigation initialized');
    }

    static adjustContentPadding() {
        const nav = document.querySelector('.bottom-nav');
        const mainContent = document.querySelector('.main-content');

        if (nav && mainContent) {
            const navHeight = nav.offsetHeight;
            mainContent.style.paddingBottom = `${navHeight + 20}px`;
        }
    }

    static initTheme() {
        // Инициализация темы
        const currentTheme = App.getCurrentTheme();

        // ПРИНУДИТЕЛЬНОЕ ПРИМЕНЕНИЕ ТЕМЫ БЕЗ ВЫЗОВА СОБЫТИЙ
        this.applyThemeSilently(currentTheme);

        // Переключатель темы
        const themeSwitch = document.getElementById('themeSwitch');
        if (themeSwitch) {
            themeSwitch.checked = currentTheme === 'dark';
            themeSwitch.addEventListener('change', (e) => {
                const newTheme = e.target.checked ? 'dark' : 'light';

                // Прямое применение темы без эмита событий
                App.applyTheme(newTheme);

                if (typeof ToastManager !== 'undefined') {
                    ToastManager.info(`Тема изменена на ${newTheme === 'dark' ? 'тёмную' : 'светлую'}`);
                }

                if (typeof HapticManager !== 'undefined') {
                    HapticManager.toggleSwitch();
                }
            });
        }

        Utils.log('Theme system initialized');
    }

    static applyThemeSilently(theme) {
        const lightTheme = document.getElementById('theme-light');
        const darkTheme = document.getElementById('theme-dark');

        if (theme === 'dark') {
            if (lightTheme) lightTheme.disabled = true;
            if (darkTheme) darkTheme.disabled = false;
            document.body.setAttribute('data-theme', 'dark');
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            if (lightTheme) lightTheme.disabled = false;
            if (darkTheme) darkTheme.disabled = true;
            document.body.removeAttribute('data-theme');
            document.documentElement.removeAttribute('data-theme');
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

                if (typeof HapticManager !== 'undefined') {
                    HapticManager.buttonPress();
                }
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

                if (e.key === 'Escape') {
                    this.hideSearch();
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

        Utils.log('Search system initialized');
    }

    static initEventListeners() {
        // Навигация по вкладкам
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                const viewName = item.getAttribute('data-view');
                if (viewName) {
                    this.showView(viewName);

                    // Обновляем активное состояние
                    navItems.forEach(nav => nav.classList.remove('active'));
                    item.classList.add('active');

                    if (typeof HapticManager !== 'undefined') {
                        HapticManager.light();
                    }
                }
            });
        });

        // Кнопка создания проекта теперь в header - ДОБАВЛЕНА ПРЕДВАРИТЕЛЬНАЯ ЗАГРУЗКА ШАБЛОНОВ
        const createProjectBtn = document.getElementById('create-project-btn');
        if (createProjectBtn) {
            createProjectBtn.addEventListener('click', async () => {
                // Предварительная загрузка шаблонов перед открытием модального окна
                await this.preloadModalTemplates();
                if (typeof ProjectsManager !== 'undefined') {
                    ProjectsManager.showCreateProjectModal();
                } else {
                    Utils.logError('ProjectsManager not available');
                }
            });
        }

        // Кнопка уведомлений
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => {
                this.showView('notifications-view');
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                document.querySelector('.nav-item[data-view="notifications-view"]')?.classList.add('active');
                HapticManager.buttonPress();
            });
        }

        // ИСПРАВЛЕННАЯ КНОПКА ЗАЯВОК НА ВСТУПЛЕНИЕ
        const joinRequestsBtn = document.getElementById('join-requests-btn');
        if (joinRequestsBtn) {
            joinRequestsBtn.addEventListener('click', async () => {
                // Показываем заявки для всех проектов, где пользователь имеет права
                const projects = StateManager.getState('projects') || [];
                const userProjectsWithAccess = projects.filter(project => {
                    const role = project.current_user_role || project.user_role;
                    return ['owner', 'admin'].includes(role);
                });

                if (userProjectsWithAccess.length === 0) {
                    ToastManager.info('У вас нет проектов с правами для управления заявками');
                    return;
                }

                // Показываем модальное окно со списком проектов для управления заявками
                this.showJoinRequestsProjectsModal(userProjectsWithAccess);
            });
        }

        // Кнопка "Прочитать все" в уведомлениях
        const markAllReadBtn = document.getElementById('mark-all-read-btn');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => {
                if (typeof NotificationsManager !== 'undefined') {
                    NotificationsManager.markAllNotificationsRead();
                } else {
                    ToastManager.error('Менеджер уведомлений недоступен');
                }
            });
        }

        // Кнопка настроек - ДОБАВЛЕНА ПРЕДВАРИТЕЛЬНАЯ ЗАГРУЗКА ШАБЛОНОВ
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', async () => {
                // Предварительная загрузка шаблонов перед открытием настроек
                await this.preloadModalTemplates();
                if (typeof UsersManager !== 'undefined') {
                    UsersManager.showPreferencesModal();
                } else {
                    this.showView('settings-view');
                }
            });
        }

        // ДОБАВЛЕННЫЕ ОБРАБОТЧИКИ ДЛЯ КНОПОК ПОЛЬЗОВАТЕЛЯ
        const userMenuBtn = document.getElementById('user-menu-btn');
        if (userMenuBtn) {
            userMenuBtn.addEventListener('click', () => {
                this.showUserMenu();
            });
        }

        // Обработчики для кнопок в настройках
        const exportDataBtn = document.getElementById('export-data-btn');
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => {
                if (typeof PersistenceManager !== 'undefined') {
                    PersistenceManager.exportData();
                } else {
                    ToastManager.error('Менеджер данных недоступен');
                }
            });
        }

        const clearCacheBtn = document.getElementById('clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                if (typeof CacheManager !== 'undefined') {
                    CacheManager.clear();
                    ToastManager.success('Кэш очищен');
                } else {
                    ToastManager.error('Менеджер кэша недоступен');
                }
            });
        }

        const debugInfoBtn = document.getElementById('debug-info-btn');
        if (debugInfoBtn) {
            debugInfoBtn.addEventListener('click', () => {
                if (typeof App !== 'undefined') {
                    App.showDebugInfo();
                }
            });
        }

        // Обработчики для кнопок в дашборде
        const filterBtn = document.getElementById('filter-btn');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => {
                this.showFiltersModal();
            });
        }

        const sortBtn = document.getElementById('sort-btn');
        if (sortBtn) {
            sortBtn.addEventListener('click', () => {
                this.showSortModal();
            });
        }

        // Показать секцию отладки в development
        if (CONFIG.ENV === 'development') {
            const debugSection = document.getElementById('debug-section');
            if (debugSection) {
                debugSection.style.display = 'block';
            }
        }

        // Обработчики глобальных событий
        EventManager.on(APP_EVENTS.USER_UPDATE, (user) => {
            this.updateUserInfo(user);
        });

        EventManager.on(APP_EVENTS.NOTIFICATIONS_LOADED, (notifications) => {
            this.updateNotificationBadge(notifications);
        });

        EventManager.on(APP_EVENTS.PROJECTS_LOADED, (projects) => {
            console.log('PROJECTS_LOADED event received:', projects);
            // Добавляем небольшую задержку для гарантии что DOM готов
            setTimeout(() => this.renderProjects(projects), 100);
        });

        EventManager.on(APP_EVENTS.PROJECTS_UPDATED, (projects) => {
            console.log('PROJECTS_UPDATED event received:', projects);
            setTimeout(() => this.renderProjects(projects), 100);
        });

        EventManager.on(APP_EVENTS.STATE_UPDATED, (newState) => {
            if (newState.projects && Array.isArray(newState.projects)) {
                console.log('STATE_UPDATED with projects:', newState.projects);
                setTimeout(() => this.renderProjects(newState.projects), 150);
            }
        });

        EventManager.on(APP_EVENTS.TASKS_LOADED, (tasks) => {
            this.renderTasks(tasks);
        });

        EventManager.on(APP_EVENTS.THEME_CHANGED, (theme) => {
            this.updateThemeUI(theme);
        });

        EventManager.on(APP_EVENTS.NETWORK_STATUS_CHANGED, (status) => {
            this.updateNetworkStatusUI(status);
        });

        EventManager.on(APP_EVENTS.USER_UPDATE, (user) => {
            this.updateUserInfo(user);
            this.updateAccountSettingsInfo(user); // Новый метод
        });

        // ДОБАВЛЕНЫ ОБРАБОТЧИКИ ДЛЯ СОБЫТИЙ ШАБЛОНОВ
        EventManager.on(APP_EVENTS.MODAL_OPENED, (modalId) => {
            Utils.log(`Modal opened: ${modalId}`);
            this.handleModalOpened(modalId); // ВЫЗОВ НОВОГО МЕТОДА
        });

        EventManager.on(APP_EVENTS.MODAL_CLOSED, (modalId) => {
            Utils.log(`Modal closed: ${modalId}`);
            this.handleModalClosed(modalId); // ВЫЗОВ НОВОГО МЕТОДА
        });

        EventManager.on(APP_EVENTS.DATA_LOADED, () => {
            // При загрузке данных убедиться что основные шаблоны доступны
            this.ensureRequiredTemplates();
        });

        Utils.log('Event listeners initialized');
    }

    static showJoinRequestsProjectsModal(projects) {
        const projectsWithAccess = projects.filter(project =>
            ['owner', 'admin'].includes(project.current_user_role || project.user_role)
        );

        if (projectsWithAccess.length === 0) {
            ToastManager.info('Нет проектов с правами для управления заявками');
            return;
        }

        ModalManager.showModal('join-requests-projects', {
            title: 'Управление заявками на вступление',
            size: 'medium',
            template: `
                <div class="join-requests-projects">
                    <p>Выберите проект для просмотра заявок на вступление:</p>
                    <div class="projects-list">
                        ${projectsWithAccess.map(project => `
                            <div class="project-item" onclick="UIComponents.openJoinRequestsForProject('${project.hash}')">
                                <div class="project-info">
                                    <h5>${Utils.escapeHTML(project.title)}</h5>
                                    <span class="project-role">${Utils.escapeHTML(project.current_user_role || project.user_role)}</span>
                                </div>
                                <div class="project-actions">
                                    <button class="btn btn-primary btn-sm"
                                            onclick="event.stopPropagation(); UIComponents.openJoinRequestsForProject('${project.hash}')">
                                        <i class="fas fa-user-plus"></i> Просмотреть заявки
                                    </button>
                                </div>
                            </div>
                        `).join('')}
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

    static openJoinRequestsForProject(projectHash) {
        if (typeof JoinRequestsManager !== 'undefined') {
            JoinRequestsManager.showJoinRequestsModal(projectHash);
        } else {
            ToastManager.error('Менеджер заявок недоступен');
        }
    }

    static handleModalOpened(modalId) {
        // Выполняем специфичные действия при открытии разных модальных окон
        switch(modalId) {
            case 'create-project':
                // Автофокус на поле названия при создании проекта
                setTimeout(() => {
                    const titleInput = document.getElementById('project-title');
                    if (titleInput) titleInput.focus();
                }, 300);
                break;

            case 'create-task':
                // Автофокус на поле названия при создании задачи
                setTimeout(() => {
                    const titleInput = document.getElementById('task-title');
                    if (titleInput) titleInput.focus();
                }, 300);
                break;

            case 'join-requests':
                // Загрузка заявок при открытии окна
                const projectHash = this.getCurrentProjectHashFromModal();
                if (projectHash && typeof JoinRequestsManager !== 'undefined') {
                    JoinRequestsManager.loadAndRenderJoinRequests(projectHash);
                }
                break;

            case 'user-preferences':
                // Обновление информации пользователя в настройках
                if (typeof UsersManager !== 'undefined') {
                    UsersManager.updateAccountSettingsInfo();
                }
                break;
        }

        // Глобальные действия для всех модальных окон
        this.disableBackgroundInteractions();
        this.addModalOverlay();
    }


    static handleModalClosed(modalId) {
        // Выполняем специфичные действия при закрытии разных модальных окон
        switch(modalId) {
            case 'create-project':
            case 'create-task':
                // Очистка форм после закрытия
                const form = document.getElementById(`${modalId.replace('create-', '')}-form`);
                if (form) form.reset();
                break;

            case 'join-requests':
                // Обновление уведомлений после работы с заявками
                if (typeof NotificationsManager !== 'undefined') {
                    NotificationsManager.loadNotifications();
                }
                break;
        }

        // Глобальные действия для всех модальных окон
        this.enableBackgroundInteractions();
        this.removeModalOverlay();

        // Эмитим кастомное событие для дополнительной обработки
        EventManager.emit('modal:after-close', modalId);
    }

    static disableBackgroundInteractions() {
        // Блокируем скролл на заднем фоне
        document.body.style.overflow = 'hidden';

        // Добавляем класс для визуального затемнения фона
        document.body.classList.add('modal-open');
    }

    static enableBackgroundInteractions() {
        // Восстанавливаем скролл
        document.body.style.overflow = '';

        // Убираем класс затемнения
        document.body.classList.remove('modal-open');
    }

    static addModalOverlay() {
        // Создаем оверлей для модальных окон
        let overlay = document.getElementById('modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'modal-overlay';
            overlay.className = 'modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 1040;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            document.body.appendChild(overlay);

            // Анимация появления
            setTimeout(() => {
                overlay.style.opacity = '1';
            }, 10);

            // Закрытие по клику на оверлей
            overlay.addEventListener('click', () => {
                ModalManager.closeCurrentModal();
            });
        }
    }

    static removeModalOverlay() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
        }
    }

    static getCurrentProjectHashFromModal() {
        // Получаем project hash из активного модального окна
        const modal = document.querySelector('.modal.show');
        if (modal) {
            const projectItem = modal.querySelector('[data-project-hash]');
            return projectItem ? projectItem.getAttribute('data-project-hash') : null;
        }
        return null;
    }

    static ensureModalTemplate(modalId) {
        const templateId = `${modalId}-modal-template`;
        if (!this.templates.has(templateId)) {
            Utils.log(`Modal template not found: ${templateId}, creating fallback`);
            switch(modalId) {
                case 'create-project':
                    this.templates.set(templateId, this.getCreateProjectFallbackTemplate());
                    break;
                case 'create-task':
                    this.templates.set(templateId, this.getCreateTaskFallbackTemplate());
                    break;
                case 'user-preferences':
                    this.templates.set(templateId, this.getSettingsFallbackTemplate());
                    break;
            }
        }
    }
    // Новый метод для обновления информации в настройках
    static updateAccountSettingsInfo(user) {
        const avatar = document.getElementById('settings-user-avatar');
        const name = document.getElementById('settings-user-name');
        const userId = document.getElementById('settings-user-id');
        const email = document.getElementById('settings-user-email');
        const role = document.getElementById('settings-user-role');

        if (avatar) {
            const initials = Utils.getInitials(user.full_name || user.username || 'Пользователь');
            avatar.textContent = initials;

            if (user.photo_url) {
                avatar.style.backgroundImage = `url(${user.photo_url})`;
                avatar.textContent = '';
            }
        }

        if (name) {
            name.textContent = user.full_name || user.username || 'Пользователь';
        }

        if (userId) {
            userId.textContent = `ID: ${user.id || 'неизвестен'}`;
        }

        if (email) {
            email.textContent = `Email: ${user.email || 'не указан'}`;
        }

        if (role) {
            const roleText = user.role ? UsersManager.getRoleText(user.role) : 'Участник';
            role.textContent = `Роль: ${roleText}`;
        }
    }

    static setupGlobalHandlers() {
        // Обработка кликов по внешним ссылкам
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="http"]');
            if (link && !link.href.includes(window.location.hostname)) {
                e.preventDefault();
                this.openExternalLink(link.href);
            }
        });

        // Предотвращение потери данных при перезагрузке
        window.addEventListener('beforeunload', (e) => {
            const hasUnsavedChanges = StateManager.getState('ui.hasUnsavedChanges');
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'У вас есть несохраненные изменения. Вы уверены, что хотите уйти?';
                return e.returnValue;
            }
        });

        Utils.log('Global handlers setup completed');
    }

    static openExternalLink(url) {
        ModalManager.showConfirmation({
            title: 'Внешняя ссылка',
            message: `Вы собираетесь перейти по внешней ссылке: ${url}`,
            confirmText: 'Перейти',
            cancelText: 'Отмена',
            onConfirm: () => {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        });
    }

    // ==================== ОСНОВНЫЕ МЕТОДЫ ОТОБРАЖЕНИЯ ====================

    static showView(viewName) {
        const views = document.querySelectorAll('.view');
        views.forEach(view => {
            view.classList.remove('active');
            view.setAttribute('aria-hidden', 'true');
        });

        const targetView = document.getElementById(viewName);
        if (targetView) {
            targetView.classList.add('active');
            targetView.setAttribute('aria-hidden', 'false');
            StateManager.setCurrentView(viewName);

            // Прокрутка вверх при смене вью
            targetView.scrollTop = 0;

            // Эмитим событие смены вью
            EventManager.emit(APP_EVENTS.VIEW_CHANGED, viewName);

            Utils.log(`View changed to: ${viewName}`);
        } else {
            Utils.logError(`View not found: ${viewName}`);
        }
    }

    static showSearch() {
        const overlay = document.getElementById('search-overlay');
        if (overlay) {
            overlay.classList.add('active');
            document.body.classList.add('search-open');
            const input = document.getElementById('search-input');
            if (input) {
                input.value = '';
                setTimeout(() => input.focus(), 100);
            }

            // Показываем пустое состояние
            if (typeof SearchManager !== 'undefined') {
                SearchManager.clearResults();
            }
        }
    }

    static hideSearch() {
        const overlay = document.getElementById('search-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.classList.remove('search-open');
            overlay.setAttribute('aria-hidden', 'true');
        }

        if (typeof SearchManager !== 'undefined') {
            SearchManager.clearResults();
        }
    }

    static showUserMenu() {
        const user = AuthManager.getCurrentUser();
        if (!user) return;

        const menuItems = [
            {
                text: user.full_name || user.username || 'Пользователь',
                icon: 'fa-user',
                action: () => {
                    this.showView('settings-view');
                }
            },
            { type: 'separator' },
            {
                text: 'Настройки',
                icon: 'fa-cog',
                action: () => {
                    this.showView('settings-view');
                }
            },
            { type: 'separator' },
            {
                text: 'Выйти',
                icon: 'fa-sign-out-alt',
                danger: true,
                action: () => {
                    if (typeof App !== 'undefined') {
                        App.logout();
                    }
                }
            }
        ];

        ModalManager.showContextMenu({
            triggerElement: document.getElementById('user-menu-btn'),
            position: 'bottom-end',
            items: menuItems
        });
    }

    // Новый метод для открытия настроек
    static showSettingsView() {
        this.showView('settings-view');

        // Обновляем навигацию
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        document.querySelector('.nav-item[data-view="settings-view"]')?.classList.add('active');

        if (typeof HapticManager !== 'undefined') {
            HapticManager.buttonPress();
        }
    }

    // НОВЫЕ МЕТОДЫ ДЛЯ ФИЛЬТРОВ И СОРТИРОВКИ
    static showFiltersModal() {
        ModalManager.showModal('filters', {
            title: 'Фильтры проектов',
            size: 'small',
            template: `
                <div class="filters-modal">
                    <div class="form-group">
                        <label class="form-label">Статус проекта</label>
                        <select class="form-select" id="project-status-filter">
                            <option value="all">Все проекты</option>
                            <option value="active">Активные</option>
                            <option value="completed">Завершенные</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Роль</label>
                        <select class="form-select" id="project-role-filter">
                            <option value="all">Все роли</option>
                            <option value="owner">Владелец</option>
                            <option value="admin">Админ</option>
                            <option value="member">Участник</option>
                        </select>
                    </div>
                </div>
            `,
            actions: [
                {
                    text: 'Сбросить',
                    type: 'secondary',
                    action: 'close'
                },
                {
                    text: 'Применить',
                    type: 'primary',
                    action: 'submit',
                    onClick: () => this.applyFilters()
                }
            ]
        });
    }

    static showSortModal() {
        ModalManager.showModal('sort', {
            title: 'Сортировка проектов',
            size: 'small',
            template: `
                <div class="sort-modal">
                    <div class="form-group">
                        <label class="form-label">Сортировать по</label>
                        <select class="form-select" id="project-sort-by">
                            <option value="title">Названию</option>
                            <option value="updated">Дате обновления</option>
                            <option value="progress">Прогрессу</option>
                            <option value="tasks">Количеству задач</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Порядок</label>
                        <select class="form-select" id="project-sort-order">
                            <option value="asc">По возрастанию</option>
                            <option value="desc">По убыванию</option>
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
                    text: 'Применить',
                    type: 'primary',
                    action: 'submit',
                    onClick: () => this.applySort()
                }
            ]
        });
    }

    static applyFilters() {
        const statusFilter = document.getElementById('project-status-filter').value;
        const roleFilter = document.getElementById('project-role-filter').value;

        if (typeof ProjectsManager !== 'undefined') {
            ProjectsManager.applyFilters(statusFilter, roleFilter);
        }

        ModalManager.closeCurrentModal();
    }

    static applySort() {
        const sortBy = document.getElementById('project-sort-by').value;
        const sortOrder = document.getElementById('project-sort-order').value;

        if (typeof ProjectsManager !== 'undefined') {
            ProjectsManager.applySorting(sortBy, sortOrder);
        }

        ModalManager.closeCurrentModal();
    }

    static updateUserInfo(user) {
        const userNameEl = document.getElementById('user-name');
        const userAvatarEl = document.getElementById('user-avatar');
        const userInitialsEl = document.getElementById('user-initials');

        if (userNameEl) {
            userNameEl.textContent = user.full_name || user.username || 'Пользователь';
            userNameEl.setAttribute('title', user.full_name || user.username || 'Пользователь');
        }

        if (userAvatarEl) {
            const initials = Utils.getInitials(user.full_name || user.username || 'Пользователь');
            userAvatarEl.textContent = initials;
            userAvatarEl.setAttribute('aria-label', `Аватар пользователя ${user.full_name || user.username}`);
        }

        if (userInitialsEl) {
            const initials = Utils.getInitials(user.full_name || user.username || 'Пользователь');
            userInitialsEl.textContent = initials;
        }
    }

    static updateNotificationBadge(notifications) {
        const badge = document.getElementById('notifications-badge');
        const navBadge = document.getElementById('nav-notification-count');
        const count = notifications.filter(n => !n.is_read).length;

        if (badge) {
            badge.textContent = count > 99 ? '99+' : count.toString();
            badge.style.display = count > 0 ? 'flex' : 'none';
            badge.setAttribute('aria-label', `${count} непрочитанных уведомлений`);
        }

        if (navBadge) {
            navBadge.textContent = count > 9 ? '9+' : count.toString();
            navBadge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    static updateThemeUI(theme) {
        const themeSwitch = document.getElementById('themeSwitch');
        const mobileThemeBtn = document.getElementById('mobile-theme-btn');

        if (themeSwitch) {
            themeSwitch.checked = theme === 'dark';
        }

        if (mobileThemeBtn) {
            mobileThemeBtn.innerHTML = theme === 'dark'
                ? '<i class="fas fa-sun"></i> Светлая тема'
                : '<i class="fas fa-moon"></i> Тёмная тема';
        }
    }

    static updateNetworkStatusUI(status) {
        const statusIndicator = document.getElementById('network-status');
        if (statusIndicator) {
            statusIndicator.className = `network-status ${status}`;
            statusIndicator.setAttribute('title', status === 'online' ? 'В сети' : 'Не в сети');
            statusIndicator.setAttribute('aria-label', status === 'online' ? 'Подключение к интернету активно' : 'Отсутствует подключение к интернету');
        }
    }

    // ==================== РЕНДЕРИНГ ДАННЫХ ====================

    static renderProjects(projects) {
        try {
            const container = document.getElementById('projects-list');
            if (!container) {
                console.warn('Projects container not found');
                return;
            }

            // Очищаем контейнер
            container.innerHTML = '';

            if (!projects || !Array.isArray(projects) || projects.length === 0) {
                this.showEmptyState(container, 'Проектов пока нет', 'fa-folder-open', `
                    <button class="btn btn-primary" onclick="ProjectsManager.showCreateProjectModal()">
                        <i class="fas fa-plus"></i> Создать проект
                    </button>
                `);
                return;
            }

            // Рендерим проекты
            projects.forEach((projectData, index) => {
                setTimeout(() => {
                    try {
                        const project = projectData.project || projectData;
                        console.log('Rendering project card with data:', project);

                        const cardHTML = this.renderProjectCardWithTemplate(project);

                        if (!cardHTML) {
                            console.error('Empty card HTML for project:', project);
                            return;
                        }

                        const cardElement = document.createElement('div');
                        cardElement.innerHTML = cardHTML.trim();

                        // Получаем первый элемент (саму карточку)
                        const projectCard = cardElement.firstElementChild;

                        if (!projectCard) {
                            console.error('Could not create card element for project:', project);
                            return;
                        }

                        // Добавляем анимацию
                        projectCard.style.opacity = '0';
                        projectCard.style.transform = 'translateY(20px)';

                        container.appendChild(projectCard);

                        // Анимация появления
                        requestAnimationFrame(() => {
                            projectCard.style.opacity = '1';
                            projectCard.style.transform = 'translateY(0)';
                            projectCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        });

                    } catch (error) {
                        console.error('Error rendering project card:', error, projectData);
                    }
                }, index * 50);
            });

            Utils.log(`Rendered ${projects.length} projects`);
        } catch (error) {
            Utils.logError('Error in renderProjects:', error);
            const container = document.getElementById('projects-list');
            if (container) {
                this.showErrorState(container, 'Ошибка отображения проектов');
            }
        }
    }

    static renderTasks(tasks) {
        const container = document.getElementById('tasks-container');
        if (!container) return;

        if (!tasks || tasks.length === 0) {
            this.showEmptyState(container, 'Задач пока нет', 'fa-tasks');
            return;
        }

        this.showLoadingState(container);

        requestAnimationFrame(() => {
            container.innerHTML = '';
            tasks.forEach((task, index) => {
                setTimeout(() => {
                    const cardHTML = this.renderTaskCardWithTemplate(task);
                    const card = document.createElement('div');
                    card.innerHTML = cardHTML;
                    container.appendChild(card.firstElementChild);

                    // Добавляем анимацию появления
                    card.firstElementChild.style.animationDelay = `${index * 50}ms`;
                    card.firstElementChild.classList.add('fade-in');
                }, index * 50);
            });
        });
    }

    static createProjectCard(project) {
        const stats = project.stats || {};
        const progress = stats.tasks_count > 0
            ? Math.round((stats.tasks_done / stats.tasks_count) * 100)
            : 0;

        return `
            <div class="project-card" data-project-hash="${project.hash}" tabindex="0"
                 aria-label="Проект ${Utils.escapeHTML(project.title)}">
                <div class="card-header">
                    <h5 class="project-title">${Utils.escapeHTML(project.title)}</h5>
                    <span class="project-status">${this.getProjectStatus(project)}</span>
                </div>
                <p class="project-description">
                    ${Utils.escapeHTML(project.description || 'Без описания')}
                </p>
                <div class="project-stats">
                    <div class="stat">
                        <i class="fas fa-users" aria-hidden="true"></i>
                        <span>${stats.members_count || 0}</span>
                        <span class="sr-only">участников</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-tasks" aria-hidden="true"></i>
                        <span>${stats.tasks_count || 0}</span>
                        <span class="sr-only">задач</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-check-circle" aria-hidden="true"></i>
                        <span>${stats.tasks_done || 0}</span>
                        <span class="sr-only">выполнено</span>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"
                         aria-label="Прогресс: ${progress}%"></div>
                </div>
                <div class="project-footer">
                    <span class="progress-text">${progress}%</span>
                    ${project.is_private ? `
                        <button class="btn btn-sm btn-outline share-btn"
                                onclick="ProjectsManager.showInviteDialog('${project.hash}')"
                                aria-label="Поделиться проектом">
                            <i class="fas fa-share-alt" aria-hidden="true"></i>
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
            <div class="task-card" data-task-id="${task.id}" tabindex="0"
                 aria-label="Задача ${Utils.escapeHTML(task.title)}">
                <div class="swipe-actions">
                    <div class="swipe-action edit-action" aria-label="Редактировать задачу">
                        <i class="fas fa-edit" aria-hidden="true"></i>
                    </div>
                    <div class="swipe-action delete-action" aria-label="Удалить задачу">
                        <i class="fas fa-trash" aria-hidden="true"></i>
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
                            <i class="fas fa-user" aria-hidden="true"></i>
                            <span>${Utils.escapeHTML(task.assignee?.full_name || 'Не назначен')}</span>
                        </div>
                        <div class="meta-item ${isOverdue ? 'overdue' : ''}">
                            <i class="fas fa-clock" aria-hidden="true"></i>
                            <span>${task.due_date ? Utils.formatDate(task.due_date) : 'Нет срока'}</span>
                            ${isOverdue ? '<span class="sr-only">Просрочено</span>' : ''}
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
            'admin': 'Администратор',
            'member': 'Участник',
            'viewer': 'Наблюдатель',
            'guest': 'Гость'
        };
        return roles[role] || role;
    }

    static getProjectStatus(project) {
        if (!project) return 'Неизвестно';

        if (project.is_private) {
            return project.requires_approval
                ? 'Приватный (требует одобрения)'
                : 'Приватный';
        }
        return 'Публичный';
    }

    // ==================== СОСТОЯНИЯ ИНТЕРФЕЙСА ====================

    static showLoadingState(container) {
        if (!container) return;

        container.innerHTML = `
            <div class="loading-state" aria-live="polite" aria-busy="true">
                <div class="spinner" aria-hidden="true"></div>
                <p>Загрузка...</p>
            </div>
        `;
    }

    static showErrorState(container, message = 'Ошибка загрузки', retryCallback = null) {
        if (!container) return;

        let retryButton = '';
        if (retryCallback && typeof retryCallback === 'function') {
            retryButton = `
                <button class="btn btn-primary" onclick="UIComponents.retryAction()">
                    <i class="fas fa-refresh"></i> Попробовать снова
                </button>
            `;
        }

        try {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>${Utils.escapeHTML(message)}</h3>
                    ${retryButton}
                </div>
            `;
        } catch (error) {
            Utils.logError('Error showing error state:', error);
        }
    }

    static retryAction() {
        if (typeof ProjectsManager !== 'undefined') {
            ProjectsManager.loadProjects();
        }
    }

    static showEmptyState(container, message = 'Данных пока нет', icon = 'fa-inbox', actionHTML = '') {
        if (!container) {
            console.warn('Container not provided for empty state');
            return;
        }

        try {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    <h3>${Utils.escapeHTML(message)}</h3>
                    ${actionHTML}
                </div>
            `;
        } catch (error) {
            Utils.logError('Error showing empty state:', error);
            container.innerHTML = '<div class="empty-state">Ошибка отображения</div>';
        }
    }

    // ==================== ШАБЛОНЫ ====================

    static renderProjectCardWithTemplate(projectData) {
        try {
            console.log('Rendering project card with data:', projectData);

            if (!projectData) {
                console.error('Invalid project data:', projectData);
                return '<div class="project-card error">Ошибка данных проекта</div>';
            }

            const project = projectData.project || projectData;
            const stats = project.stats || {};

            // Безопасное извлечение данных с приоритетом роли
            const title = project.title || 'Без названия';
            const description = project.description || 'Без описания';

            // Определяем роль с приоритетами
            let role = 'member';
            if (project.user_role) {
                role = project.user_role;
            } else if (project.current_user_role) {
                role = project.current_user_role;
            } else if (projectData.role) {
                role = projectData.role;
            }

            const isPrivate = Boolean(project.is_private);
            const requiresApproval = Boolean(project.requires_approval);

            const progress = stats.tasks_count > 0
                ? Math.round((stats.tasks_done / stats.tasks_count) * 100)
                : 0;

            const templateData = {
                id: project.id || 'unknown',
                hash: project.hash || '',
                title: title,
                description: description,
                role: role,
                roleText: this.getRoleText(role),
                membersCount: stats.members_count || 0,
                tasksCount: stats.tasks_count || 0,
                tasksDone: stats.tasks_done || 0,
                tasksInProgress: stats.tasks_in_progress || 0,
                tasksTodo: stats.tasks_todo || 0,
                progress: progress,
                isPrivate: isPrivate,
                requiresApproval: requiresApproval,
                status: this.getProjectStatus(project),
                canInvite: ['owner', 'admin'].includes(role)
            };

            console.log('Template data prepared:', templateData);

            // Используем шаблон
            const rendered = this.renderTemplate('project-card-template', templateData);

            if (!rendered) {
                console.warn('Template rendering returned empty, using fallback');
                return this.createProjectCardFallback(templateData);
            }

            return rendered;

        } catch (error) {
            Utils.logError('Error in renderProjectCardWithTemplate:', error);
            return this.createProjectCardFallback({title: 'Ошибка загрузки'});
        }
    }



    static createProjectCardFallback(project) {
        return `
            <div class="project-card" data-project-id="${project.id}" data-project-hash="${project.hash}">
                <div class="card-header">
                    <h3 class="project-title">${Utils.escapeHTML(project.title)}</h3>
                    <div class="project-badges">
                        <span class="project-privacy ${project.isPrivate ? 'private' : 'public'}">
                            ${project.isPrivate ? '🔒 Приватный' : '🌐 Публичный'}
                        </span>
                        <span class="project-role ${project.role}">
                            ${project.roleText}
                        </span>
                    </div>
                </div>

                <p class="project-description">
                    ${Utils.escapeHTML(project.description)}
                </p>

                <div class="project-stats">
                    <div class="stat">
                        <i class="fas fa-users"></i>
                        <span>${project.membersCount}</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-tasks"></i>
                        <span>${project.tasksCount}</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-check-circle"></i>
                        <span>${project.tasksDone}</span>
                    </div>
                </div>

                ${project.tasksCount > 0 ? `
                    <div class="progress-section">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${project.progress}%"></div>
                        </div>
                        <span class="progress-text">${project.progress}%</span>
                    </div>
                ` : ''}

                <div class="project-footer">
                    <div class="task-breakdown">
                        <span class="task-todo">${project.tasksTodo} к выполнению</span>
                        <span class="task-in-progress">${project.tasksInProgress} в работе</span>
                    </div>

                    ${project.canInvite && project.isPrivate ? `
                        <button class="btn btn-sm btn-outline share-btn"
                                onclick="ProjectsManager.showInviteDialog('${project.hash}')">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
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

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    static setUnsavedChanges(hasChanges) {
        StateManager.updateState('ui', ui => ({ ...ui, hasUnsavedChanges: hasChanges }));

        if (hasChanges) {
            window.addEventListener('beforeunload', this.handleBeforeUnload);
        } else {
            window.removeEventListener('beforeunload', this.handleBeforeUnload);
        }
    }

    static handleBeforeUnload(e) {
        e.preventDefault();
        e.returnValue = 'У вас есть несохраненные изменения. Вы уверены, что хотите уйти?';
        return e.returnValue;
    }

    static showOfflineIndicator() {
        const existingIndicator = document.getElementById('offline-indicator');
        if (existingIndicator) return;

        const indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.className = 'offline-indicator';
        indicator.innerHTML = `
            <i class="fas fa-wifi-slash"></i>
            <span>Отсутствует подключение к интернету</span>
        `;
        document.body.appendChild(indicator);

        setTimeout(() => {
            indicator.classList.add('show');
        }, 100);
    }

    static hideOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.classList.remove('show');
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 300);
        }
    }

    // Адаптивные методы
    static isMobileView() {
        return window.innerWidth <= 768;
    }

    static setupResponsiveBehavior() {
        const handleResize = Utils.debounce(() => {
            const isMobile = this.isMobileView();
            document.body.classList.toggle('mobile-view', isMobile);
            document.body.classList.toggle('desktop-view', !isMobile);

            EventManager.emit('ui:viewport-changed', { isMobile });
        }, 250);

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial call
    }

    // Методы доступности
    static announceToScreenReader(message) {
        const announcer = document.getElementById('screen-reader-announcer') || this.createScreenReaderAnnouncer();
        announcer.textContent = '';
        setTimeout(() => {
            announcer.textContent = message;
        }, 100);
    }

    static createScreenReaderAnnouncer() {
        const announcer = document.createElement('div');
        announcer.id = 'screen-reader-announcer';
        announcer.className = 'sr-only';
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        document.body.appendChild(announcer);
        return announcer;
    }
}

window.UIComponents = UIComponents;
