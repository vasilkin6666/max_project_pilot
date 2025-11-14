// API service with caching and error handling
class ApiService {
    constructor() {
        this.config = {
            API_BASE_URL: 'https://powerfully-exotic-chamois.cloudpub.ru/api',
            RETRY_ATTEMPTS: 3,
            RETRY_DELAY: 1000,
            TIMEOUT: 30000
        };

        this.cache = null;
        this.auth = null;
    }

    async init() {
        console.log('API service initialized');
        this.cache = window.App?.modules?.cache;
        this.auth = window.App?.modules?.auth;
        return Promise.resolve();
    }

    // Base request method
    async request(endpoint, options = {}) {
        const token = this.auth?.getToken();
        const url = `${this.config.API_BASE_URL}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers,
            signal: AbortSignal.timeout(this.config.TIMEOUT)
        };

        console.log(`API Request: ${config.method || 'GET'} ${url}`);

        for (let attempt = 1; attempt <= this.config.RETRY_ATTEMPTS; attempt++) {
            try {
                const response = await fetch(url, config);

                if (response.status === 401) {
                    // Token might be expired, try to refresh
                    if (this.auth && attempt === 1) {
                        const refreshed = await this.auth.refreshToken();
                        if (refreshed) {
                            // Retry with new token
                            headers['Authorization'] = `Bearer ${this.auth.getToken()}`;
                            continue;
                        }
                    }
                    // If refresh failed or not available, redirect to login
                    this.handleUnauthorized();
                    throw new Error('Authentication required');
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                console.log(`API Response:`, data);
                return data;

            } catch (error) {
                console.error(`API request attempt ${attempt} failed:`, error);

                if (attempt === this.config.RETRY_ATTEMPTS) {
                    this.handleError(error, endpoint);
                    throw error;
                }

                if (error.name === 'AbortError') {
                    throw new Error('Request timeout');
                }

                // Wait before retry
                await Utils.wait(this.config.RETRY_DELAY * attempt);
            }
        }
    }

    // HTTP methods
    async get(endpoint, useCache = true) {
        if (useCache && this.cache) {
            const cacheKey = `api:${endpoint}`;
            return this.cache.getOrSet(
                cacheKey,
                () => this.request(endpoint, { method: 'GET' }),
                CacheManager.TTL.MEDIUM
            );
        }

        return this.request(endpoint, { method: 'GET' });
    }

    async post(endpoint, data, useCache = false) {
        const result = await this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        // Invalidate relevant cache
        if (useCache && this.cache) {
            this.invalidateCacheForEndpoint(endpoint);
        }

        return result;
    }

    async put(endpoint, data, useCache = false) {
        const result = await this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });

        if (useCache && this.cache) {
            this.invalidateCacheForEndpoint(endpoint);
        }

        return result;
    }

    async patch(endpoint, data, useCache = false) {
        const result = await this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });

        if (useCache && this.cache) {
            this.invalidateCacheForEndpoint(endpoint);
        }

        return result;
    }

    async delete(endpoint, useCache = false) {
        const result = await this.request(endpoint, { method: 'DELETE' });

        if (useCache && this.cache) {
            this.invalidateCacheForEndpoint(endpoint);
        }

        return result;
    }

    // Cache invalidation
    invalidateCacheForEndpoint(endpoint) {
        if (!this.cache) return;

        // Invalidate specific endpoint cache
        this.cache.delete(`api:${endpoint}`);

        // Invalidate related caches based on endpoint pattern
        if (endpoint.includes('/projects/')) {
            this.cache.invalidatePrefix('api:/projects/');
            this.cache.invalidatePrefix(CacheManager.Keys.PROJECTS);
        }

        if (endpoint.includes('/tasks/')) {
            this.cache.invalidatePrefix('api:/tasks/');
            this.cache.invalidatePrefix(CacheManager.Keys.USER_TASKS());
        }

        if (endpoint.includes('/users/')) {
            this.cache.invalidatePrefix('api:/users/');
        }
    }

    // Error handling
    handleError(error, endpoint) {
        console.error(`API Error for ${endpoint}:`, error);

        let userMessage = 'Произошла ошибка при выполнении запроса';

        if (error.name === 'AbortError') {
            userMessage = 'Превышено время ожидания ответа от сервера';
        } else if (error.message.includes('NetworkError')) {
            userMessage = 'Ошибка сети. Проверьте подключение к интернету';
        } else if (error.message.includes('500')) {
            userMessage = 'Внутренняя ошибка сервера';
        } else if (error.message.includes('404')) {
            userMessage = 'Запрашиваемый ресурс не найден';
        } else if (error.message.includes('403')) {
            userMessage = 'Доступ запрещен';
        }

        Utils.showToast(userMessage, 'error');
    }

    handleUnauthorized() {
        Utils.showToast('Требуется авторизация', 'error');
        // You might want to redirect to login page here
        if (this.auth) {
            this.auth.logout();
        }
    }

    // Auth endpoints
    async getAuthToken(maxId, fullName, username) {
        return this.post('/auth/token', {
            max_id: maxId,
            full_name: fullName,
            username: username
        }, false);
    }

    async refreshAuthToken() {
        // Implementation depends on your auth system
        return this.post('/auth/refresh', {}, false);
    }

    // Project endpoints
    async getProjects() {
        return this.get('/projects/', true);
    }

    async createProject(projectData) {
        return this.post('/projects/', projectData, false);
    }

    async getProject(projectHash) {
        return this.get(`/projects/${projectHash}`, true);
    }

    async updateProject(projectHash, projectData) {
        return this.put(`/projects/${projectHash}`, projectData, false);
    }

    async deleteProject(projectHash) {
        return this.delete(`/projects/${projectHash}`, false);
    }

    async getProjectMembers(projectHash) {
        return this.get(`/projects/${projectHash}/members`, true);
    }

    async updateMemberRole(projectHash, userId, role) {
        return this.put(`/projects/${projectHash}/members/${userId}`, { role }, false);
    }

    async removeProjectMember(projectHash, userId) {
        return this.delete(`/projects/${projectHash}/members/${userId}`, false);
    }

    async approveJoinRequest(projectHash, requestId) {
        return this.post(`/projects/${projectHash}/join-requests/${requestId}/approve`, {}, false);
    }

    async rejectJoinRequest(projectHash, requestId) {
        return this.post(`/projects/${projectHash}/join-requests/${requestId}/reject`, {}, false);
    }

    async getProjectJoinRequests(projectHash) {
        return this.get(`/projects/${projectHash}/join-requests`, true);
    }

    async joinProject(projectHash) {
        return this.post(`/projects/${projectHash}/join`, {}, false);
    }

    async regenerateInvite(projectHash) {
        return this.post(`/projects/${projectHash}/regenerate-invite`, {}, false);
    }

    async getProjectSummary(projectHash) {
        return this.get(`/projects/${projectHash}/summary`, true);
    }

    async searchPublicProjects(query = '') {
        const params = query ? `?query=${encodeURIComponent(query)}` : '';
        return this.get(`/projects/search/public${params}`, true);
    }

    async getProjectByHashExact(projectHash) {
        return this.get(`/projects/by-hash/${projectHash}`, true);
    }

    // Task endpoints
    async getTasks(projectHash) {
        return this.get(`/tasks/projects/${projectHash}/tasks`, true);
    }

    async getUserTasks(filters = {}) {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.project_hash) params.append('project_hash', filters.project_hash);
        if (filters.priority) params.append('priority', filters.priority);

        const query = params.toString();
        return this.get(`/tasks/${query ? `?${query}` : ''}`, true);
    }

    async createTask(taskData) {
        // Transform assigned_to_ids to assigned_to_id if needed
        if (taskData.assigned_to_ids && taskData.assigned_to_ids.length > 0) {
            taskData.assigned_to_id = taskData.assigned_to_ids[0];
            delete taskData.assigned_to_ids;
        }
        return this.post('/tasks/', taskData, false);
    }

    async getTask(taskId) {
        return this.get(`/tasks/${taskId}`, true);
    }

    async updateTask(taskId, taskData) {
        // Transform assigned_to_ids to assigned_to_id if needed
        if (taskData.assigned_to_ids && taskData.assigned_to_ids.length > 0) {
            taskData.assigned_to_id = taskData.assigned_to_ids[0];
            delete taskData.assigned_to_ids;
        } else if (taskData.assigned_to_ids && taskData.assigned_to_ids.length === 0) {
            taskData.assigned_to_id = null;
            delete taskData.assigned_to_ids;
        }
        return this.put(`/tasks/${taskId}`, taskData, false);
    }

    async deleteTask(taskId) {
        return this.delete(`/tasks/${taskId}`, false);
    }

    async updateTaskStatus(taskId, status) {
        return this.put(`/tasks/${taskId}/status?status=${status}`, {}, false);
    }

    async getTaskDependencies(taskId) {
        return this.get(`/tasks/${taskId}/dependencies`, true);
    }

    async addTaskDependency(taskId, dependsOnId) {
        return this.post(`/tasks/${taskId}/dependencies?depends_on_id=${dependsOnId}`, {}, false);
    }

    async removeTaskDependency(taskId, dependsOnId) {
        return this.delete(`/tasks/${taskId}/dependencies?depends_on_id=${dependsOnId}`, false);
    }

    async getTaskComments(taskId) {
        return this.get(`/tasks/${taskId}/comments`, true);
    }

    async createTaskComment(taskId, content) {
        return this.post(`/tasks/${taskId}/comments?content=${encodeURIComponent(content)}`, {}, false);
    }

    // User endpoints
    async getCurrentUser() {
        return this.get('/users/me', true);
    }

    async updateCurrentUser(userData) {
        const params = new URLSearchParams();
        if (userData.full_name) params.append('full_name', userData.full_name);
        if (userData.username) params.append('username', userData.username);

        return this.request(`/users/me?${params}`, { method: 'PUT' });
    }

    async getUserPreferences() {
        return this.get('/users/me/preferences', true);
    }

    async updateUserPreferences(preferences) {
        return this.put('/users/me/preferences', preferences, false);
    }

    async patchUserPreferences(preferences) {
        return this.patch('/users/me/preferences', preferences, false);
    }

    async resetUserPreferences() {
        return this.put('/users/me/preferences/reset', {}, false);
    }

    async getUser(userId) {
        return this.get(`/users/${userId}`, true);
    }

    async getUserProjects(userId) {
        return this.get(`/users/${userId}/projects`, true);
    }

    async deleteJoinRequest(projectHash, requestId) {
        return this.delete(`/projects/${projectHash}/join-requests/${requestId}`, false);
    }

    // Notifications endpoints
    async getNotifications() {
        return this.get('/notifications/', true);
    }

    async markAllNotificationsRead() {
        return this.put('/notifications/mark_all_read', {}, false);
    }

    // Dashboard endpoints
    async getDashboard() {
        return this.get('/dashboard/', true);
    }

    // Health endpoints
    async healthCheck() {
        return this.get('/health');
    }

    async apiHealthCheck() {
        return this.get('/api/health');
    }

    // Batch operations (if supported by API)
    async batchRequests(requests) {
        return this.post('/batch', { requests }, false);
    }

    // File upload (if needed)
    async uploadFile(file, onProgress = null) {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        return new Promise((resolve, reject) => {
            xhr.upload.addEventListener('progress', (e) => {
                if (onProgress && e.lengthComputable) {
                    onProgress((e.loaded / e.total) * 100);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'));
            });

            xhr.open('POST', `${this.config.API_BASE_URL}/upload`);
            const token = this.auth?.getToken();
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            xhr.send(formData);
        });
    }
}
