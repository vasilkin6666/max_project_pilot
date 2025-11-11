// Сервис для работы с API
class ApiService {
    static async apiCall(endpoint, method = 'GET', data = null, params = {}) {
        const token = localStorage.getItem('access_token');
        const baseUrl = CONFIG.API_BASE_URL;

        // Формируем URL с параметрами
        let url = `${baseUrl}${endpoint}`;
        const urlParams = new URLSearchParams();

        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
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

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.body = JSON.stringify(data);
        }

        try {
            Utils.log(`API Call: ${method} ${url}`, data);

            const response = await fetch(url, config);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
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

            throw error;
        }
    }

    // Аутентификация
    static async getAuthToken(maxId, fullName, username = '') {
        return await this.apiCall('/auth/token', 'POST', {
            max_id: maxId,
            full_name: fullName,
            username: username
        });
    }

    // Пользователи
    static async getCurrentUser() {
        return await this.apiCall('/users/me');
    }

    static async updateCurrentUser(data) {
        return await this.apiCall('/users/me', 'PUT', data);
    }

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

    // Проекты
    static async getProjects() {
        return await this.apiCall('/projects/');
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

    static async getProjectMembers(projectHash) {
        return await this.apiCall(`/projects/${projectHash}/members`);
    }

    static async updateMemberRole(projectHash, userId, role) {
        return await this.apiCall(`/projects/${projectHash}/members/${userId}`, 'PUT', { role });
    }

    static async removeMember(projectHash, userId) {
        return await this.apiCall(`/projects/${projectHash}/members/${userId}`, 'DELETE');
    }

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

    static async getProjectSummary(projectHash) {
        return await this.apiCall(`/projects/${projectHash}/summary`);
    }

    // Задачи
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
        return await this.apiCall(`/tasks/${taskId}/status`, 'PUT', null, { status });
    }

    static async getTaskDependencies(taskId) {
        return await this.apiCall(`/tasks/${taskId}/dependencies`);
    }

    static async addTaskDependency(taskId, dependsOnId) {
        return await this.apiCall(`/tasks/${taskId}/dependencies`, 'POST', null, { depends_on_id: dependsOnId });
    }

    static async getTaskComments(taskId) {
        return await this.apiCall(`/tasks/${taskId}/comments`);
    }

    static async addTaskComment(taskId, content) {
        return await this.apiCall(`/tasks/${taskId}/comments`, 'POST', null, { content });
    }

    static async getProjectTasks(projectHash) {
        return await this.apiCall(`/tasks/projects/${projectHash}/tasks`);
    }

    // Уведомления
    static async getNotifications() {
        return await this.apiCall('/notifications/');
    }

    static async markAllNotificationsRead() {
        return await this.apiCall('/notifications/mark_all_read', 'PUT');
    }

    // Дашборд
    static async getDashboard() {
        return await this.apiCall('/dashboard/');
    }

    // Health check
    static async healthCheck() {
        return await this.apiCall('/health');
    }

    static async apiHealthCheck() {
        return await this.apiCall('/api/health');
    }
}

// Создаем псевдонимы для обратной совместимости
window.ApiService = ApiService;
