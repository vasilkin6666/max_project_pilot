// api.js
// Конфигурация
const CONFIG = {
    API_BASE_URL: 'https://powerfully-exotic-chamois.cloudpub.ru/api' // Используем URL из index.txt
};

// API сервис
class ApiService {
    static async request(endpoint, options = {}) {
        const token = AuthManager.getToken();
        const url = `${CONFIG.API_BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        console.log(`API Request: ${options.method || 'GET'} ${url}`);

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            const data = await response.json();
            console.log(`API Response:`, data);
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    static async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    static async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    static async patch(endpoint, data) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    static async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // Auth endpoints
    static async getAuthToken(testId, fullName, email) {
        return this.post('/auth/token', { test_id: testId, full_name: fullName, email });
    }

    static async getCurrentUser() {
        return this.get('/auth/me');
    }

    // Project endpoints
    static async getProjects() {
        return this.get('/projects/');
    }

    static async getProject(hash) {
        return this.get(`/projects/${hash}`);
    }

    static async createProject(data) {
        return this.post('/projects/', data);
    }

    static async updateProject(hash, data) {
        return this.put(`/projects/${hash}/`, data);
    }

    static async deleteProject(hash) {
        return this.delete(`/projects/${hash}/`);
    }

    static async searchProjects(query) {
        const params = new URLSearchParams({ query });
        return this.get(`/projects/search?${params}`);
    }

    static async getProjectByHashExact(hash) {
        return this.get(`/projects/hash/${hash}`);
    }

    // Project members endpoints
    static async getProjectMembers(hash) {
        return this.get(`/projects/${hash}/members/`);
    }

    static async updateProjectMemberRole(hash, memberId, role) {
        return this.patch(`/projects/${hash}/members/${memberId}/role`, { role });
    }

    static async removeProjectMember(hash, memberId) {
        return this.delete(`/projects/${hash}/members/${memberId}/`);
    }

    // Join requests endpoints
    static async getProjectJoinRequests(hash) {
        return this.get(`/projects/${hash}/join-requests/`);
    }

    static async approveJoinRequest(hash, requestId) {
        return this.post(`/projects/${hash}/join-requests/${requestId}/approve`);
    }

    static async rejectJoinRequest(hash, requestId) {
        return this.post(`/projects/${hash}/join-requests/${requestId}/reject`);
    }

    static async joinProject(hash) {
        return this.post(`/projects/${hash}/join`);
    }

    // Task endpoints
    static async getTasks(projectHash) {
        return this.get(`/projects/${projectHash}/tasks/`);
    }

    static async getTask(taskId) {
        return this.get(`/tasks/${taskId}/`);
    }

    static async createTask(data) {
        return this.post('/tasks/', data);
    }

    static async updateTask(taskId, data) {
        return this.put(`/tasks/${taskId}/`, data);
    }

    static async updateTaskStatus(taskId, status) {
        return this.put(`/tasks/${taskId}/status`, { status });
    }

    static async deleteTask(taskId) {
        return this.delete(`/tasks/${taskId}/`);
    }

    // Comment endpoints
    static async getTaskComments(taskId) {
        return this.get(`/tasks/${taskId}/comments/`);
    }

    static async createTaskComment(taskId, content) {
        return this.post(`/tasks/${taskId}/comments/`, { content });
    }

    // User tasks endpoints
    static async getUserTasks(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.get(`/tasks/user/?${params}`);
    }

    // User endpoints
    static async updateCurrentUser(data) {
        return this.put('/auth/me/', data);
    }

    static async updateUserPreferences(data) {
        return this.put('/auth/preferences', data);
    }

    static async resetUserPreferences() {
        return this.delete('/auth/preferences');
    }

    // Search endpoints
    static async searchPublicProjects(query = '') {
        const params = query ? new URLSearchParams({ query }) : '';
        return this.get(`/projects/public/search?${params}`);
    }

    // Notifications endpoints
    static async getNotifications() {
        return this.get('/notifications/');
    }

    static async markAllNotificationsRead() {
        return this.put('/notifications/mark_all_read');
    }

    // Dashboard endpoints
    static async getDashboard() {
        return this.get('/dashboard/');
    }

    // Health endpoints
    static async healthCheck() {
        return this.get('/health');
    }

    static async apiHealthCheck() {
        return this.get('/api/health');
    }
}
