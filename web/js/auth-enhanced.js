// js/auth-enhanced.js
class EnhancedAuthManager {
    static async initialize() {
        try {
            console.log('Initializing enhanced authentication...');

            // Пробуем аутентификацию через MAX
            const maxUser = await this.tryMaxAuthentication();
            if (maxUser) {
                console.log('MAX authentication successful');
                return maxUser;
            }

            // Пробуем локальную аутентификацию
            const localUser = await this.tryLocalAuthentication();
            if (localUser) {
                console.log('Local authentication successful');
                return localUser;
            }

            // Создаем тестового пользователя для разработки
            console.log('Creating test user for development');
            return await this.createTestUser();

        } catch (error) {
            console.error('Enhanced authentication failed:', error);
            throw error;
        }
    }

    static async tryMaxAuthentication() {
        if (typeof WebApp !== 'undefined' && WebApp.initDataUnsafe?.user) {
            const userData = WebApp.initDataUnsafe.user;
            console.log('MAX user detected:', userData);

            const authData = {
                max_id: userData.id.toString(),
                full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Пользователь MAX',
                username: userData.username || '',
                photo_url: userData.photo_url || '',
                language_code: userData.language_code || 'ru',
                is_premium: userData.is_premium || false
            };

            try {
                const tokenData = await ApiService.getAuthToken(
                    authData.max_id,
                    authData.full_name,
                    authData.username
                );

                if (tokenData?.access_token) {
                    localStorage.setItem('access_token', tokenData.access_token);
                    localStorage.setItem('user_data', JSON.stringify({
                        ...authData,
                        auth_method: 'max',
                        auth_date: new Date().toISOString()
                    }));

                    console.log('MAX authentication token received');
                    return tokenData.user;
                }
            } catch (error) {
                console.error('MAX authentication API error:', error);
                // Продолжаем с другими методами аутентификации
            }
        }
        return null;
    }

    static async tryLocalAuthentication() {
        const savedToken = localStorage.getItem('access_token');
        const userDataStr = localStorage.getItem('user_data');

        if (savedToken && userDataStr) {
            try {
                const userData = JSON.parse(userDataStr);

                // Проверяем валидность токена
                const userInfo = await ApiService.getCurrentUser();
                console.log('Local authentication token valid');

                // Обновляем данные пользователя
                localStorage.setItem('user_data', JSON.stringify({
                    ...userData,
                    last_validation: new Date().toISOString()
                }));

                return userInfo;
            } catch (error) {
                console.log('Local token invalid, clearing...');
                this.clearAuthData();
            }
        }
        return null;
    }

    static async createTestUser() {
        // Создаем уникальный ID для тестового пользователя
        const testId = 'dev_user_' + Math.random().toString(36).substr(2, 9);
        const fullName = 'Тестовый пользователь';
        const username = 'test_user';

        console.log('Creating test user:', { testId, fullName, username });

        try {
            const tokenData = await ApiService.getAuthToken(testId, fullName, username);

            if (tokenData?.access_token) {
                localStorage.setItem('access_token', tokenData.access_token);
                localStorage.setItem('user_data', JSON.stringify({
                    max_id: testId,
                    full_name: fullName,
                    username: username,
                    auth_method: 'test',
                    created_at: new Date().toISOString()
                }));

                console.log('Test user authentication successful');
                return tokenData.user;
            }
        } catch (error) {
            console.error('Test user creation failed:', error);
            throw new Error('Не удалось создать тестового пользователя');
        }
    }

    static getCurrentUserData() {
        const userDataStr = localStorage.getItem('user_data');
        return userDataStr ? JSON.parse(userDataStr) : null;
    }

    static getCurrentAuthMethod() {
        const userData = this.getCurrentUserData();
        return userData ? userData.auth_method : null;
    }

    static isMaxUser() {
        return this.getCurrentAuthMethod() === 'max';
    }

    static isTestUser() {
        return this.getCurrentAuthMethod() === 'test';
    }

    static clearAuthData() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_data');
        console.log('Authentication data cleared');
    }

    static async logout() {
        this.clearAuthData();

        // Тактильная обратная связь при выходе
        if (window.hapticFeedback) {
            window.hapticFeedback.selection();
        }

        // Перезагружаем приложение
        setTimeout(() => {
            window.location.reload();
        }, 500);
    }

    static async refreshToken() {
        const userData = this.getCurrentUserData();
        if (!userData) {
            throw new Error('No user data available for token refresh');
        }

        try {
            const tokenData = await ApiService.getAuthToken(
                userData.max_id,
                userData.full_name,
                userData.username
            );

            if (tokenData?.access_token) {
                localStorage.setItem('access_token', tokenData.access_token);
                console.log('Token refreshed successfully');
                return tokenData.user;
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
            throw error;
        }
    }

    static getAuthStatus() {
        const token = localStorage.getItem('access_token');
        const userData = this.getCurrentUserData();

        return {
            isAuthenticated: !!token,
            authMethod: userData?.auth_method,
            userData: userData,
            tokenExists: !!token
        };
    }

    static async validateSession() {
        try {
            const status = this.getAuthStatus();
            if (!status.isAuthenticated) {
                return { valid: false, reason: 'not_authenticated' };
            }

            // Проверяем токен через API
            await ApiService.getCurrentUser();
            return { valid: true };

        } catch (error) {
            console.error('Session validation failed:', error);

            // Пробуем обновить токен для MAX пользователей
            if (this.isMaxUser()) {
                try {
                    await this.refreshToken();
                    return { valid: true, refreshed: true };
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                }
            }

            return { valid: false, reason: 'api_error' };
        }
    }
}

// Глобальная доступность
window.EnhancedAuthManager = EnhancedAuthManager;
