// Конфигурация
const CONFIG = {
    API_BASE_URL: 'https://powerfully-exotic-chamois.cloudpub.ru/api'
};

// Менеджер аутентификации
class AuthManager {
    static async initialize() {
        try {
            console.log('Initializing authentication...');

            // Проверяем MAX окружение
            if (typeof WebApp !== 'undefined' && WebApp.initDataUnsafe?.user) {
                return await this.authenticateWithMax();
            } else {
                // Для разработки - тестовый пользователь
                return await this.authenticateWithTestUser();
            }
        } catch (error) {
            console.error('Authentication failed:', error);
            throw error;
        }
    }

    static async authenticateWithMax() {
        const userData = WebApp.initDataUnsafe.user;
        const maxId = userData.id.toString();
        const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Пользователь MAX';

        console.log('MAX authentication with:', { maxId, fullName });

        const tokenData = await ApiService.getAuthToken(maxId, fullName, userData.username || '');

        if (tokenData?.access_token) {
            localStorage.setItem('access_token', tokenData.access_token);
            localStorage.setItem('user_data', JSON.stringify(tokenData.user));
            console.log('MAX authentication successful');
            return tokenData.user;
        }

        throw new Error('MAX authentication failed');
    }

    static async authenticateWithTestUser() {
        const testId = 'dev_user_' + Math.random().toString(36).substr(2, 9);
        const fullName = 'Тестовый пользователь';

        console.log('Test authentication with:', { testId, fullName });

        // Для демо создаем тестового пользователя
        const testUser = {
            id: 1,
            full_name: fullName,
            username: testId,
            email: 'test@example.com'
        };

        localStorage.setItem('access_token', 'test_token_' + testId);
        localStorage.setItem('user_data', JSON.stringify(testUser));

        console.log('Test authentication successful');
        return testUser;
    }

    static getToken() {
        return localStorage.getItem('access_token');
    }

    static getUser() {
        const userData = localStorage.getItem('user_data');
        return userData ? JSON.parse(userData) : null;
    }

    static isAuthenticated() {
        return !!this.getToken();
    }

    static logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_data');
        window.location.reload();
    }

    static updateUser(userData) {
        const currentUser = this.getUser();
        const updatedUser = { ...currentUser, ...userData };
        localStorage.setItem('user_data', JSON.stringify(updatedUser));
        return updatedUser;
    }
}
