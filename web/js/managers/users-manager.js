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

  static async updateUserFromMaxData() {
      try {
          const maxData = AuthManager.maxData;
          if (!maxData || !maxData.user || !AuthManager.isUserAuthenticated()) {
              return;
          }

          const maxUser = maxData.user;
          const currentUser = AuthManager.getCurrentUser();
          const updateData = {};

          // Проверяем какие данные нужно обновить
          const maxFullName = `${maxUser.first_name || ''} ${maxUser.last_name || ''}`.trim();

          // Обновляем имя если оно из MAX и лучше текущего
          if (maxFullName && maxFullName !== 'Пользователь MAX' &&
              (!currentUser.full_name || currentUser.full_name === 'Пользователь MAX')) {
              updateData.full_name = maxFullName;
          }

          // Обновляем username если его нет
          if (maxUser.username && !currentUser.username) {
              updateData.username = maxUser.username;
          }

          // Если есть изменения - обновляем профиль
          if (Object.keys(updateData).length > 0) {
              Utils.log('Updating user profile from MAX data:', updateData);
              await this.updateUserProfile(updateData);
          }

      } catch (error) {
          Utils.logError('Error updating user from MAX data:', error);
      }
  }


  static async updateAccountSettingsInfo() {
      try {
          const user = await UsersManager.loadUserDataForSettings();
          if (!user) return;

          // Используем MAX данные если есть
          let displayUser = { ...user };
          const maxData = AuthManager.maxData;
          if (maxData && maxData.user) {
              const maxUser = maxData.user;
              displayUser = {
                  ...displayUser,
                  full_name: maxUser.first_name && maxUser.last_name ?
                      `${maxUser.first_name} ${maxUser.last_name}` : displayUser.full_name,
                  photo_url: maxUser.photo_url || displayUser.photo_url
              };
          }

          const avatar = document.getElementById('settings-user-avatar');
          const name = document.getElementById('settings-user-name');
          const maxId = document.getElementById('settings-max-id');
          const role = document.getElementById('settings-user-role');

          if (avatar) {
              const initials = Utils.getInitials(displayUser.full_name || displayUser.username || 'Пользователь');
              avatar.textContent = initials;
              if (displayUser.photo_url) {
                  avatar.style.backgroundImage = `url(${displayUser.photo_url})`;
                  avatar.textContent = '';
              } else {
                  avatar.style.backgroundImage = '';
              }
          }

          if (name) {
              name.textContent = displayUser.full_name || displayUser.username || 'Пользователь';
          }

          if (maxId) {
              const displayMaxId = AuthManager.getMaxUserId() || user.max_id || user.id || 'неизвестен';
              maxId.textContent = `MAX ID: ${displayMaxId}`;
          }

          if (role) {
              const roleText = user.role ? this.getRoleText(user.role) : 'Участник';
              role.textContent = `Роль: ${roleText}`;
          }

      } catch (error) {
          Utils.logError('Error updating account settings info:', error);
      }
  }

  static addSwipePreferences() {
      // Возвращает настройки по умолчанию для свайпов
      return {
          swipe_enabled: true,
          swipe_threshold: 60,
          swipe_max_distance: 80,
          long_press_delay: 500,
          haptic_feedback: true,
          haptic_intensity: 'medium'
      };
  }

  static initSettingsIntegration() {
      // Применяем настройки при их изменении
      EventManager.on('preferences:updated', (prefs) => {
          this.applyUserPreferences(prefs);
      });

      // Загружаем и применяем настройки при старте
      this.loadAndApplyPreferences();
  }

  static async loadAndApplyPreferences() {
      try {
          const preferences = await this.loadUserPreferences();
          this.applyUserPreferences(preferences);
      } catch (error) {
          Utils.logError('Failed to load preferences:', error);
      }
  }

  static applyUserPreferences(preferences) {
      // Применяем настройки свайпов
      if (typeof SwipeManager !== 'undefined') {
          if (preferences.swipe_threshold !== undefined) {
              SwipeManager.setThreshold(preferences.swipe_threshold);
          }
          if (preferences.swipe_max_distance !== undefined) {
              SwipeManager.setMaxSwipe(preferences.swipe_max_distance);
          }
          if (preferences.long_press_delay !== undefined) {
              SwipeManager.setLongPressDelay(preferences.long_press_delay);
          }
          if (preferences.swipe_enabled !== undefined) {
              preferences.swipe_enabled ? SwipeManager.enableSwipes() : SwipeManager.disableSwipes();
          }
      }

      // Применяем настройки тактильной обратной связи
      if (typeof HapticManager !== 'undefined') {
          if (preferences.haptic_feedback !== undefined) {
              preferences.haptic_feedback ? HapticManager.enable() : HapticManager.disable();
          }
          if (preferences.haptic_intensity !== undefined) {
              HapticManager.setIntensity(preferences.haptic_intensity);
          }
      }

      // Применяем тему
      if (preferences.theme && typeof App !== 'undefined') {
          App.applyTheme(preferences.theme);
      }
  }


  static async loadUserDataForSettings() {
      try {
          const user = AuthManager.getCurrentUser();
          if (!user) return null;

          // Всегда загружаем свежие данные для настроек
          const userData = await this.loadUserProfile('me');
          const freshUser = userData.user || userData;

          // Обновляем данные из MAX
          await this.updateUserFromMaxData();

          // Сохраняем в AuthManager для консистентности
          if (typeof AuthManager !== 'undefined') {
              AuthManager.currentUser = { ...AuthManager.currentUser, ...freshUser };
          }

          return freshUser;

      } catch (error) {
          Utils.logError('Error loading user data for settings:', error);
          // Возвращаем базовые данные из AuthManager
          return AuthManager.getCurrentUser();
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
            // Очищаем данные от null/undefined/пустых значений
            const cleanData = {};
            for (const [key, value] of Object.entries(updateData)) {
                if (value !== null && value !== undefined && value !== '') {
                    cleanData[key] = value;
                }
            }

            // Проверяем что есть данные для обновления
            if (Object.keys(cleanData).length === 0) {
                Utils.log('No valid data to update in user profile');
                return null;
            }

            Utils.log('Updating user profile with data:', cleanData);
            const result = await ApiService.updateCurrentUser(cleanData);

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

            let errorMessage = 'Ошибка обновления профиля';
            if (error.message?.includes('No data provided')) {
                errorMessage = 'Нет данных для обновления';
            } else if (error.message?.includes('400')) {
                errorMessage = 'Неверный формат данных';
            } else {
                errorMessage += ': ' + error.message;
            }

            ToastManager.error(errorMessage);
            HapticManager.error();
            throw error;
        }
    }

    static updateUserUI() {
        const maxPhoto = AuthManager.maxData?.user?.photo_url;
        const fallbackPhoto = AuthManager.currentUser?.photo_url;

        const photoUrl = maxPhoto || fallbackPhoto;

        if (photoUrl) {
            userAvatar.style.backgroundImage = `url(${photoUrl})`;
            userAvatar.textContent = '';
        } else {
            userAvatar.style.backgroundImage = '';
            userAvatar.textContent = Utils.getInitials(displayUser.full_name);
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
        if (!AuthManager.isUserAuthenticated() || !AuthManager.getCurrentUser()) {
            Utils.log('User not fully authenticated, skipping preferences save');
            return;
        }

        try {
            const response = await ApiService.patchUserPreferences(preferences);
            Utils.log('Preferences updated successfully');
            return response;
        } catch (error) {
            Utils.logError('Error patching user preferences:', error);
            throw new Error('Не удалось обновить настройки');
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
        // Получаем шаблон из встроенных шаблонов
        const template = typeof UIComponents !== 'undefined' && UIComponents.templates.has('settings-modal-template') ?
            UIComponents.templates.get('settings-modal-template') :
            this.getSettingsFallbackTemplate();

        ModalManager.showModal('user-preferences', {
            title: 'Настройки пользователя',
            size: 'large',
            template: template,
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

    static setupSwipePreferenceHandlers() {
        // Обработчики для полей свайпов
        const swipeEnabled = document.getElementById('swipe-enabled');
        const swipeThreshold = document.getElementById('swipe-threshold');
        const swipeDistance = document.getElementById('swipe-max-distance');
        const longPressDelay = document.getElementById('long-press-delay');
        const hapticEnabled = document.getElementById('haptic-enabled');
        const hapticIntensity = document.getElementById('haptic-intensity');

        // Включение/выключение свайпов
        if (swipeEnabled) {
            swipeEnabled.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                if (enabled) {
                    SwipeManager.enableSwipes();
                } else {
                    SwipeManager.disableSwipes();
                }

                // Сохраняем настройку немедленно
                this.patchUserPreferences({
                    swipe_enabled: enabled
                }).catch(error => {
                    Utils.logError('Failed to save swipe preference:', error);
                });
            });
        }

        // Настройка порога свайпа
        if (swipeThreshold) {
            swipeThreshold.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                SwipeManager.setThreshold(value);

                // Обновляем значение рядом с ползунком
                const valueDisplay = document.getElementById('swipe-threshold-value');
                if (valueDisplay) {
                    valueDisplay.textContent = `${value}px`;
                }
            });

            // Сохранение при отпускании ползунка
            swipeThreshold.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                this.patchUserPreferences({
                    swipe_threshold: value
                }).catch(error => {
                    Utils.logError('Failed to save swipe threshold:', error);
                });
            });
        }

        // Максимальное расстояние свайпа
        if (swipeDistance) {
            swipeDistance.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                SwipeManager.setMaxSwipe(value);

                const valueDisplay = document.getElementById('swipe-distance-value');
                if (valueDisplay) {
                    valueDisplay.textContent = `${value}px`;
                }
            });

            swipeDistance.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                this.patchUserPreferences({
                    swipe_max_distance: value
                }).catch(error => {
                    Utils.logError('Failed to save swipe distance:', error);
                });
            });
        }

        // Задержка долгого нажатия
        if (longPressDelay) {
            longPressDelay.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                SwipeManager.setLongPressDelay(value);

                const valueDisplay = document.getElementById('long-press-value');
                if (valueDisplay) {
                    valueDisplay.textContent = `${value}ms`;
                }
            });

            longPressDelay.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                this.patchUserPreferences({
                    long_press_delay: value
                }).catch(error => {
                    Utils.logError('Failed to save long press delay:', error);
                });
            });
        }

        // Включение/выключение тактильной обратной связи
        if (hapticEnabled) {
            hapticEnabled.addEventListener('change', (e) => {
                const enabled = e.target.checked;
                if (enabled) {
                    HapticManager.enable();
                } else {
                    HapticManager.disable();
                }

                this.patchUserPreferences({
                    haptic_feedback: enabled
                }).catch(error => {
                    Utils.logError('Failed to save haptic preference:', error);
                });
            });
        }

        // Интенсивность тактильной обратной связи
        if (hapticIntensity) {
            hapticIntensity.addEventListener('change', (e) => {
                const intensity = e.target.value;
                HapticManager.setIntensity(intensity);

                this.patchUserPreferences({
                    haptic_intensity: intensity
                }).catch(error => {
                    Utils.logError('Failed to save haptic intensity:', error);
                });
            });
        }

        // Тестовые кнопки для проверки настроек
        this.addTestButtons();
    }

    static addTestButtons() {
        // Добавляем кнопки для тестирования свайпов и тактильной обратной связи
        const swipeSection = document.querySelector('.swipe-preferences-section');
        if (swipeSection && !document.getElementById('test-swipe-btn')) {
            const testHTML = `
                <div class="preference-test-buttons">
                    <h6>Тестирование настроек</h6>
                    <div class="test-buttons">
                        <button class="btn btn-sm btn-outline" id="test-swipe-btn">
                            <i class="fas fa-hand-point-up"></i> Тест свайпа
                        </button>
                        <button class="btn btn-sm btn-outline" id="test-haptic-btn">
                            <i class="fas fa-vibrate"></i> Тест вибрации
                        </button>
                        <button class="btn btn-sm btn-outline" id="test-long-press-btn">
                            <i class="fas fa-hand-rock"></i> Тест долгого нажатия
                        </button>
                    </div>
                </div>
            `;

            swipeSection.insertAdjacentHTML('beforeend', testHTML);

            // Обработчики тестовых кнопок
            document.getElementById('test-swipe-btn')?.addEventListener('click', () => {
                HapticManager.swipeAction();
                ToastManager.info('Свайп сработал! Проверьте настройки порога.');
            });

            document.getElementById('test-haptic-btn')?.addEventListener('click', () => {
                HapticManager.medium();
                ToastManager.info('Тактильная обратная связь сработала!');
            });

            document.getElementById('test-long-press-btn')?.addEventListener('click', () => {
                HapticManager.longPress();
                ToastManager.info('Долгое нажатие сработало!');
            });
        }
    }

    static createSimplePreferencesForm(preferences) {
        return `
            <form id="preferences-form">
                <div class="preferences-section">
                    <h5>Настройки свайпов и жестов</h5>

                    <div class="form-check form-switch mb-3">
                        <input class="form-check-input" type="checkbox" id="swipe-enabled"
                               ${preferences.swipe_enabled ? 'checked' : ''}>
                        <label class="form-check-label" for="swipe-enabled">
                            Включить свайп-жесты
                        </label>
                    </div>

                    <div class="form-group mb-3">
                        <label for="swipe-threshold" class="form-label">
                            Порог свайпа: <span id="swipe-threshold-value">${preferences.swipe_threshold}px</span>
                        </label>
                        <input type="range" class="form-range" id="swipe-threshold"
                               min="30" max="120" value="${preferences.swipe_threshold}">
                        <div class="form-text">Минимальное расстояние для активации свайпа</div>
                    </div>

                    <div class="form-group mb-3">
                        <label for="swipe-max-distance" class="form-label">
                            Макс. расстояние: <span id="swipe-distance-value">${preferences.swipe_max_distance}px</span>
                        </label>
                        <input type="range" class="form-range" id="swipe-max-distance"
                               min="60" max="150" value="${preferences.swipe_max_distance}">
                        <div class="form-text">Максимальное расстояние свайпа</div>
                    </div>

                    <div class="form-group mb-3">
                        <label for="long-press-delay" class="form-label">
                            Задержка долгого нажатия: <span id="long-press-value">${preferences.long_press_delay}ms</span>
                        </label>
                        <input type="range" class="form-range" id="long-press-delay"
                               min="300" max="1000" step="100" value="${preferences.long_press_delay}">
                        <div class="form-text">Время удержания для активации контекстного меню</div>
                    </div>
                </div>

                <div class="preferences-section">
                    <h5>Тактильная обратная связь</h5>

                    <div class="form-check form-switch mb-3">
                        <input class="form-check-input" type="checkbox" id="haptic-enabled"
                               ${preferences.haptic_feedback ? 'checked' : ''}>
                        <label class="form-check-label" for="haptic-enabled">
                            Включить вибрацию
                        </label>
                    </div>

                    <div class="form-group mb-3">
                        <label for="haptic-intensity" class="form-label">Интенсивность вибрации</label>
                        <select class="form-select" id="haptic-intensity">
                            <option value="low" ${preferences.haptic_intensity === 'low' ? 'selected' : ''}>Низкая</option>
                            <option value="medium" ${preferences.haptic_intensity === 'medium' ? 'selected' : ''}>Средняя</option>
                            <option value="high" ${preferences.haptic_intensity === 'high' ? 'selected' : ''}>Высокая</option>
                        </select>
                    </div>
                </div>

                <div class="preferences-section">
                    <h5>Внешний вид</h5>
                    <div class="form-group">
                        <label for="pref-theme" class="form-label">Тема</label>
                        <select class="form-select" id="pref-theme" name="theme">
                            <option value="light" ${preferences.theme === 'light' ? 'selected' : ''}>Светлая</option>
                            <option value="dark" ${preferences.theme === 'dark' ? 'selected' : ''}>Темная</option>
                        </select>
                    </div>
                </div>
            </form>
        `;
    }

    static async loadAndRenderPreferences() {
        const container = document.getElementById('preferences-content');
        if (!container) return;

        try {
            const preferences = await this.loadUserPreferences();

            // Объединяем с настройками по умолчанию
            const fullPreferences = {
                ...this.addSwipePreferences(),
                ...preferences
            };

            // Используем шаблон если доступен, иначе fallback
            if (typeof UIComponents !== 'undefined' && UIComponents.templates.has('settings-modal-template')) {
                const rendered = UIComponents.renderTemplate('settings-modal-template', fullPreferences);
                container.innerHTML = rendered;
            } else {
                // Fallback на простую форму
                container.innerHTML = this.createSimplePreferencesForm(fullPreferences);
            }

            // Настраиваем обработчики для новых полей
            this.setupSwipePreferenceHandlers();

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
                    this.showPreferencesModal();
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
