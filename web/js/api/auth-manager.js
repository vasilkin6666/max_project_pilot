// Менеджер аутентификации для реального приложения
class AuthManager {
    static currentUser = null;
    static currentUserId = null;
    static isAuthenticated = false;
    static tokenRefreshInterval = null;

    static async initializeUser() {
        try {
            Utils.log('Starting user authentication process');

            // 1. Проверяем наличие валидного токена
            const token = localStorage.getItem('access_token');
            const tokenExpiry = localStorage.getItem('token_expiry');

            if (token && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
                // Токен есть и не истек - пробуем загрузить пользователя
                const userLoaded = await this.loadCurrentUser();
                if (userLoaded) {
                    Utils.log('User authenticated via existing token');
                    return;
                }
            }

            // 2. Если токен невалиден или отсутствует - новая аутентификация
            await this.performAuthentication();

        } catch (error) {
            Utils.logError('User initialization failed:', error);
            await this.handleAuthenticationFailure(error);
        }
    }

    static async performAuthentication() {
        // Приоритеты аутентификации:
        // 1. MAX (Telegram Web App)
        // 2. Тестовая аутентификация (только для разработки)

        if (Utils.isMaxEnvironment() && window.WebApp.initDataUnsafe?.user) {
            Utils.log('Attempting MAX authentication');
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

    static async handleMaxAuth() {
        try {
            const userData = window.WebApp.initDataUnsafe.user;
            const maxId = userData.id.toString();
            const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Пользователь MAX';
            const username = userData.username || '';
            const photoUrl = userData.photo_url || '';

            Utils.log('MAX user data:', { maxId, fullName, username });

            const authData = {
                max_id: maxId,
                full_name: fullName,
                username: username,
                photo_url: photoUrl,
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
        this.currentUserId = tokenData.user.id;
        this.isAuthenticated = true;

        // Запускаем периодическую проверку токена
        this.startTokenRefresh();

        // Обновляем UI
        this.updateUserUI();

        // Отправляем событие успешной аутентификации
        EventManager.emit(APP_EVENTS.USER_LOGIN, this.currentUser);

        Utils.log('Authentication successful', {
            user: this.currentUser.full_name,
            id: this.currentUserId
        });
    }

    static async loadCurrentUser() {
        try {
            const userData = await ApiService.getCurrentUser();

            this.currentUser = userData;
            this.currentUserId = userData.id;
            this.isAuthenticated = true;

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
            // В нашем API нет отдельного endpoint для refresh token
            // Используем стратегию silent re-authentication

            // 1. Проверяем текущий токен
            const isValid = await this.validateToken();

            if (isValid) {
                Utils.log('Token is still valid');
                return true;
            }

            Utils.log('Token expired, attempting silent re-authentication');

            // 2. Пробуем переаутентифицироваться тем же методом
            if (Utils.isMaxEnvironment() && window.WebApp.initDataUnsafe?.user) {
                // MAX аутентификация
                const success = await this.handleMaxAuth();
                if (success) {
                    Utils.log('Silent re-authentication via MAX successful');
                    return true;
                }
            }

            // 3. Если MAX не сработал, пробуем тестовую аутентификацию (только development)
            if (CONFIG.ENV === 'development') {
                const success = await this.handleTestAuth();
                if (success) {
                    Utils.log('Silent re-authentication via test auth successful');
                    return true;
                }
            }

            // 4. Если ничего не сработало - выходим
            Utils.logError('Silent re-authentication failed');
            await this.logout();
            return false;

        } catch (error) {
            Utils.logError('Token refresh failed:', error);

            // При ошибке обновления токена выходим
            await this.logout();
            return false;
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

        // Обновляем аватар пользователя
        const userAvatar = document.getElementById('user-avatar');
        if (userAvatar) {
            const initials = Utils.getInitials(this.currentUser.full_name || 'Пользователь');
            userAvatar.textContent = initials;

            // Добавляем фото если есть
            if (this.currentUser.photo_url) {
                userAvatar.style.backgroundImage = `url(${this.currentUser.photo_url})`;
                userAvatar.textContent = '';
            }
        }

        // Обновляем имя пользователя
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = this.currentUser.full_name || 'Пользователь';
        }

        EventManager.emit(APP_EVENTS.USER_UPDATE, this.currentUser);
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
        const permissions = this.getPermissions(role);

        return permissions[resource]?.includes(action) || false;
    }

    static getPermissions(role) {
        const matrix = {
            'owner': {
                'project': ['read', 'write', 'delete', 'transfer', 'configure'],
                'task': ['create', 'read', 'update', 'delete', 'assign'],
                'team': ['invite', 'remove', 'promote', 'demote'],
                'settings': ['modify']
            },
            'admin': {
                'project': ['read', 'write', 'configure'],
                'task': ['create', 'read', 'update', 'delete', 'assign'],
                'team': ['invite', 'remove'],
                'settings': ['modify']
            },
            'member': {
                'project': ['read'],
                'task': ['create', 'read', 'update_own'],
                'team': [],
                'settings': []
            },
            'guest': {
                'project': ['read_public'],
                'task': ['read_public'],
                'team': [],
                'settings': []
            }
        };

        return matrix[role] || matrix.guest;
    }

    static checkAndExecute(user, action, resource, callback, context = {}) {
        if (this.can(user, action, resource, context)) {
            return callback();
        } else {
            if (typeof ToastManager !== 'undefined') {
                ToastManager.error('Недостаточно прав для выполнения действия');
            }
            if (typeof HapticManager !== 'undefined') {
                HapticManager.error();
            }
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
