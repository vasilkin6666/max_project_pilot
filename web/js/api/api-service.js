// Сервис для работы с API
class ApiService {
    static async apiCall(endpoint, method = 'GET', data = null, params = {}) {
        const token = localStorage.getItem('access_token');
        const baseUrl = CONFIG.API_BASE_URL;

        // Формируем URL с параметрами
        let url = `${baseUrl}${endpoint}`;
        const urlParams = new URLSearchParams();

        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
                urlParams.append(key, params[key]);
            }
        });

        if (urlParams.toString()) {
            url += `?${urlParams.toString()}`;
        }

        const headers = {
            'Content-Type': 'application/json',
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            method,
            headers,
            signal: AbortSignal.timeout(CONFIG.API.TIMEOUT)
        };

        // Для GET и DELETE не добавляем body, для остальных методов добавляем
        if (data && method !== 'GET' && method !== 'DELETE') {
            config.body = JSON.stringify(data);
        }

        try {
            Utils.log(`API Call: ${method} ${url}`, data);

            const response = await fetch(url, config);

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { detail: errorText || `HTTP error! status: ${response.status}` };
                }

                throw {
                    status: response.status,
                    message: errorData.detail || `HTTP error! status: ${response.status}`,
                    data: errorData
                };
            }

            // Для DELETE запросов и 204 No Content
            if (response.status === 204 || method === 'DELETE') {
                return { success: true };
            }

            const result = await response.json();
            Utils.log(`API Response: ${method} ${url}`, result);

            return result;
        } catch (error) {
            Utils.logError(`API Error: ${method} ${url}`, error);

            if (error.name === 'TimeoutError') {
                throw new Error('Превышено время ожидания ответа от сервера');
            }

            if (error.status) {
                // Это HTTP ошибка
                throw new Error(error.message);
            }

            throw error;
        }
    }

    // В класс ApiService добавить методы для полного покрытия API
    static async getRootEndpoint() {
        return await this.apiCall('/');
    }

    static async getUserById(userId) {
        return await this.apiCall(`/users/${userId}`);
    }

    static async getUserProjects(userId = 'me') {
        return await this.apiCall(`/users/${userId}/projects`);
    }

    static async patchUserPreferences(data) {
        return await this.apiCall('/users/me/preferences', 'PATCH', data);
    }

    static async resetUserPreferences() {
        return await this.apiCall('/users/me/preferences/reset', 'PUT');
    }

    static async getTaskDependencies(taskId) {
        return await this.apiCall(`/tasks/${taskId}/dependencies`);
    }

    static async addTaskDependency(taskId, dependsOnId) {
        return await this.apiCall(`/tasks/${taskId}/dependencies`, 'POST', {
            depends_on_id: dependsOnId
        });
    }

    static async addTaskComment(taskId, content) {
        return await this.apiCall(`/tasks/${taskId}/comments`, 'POST', {
            content: content
        });
    }

    // Улучшенный метод с повторными попытками
    static async retryWithRefresh(fn, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (error.status === 401 && attempt < maxRetries) {
                    await AuthManager.refreshToken();
                    continue;
                }
                throw error;
            }
        }
    }

    // Безопасный вызов с обработкой сетевых ошибок
    static async safeApiCall(endpoint, method = 'GET', data = null, params = {}) {
        try {
            return await this.apiCall(endpoint, method, data, params);
        } catch (error) {
            if (this.isNetworkError(error)) {
                throw new Error('Проблемы с подключением к интернету. Проверьте соединение.');
            }
            throw error;
        }
    }

    // ==================== АУТЕНТИФИКАЦИЯ ====================
    static async getAuthToken(maxId, fullName, username = '') {
        return await this.apiCall('/auth/token', 'POST', {
            max_id: maxId,
            full_name: fullName,
            username: username
        });
    }

    // ==================== ПОЛЬЗОВАТЕЛИ ====================
    static async getCurrentUser() {
        return await this.apiCall('/users/me');
    }

    static async updateCurrentUser(data) {
        return await this.apiCall('/users/me', 'PUT', data);
    }

    // ДОБАВЛЕННЫЕ МЕТОДЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ
    static async getUserById(userId) {
        return await this.apiCall(`/users/${userId}`);
    }

    static async getUserProjects(userId = 'me') {
        return await this.apiCall(`/users/${userId}/projects`);
    }

    static async getRootEndpoint() {
        return await this.apiCall('/');
    }

    // ==================== НАСТРОЙКИ ПОЛЬЗОВАТЕЛЯ ====================
    static async getUserPreferences() {
        return await this.apiCall('/users/me/preferences');
    }

    static async updateUserPreferences(data) {
        return await this.apiCall('/users/me/preferences', 'PUT', data);
    }

    static async patchUserPreferences(data) {
        return await this.apiCall('/users/me/preferences', 'PATCH', data);
    }

    static async resetUserPreferences() {
        return await this.apiCall('/users/me/preferences/reset', 'PUT');
    }

    // ==================== ДАШБОРД ====================
    static async getDashboard() {
        try {
            return await this.apiCall('/dashboard/');
        } catch (error) {
            Utils.logError('Dashboard API error:', error);
            // Возвращаем fallback данные
            return {
                settings: {},
                projects: [],
                recent_tasks: []
            };
        }
    }

    // ==================== ПРОЕКТЫ ====================
    static async getProjects(filters = {}) {
        return await this.apiCall('/projects/', 'GET', null, filters);
    }

    static async createProject(projectData) {
        return await this.apiCall('/projects/', 'POST', projectData);
    }

    static async getProject(projectHash) {
        return await this.apiCall(`/projects/${projectHash}`);
    }

    static async updateProject(projectHash, updateData) {
        return await this.apiCall(`/projects/${projectHash}`, 'PUT', updateData);
    }

    static async deleteProject(projectHash) {
        return await this.apiCall(`/projects/${projectHash}`, 'DELETE');
    }

    static async getProjectSummary(projectHash) {
        return await this.apiCall(`/projects/${projectHash}/summary`);
    }

    // ==================== УЧАСТНИКИ ПРОЕКТА ====================
    static async getProjectMembers(projectHash) {
        return await this.apiCall(`/projects/${projectHash}/members`);
    }

    static async updateMemberRole(projectHash, userId, role) {
        return await this.apiCall(`/projects/${projectHash}/members/${userId}`, 'PUT', { role });
    }

    static async removeMember(projectHash, userId) {
        return await this.apiCall(`/projects/${projectHash}/members/${userId}`, 'DELETE');
    }

    // ==================== ПРИСОЕДИНЕНИЕ К ПРОЕКТУ ====================
    static async joinProject(projectHash) {
        return await this.apiCall(`/projects/${projectHash}/join`, 'POST');
    }

    static async getJoinRequests(projectHash) {
        return await this.apiCall(`/projects/${projectHash}/join-requests`);
    }

    static async approveJoinRequest(projectHash, requestId) {
        return await this.apiCall(`/projects/${projectHash}/join-requests/${requestId}/approve`, 'POST');
    }

    static async rejectJoinRequest(projectHash, requestId) {
        return await this.apiCall(`/projects/${projectHash}/join-requests/${requestId}/reject`, 'POST');
    }

    static async regenerateInvite(projectHash) {
        return await this.apiCall(`/projects/${projectHash}/regenerate-invite`, 'POST');
    }

    // ==================== ЗАДАЧИ ====================
    static async getTasks(filters = {}) {
        return await this.apiCall('/tasks/', 'GET', null, filters);
    }

    static async createTask(taskData) {
        return await this.apiCall('/tasks/', 'POST', taskData);
    }

    static async getTask(taskId) {
        return await this.apiCall(`/tasks/${taskId}`);
    }

    static async updateTask(taskId, updateData) {
        return await this.apiCall(`/tasks/${taskId}`, 'PUT', updateData);
    }

    static async deleteTask(taskId) {
        return await this.apiCall(`/tasks/${taskId}`, 'DELETE');
    }

    static async updateTaskStatus(taskId, status) {
        return await this.apiCall(`/tasks/${taskId}/status`, 'PUT', { status });
    }

    // ==================== ЗАВИСИМОСТИ ЗАДАЧ ====================
    static async getTaskDependencies(taskId) {
        return await this.apiCall(`/tasks/${taskId}/dependencies`);
    }

    // ИСПРАВЛЕННЫЙ МЕТОД - теперь передаем данные в body, а не в params
    static async addTaskDependency(taskId, dependsOnId) {
        return await this.apiCall(`/tasks/${taskId}/dependencies`, 'POST', {
            depends_on_id: dependsOnId
        });
    }

    // ==================== КОММЕНТАРИИ К ЗАДАЧАМ ====================
    static async getTaskComments(taskId) {
        return await this.apiCall(`/tasks/${taskId}/comments`);
    }

    // ИСПРАВЛЕННЫЙ МЕТОД - теперь передаем данные в body, а не в params
    static async addTaskComment(taskId, content) {
        return await this.apiCall(`/tasks/${taskId}/comments`, 'POST', {
            content: content
        });
    }

    // ==================== ЗАДАЧИ ПРОЕКТА ====================
    static async getProjectTasks(projectHash) {
        return await this.apiCall(`/tasks/projects/${projectHash}/tasks`);
    }

    // ==================== УВЕДОМЛЕНИЯ ====================
    static async getNotifications() {
        return await this.apiCall('/notifications/');
    }

    static async markAllNotificationsRead() {
        return await this.apiCall('/notifications/mark_all_read', 'PUT');
    }

    // ==================== HEALTH CHECKS ====================
    static async healthCheck() {
        return await this.apiCall('/health');
    }

    static async apiHealthCheck() {
        return await this.apiCall('/api/health');
    }

    // ==================== ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ ====================
    static async validateToken() {
        try {
            await this.getCurrentUser();
            return true;
        } catch (error) {
            return false;
        }
    }


    // Новый метод для обработки ошибок сети
    static isNetworkError(error) {
        return error.message?.includes('network') ||
               error.message?.includes('Network') ||
               error.message?.includes('fetch') ||
               error.name === 'TypeError';
    }
}

// Создаем псевдонимы для обратной совместимости
window.ApiService = ApiService;
