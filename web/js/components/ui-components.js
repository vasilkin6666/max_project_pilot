//ui-components.js
// Компоненты пользовательского интерфейса (полная исправленная версия)
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
            const templateFiles = [
                'templates/project-card.html',
                'templates/task-card.html',
                'templates/notification-item.html',
                'templates/modals/create-project.html',
                'templates/modals/create-task.html',
                'templates/modals/settings.html'
            ];

            let loadedCount = 0;

            for (const file of templateFiles) {
                try {
                    const response = await fetch(file);
                    if (response.ok) {
                        const html = await response.text();
                        const templateMatch = html.match(/<script[^>]*id="([^"]+)"[^>]*type="text\/template"[^>]*>([\s\S]*?)<\/script>/);
                        if (templateMatch) {
                            const templateId = templateMatch[1];
                            const templateContent = templateMatch[2];
                            this.templates.set(templateId, templateContent);
                            loadedCount++;
                            console.log(`✅ Loaded template: ${templateId} from ${file}`);
                        } else {
                            console.warn(`❌ No template found in: ${file}`);
                        }
                    } else {
                        console.warn(`❌ Failed to load template: ${file}`, response.status);
                    }
                } catch (error) {
                    Utils.logError(`Error loading template ${file}:`, error);
                }
            }

            // Также загружаем шаблоны из существующих script элементов
            const templateElements = document.querySelectorAll('script[type="text/template"]');
            for (const element of templateElements) {
                const id = element.id;
                const content = element.innerHTML;
                this.templates.set(id, content);
                loadedCount++;
                console.log(`✅ Loaded inline template: ${id}`);
            }

            Utils.log('Templates loaded', { count: loadedCount });

            // Проверяем наличие ключевых шаблонов
            const requiredTemplates = ['project-card-template', 'task-card-template'];
            requiredTemplates.forEach(templateId => {
                if (!this.templates.has(templateId)) {
                    console.error(`🚨 REQUIRED TEMPLATE MISSING: ${templateId}`);
                } else {
                    console.log(`✅ Required template available: ${templateId}`);
                }
            });

        } catch (error) {
            Utils.logError('Error loading templates:', error);
        }
    }

    static renderTemplate(templateId, data) {
        const template = this.templates.get(templateId);
        if (!template) {
            Utils.logError(`Template not found: ${templateId}`);
            return this.createProjectCardFallback(data);
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
            return this.createProjectCardFallback(data);
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

                if (typeof HapticManager !== 'undefined') {
                    HapticManager.toggleSwitch();
                }
            });
        }

        // Кнопка переключения темы в мобильном меню
        const mobileThemeBtn = document.getElementById('mobile-theme-btn');
        if (mobileThemeBtn) {
            mobileThemeBtn.addEventListener('click', () => {
                const newTheme = App.toggleTheme();
                mobileThemeBtn.innerHTML = newTheme === 'dark'
                    ? '<i class="fas fa-sun"></i> Светлая тема'
                    : '<i class="fas fa-moon"></i> Тёмная тема';

                if (typeof HapticManager !== 'undefined') {
                    HapticManager.toggleSwitch();
                }
            });
        }

        Utils.log('Theme system initialized');
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
        // Кнопка уведомлений
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => {
                this.showView('notifications-view');
                // Обновляем навигацию
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                document.querySelector('.nav-item[data-view="notifications-view"]')?.classList.add('active');

                if (typeof HapticManager !== 'undefined') {
                    HapticManager.buttonPress();
                }
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

        // Кнопка настроек
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
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

        Utils.log('Event listeners initialized');
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
                            <option value="progress">Прогрессу</option>
                            <option value="tasks">Количеству задач</option>
                            <option value="updated">Дате обновления</option>
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

        // Здесь можно добавить логику фильтрации
        ToastManager.info('Фильтры применены');
        ModalManager.closeCurrentModal();
    }

    static applySort() {
        const sortBy = document.getElementById('project-sort-by').value;
        const sortOrder = document.getElementById('project-sort-order').value;

        // Здесь можно добавить логику сортировки
        ToastManager.info('Сортировка применена');
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

            // Очищаем контейнер безопасно
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }

            if (!projects || !Array.isArray(projects) || projects.length === 0) {
                this.showEmptyState(container, 'Проектов пока нет', 'fa-folder-open', `
                    <button class="btn btn-primary" onclick="ProjectsManager.showCreateProjectModal()">
                        <i class="fas fa-plus"></i> Создать проект
                    </button>
                `);
                return;
            }

            // Рендерим проекты с задержкой для анимации
            projects.forEach((projectData, index) => {
                setTimeout(() => {
                    try {
                        const project = projectData.project || projectData;
                        const cardHTML = this.renderProjectCardWithTemplate(project);

                        if (!cardHTML) {
                            console.error('Empty card HTML for project:', project);
                            return;
                        }

                        const cardWrapper = document.createElement('div');
                        cardWrapper.innerHTML = cardHTML;

                        const cardElement = cardWrapper.firstElementChild;
                        if (!cardElement) {
                            console.error('Could not create card element for project:', project);
                            return;
                        }

                        // Добавляем анимацию появления
                        cardElement.style.opacity = '0';
                        cardElement.style.transform = 'translateY(20px)';
                        cardElement.classList.add('fade-in');

                        container.appendChild(cardElement);

                        // Анимация появления
                        requestAnimationFrame(() => {
                            cardElement.style.opacity = '1';
                            cardElement.style.transform = 'translateY(0)';
                            cardElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
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

            // Безопасное извлечение данных
            const title = project.title || 'Без названия';
            const description = project.description || 'Без описания';
            const role = project.user_role || projectData.role || 'member';
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
            console.log('Rendered template:', rendered);

            return rendered || this.createProjectCardFallback(templateData);

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
