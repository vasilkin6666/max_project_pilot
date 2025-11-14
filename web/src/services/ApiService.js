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

            // Оффлайн fallback
            if (!navigator.onLine) {
                return this.getOfflineData(endpoint, options);
            }

            throw error;
        }
    }

    static getOfflineData(endpoint, options) {
        // Заглушки для оффлайн режима
        const offlineData = {
            '/dashboard/': {
                projects: [],
                recent_tasks: [],
                settings: {},
                notifications: []
            },
            '/projects/': { projects: [] },
            '/notifications/': { notifications: [] }
        };

        const data = offlineData[endpoint] || {};

        if (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE') {
            // В оффлайн режиме симулируем успешный ответ
            return { success: true, message: 'Операция будет выполнена при восстановлении соединения' };
        }

        return data;
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
        // Для демо возвращаем тестовые данные
        return {
            access_token: 'demo_token_' + maxId,
            user: {
                id: parseInt(maxId) || 1,
                full_name: fullName,
                username: username,
                email: username ? `${username}@max.com` : 'user@max.com'
            }
        };
    }

    // Project endpoints
    static async getProjects() {
        return this.get('/projects/');
    }

    static async createProject(projectData) {
        // Для демо симулируем создание проекта
        const demoProject = {
            ...projectData,
            id: Date.now(),
            hash: 'proj_' + Math.random().toString(36).substr(2, 9),
            created_at: new Date().toISOString(),
            stats: {
                members_count: 1,
                tasks_count: 0,
                tasks_done: 0,
                tasks_in_progress: 0
            }
        };
        return { project: demoProject };
    }

    static async getProject(projectHash) {
        // Для демо возвращаем тестовый проект
        return {
            project: {
                hash: projectHash,
                title: 'Демо проект',
                description: 'Это демо проект для тестирования',
                is_private: false,
                requires_approval: false,
                created_at: new Date().toISOString(),
                stats: {
                    members_count: 3,
                    tasks_count: 5,
                    tasks_done: 2,
                    tasks_in_progress: 1
                },
                members: [
                    { user_id: 1, role: 'owner', full_name: 'Текущий пользователь' },
                    { user_id: 2, role: 'member', full_name: 'Участник 1' },
                    { user_id: 3, role: 'member', full_name: 'Участник 2' }
                ],
                current_user_role: 'owner'
            }
        };
    }

    static async updateProject(projectHash, projectData) {
        return { success: true, project: { ...projectData, hash: projectHash } };
    }

    static async deleteProject(projectHash) {
        return { success: true, message: 'Проект удален' };
    }

    // Task endpoints
    static async getTasks(projectHash) {
        // Для демо возвращаем тестовые задачи
        return {
            tasks: [
                {
                    id: 1,
                    title: 'Первая задача',
                    description: 'Описание первой задачи',
                    status: 'todo',
                    priority: 'medium',
                    project_hash: projectHash,
                    created_at: new Date().toISOString()
                },
                {
                    id: 2,
                    title: 'Вторая задача',
                    description: 'Описание второй задачи',
                    status: 'in_progress',
                    priority: 'high',
                    project_hash: projectHash,
                    created_at: new Date().toISOString()
                }
            ]
        };
    }

    static async createTask(taskData) {
        const demoTask = {
            ...taskData,
            id: Date.now(),
            created_at: new Date().toISOString(),
            status: 'todo'
        };
        return { task: demoTask };
    }

    static async getTask(taskId) {
        return {
            task: {
                id: taskId,
                title: 'Демо задача',
                description: 'Описание демо задачи',
                status: 'todo',
                priority: 'medium',
                created_at: new Date().toISOString(),
                project_hash: 'demo_project'
            }
        };
    }

    static async updateTask(taskId, taskData) {
        return { success: true, task: { ...taskData, id: taskId } };
    }

    static async deleteTask(taskId) {
        return { success: true, message: 'Задача удалена' };
    }

    // Dashboard endpoints
    static async getDashboard() {
        return {
            projects: [
                {
                    hash: 'proj1',
                    title: 'Разработка нового функционала',
                    description: 'Создание инновационных возможностей для платформы',
                    is_private: false,
                    created_at: new Date().toISOString(),
                    stats: {
                        members_count: 5,
                        tasks_count: 12,
                        tasks_done: 8,
                        tasks_in_progress: 3
                    }
                },
                {
                    hash: 'proj2',
                    title: 'Маркетинговая кампания',
                    description: 'Продвижение продукта на новых рынках',
                    is_private: true,
                    created_at: new Date().toISOString(),
                    stats: {
                        members_count: 3,
                        tasks_count: 7,
                        tasks_done: 2,
                        tasks_in_progress: 4
                    }
                }
            ],
            recent_tasks: [
                {
                    id: 1,
                    title: 'Создание дизайна',
                    status: 'in_progress',
                    priority: 'high',
                    due_date: new Date(Date.now() + 86400000).toISOString()
                },
                {
                    id: 2,
                    title: 'Тестирование API',
                    status: 'todo',
                    priority: 'medium',
                    due_date: new Date(Date.now() + 172800000).toISOString()
                }
            ],
            settings: {
                theme: 'auto',
                notifications_enabled: true,
                compact_view: false
            },
            notifications: [
                {
                    id: 1,
                    title: 'Новая задача',
                    message: 'Вам назначена новая задача в проекте "Разработка"',
                    created_at: new Date().toISOString(),
                    read: false
                }
            ]
        };
    }

    // User endpoints
    static async getCurrentUser() {
        return AuthManager.getUser();
    }

    static async updateCurrentUser(userData) {
        const updatedUser = AuthManager.updateUser(userData);
        return { user: updatedUser };
    }

    static async getUserPreferences() {
        const settings = localStorage.getItem('user_settings');
        return settings ? JSON.parse(settings) : {
            theme: 'auto',
            notifications_enabled: true,
            compact_view: false
        };
    }

    static async updateUserPreferences(preferences) {
        localStorage.setItem('user_settings', JSON.stringify(preferences));
        return { success: true, preferences };
    }

    // Notifications endpoints
    static async getNotifications() {
        return {
            notifications: [
                {
                    id: 1,
                    title: 'Добро пожаловать!',
                    message: 'Вы успешно вошли в Project Pilot MAX',
                    created_at: new Date().toISOString(),
                    read: false,
                    type: 'info'
                }
            ]
        };
    }

    static async markAllNotificationsRead() {
        return { success: true, message: 'Все уведомления отмечены как прочитанные' };
    }
}
