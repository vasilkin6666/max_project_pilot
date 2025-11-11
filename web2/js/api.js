const CONFIG = {
    API_BASE_URL: 'https://powerfully-exotic-chamois.cloudpub.ru/api'
};

class ApiService {
    static async apiCall(endpoint, method = 'GET', data = null) {
        const token = localStorage.getItem('access_token');
        const url = `${CONFIG.API_BASE_URL}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            method,
            headers,
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (response.status === 204 || method === 'DELETE') {
                return { status: 'success' };
            }

            return await response.json();
        } catch (error) {
            Utils.logError(`API Error: ${method} ${url}`, error);
            throw error;
        }
    }

    // Аутентификация
    static async apiGetAuthToken(maxId, fullName, username = '') {
        return await this.apiCall('/auth/token', 'POST', {
            max_id: maxId,
            full_name: fullName,
            username: username
        });
    }

    // Пользователи
    static async apiGetCurrentUser() {
        return await this.apiCall('/users/me', 'GET');
    }

    // Проекты
    static async apiGetUserProjects() {
        return await this.apiCall('/users/me/projects', 'GET');
    }

    static async apiCreateProject(projectData) {
        return await this.apiCall('/projects/', 'POST', projectData);
    }

    static async apiGetProjectByHash(projectHash) {
        return await this.apiCall(`/projects/${projectHash}`, 'GET');
    }

    static async apiUpdateProject(projectHash, updateData) {
        return await this.apiCall(`/projects/${projectHash}`, 'PUT', updateData);
    }

    static async apiDeleteProject(projectHash) {
        return await this.apiCall(`/projects/${projectHash}`, 'DELETE');
    }

    static async apiJoinProject(projectHash) {
        return await this.apiCall(`/projects/${projectHash}/join`, 'POST');
    }

    // Задачи
    static async apiGetProjectTasks(projectHash) {
        return await this.apiCall('/tasks/', 'GET', null, { project_hash: projectHash });
    }

    static async apiCreateTask(taskData) {
        return await this.apiCall('/tasks/', 'POST', taskData);
    }

    static async apiGetTaskById(taskId) {
        return await this.apiCall(`/tasks/${taskId}`, 'GET');
    }

    static async apiUpdateTaskStatus(taskId, status) {
        return await this.apiCall(`/tasks/${taskId}/status`, 'PUT', { status });
    }

    static async apiDeleteTask(taskId) {
        return await this.apiCall(`/tasks/${taskId}`, 'DELETE');
    }

    // Комментарии
    static async apiGetTaskComments(taskId) {
        return await this.apiCall(`/tasks/${taskId}/comments`, 'GET');
    }

    static async apiAddTaskComment(taskId, content) {
        return await this.apiCall(`/tasks/${taskId}/comments`, 'POST', { content });
    }

    // Уведомления
    static async apiGetNotifications() {
        return await this.apiCall('/notifications/', 'GET');
    }

    static async apiMarkNotificationsRead(notificationIds) {
        return await this.apiCall('/notifications/mark_read', 'PUT', { notification_ids: notificationIds });
    }

    // Запросы на вступление
    static async apiApproveJoinRequest(projectHash, requestId) {
        return await this.apiCall(`/projects/${projectHash}/join-requests/${requestId}/approve`, 'POST');
    }

    static async apiRejectJoinRequest(projectHash, requestId) {
        return await this.apiCall(`/projects/${projectHash}/join-requests/${requestId}/reject`, 'POST');
    }
}

window.ApiService = ApiService;
window.CONFIG = CONFIG;
