// Менеджер аутентификации
class AuthManager {
    static currentUser = null;
    static currentUserId = null;
    static isAuthenticated = false;

    static async initializeUser() {
        try {
            // Проверяем наличие токена
            const token = localStorage.getItem('access_token');

            if (!token) {
                await this.handleUnauthenticated();
                return;
            }

            // Получаем данные пользователя
            await this.loadCurrentUser();

            // Проверяем валидность токена
            if (this.currentUser) {
                this.isAuthenticated = true;
                EventManager.emit(APP_EVENTS.USER_LOGIN, this.currentUser);
                Utils.log('User authenticated successfully');
            } else {
                await this.handleUnauthenticated();
            }

        } catch (error) {
            Utils.logError('User initialization failed:', error);
            await this.handleUnauthenticated();
        }
    }

    static async loadCurrentUser() {
        try {
            const userData = await ApiService.getCurrentUser();
            this.currentUser = userData;
            this.currentUserId = userData.id;

            // Обновляем UI
            this.updateUserUI();

            EventManager.emit(APP_EVENTS.USER_UPDATE, userData);

            return userData;
        } catch (error) {
            Utils.logError('Failed to load current user:', error);
            throw error;
        }
    }

    static async handleUnauthenticated() {
        // Пытаемся аутентифицироваться через MAX или другие методы
        if (Utils.isMaxEnvironment() && window.WebApp.initDataUnsafe?.user) {
            await this.handleMaxAuth();
        } else {
            await this.handleTestAuth();
        }
    }

    static async handleMaxAuth() {
        try {
            const userData = window.WebApp.initDataUnsafe.user;
            const maxId = userData.id.toString();
            const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Пользователь MAX';
            const username = userData.username || '';

            const tokenData = await ApiService.getAuthToken(maxId, fullName, username);

            if (tokenData && tokenData.access_token) {
                localStorage.setItem('access_token', tokenData.access_token);
                this.currentUser = tokenData.user;
                this.currentUserId = this.currentUser.id;
                this.isAuthenticated = true;

                this.updateUserUI();
                EventManager.emit(APP_EVENTS.USER_LOGIN, this.currentUser);

                Utils.log('MAX user authenticated successfully');
            }
        } catch (error) {
            Utils.logError('MAX authentication failed:', error);
            await this.handleTestAuth();
        }
    }

    static async handleTestAuth() {
        try {
            // Тестовая аутентификация для разработки
            const testId = 'test_user_' + Date.now();
            const fullName = 'Тестовый Пользователь';
            const username = 'test_user';

            const tokenData = await ApiService.getAuthToken(testId, fullName, username);

            if (tokenData && tokenData.access_token) {
                localStorage.setItem('access_token', tokenData.access_token);
                this.currentUser = tokenData.user;
                this.currentUserId = this.currentUser.id;
                this.isAuthenticated = true;

                this.updateUserUI();
                EventManager.emit(APP_EVENTS.USER_LOGIN, this.currentUser);

                ToastManager.info('Режим разработки: тестовый пользователь');
                Utils.log('Test user authenticated successfully');
            }
        } catch (error) {
            Utils.logError('Test authentication failed:', error);
            this.showAuthError();
        }
    }

    static updateUserUI() {
        // Обновляем аватар пользователя
        const userAvatar = document.getElementById('user-avatar');
        if (userAvatar && this.currentUser) {
            const initials = Utils.getInitials(this.currentUser.full_name || 'Пользователь');
            userAvatar.textContent = initials;
        }

        // Обновляем другие элементы UI
        EventManager.emit(APP_EVENTS.USER_UPDATE, this.currentUser);
    }

    static showAuthError() {
        const appContainer = document.getElementById('app');
        if (appContainer) {
            appContainer.innerHTML = `
                <div class="error-container">
                    <div class="error-icon">
                        <i class="fas fa-user-slash"></i>
                    </div>
                    <h2>Ошибка авторизации</h2>
                    <p>Не удалось выполнить вход в приложение.</p>
                    <button class="btn btn-primary" onclick="location.reload()">
                        <i class="fas fa-refresh"></i> Попробовать снова
                    </button>
                </div>
            `;
        }
    }

    static async logout() {
        try {
            // Очищаем данные аутентификации
            localStorage.removeItem('access_token');
            this.currentUser = null;
            this.currentUserId = null;
            this.isAuthenticated = false;

            // Очищаем кэш
            CacheManager.clear();

            EventManager.emit(APP_EVENTS.USER_LOGOUT);
            Utils.log('User logged out successfully');

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

    static async refreshToken() {
        try {
            // В реальном приложении здесь была бы логика обновления токена
            // Для простоты просто перезагружаем пользователя
            await this.loadCurrentUser();
            return true;
        } catch (error) {
            Utils.logError('Token refresh failed:', error);
            await this.logout();
            return false;
        }
    }

    // Проверка прав доступа
    static hasPermission(action, resource, context = {}) {
        if (!this.currentUser) return false;

        const userRole = this.currentUser.role || 'member';
        return PermissionManager.can(this.currentUser, action, resource, context);
    }

    // Проверка и выполнение с проверкой прав
    static checkAndExecute(action, resource, callback, context = {}) {
        return PermissionManager.checkAndExecute(
            this.currentUser,
            action,
            resource,
            callback,
            context
        );
    }
}

// Менеджер прав доступа
class PermissionManager {
    static can(user, action, resource, context = {}) {
        const role = user?.role || 'guest';
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
            ToastManager.error('Недостаточно прав для выполнения действия');
            HapticManager.error();
            return false;
        }
    }
}

window.AuthManager = AuthManager;
window.PermissionManager = PermissionManager;
