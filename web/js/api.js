// js/api.js
// Конфигурация
const CONFIG = {
    API_BASE_URL: 'https://powerfully-exotic-chamois.cloudpub.ru/api'
};

// API сервис
class ApiService {
    static pendingRequests = new Map();

    static async request(endpoint, options = {}) {
        // Создаем уникальный ключ для запроса
        const requestKey = `${options.method || 'GET'}_${endpoint}_${JSON.stringify(options.body || '')}`;

        // Проверяем, нет ли уже такого запроса в процессе
        if (this.pendingRequests.has(requestKey)) {
            console.log('Duplicate request detected, returning pending promise');
            return this.pendingRequests.get(requestKey);
        }

        const token = localStorage.getItem('access_token');
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
            // Сохраняем промис в карту
            const requestPromise = (async () => {
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
            })();

            this.pendingRequests.set(requestKey, requestPromise);
            const result = await requestPromise;
            this.pendingRequests.delete(requestKey);
            return result;

        } catch (error) {
            this.pendingRequests.delete(requestKey);
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
    static async getAuthToken(maxId, fullName, username) {
        return this.post('/auth/token', {
            max_id: maxId,
            full_name: fullName,
            username: username
        });
    }

    // Project endpoints
    static async getProjects() {
        return this.get('/projects/');
    }

    static async createProject(projectData) {
        return this.post('/projects/', projectData);
    }

    static async getProject(projectHash) {
        return this.get(`/projects/${projectHash}`);
    }

    static async updateProject(projectHash, projectData) {
        return this.put(`/projects/${projectHash}`, projectData);
    }

    static async deleteProject(projectHash) {
        return this.delete(`/projects/${projectHash}`);
    }

    static async getProjectMembers(projectHash) {
        return this.get(`/projects/${projectHash}/members`);
    }

    static async updateMemberRole(projectHash, userId, role) {
        return this.put(`/projects/${projectHash}/members/${userId}`, { role });
    }

    static async removeProjectMember(projectHash, userId) {
        return this.delete(`/projects/${projectHash}/members/${userId}`);
    }

    static async approveJoinRequest(projectHash, requestId) {
        return this.post(`/projects/${projectHash}/join-requests/${requestId}/approve`);
    }

    static async rejectJoinRequest(projectHash, requestId) {
        return this.post(`/projects/${projectHash}/join-requests/${requestId}/reject`);
    }

    static async getProjectJoinRequests(projectHash) {
        return this.get(`/projects/${projectHash}/join-requests`);
    }

    static async joinProject(projectHash) {
        return this.post(`/projects/${projectHash}/join`);
    }

    static async regenerateInvite(projectHash) {
        return this.post(`/projects/${projectHash}/regenerate-invite`);
    }

    static async getProjectSummary(projectHash) {
        return this.get(`/projects/${projectHash}/summary`);
    }

    // Поиск публичных проектов
    static async searchPublicProjects(query = '') {
        const params = query ? `?query=${encodeURIComponent(query)}` : '';
        return this.get(`/projects/search/public${params}`);
    }

    // Получить проект по точному хэшу
    static async getProjectByHashExact(projectHash) {
        return this.get(`/projects/by-hash/${projectHash}`);
    }

    // Task endpoints
    static async getTasks(projectHash) {
        return this.get(`/tasks/projects/${projectHash}/tasks`);
    }

    static async getUserTasks(filters = {}) {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.project_hash) params.append('project_hash', filters.project_hash);

        const query = params.toString();
        return this.get(`/tasks/${query ? `?${query}` : ''}`);
    }

    static async createTask(taskData) {
        // Преобразуем assigned_to_ids в assigned_to_id если нужно
        if (taskData.assigned_to_ids && taskData.assigned_to_ids.length > 0) {
            taskData.assigned_to_id = taskData.assigned_to_ids[0];
            delete taskData.assigned_to_ids;
        }
        return this.post('/tasks/', taskData);
    }

    static async getTask(taskId) {
        return this.get(`/tasks/${taskId}`);
    }

    static async updateTask(taskId, taskData) {
        // Преобразуем assigned_to_ids в assigned_to_id если нужно
        if (taskData.assigned_to_ids && taskData.assigned_to_ids.length > 0) {
            taskData.assigned_to_id = taskData.assigned_to_ids[0];
            delete taskData.assigned_to_ids;
        } else if (taskData.assigned_to_ids && taskData.assigned_to_ids.length === 0) {
            taskData.assigned_to_id = null;
            delete taskData.assigned_to_ids;
        }
        return this.put(`/tasks/${taskId}`, taskData);
    }

    static async deleteTask(taskId) {
        return this.delete(`/tasks/${taskId}`);
    }

    static async updateTaskStatus(taskId, status) {
        return this.put(`/tasks/${taskId}/status?status=${status}`);
    }

    // Управление зависимостями задач
    static async getTaskDependencies(taskId) {
        return this.get(`/tasks/${taskId}/dependencies`);
    }

    static async addTaskDependency(taskId, dependsOnId) {
        return this.post(`/tasks/${taskId}/dependencies?depends_on_id=${dependsOnId}`);
    }

    static async removeTaskDependency(taskId, dependsOnId) {
        return this.delete(`/tasks/${taskId}/dependencies?depends_on_id=${dependsOnId}`);
    }

    static async getTaskComments(taskId) {
        return this.get(`/tasks/${taskId}/comments`);
    }

    static async createTaskComment(taskId, content) {
        return this.post(`/tasks/${taskId}/comments?content=${encodeURIComponent(content)}`);
    }

    // User endpoints
    static async getCurrentUser() {
        return this.get('/users/me');
    }

    // ИСПРАВЛЕНО: Правильное обновление пользователя
    static async updateCurrentUser(userData) {
        const params = new URLSearchParams();
        if (userData.full_name) params.append('full_name', userData.full_name);
        if (userData.username) params.append('username', userData.username);

        return this.request(`/users/me?${params}`, { method: 'PUT' });
    }

    static async getUserPreferences() {
        return this.get('/users/me/preferences');
    }

    static async updateUserPreferences(preferences) {
        return this.put('/users/me/preferences', preferences);
    }

    static async patchUserPreferences(preferences) {
        return this.patch('/users/me/preferences', preferences);
    }

    static async resetUserPreferences() {
        return this.put('/users/me/preferences/reset');
    }

    static async getUser(userId) {
        return this.get(`/users/${userId}`);
    }

    // Получение проектов пользователя
    static async getUserProjects(userId) {
        return this.get(`/users/${userId}/projects`);
    }

    static async deleteJoinRequest(projectHash, requestId) {
        return this.delete(`/projects/${projectHash}/join-requests/${requestId}`);
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
        try {
            const response = await this.get('/dashboard/');
            return response;
        } catch (error) {
            console.error('Dashboard loading failed, returning fallback data');
            return {
                settings: {},
                projects: [],
                recent_tasks: []
            };
        }
    }

    // Health endpoints
    static async healthCheck() {
        return this.get('/health');
    }

    static async apiHealthCheck() {
        return this.get('/api/health');
    }
}

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
            console.log('MAX authentication successful');
            return tokenData.user;
        }

        throw new Error('MAX authentication failed');
    }

    static async authenticateWithTestUser() {
        const testId = 'dev_user_' + Math.random().toString(36).substr(2, 9);
        const fullName = 'Тестовый пользователь';

        console.log('Test authentication with:', { testId, fullName });

        const tokenData = await ApiService.getAuthToken(testId, fullName, '');

        if (tokenData?.access_token) {
            localStorage.setItem('access_token', tokenData.access_token);
            console.log('Test authentication successful');
            return tokenData.user;
        }

        throw new Error('Test authentication failed');
    }

    static getToken() {
        return localStorage.getItem('access_token');
    }

    static isAuthenticated() {
        return !!this.getToken();
    }
}

// Глобальные переменные
let currentProject = null;
let currentTask = null;
let currentUser = null;
let currentMemberToUpdate = null;
let currentMemberToRemove = null;
let userSettings = {};

// Константы ролей проекта
const ProjectRole = {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    GUEST: 'guest'
};
