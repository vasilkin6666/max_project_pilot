// api-service.js
// ---------------------------------------------------------------
// 1. ОДИН КЛАСС – никаких «вложенных» static-ов
// 2. request() + retryOnAuthError
// 3. Все методы, которые были в старом файле
// ---------------------------------------------------------------

class ApiService {
    // ======================= БАЗОВЫЙ REQUEST =======================
    static async request(url, options = {}, cacheKey = null) {
        try {
            const token = AuthManager.getToken();
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(url, { ...options, headers });

            // ---- 401 → refresh + retry ----
            if (response.status === 401) {
                if (options.retryOnAuthError) {
                    Utils.log('401 → attempting token refresh');
                    try {
                        await AuthManager.refreshToken();
                        return this.request(url, options, cacheKey);
                    } catch (e) {
                        Utils.logError('Refresh failed', e);
                        AuthManager.clearAuth();
                        App.redirectToLogin?.();
                        throw { status: 401, message: 'Session expired' };
                    }
                }
                throw { status: 401, message: 'Could not validate credentials' };
            }

            // ---- Другие ошибки ----
            if (!response.ok) {
                let data = {};
                try { data = await response.json(); } catch {}
                throw {
                    status: response.status,
                    message: data.message || response.statusText || 'Network error',
                    data
                };
            }

            // ---- Успех ----
            const ct = response.headers.get('content-type');
            return ct?.includes('application/json') ? await response.json() : await response.text();

        } catch (err) {
            if (err.name !== 'TypeError' || !err.message.includes('fetch')) {
                Utils.logError('API Request failed', { url, err });
            }
            throw err;
        }
    }

    // ======================= УДОБНЫЕ МЕТОДЫ =======================
    static async get(url, params = {}, cacheKey = null) {
        const q = params ? `?${new URLSearchParams(params)}` : '';
        return this.request(url + q, { method: 'GET' }, cacheKey);
    }
    static async post(url, data = {}, cacheKey = null) {
        return this.request(url, { method: 'POST', body: JSON.stringify(data) }, cacheKey);
    }
    static async put(url, data = {}, cacheKey = null) {
        return this.request(url, { method: 'PUT', body: JSON.stringify(data) }, cacheKey);
    }
    static async delete(url, cacheKey = null) {
        return this.request(url, { method: 'DELETE' }, cacheKey);
    }

    // ======================= УТИЛИТЫ =======================
    static async apiCall(endpoint, method = 'GET', data = null, params = {}) {
        const token = localStorage.getItem('access_token');
        const base = CONFIG.API_BASE_URL;
        let url = `${base}${endpoint}`;
        const p = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => v != null && v !== '' && p.append(k, v));
        if (p.toString()) url += `?${p}`;

        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const cfg = { method, headers, signal: AbortSignal.timeout(CONFIG.API.TIMEOUT) };
        if (data && !['GET', 'DELETE'].includes(method)) cfg.body = JSON.stringify(data);

        Utils.log(`API Call: ${method} ${url}`, data);
        const resp = await fetch(url, cfg);

        if (!resp.ok) {
            let txt = await resp.text(), err = { detail: txt };
            try { err = JSON.parse(txt); } catch {}
            throw { status: resp.status, message: err.detail || resp.statusText, data: err };
        }

        if (resp.status === 204 || method === 'DELETE') return { success: true };
        const json = await resp.json();
        Utils.log(`API Response: ${method} ${url}`, json);
        return json;
    }

    static async retryWithRefresh(fn, max = 3) {
        for (let i = 1; i <= max; i++) {
            try { return await fn(); }
            catch (e) { if (e.status === 401 && i < max) await AuthManager.refreshToken(); else throw e; }
        }
    }

    static isNetworkError(e) {
        return /network|fetch/i.test(e?.message) || e?.name === 'TypeError';
    }

    // ======================= АУТЕНТИФИКАЦИЯ =======================
    static async getAuthToken(maxId, fullName, username = '') {
        return this.apiCall('/auth/token', 'POST', { max_id: maxId, full_name: fullName, username });
    }

    // ======================= ПОЛЬЗОВАТЕЛЬ =======================
    static async getCurrentUser() { return this.apiCall('/users/me'); }
    static async updateCurrentUser(data) { return this.apiCall('/users/me', 'PUT', data); }
    static async getUserById(id) { return this.apiCall(`/users/${id}`); }

    // ======================= ПРЕДПОЧТЕНИЯ =======================
    static async getUserPreferences() { return this.apiCall('/users/me/preferences'); }
    static async updateUserPreferences(d) { return this.apiCall('/users/me/preferences', 'PUT', d); }
    static async resetUserPreferences() { return this.apiCall('/users/me/preferences/reset', 'PUT'); }

    // ======================= ДАШБОРД =======================
    static async getDashboard() {
        try { return await this.apiCall('/dashboard/'); }
        catch (e) {
            Utils.logError('Dashboard API error', e);
            return { settings: {}, projects: [], recent_tasks: [] };
        }
    }

    // ======================= ПРОЕКТЫ =======================
    static async getProjects(filters = {}) { return this.apiCall('/projects/', 'GET', null, filters); }
    static async createProject(d) { return this.apiCall('/projects/', 'POST', d); }
    static async getProject(hash) { return this.apiCall(`/projects/${hash}`); }
    static async updateProject(hash, d) { return this.apiCall(`/projects/${hash}`, 'PUT', d); }
    static async deleteProject(hash) { return this.apiCall(`/projects/${hash}`, 'DELETE'); }
    static async getProjectSummary(hash) { return this.apiCall(`/projects/${hash}/summary`); }

    // ======================= УЧАСТНИКИ =======================
    static async getProjectMembers(hash) { return this.apiCall(`/projects/${hash}/members`); }
    static async updateMemberRole(hash, uid, role) { return this.apiCall(`/projects/${hash}/members/${uid}`, 'PUT', { role }); }
    static async removeMember(hash, uid) { return this.apiCall(`/projects/${hash}/members/${uid}`, 'DELETE'); }

    // ======================= ПРИСОЕДИНЕНИЕ =======================
    static async joinProject(hash) { return this.apiCall(`/projects/${hash}/join`, 'POST'); }
    static async getJoinRequests(hash) { return this.apiCall(`/projects/${hash}/join-requests`); }
    static async approveJoinRequest(hash, rid) { return this.apiCall(`/projects/${hash}/join-requests/${rid}/approve`, 'POST'); }
    static async rejectJoinRequest(hash, rid) { return this.apiCall(`/projects/${hash}/join-requests/${rid}/reject`, 'POST'); }
    static async regenerateInvite(hash) { return this.apiCall(`/projects/${hash}/regenerate-invite`, 'POST'); }

    // ======================= ЗАДАЧИ =======================
    static async getTasks(filters = {}) { return this.apiCall('/tasks/', 'GET', null, filters); }
    static async createTask(d) { return this.apiCall('/tasks/', 'POST', d); }
    static async getTask(id) { return this.apiCall(`/tasks/${id}`); }
    static async updateTask(id, d) { return this.apiCall(`/tasks/${id}`, 'PUT', d); }
    static async deleteTask(id) { return this.apiCall(`/tasks/${id}`, 'DELETE'); }
    static async updateTaskStatus(id, s) { return this.apiCall(`/tasks/${id}/status`, 'PUT', { status: s }); }

    // ======================= ЗАВИСИМОСТИ =======================
    static async addTaskDependency(tid, depId) {
        return this.apiCall(`/tasks/${tid}/dependencies`, 'POST', { depends_on_id: depId });
    }

    // ======================= КОММЕНТАРИИ =======================
    static async getTaskComments(tid) { return this.apiCall(`/tasks/${tid}/comments`); }
    static async addTaskComment(tid, content) {
        return this.apiCall(`/tasks/${tid}/comments`, 'POST', { content });
    }

    // ======================= ЗАДАЧИ ПРОЕКТА =======================
    static async getProjectTasks(hash) { return this.apiCall(`/tasks/projects/${hash}/tasks`); }

    // ======================= УВЕДОМЛЕНИЯ =======================
    static async getNotifications() { return this.apiCall('/notifications/'); }
    static async markAllNotificationsRead() { return this.apiCall('/notifications/mark_all_read', 'PUT'); }

    // ======================= HEALTH =======================
    static async healthCheck() { return this.apiCall('/health'); }
    static async apiHealthCheck() { return this.apiCall('/api/health'); }

    // ======================= ТОКЕН =======================
    static async validateToken() {
        try { await this.getCurrentUser(); return true; }
        catch { return false; }
    }

    // ======================= ПРОЕКТЫ ПОЛЬЗОВАТЕЛЯ =======================
    static async getUserProjects(userId = 'me') {
        return this.apiCall(`/users/${userId}/projects`);
    }

    // ======================= ПРЕДПОЧТЕНИЯ =======================
    static async patchUserPreferences(data) {
        return this.apiCall('/users/me/preferences', 'PATCH', data);
    }

    // ======================= ЗАВИСИМОСТИ ЗАДАЧ =======================
    static async getTaskDependencies(taskId) {
        return this.apiCall(`/tasks/${taskId}/dependencies`);
    }

    // ======================= КОРНЕВОЙ ЭНДПОИНТ =======================
    static async getRootEndpoint() { return this.apiCall('/'); }

    // ======================= ОЧИСТКА ДАННЫХ =======================
    static cleanRequestData(data) {
        const out = {};
        for (const [k, v] of Object.entries(data)) {
            if (v != null && v !== '') out[k] = v;
        }
        return out;
    }
}

// Глобальный алиас (для старого кода)
window.ApiService = ApiService;
