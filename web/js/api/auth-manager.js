// Менеджер аутентификации для реального приложения
class AuthManager {
    static currentUser = null;
    static currentUserId = null;
    static isAuthenticated = false;
    static tokenRefreshInterval = null;
    static maxData = null;

    static initPermissionSystem() {
        EventManager.on(APP_EVENTS.USER_UPDATE, (user) => {
            window.currentUserPermissions = PermissionManager.getPermissions(user.role);
        });

        // Также инициализируем при старте если пользователь уже залогинен
        if (this.currentUser) {
            window.currentUserPermissions = PermissionManager.getPermissions(this.currentUser.role);
        }

        Utils.log('Permission system initialized');
    }

    static extractMaxDataFromUrl() {
        try {
            // Парсим данные из хэша URL
            const urlParams = new URLSearchParams(window.location.hash.substring(1));
            const webAppData = urlParams.get('WebAppData');

            if (webAppData) {
                const params = new URLSearchParams(webAppData);
                const userJson = params.get('user');

                if (userJson) {
                    const userData = JSON.parse(decodeURIComponent(userJson));
                    const maxData = {
                        user: {
                            id: userData.id,
                            first_name: userData.first_name,
                            last_name: userData.last_name,
                            username: userData.username,
                            language_code: userData.language_code,
                            photo_url: userData.photo_url
                        },
                        auth_date: parseInt(params.get('auth_date')),
                        hash: params.get('hash'),
                        query_id: params.get('query_id'),
                        chat: JSON.parse(decodeURIComponent(params.get('chat') || '{}')),
                        ip: params.get('ip')
                    };

                    Utils.log('MAX data extracted from URL:', maxData);
                    return maxData;
                }
            }
        } catch (error) {
            Utils.logError('Error extracting MAX data from URL:', error);
        }
        return null;
    }

    static async initializeUser() {
        try {
            Utils.log('Starting user authentication process');

            // Извлекаем данные MAX из URL
            this.maxData = this.extractMaxDataFromUrl();

            // 1. Проверяем наличие валидного токена
            const token = localStorage.getItem('access_token');
            const tokenExpiry = localStorage.getItem('token_expiry');

            let userLoaded = false;
            if (token && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
                // Токен есть и не истек - пробуем загрузить пользователя
                userLoaded = await this.loadCurrentUser();
                if (userLoaded) {
                    Utils.log('User authenticated via existing token');
                    // Обновляем данные из MAX если есть (без блокировки инициализации)
                    setTimeout(() => {
                        this.updateUserFromMaxData().catch(error => {
                            Utils.logError('Non-critical error updating from MAX data:', error);
                        });
                    }, 3000);
                    return;
                }
            }

            // 2. Если токен невалиден или отсутствует - новая аутентификация
            await this.performAuthentication();

            // После успешной аутентификации
            this.startPeriodicUserUpdate();
            this.initPermissionSystem();

        } catch (error) {
            Utils.logError('User initialization failed:', error);
            await this.handleAuthenticationFailure(error);
        }
    }

    static async performAuthentication() {
        // Приоритеты аутентификации:
        // 1. MAX данные из URL
        // 2. MAX Web App
        // 3. Тестовая аутентификация (только для разработки)

        if (this.maxData && this.maxData.user) {
            Utils.log('Attempting MAX URL authentication');
            const urlSuccess = await this.handleMaxUrlAuth();
            if (urlSuccess) return;
        }

        if (Utils.isMaxEnvironment() && window.WebApp?.initDataUnsafe?.user) {
            Utils.log('Attempting MAX WebApp authentication');
            const maxSuccess = await this.handleMaxAuth();
            if (maxSuccess) return;
        }

        // Если MAX не сработал, пробуем тестовую аутентификацию (только в development)
        if (CONFIG.ENV === 'development') {
            Utils.log('Attempting test authentication (development mode)');
            const testSuccess = await this.handleTestAuth();
            if (testSuccess) return;
        }

        // Если ничего не сработало
        throw new Error('No authentication method available');
    }

    static async handleMaxUrlAuth() {
        try {
            const userData = this.maxData.user;
            const maxId = userData.id.toString();
            const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Пользователь MAX';
            const username = userData.username || '';

            Utils.log('MAX URL user data:', { maxId, fullName, username });

            const authData = {
                max_id: maxId,
                full_name: fullName,
                username: username,
                auth_date: this.maxData.auth_date,
                hash: this.maxData.hash,
                chat: this.maxData.chat
            };

            const tokenData = await ApiService.getAuthToken(maxId, fullName, username);
            if (tokenData?.access_token) {
                await this.handleSuccessfulAuth(tokenData);
                Utils.log('MAX URL authentication successful');
                return true;
            }

        } catch (error) {
            Utils.logError('MAX URL authentication failed:', error);
            // Пробуем стандартный MAX auth как fallback
            if (Utils.isMaxEnvironment() && window.WebApp?.initDataUnsafe?.user) {
                return await this.handleMaxAuth();
            }
        }
        return false;
    }

    static startPeriodicUserUpdate() {
        // Обновляем данные пользователя каждые 5 минут
        setInterval(async () => {
            if (this.isAuthenticated) {
                try {
                    await this.loadCurrentUser();
                    Utils.log('Periodic user data update completed');
                } catch (error) {
                    Utils.logError('Periodic user update failed:', error);
                }
            }
        }, 5 * 60 * 1000); // 5 минут
    }

    static async handleMaxAuth() {
        try {
            const userData = window.WebApp.initDataUnsafe.user;
            const maxId = userData.id.toString();
            const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Пользователь MAX';
            const username = userData.username || '';

            Utils.log('MAX user data:', { maxId, fullName, username });

            const authData = {
                max_id: maxId,
                full_name: fullName,
                username: username,
                auth_date: window.WebApp.initDataUnsafe.auth_date,
                hash: window.WebApp.initDataUnsafe.hash
            };

            const tokenData = await ApiService.getAuthToken(maxId, fullName, username);

            if (tokenData?.access_token) {
                await this.handleSuccessfulAuth(tokenData);
                Utils.log('MAX authentication successful');
                return true;
            }
        } catch (error) {
            Utils.logError('MAX authentication failed:', error);

            // Если ошибка API, пробуем без дополнительных данных
            if (error.status >= 400) {
                return await this.fallbackMaxAuth();
            }
        }

        return false;
    }

    static async fallbackMaxAuth() {
        try {
            const userData = window.WebApp.initDataUnsafe.user;
            const maxId = userData.id.toString();
            const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Пользователь MAX';

            Utils.log('Attempting fallback MAX authentication');

            const tokenData = await ApiService.getAuthToken(maxId, fullName, '');

            if (tokenData?.access_token) {
                await this.handleSuccessfulAuth(tokenData);
                Utils.log('Fallback MAX authentication successful');
                return true;
            }
        } catch (error) {
            Utils.logError('Fallback MAX authentication failed:', error);
        }

        return false;
    }

    static async handleTestAuth() {
        // Только для режима разработки
        if (CONFIG.ENV !== 'development') {
            return false;
        }

        try {
            const testId = 'dev_user_' + Math.random().toString(36).substr(2, 9);
            const fullName = 'Разработчик';
            const username = 'developer';

            Utils.log('Test authentication with:', { testId, fullName, username });

            const tokenData = await ApiService.getAuthToken(testId, fullName, username);

            if (tokenData?.access_token) {
                await this.handleSuccessfulAuth(tokenData);

                // Показываем уведомление только в development
                if (typeof ToastManager !== 'undefined') {
                    ToastManager.info('Режим разработки: тестовый пользователь', { duration: 3000 });
                }

                Utils.log('Test authentication successful');
                return true;
            }
        } catch (error) {
            Utils.logError('Test authentication failed:', error);
        }

        return false;
    }

    static async handleSuccessfulAuth(tokenData) {
        // Сохраняем токен
        localStorage.setItem('access_token', tokenData.access_token);

        // В нашем API нет информации о времени жизни токена
        // Используем консервативный подход: 12 часов для безопасности
        const expiryTime = Date.now() + (12 * 60 * 60 * 1000); // 12 часов
        localStorage.setItem('token_expiry', expiryTime.toString());

        // Сохраняем время последней успешной аутентификации
        localStorage.setItem('last_auth_time', Date.now().toString());

        // Сохраняем данные пользователя
        this.currentUser = tokenData.user;
        this.currentUserId = tokenData.user?.id;
        this.isAuthenticated = true;

        // Запускаем периодическую проверку токена
        this.startTokenRefresh();

        // Обновляем UI
        this.updateUserUI();

        // Отправляем событие успешной аутентификации
        EventManager.emit(APP_EVENTS.USER_LOGIN, this.currentUser);

        Utils.log('Authentication successful', {
            user: this.currentUser?.full_name,
            id: this.currentUserId,
            maxData: !!this.maxData
        });
    }

    // НЕ ОТПРАВЛЯЕМ photo_url на сервер — только используем локально
    static async updateUserFromMaxData() {
        if (!this.maxData || !this.maxData.user || !this.isAuthenticated) {
            return;
        }

        try {
            const maxUser = this.maxData.user;
            const currentUser = this.currentUser;

            // Обновляем только локальные данные и UI
            const updates = {};

            const maxFullName = `${maxUser.first_name || ''} ${maxUser.last_name || ''}`.trim();
            if (maxFullName && maxFullName !== 'Пользователь MAX' && maxFullName !== currentUser.full_name) {
                updates.full_name = maxFullName;
            }

            if (maxUser.username && !currentUser.username) {
                updates.username = maxUser.username;
            }

            // photo_url НЕ отправляем — только локально
            if (maxUser.photo_url && maxUser.photo_url.includes('oneme.ru')) {
                updates.photo_url = maxUser.photo_url;
            }

            if (Object.keys(updates).length === 0) {
                Utils.log('No local user updates needed from MAX data');
                return;
            }

            // Обновляем только локально
            this.currentUser = { ...this.currentUser, ...updates };
            this.updateUserUI();
            EventManager.emit(APP_EVENTS.USER_UPDATE, this.currentUser);

            Utils.log('Local user profile updated from MAX data', updates);

        } catch (error) {
            Utils.logError('Error updating local user from MAX data:', error);
        }
    }

    static async loadCurrentUser() {
        try {
            const userData = await ApiService.getCurrentUser();
            this.currentUser = userData;
            this.currentUserId = userData.id;
            this.isAuthenticated = true;

            // Обновляем UI с учётом MAX данных
            this.updateUserUI();

            EventManager.emit(APP_EVENTS.USER_UPDATE, userData);

            Utils.log('Current user loaded successfully');
            return true;

        } catch (error) {
            Utils.logError('Failed to load current user:', error);
            // Если ошибка аутентификации - очищаем токен
            if (error.status === 401 || error.message?.includes('401')) {
                Utils.log('Token invalid, clearing authentication data');
                this.clearAuthData();
                // Перезагружаем страницу для повторной аутентификации
                setTimeout(() => window.location.reload(), 1000);
            }
            return false;
        }
    }

    static startTokenRefresh() {
        // Очищаем предыдущий интервал
        if (this.tokenRefreshInterval) {
            clearInterval(this.tokenRefreshInterval);
        }

        // Проверяем токен каждые 30 минут
        this.tokenRefreshInterval = setInterval(async () => {
            if (this.isAuthenticated) {
                await this.refreshToken();
            }
        }, 30 * 60 * 1000);

        // Дополнительно: проверяем токен при возвращении на вкладку
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isAuthenticated) {
                // Если пользователь вернулся на вкладку после долгого отсутствия
                const lastAuth = parseInt(localStorage.getItem('last_auth_time') || '0');
                if (Date.now() - lastAuth > 60 * 60 * 1000) { // Больше часа
                    this.refreshToken();
                }
            }
        });
    }

    static async refreshToken() {
        try {
            // Используем существующий метод аутентификации для обновления токена
            if (Utils.isMaxEnvironment() && window.WebApp?.initDataUnsafe?.user) {
                return await this.handleMaxAuth();
            }
            return await this.handleTestAuth();
        } catch (error) {
            Utils.logError('Token refresh failed:', error);
            this.clearAuthData();
            window.location.reload();
        }
    }

    static async validateToken() {
        try {
            // Проверяем expiry time из localStorage
            const expiry = localStorage.getItem('token_expiry');
            if (expiry && Date.now() >= parseInt(expiry)) {
                Utils.log('Token expired based on local expiry time');
                return false;
            }

            // Делаем легковесный запрос для проверки токена
            await ApiService.getCurrentUser();
            return true;
        } catch (error) {
            // Если ошибка 401 - токен невалиден
            if (error.status === 401 || error.message?.includes('401')) {
                Utils.log('Token invalid - server returned 401');
                return false;
            }

            // Для других ошибок (network и т.д.) считаем токен валидным
            // чтобы не разрывать сессию из-за временных проблем
            Utils.log('Token validation failed due to network error, assuming valid');
            return true;
        }
    }

    static updateUserUI() {
        if (!this.currentUser) return;

        // Используем данные из MAX если есть
        let displayUser = { ...this.currentUser };
        if (this.maxData && this.maxData.user) {
            const maxUser = this.maxData.user;
            displayUser = {
                ...displayUser,
                // Приоритет у MAX данных для отображения
                full_name: maxUser.first_name && maxUser.last_name ?
                    `${maxUser.first_name} ${maxUser.last_name}` : displayUser.full_name,
                photo_url: maxUser.photo_url || displayUser.photo_url
            };
        }

        // Обновляем аватар пользователя
        const userAvatar = document.getElementById('user-avatar');
        if (userAvatar) {
            const initials = Utils.getInitials(displayUser.full_name || 'Пользователь');
            userAvatar.textContent = initials;

            // Добавляем фото если есть (приоритет у MAX фото)
            if (displayUser.photo_url) {
                userAvatar.style.backgroundImage = `url(${displayUser.photo_url})`;
                userAvatar.textContent = '';
            }
        }

        // Обновляем имя пользователя в настройках если есть элемент
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = displayUser.full_name || 'Пользователь';
        }

        // Обновляем информацию в настройках через UIComponents
        if (typeof UIComponents !== 'undefined') {
            UIComponents.updateUserInfo(displayUser);
            UIComponents.updateAccountSettingsInfo(displayUser);
        }

        EventManager.emit(APP_EVENTS.USER_UPDATE, displayUser);
    }

    static getMaxUserId() {
        if (this.maxData && this.maxData.user) {
            return this.maxData.user.id;
        }
        return this.currentUser?.max_id || this.currentUser?.id;
    }

    static getMaxLanguage() {
        if (this.maxData && this.maxData.user && this.maxData.user.language_code) {
            return this.maxData.user.language_code;
        }
        return 'ru'; // fallback
    }

    static async handleAuthenticationFailure(error) {
        Utils.logError('Authentication failed:', error);

        // Показываем пользовательский интерфейс ошибки
        this.showAuthError(error);

        // Отправляем событие ошибки аутентификации
        EventManager.emit(APP_EVENTS.AUTH_ERROR, error);
    }

    static showAuthError(error) {
        const appContainer = document.getElementById('app');
        if (!appContainer) return;

        const errorMessage = this.getErrorMessage(error);

        appContainer.innerHTML = `
            <div class="error-container" style="padding: 2rem; text-align: center;">
                <div class="error-icon" style="font-size: 4rem; color: var(--danger-color); margin-bottom: 1rem;">
                    <i class="fas fa-user-slash"></i>
                </div>
                <h2 style="color: var(--text-primary); margin-bottom: 1rem;">Ошибка авторизации</h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">${errorMessage}</p>
                <div class="error-actions" style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="location.reload()" style="padding: 0.5rem 1rem;">
                        <i class="fas fa-refresh"></i> Попробовать снова
                    </button>
                    <button class="btn btn-outline" onclick="AuthManager.showDebugInfo()" style="padding: 0.5rem 1rem;">
                        <i class="fas fa-bug"></i> Информация для поддержки
                    </button>
                </div>
            </div>
        `;
    }

    static getErrorMessage(error) {
        if (error.status === 401) {
            return 'Недействительные учетные данные. Пожалуйста, войдите снова.';
        }
        if (error.status === 403) {
            return 'Доступ запрещен.';
        }
        if (error.status === 429) {
            return 'Слишком много попыток входа. Попробуйте позже.';
        }
        if (error.message?.includes('network') || error.message?.includes('Network')) {
            return 'Проблемы с подключением к интернету. Проверьте соединение.';
        }

        return 'Не удалось выполнить вход в приложение. Пожалуйста, попробуйте позже.';
    }

    static clearAuthData() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('token_expiry');
        localStorage.removeItem('last_auth_time');
        this.currentUser = null;
        this.currentUserId = null;
        this.isAuthenticated = false;

        if (this.tokenRefreshInterval) {
            clearInterval(this.tokenRefreshInterval);
            this.tokenRefreshInterval = null;
        }
    }

    static async logout() {
        try {
            Utils.log('Logging out user');

            this.clearAuthData();

            // Очищаем кэш
            if (typeof CacheManager !== 'undefined') {
                CacheManager.clear();
            }

            // Отправляем событие выхода
            EventManager.emit(APP_EVENTS.USER_LOGOUT);

            // Показываем сообщение
            if (typeof ToastManager !== 'undefined') {
                ToastManager.success('Вы вышли из системы');
            }

            Utils.log('User logged out successfully');

            // Перезагружаем страницу для чистого состояния
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error) {
            Utils.logError('Logout error:', error);
            throw error;
        }
    }

    static getCurrentUser() {
        return this.currentUser;
    }

    static getCurrentUserId() {
        return this.currentUserId;
    }

    static isUserAuthenticated() {
        return this.isAuthenticated && !!localStorage.getItem('access_token');
    }

    static getAuthToken() {
        return localStorage.getItem('access_token');
    }

    // Методы для отладки
    static showDebugInfo() {
        const authInfo = {
            isAuthenticated: this.isAuthenticated,
            currentUser: this.currentUser ? {
                id: this.currentUser.id,
                name: this.currentUser.full_name,
                role: this.currentUser.role
            } : null,
            hasToken: !!localStorage.getItem('access_token'),
            tokenExpiry: localStorage.getItem('token_expiry'),
            lastAuthTime: localStorage.getItem('last_auth_time'),
            maxEnvironment: Utils.isMaxEnvironment(),
            maxUser: window.WebApp?.initDataUnsafe?.user
        };

        console.log('Auth Debug Info:', authInfo);

        if (typeof ModalManager !== 'undefined') {
            ModalManager.showModal('auth-debug', {
                title: 'Информация об аутентификации',
                template: `
                    <div class="debug-info">
                        <pre><code>${JSON.stringify(authInfo, null, 2)}</code></pre>
                    </div>
                `,
                actions: [
                    {
                        text: 'Закрыть',
                        type: 'secondary',
                        action: 'close'
                    },
                    {
                        text: 'Перезагрузить',
                        type: 'primary',
                        action: 'custom',
                        onClick: () => location.reload()
                    }
                ]
            });
        }
    }
}

// Менеджер прав доступа
class PermissionManager {
  static can(user, action, resource, context = {}) {
      if (!user) return false;

      const role = user.role || 'member';
      const projectRole = context.project?.current_user_role || context.project?.user_role;
      const effectiveRole = projectRole || role;

      const permissions = this.getPermissions(effectiveRole);
      return permissions[resource]?.includes(action) || false;
  }

  static getPermissions(role) {
      const matrix = {
          'owner': {
              'project': ['read', 'write', 'delete', 'transfer', 'configure'],
              'task': ['create', 'read', 'update', 'delete', 'assign'],
              'team': ['invite', 'remove', 'promote', 'demote'],
              'settings': ['modify'],
              'notifications': ['read', 'manage']
          },
          'admin': {
              'project': ['read', 'write', 'configure'],
              'task': ['create', 'read', 'update', 'delete', 'assign'],
              'team': ['invite', 'remove'],
              'settings': ['modify'],
              'notifications': ['read', 'manage']
          },
          'member': {
              'project': ['read'],
              'task': ['create', 'read', 'update_own'],
              'team': [],
              'settings': [],
              'notifications': ['read']
          },
          'guest': {
              'project': ['read_public'],
              'task': ['read_public'],
              'team': [],
              'settings': [],
              'notifications': []
          }
      };
      return matrix[role] || matrix.member;
  }

  static checkAndExecute(user, action, resource, callback, context = {}) {
      if (this.can(user, action, resource, context)) {
          return callback();
      } else {
          ToastManager.error('Недостаточно прав для выполнения действия');
          HapticManager.error();
          return false;
      }
  }
}

// Добавляем глобальные события аутентификации
if (typeof APP_EVENTS !== 'undefined') {
    APP_EVENTS.AUTH_ERROR = 'auth:error';
}

window.AuthManager = AuthManager;
window.PermissionManager = PermissionManager;
