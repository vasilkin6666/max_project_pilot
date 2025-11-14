// api.js
class ApiService {
    static BASE_URL = '/api'; // Replace with your actual API base URL

    static getHeaders() {
        return {
            'Content-Type': 'application/json',
            // Add any auth headers if needed
            // 'Authorization': `Bearer ${localStorage.getItem('token')}`
        };
    }

    static async request(endpoint, options = {}) {
        const url = `${this.BASE_URL}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Auth
    static async login(credentials) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
    }

    static async getCurrentUser() {
        return this.request('/auth/me');
    }

    // Projects
    static async getProjects() {
        return this.request('/projects');
    }

    static async getProject(hash) {
        return this.request(`/projects/${hash}`);
    }

    static async getProjectSummary(hash) {
        return this.request(`/projects/${hash}/summary`);
    }

    static async createProject(data) {
        return this.request('/projects', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async updateProject(hash, data) {
        return this.request(`/projects/${hash}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    static async deleteProject(hash) {
        return this.request(`/projects/${hash}`, {
            method: 'DELETE'
        });
    }

    static async searchProjects(query) {
        const params = new URLSearchParams({ query });
        return this.request(`/projects/search?${params}`);
    }

    static async getProjectByHashExact(hash) {
        return this.request(`/projects/hash/${hash}`);
    }

    static async joinProject(hash) {
        return this.request(`/projects/${hash}/join`, {
            method: 'POST'
        });
    }

    static async leaveProject(hash) {
        return this.request(`/projects/${hash}/leave`, {
            method: 'POST'
        });
    }

    static async getProjectMembers(hash) {
        return this.request(`/projects/${hash}/members`);
    }

    static async manageProjectMember(hash, memberId, action, role = null) {
        const body = { action, role };
        return this.request(`/projects/${hash}/members/${memberId}`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    static async getJoinRequests(hash) {
        return this.request(`/projects/${hash}/join-requests`);
    }

    static async handleJoinRequest(hash, requestId, action) {
        const body = { action };
        return this.request(`/projects/${hash}/join-requests/${requestId}`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    // Tasks
    static async getTasks(projectHash) {
        return this.request(`/projects/${projectHash}/tasks`);
    }

    static async getTask(taskId) {
        return this.request(`/tasks/${taskId}`);
    }

    static async createTask(data) {
        return this.request('/tasks', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    static async updateTask(taskId, data) {
        return this.request(`/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    static async updateTaskStatus(taskId, status) {
        return this.request(`/tasks/${taskId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
    }

    static async deleteTask(taskId) {
        return this.request(`/tasks/${taskId}`, {
            method: 'DELETE'
        });
    }

    // Comments
    static async getComments(taskId) {
        return this.request(`/tasks/${taskId}/comments`);
    }

    static async addComment(taskId, content) {
        return this.request(`/tasks/${taskId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
    }

    // User tasks
    static async getUserTasks(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/tasks/user?${params}`);
    }

    // Dashboard
    static async getDashboard() {
        return this.request('/dashboard');
    }

    // Notifications
    static async getNotifications() {
        return this.request('/notifications');
    }

    static async markNotificationAsRead(notificationId) {
        return this.request(`/notifications/${notificationId}/read`, {
            method: 'POST'
        });
    }
}
