// Authentication manager
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.token = null;
        this.isAuthenticated = false;
    }

    async init() {
        console.log('Auth manager initialized');

        // Try to restore session from storage
        await this.restoreSession();

        return Promise.resolve();
    }

    // Authentication methods
    async authenticateWithMax() {
        try {
            if (typeof WebApp !== 'undefined' && WebApp.initDataUnsafe?.user) {
                return await this.authenticateWithMaxData(WebApp.initDataUnsafe.user);
            } else {
                // Fallback to test user for development
                return await this.authenticateWithTestUser();
            }
        } catch (error) {
            console.error('MAX authentication failed:', error);
            throw error;
        }
    }

    async authenticateWithMaxData(userData) {
        const maxId = userData.id.toString();
        const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Пользователь MAX';
        const username = userData.username || '';

        console.log('MAX authentication with:', { maxId, fullName, username });

        const api = window.App?.modules?.api;
        if (!api) {
            throw new Error('API service not available');
        }

        const tokenData = await api.getAuthToken(maxId, fullName, username);

        if (tokenData?.access_token) {
            this.setToken(tokenData.access_token);
            this.setCurrentUser(tokenData.user);
            console.log('MAX authentication successful');
            return tokenData.user;
        }

        throw new Error('MAX authentication failed');
    }

    async authenticateWithTestUser() {
        const testId = 'dev_user_' + Math.random().toString(36).substr(2, 9);
        const fullName = 'Тестовый пользователь';

        console.log('Test authentication with:', { testId, fullName });

        const api = window.App?.modules?.api;
        if (!api) {
            throw new Error('API service not available');
        }

        const tokenData = await api.getAuthToken(testId, fullName, '');

        if (tokenData?.access_token) {
            this.setToken(tokenData.access_token);
            this.setCurrentUser(tokenData.user);
            console.log('Test authentication successful');
            return tokenData.user;
        }

        throw new Error('Test authentication failed');
    }

    // Token management
    setToken(token) {
        this.token = token;
        this.isAuthenticated = true;
        Utils.setStorage('access_token', token);
    }

    getToken() {
        if (!this.token) {
            this.token = Utils.getStorage('access_token');
        }
        return this.token;
    }

    async refreshToken() {
        try {
            const api = window.App?.modules?.api;
            if (!api) return false;

            const tokenData = await api.refreshAuthToken();
            if (tokenData?.access_token) {
                this.setToken(tokenData.access_token);
                return true;
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
        }
        return false;
    }

    clearToken() {
        this.token = null;
        this.isAuthenticated = false;
        Utils.removeStorage('access_token');
    }

    // User management
    setCurrentUser(user) {
        this.currentUser = user;
        Utils.setStorage('current_user', user);

        // Update UI if needed
        this.updateUserUI(user);
    }

    getCurrentUser() {
        if (!this.currentUser) {
            this.currentUser = Utils.getStorage('current_user');
        }
        return this.currentUser;
    }

    async updateCurrentUser(userData) {
        try {
            const api = window.App?.modules?.api;
            if (!api) throw new Error('API service not available');

            const updatedUser = await api.updateCurrentUser(userData);
            this.setCurrentUser(updatedUser);
            return updatedUser;
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }

    // Session management
    async restoreSession() {
        const token = this.getToken();
        if (!token) {
            return false;
        }

        try {
            const api = window.App?.modules?.api;
            if (!api) return false;

            // Verify token is still valid by making a simple request
            const user = await api.getCurrentUser();
            this.setCurrentUser(user);
            this.isAuthenticated = true;
            console.log('Session restored successfully');
            return true;
        } catch (error) {
            console.error('Session restoration failed:', error);
            this.clearToken();
            return false;
        }
    }

    async logout() {
        // Clear all auth-related data
        this.clearToken();
        this.currentUser = null;
        this.isAuthenticated = false;

        // Clear user from storage
        Utils.removeStorage('current_user');

        // Clear cache
        const cache = window.App?.modules?.cache;
        if (cache) {
            cache.clear();
        }

        // Redirect to login or show auth screen
        this.showAuthScreen();

        console.log('User logged out');
    }

    // UI updates
    updateUserUI(user) {
        // Update user name in header
        const userNameElement = document.getElementById('userName');
        const userInitialsElement = document.getElementById('userInitials');

        if (userNameElement && user) {
            userNameElement.textContent = user.full_name || 'Пользователь';
        }

        if (userInitialsElement && user) {
            const initials = Utils.getInitials(user.full_name || 'Пользователь');
            userInitialsElement.textContent = initials;
        }
    }

    showAuthScreen() {
        // Implement your auth screen logic here
        // This could show a login modal or redirect to auth page
        Utils.showToast('Вы вышли из системы', 'info');

        // For now, just reload the page to trigger auth flow
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }

    // Permission checks
    canEditProject(project) {
        if (!this.isAuthenticated || !project) return false;

        const userRole = project.current_user_role;
        return userRole === 'owner' || userRole === 'admin';
    }

    canDeleteProject(project) {
        if (!this.isAuthenticated || !project) return false;
        return project.current_user_role === 'owner';
    }

    canManageMembers(project) {
        if (!this.isAuthenticated || !project) return false;
        const userRole = project.current_user_role;
        return userRole === 'owner' || userRole === 'admin';
    }

    canManageTasks(project) {
        if (!this.isAuthenticated || !project) return false;
        const userRole = project.current_user_role;
        return userRole === 'owner' || userRole === 'admin' || userRole === 'member';
    }

    // Utility methods
    isLoggedIn() {
        return this.isAuthenticated && this.token !== null;
    }

    getUserRoleInProject(project) {
        if (!project || !this.currentUser) return null;
        return project.current_user_role;
    }

    // Event handlers for auth state changes
    onAuthStateChange(callback) {
        this.authStateChangeCallbacks = this.authStateChangeCallbacks || [];
        this.authStateChangeCallbacks.push(callback);
    }

    notifyAuthStateChange() {
        if (this.authStateChangeCallbacks) {
            this.authStateChangeCallbacks.forEach(callback => {
                callback(this.isAuthenticated, this.currentUser);
            });
        }
    }

    // Security utilities
    validatePassword(password) {
        // Basic password validation
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        return {
            isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers,
            requirements: {
                length: password.length >= minLength,
                upperCase: hasUpperCase,
                lowerCase: hasLowerCase,
                numbers: hasNumbers,
                specialChar: hasSpecialChar
            }
        };
    }

    // Token expiration check
    isTokenExpired() {
        // Simple check - in real app, you'd decode JWT and check exp
        const token = this.getToken();
        if (!token) return true;

        // For now, assume token is valid if we have it
        // In production, you should properly validate JWT
        return false;
    }

    // Auto-logout on token expiration
    startTokenExpirationCheck() {
        setInterval(() => {
            if (this.isTokenExpired()) {
                console.log('Token expired, logging out...');
                this.logout();
            }
        }, 60000); // Check every minute
    }
}
