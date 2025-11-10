class AuthManager {
    static currentUserId = null;
    static currentUser = null;
    static isMaxEnvironment = typeof window.WebApp !== 'undefined';

    static async initializeUser() {
        if (this.isMaxEnvironment && window.WebApp.initDataUnsafe?.user) {
            await this.handleMaxUserAuth(window.WebApp.initDataUnsafe.user);
        } else {
            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get('user_id');

            if (userId) {
                await this.handleUrlUserAuth(userId);
            } else {
                await this.handleTestUserAuth();
            }
        }
    }

    static async handleMaxUserAuth(userData) {
        try {
            const maxId = userData.id.toString();
            const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Пользователь MAX';
            const username = userData.username || '';

            Utils.log(`MAX user authentication: ${fullName} (${maxId})`);

            const tokenData = await ApiService.apiGetAuthToken(maxId, fullName, username);

            if (tokenData && tokenData.access_token) {
                localStorage.setItem('access_token', tokenData.access_token);
                this.currentUser = tokenData.user;
                this.currentUserId = this.currentUser.id;

                this.displayUserInfo(this.currentUser);
                UI.showMainInterface();

                Utils.log('MAX user authenticated successfully');

                // Загружаем данные пользователя с сервера для актуальности
                await this.loadCurrentUserData();
            } else {
                throw new Error('No access token received');
            }
        } catch (error) {
            Utils.logError('MAX user authentication failed', error);
            ToastManager.showToast('Ошибка авторизации. Пожалуйста, попробуйте снова.', 'error');
        }
    }

    static async handleUrlUserAuth(userId) {
        try {
            Utils.log(`URL user authentication: ${userId}`);

            const tokenData = await ApiService.apiGetAuthToken(userId, 'Пользователь', '');

            if (tokenData && tokenData.access_token) {
                localStorage.setItem('access_token', tokenData.access_token);
                this.currentUser = tokenData.user;
                this.currentUserId = this.currentUser.id;

                this.displayUserInfo(this.currentUser);
                UI.showMainInterface();

                Utils.log('URL user authenticated successfully');

                await this.loadCurrentUserData();
            }
        } catch (error) {
            Utils.logError('URL user authentication failed', error);
            ToastManager.showToast('Ошибка авторизации. Проверьте user_id.', 'error');
        }
    }

    static async handleTestUserAuth() {
        try {
            const testId = 'test_user_' + Date.now();
            const tokenData = await ApiService.apiGetAuthToken(testId, 'Тестовый Пользователь', 'test');

            if (tokenData && tokenData.access_token) {
                localStorage.setItem('access_token', tokenData.access_token);
                this.currentUser = tokenData.user;
                this.currentUserId = this.currentUser.id;

                this.displayUserInfo(this.currentUser);
                UI.showMainInterface();

                Utils.log('Test user authenticated successfully');
                ToastManager.showToast('Режим разработки: тестовый пользователь', 'info');

                await this.loadCurrentUserData();
            }
        } catch (error) {
            Utils.logError('Test user authentication failed', error);
            this.displayUserInfo({ full_name: 'Гость', id: 'guest' });
            UI.showMainInterface();
        }
    }

    static async loadCurrentUserData() {
        try {
            const userData = await ApiService.apiGetCurrentUser();
            this.currentUser = userData;
            this.displayUserInfo(userData);
        } catch (error) {
            Utils.logError('Failed to load current user data', error);
        }
    }

    static displayUserInfo(user) {
        const userNameElement = document.getElementById('user-name');
        const userAvatarElement = document.getElementById('user-avatar');

        if (userNameElement) {
            userNameElement.textContent = user.full_name || 'Гость';
        }

        if (userAvatarElement) {
            userAvatarElement.textContent = (user.full_name || 'Г').charAt(0).toUpperCase();
        }

        if (user.full_name) {
            localStorage.setItem('user_name', user.full_name);
        }
    }

    static getCurrentUser() {
        return this.currentUser;
    }

    static getCurrentUserId() {
        return this.currentUserId;
    }

    static isAuthenticated() {
        return !!this.currentUserId && !!localStorage.getItem('access_token');
    }

    static logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_name');
        this.currentUser = null;
        this.currentUserId = null;
        window.location.reload();
    }
}

window.AuthManager = AuthManager;
