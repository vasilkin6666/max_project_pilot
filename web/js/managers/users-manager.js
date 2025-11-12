// Менеджер пользователей
class UsersManager {
    static async loadUserProfile(userId = 'me') {
        try {
            let userData;

            if (userId === 'me') {
                userData = await ApiService.getCurrentUser();
            } else {
                userData = await ApiService.getUserById(userId);
            }

            return userData;
        } catch (error) {
            Utils.logError('Error loading user profile:', error);
            throw error;
        }
    }

    // Добавить метод для загрузки данных в настройки
    static async loadUserDataForSettings() {
        try {
            const user = AuthManager.getCurrentUser();
            if (!user) return null;

            // Используем данные из AuthManager или загружаем свежие
            const userData = await this.loadUserProfile('me');
            return userData.user || userData;
        } catch (error) {
            Utils.logError('Error loading user data for settings:', error);
            // Возвращаем базовые данные из AuthManager
            return AuthManager.getCurrentUser();
        }
    }

    // Обновить метод в UIComponents для отображения данных пользователя
    static async updateAccountSettingsInfo() {
        try {
            const user = await UsersManager.loadUserDataForSettings();
            if (!user) return;

            const avatar = document.getElementById('settings-user-avatar');
            const name = document.getElementById('settings-user-name');
            const maxId = document.getElementById('settings-max-id');

            if (avatar) {
                const initials = Utils.getInitials(user.full_name || user.username || 'Пользователь');
                avatar.textContent = initials;
                avatar.style.backgroundImage = user.photo_url ? `url(${user.photo_url})` : '';
            }

            if (name) {
                name.textContent = user.full_name || user.username || 'Пользователь';
            }

            if (maxId) {
                // Отображаем MAX ID из данных пользователя
                maxId.textContent = `MAX ID: ${user.max_id || user.id || 'неизвестен'}`;
            }
        } catch (error) {
            Utils.logError('Error updating account settings info:', error);
        }
    }

    static async loadUserProjects(userId = 'me') {
        try {
            const data = await ApiService.getUserProjects(userId);
            return data.projects || [];
        } catch (error) {
            Utils.logError('Error loading user projects:', error);
            throw error;
        }
    }

    static async updateUserProfile(updateData) {
        try {
            const result = await ApiService.updateCurrentUser(updateData);

            if (result && result.user) {
                // Обновляем текущего пользователя в AuthManager
                if (typeof AuthManager !== 'undefined') {
                    AuthManager.currentUser = { ...AuthManager.currentUser, ...result.user };
                    EventManager.emit(APP_EVENTS.USER_UPDATE, AuthManager.currentUser);
                }

                ToastManager.success('Профиль обновлен');
                HapticManager.success();
                return result.user;
            }

            throw new Error('Не удалось обновить профиль');
        } catch (error) {
            Utils.logError('Error updating user profile:', error);
            ToastManager.error('Ошибка обновления профиля: ' + error.message);
            HapticManager.error();
            throw error;
        }
    }

    static async loadUserPreferences() {
        try {
            const data = await ApiService.getUserPreferences();
            return data.preferences || {};
        } catch (error) {
            Utils.logError('Error loading user preferences:', error);
            throw error;
        }
    }

    static async updateUserPreferences(preferences) {
        try {
            const result = await ApiService.updateUserPreferences({ preferences });

            if (result && result.preferences) {
                ToastManager.success('Настройки сохранены');
                HapticManager.success();
                return result.preferences;
            }

            throw new Error('Не удалось сохранить настройки');
        } catch (error) {
            Utils.logError('Error updating user preferences:', error);
            ToastManager.error('Ошибка сохранения настроек: ' + error.message);
            HapticManager.error();
            throw error;
        }
    }

    static async patchUserPreferences(preferences) {
        try {
            const result = await ApiService.patchUserPreferences({ preferences });

            if (result && result.preferences) {
                ToastManager.success('Настройки обновлены');
                HapticManager.success();
                return result.preferences;
            }

            throw new Error('Не удалось обновить настройки');
        } catch (error) {
            Utils.logError('Error patching user preferences:', error);
            ToastManager.error('Ошибка обновления настроек: ' + error.message);
            HapticManager.error();
            throw error;
        }
    }

    static async resetUserPreferences() {
        try {
            const result = await ApiService.resetUserPreferences();

            if (result && result.preferences) {
                ToastManager.success('Настройки сброшены');
                HapticManager.success();
                return result.preferences;
            }

            throw new Error('Не удалось сбросить настройки');
        } catch (error) {
            Utils.logError('Error resetting user preferences:', error);
            ToastManager.error('Ошибка сброса настроек: ' + error.message);
            HapticManager.error();
            throw error;
        }
    }

    static showUserProfileModal(userId = 'me') {
        ModalManager.showModal('user-profile', {
            title: 'Профиль пользователя',
            size: 'medium',
            template: `
                <div class="user-profile">
                    <div id="user-profile-content">
                        <div class="loading-state">
                            <div class="spinner"></div>
                            <p>Загрузка профиля...</p>
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
            ],
            onShow: () => {
                this.loadAndRenderUserProfile(userId);
            }
        });
    }

    static async loadAndRenderUserProfile(userId) {
        const container = document.getElementById('user-profile-content');
        if (!container) return;

        try {
            const [userData, userProjects] = await Promise.all([
                this.loadUserProfile(userId),
                this.loadUserProjects(userId)
            ]);

            const user = userData.user || userData;
            const isCurrentUser = userId === 'me' || user.id === AuthManager.getCurrentUserId();

            container.innerHTML = `
                <div class="profile-header">
                    <div class="profile-avatar">
                        ${Utils.getInitials(user.full_name || user.username || 'Пользователь')}
                    </div>
                    <div class="profile-info">
                        <h4>${Utils.escapeHTML(user.full_name || user.username || 'Пользователь')}</h4>
                        <p class="text-muted">@${Utils.escapeHTML(user.username || 'username')}</p>
                        ${user.role ? `<span class="role-badge">${Utils.escapeHTML(user.role)}</span>` : ''}
                    </div>
                </div>

                <div class="profile-stats">
                    <div class="stat-item">
                        <strong>${userProjects.length}</strong>
                        <span>Проектов</span>
                    </div>
                    <div class="stat-item">
                        <strong>${Utils.formatDate(user.created_at)}</strong>
                        <span>Дата регистрации</span>
                    </div>
                </div>

                ${isCurrentUser ? `
                    <div class="profile-actions">
                        <button class="btn btn-outline-primary" onclick="UsersManager.showEditProfileModal()">
                            <i class="fas fa-edit"></i> Редактировать профиль
                        </button>
                        <button class="btn btn-outline-secondary" onclick="UsersManager.showPreferencesModal()">
                            <i class="fas fa-cog"></i> Настройки
                        </button>
                    </div>
                ` : ''}

                ${userProjects.length > 0 ? `
                    <div class="profile-projects">
                        <h5>Проекты</h5>
                        <div class="projects-list">
                            ${userProjects.slice(0, 5).map(project => `
                                <div class="project-item" onclick="ProjectsManager.openProjectDetail('${project.hash}')">
                                    <span class="project-title">${Utils.escapeHTML(project.title)}</span>
                                    <span class="project-role">${Utils.escapeHTML(project.role)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            `;

        } catch (error) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Ошибка загрузки профиля</h3>
                    <p>${Utils.escapeHTML(error.message)}</p>
                    <button class="btn btn-primary" onclick="UsersManager.loadAndRenderUserProfile('${userId}')">
                        <i class="fas fa-refresh"></i> Попробовать снова
                    </button>
                </div>
            `;
        }
    }

    static showEditProfileModal() {
        const currentUser = AuthManager.getCurrentUser();
        if (!currentUser) return;

        ModalManager.showModal('edit-profile', {
            title: 'Редактирование профиля',
            size: 'medium',
            template: `
                <form id="edit-profile-form">
                    <div class="form-group">
                        <label for="edit-full-name" class="form-label">Полное имя</label>
                        <input type="text" class="form-control" id="edit-full-name"
                               value="${Utils.escapeHTML(currentUser.full_name || '')}"
                               placeholder="Введите ваше полное имя">
                    </div>
                    <div class="form-group">
                        <label for="edit-username" class="form-label">Имя пользователя</label>
                        <input type="text" class="form-control" id="edit-username"
                               value="${Utils.escapeHTML(currentUser.username || '')}"
                               placeholder="Введите имя пользователя">
                    </div>
                    <div class="form-group">
                        <label for="edit-email" class="form-label">Email</label>
                        <input type="email" class="form-control" id="edit-email"
                               value="${Utils.escapeHTML(currentUser.email || '')}"
                               placeholder="Введите email">
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
                    onClick: () => this.handleEditProfileSubmit()
                }
            ]
        });
    }

    static async handleEditProfileSubmit() {
        const form = document.getElementById('edit-profile-form');
        if (!form) return;

        const fullName = document.getElementById('edit-full-name').value.trim();
        const username = document.getElementById('edit-username').value.trim();
        const email = document.getElementById('edit-email').value.trim();

        const updateData = {};
        if (fullName) updateData.full_name = fullName;
        if (username) updateData.username = username;
        if (email) updateData.email = email;

        if (Object.keys(updateData).length === 0) {
            ToastManager.info('Нет изменений для сохранения');
            return;
        }

        try {
            await this.updateUserProfile(updateData);
            ModalManager.closeCurrentModal();
        } catch (error) {
            // Ошибка уже обработана в updateUserProfile
        }
    }

    static showPreferencesModal() {
        ModalManager.showModal('user-preferences', {
            title: 'Настройки пользователя',
            size: 'large',
            template: `
                <div class="user-preferences">
                    <div id="preferences-content">
                        <div class="loading-state">
                            <div class="spinner"></div>
                            <p>Загрузка настроек...</p>
                        </div>
                    </div>
                </div>
            `,
            actions: [
                {
                    text: 'Сбросить настройки',
                    type: 'danger',
                    action: 'custom',
                    onClick: () => this.resetPreferencesWithConfirmation()
                },
                {
                    text: 'Сохранить',
                    type: 'primary',
                    action: 'submit',
                    onClick: () => this.handlePreferencesSubmit()
                },
                {
                    text: 'Закрыть',
                    type: 'secondary',
                    action: 'close'
                }
            ],
            onShow: () => {
                this.loadAndRenderPreferences();
            }
        });
    }

    static async loadAndRenderPreferences() {
        const container = document.getElementById('preferences-content');
        if (!container) return;

        try {
            const preferences = await this.loadUserPreferences();

            container.innerHTML = `
                <form id="preferences-form">
                    <div class="preferences-section">
                        <h5>Внешний вид</h5>
                        <div class="form-group">
                            <label for="pref-theme" class="form-label">Тема</label>
                            <select class="form-select" id="pref-theme" name="theme">
                                <option value="light" ${preferences.theme === 'light' ? 'selected' : ''}>Светлая</option>
                                <option value="dark" ${preferences.theme === 'dark' ? 'selected' : ''}>Темная</option>
                                <option value="auto" ${preferences.theme === 'auto' ? 'selected' : ''}>Авто</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="pref-language" class="form-label">Язык</label>
                            <select class="form-select" id="pref-language" name="language">
                                <option value="ru" ${preferences.language === 'ru' ? 'selected' : ''}>Русский</option>
                                <option value="en" ${preferences.language === 'en' ? 'selected' : ''}>English</option>
                            </select>
                        </div>
                    </div>

                    <div class="preferences-section">
                        <h5>Уведомления</h5>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="pref-notifications"
                                   name="notifications_enabled" ${preferences.notifications_enabled ? 'checked' : ''}>
                            <label class="form-check-label" for="pref-notifications">
                                Включить уведомления
                            </label>
                        </div>

                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="pref-email-notifications"
                                   name="email_notifications" ${preferences.email_notifications ? 'checked' : ''}>
                            <label class="form-check-label" for="pref-email-notifications">
                                Email уведомления
                            </label>
                        </div>
                    </div>

                    <div class="preferences-section">
                        <h5>Интерфейс</h5>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="pref-compact-view"
                                   name="compact_view" ${preferences.compact_view ? 'checked' : ''}>
                            <label class="form-check-label" for="pref-compact-view">
                                Компактный вид
                            </label>
                        </div>

                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="pref-show-completed"
                                   name="show_completed_tasks" ${preferences.show_completed_tasks ? 'checked' : ''}>
                            <label class="form-check-label" for="pref-show-completed">
                                Показывать завершенные задачи
                            </label>
                        </div>
                    </div>
                </form>
            `;

        } catch (error) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Ошибка загрузки настроек</h3>
                    <p>${Utils.escapeHTML(error.message)}</p>
                    <button class="btn btn-primary" onclick="UsersManager.loadAndRenderPreferences()">
                        <i class="fas fa-refresh"></i> Попробовать снова
                    </button>
                </div>
            `;
        }
    }

    static async handlePreferencesSubmit() {
        const form = document.getElementById('preferences-form');
        if (!form) return;

        const formData = new FormData(form);
        const preferences = Object.fromEntries(formData.entries());

        // Конвертируем checkbox значения в boolean
        preferences.notifications_enabled = preferences.notifications_enabled === 'on';
        preferences.email_notifications = preferences.email_notifications === 'on';
        preferences.compact_view = preferences.compact_view === 'on';
        preferences.show_completed_tasks = preferences.show_completed_tasks === 'on';

        try {
            await this.updateUserPreferences(preferences);
            ModalManager.closeCurrentModal();

            // Применяем тему сразу
            if (preferences.theme && typeof App !== 'undefined') {
                App.applyTheme(preferences.theme);
            }
        } catch (error) {
            // Ошибка уже обработана в updateUserPreferences
        }
    }

    static resetPreferencesWithConfirmation() {
        ModalManager.showConfirmation({
            title: 'Сброс настроек',
            message: 'Вы уверены, что хотите сбросить все настройки к значениям по умолчанию?',
            confirmText: 'Сбросить',
            cancelText: 'Отмена',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await this.resetUserPreferences();
                    ModalManager.closeCurrentModal();
                    this.showPreferencesModal(); // Перезагружаем модалку
                } catch (error) {
                    // Ошибка уже обработана
                }
            }
        });
    }

    // Инициализация менеджера
    static init() {
        Utils.log('Users manager initialized');
    }
}

window.UsersManager = UsersManager;
