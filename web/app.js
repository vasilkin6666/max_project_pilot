// Конфигурация
const CONFIG = {
    API_BASE_URL: 'https://powerfully-exotic-chamois.cloudpub.ru/api'
};

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

// Утилиты для UI
class UIUtils {
    // Показать уведомление
    static showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toastId = 'toast-' + Date.now();

        const typeConfig = {
            success: { bg: 'bg-success-500', icon: 'fa-check-circle' },
            error: { bg: 'bg-danger-500', icon: 'fa-exclamation-circle' },
            warning: { bg: 'bg-warning-500', icon: 'fa-exclamation-triangle' },
            info: { bg: 'bg-primary-500', icon: 'fa-info-circle' }
        };

        const config = typeConfig[type] || typeConfig.info;

        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `p-4 rounded-xl text-white shadow-lg transform transition-all duration-300 translate-x-full opacity-0 ${config.bg}`;
        toast.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${config.icon} mr-3"></i>
                <div class="flex-1">${message}</div>
                <button class="ml-4" onclick="document.getElementById('${toastId}').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        toastContainer.appendChild(toast);

        // Анимация появления
        setTimeout(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
            toast.classList.add('translate-x-0', 'opacity-100');
        }, 10);

        // Автоматическое скрытие
        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }

    // Показать модальное окно
    static showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            setTimeout(() => {
                const modalContent = modal.querySelector('.modal');
                if (modalContent) {
                    modalContent.classList.remove('scale-95', 'opacity-0');
                    modalContent.classList.add('scale-100', 'opacity-100');
                }
            }, 10);
        }
    }

    // Скрыть модальное окно
    static hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            const modalContent = modal.querySelector('.modal');
            if (modalContent) {
                modalContent.classList.remove('scale-100', 'opacity-100');
                modalContent.classList.add('scale-95', 'opacity-0');
            }

            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }
    }

    // Переключение сайдбара на мобильных устройствах
    static toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');

        if (sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.remove('-translate-x-full');
            backdrop.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
        }
    }

    // Переключение темы
    static toggleTheme() {
        const themeToggle = document.getElementById('themeToggle');
        const isDark = document.documentElement.classList.contains('dark');

        if (isDark) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
    }

    // Инициализация темы из localStorage
    static initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        const themeToggle = document.getElementById('themeToggle');

        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.documentElement.classList.remove('dark');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
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

// Основное приложение
class App {
    static async init() {
        try {
            console.log('Initializing app...');

            // Показываем заставку
            this.showSplashScreen();

            // Инициализируем тему
            UIUtils.initTheme();

            // Инициализируем аутентификацию
            currentUser = await AuthManager.initialize();

            // Обновляем информацию о пользователе в интерфейсе
            this.updateUserInfo();

            // Загружаем данные
            await this.loadData();

            // Настраиваем обработчики событий
            this.setupEventListeners();

            console.log('App initialized successfully');
        } catch (error) {
            console.error('App initialization failed:', error);
            this.showError('Ошибка инициализации приложения: ' + error.message);
        }
    }

    static updateUserInfo() {
        if (currentUser) {
            // Обновляем аватар
            const userAvatar = document.getElementById('userAvatar');
            if (userAvatar && currentUser.full_name) {
                userAvatar.innerHTML = `<span>${currentUser.full_name.charAt(0).toUpperCase()}</span>`;
            }

            // Обновляем имя пользователя
            const userNameElements = document.querySelectorAll('#userName, #dropdownUserName');
            userNameElements.forEach(el => {
                if (currentUser.full_name) {
                    el.textContent = currentUser.full_name;
                }
            });

            // Обновляем email
            const userEmail = document.getElementById('dropdownUserEmail');
            if (userEmail && currentUser.username) {
                userEmail.textContent = currentUser.username;
            }

            // Обновляем приветствие
            const welcomeHeader = document.getElementById('welcomeHeader');
            if (welcomeHeader && currentUser.full_name) {
                welcomeHeader.textContent = `Добро пожаловать, ${currentUser.full_name}!`;
            }
        }
    }

    static showSplashScreen() {
        const splashScreen = document.getElementById('splashScreen');
        const progressBar = document.getElementById('splashProgressBar');
        const appContainer = document.getElementById('appContainer');

        // Анимируем прогресс-бар
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);

                // Скрываем заставку и показываем приложение
                setTimeout(() => {
                    splashScreen.style.opacity = '0';
                    setTimeout(() => {
                        splashScreen.style.display = 'none';
                        appContainer.classList.remove('hidden');
                    }, 1000);
                }, 500);
            }
            progressBar.style.width = `${progress}%`;
        }, 200);
    }

    static async loadData() {
        try {
            console.log('Loading data...');
            // Загружаем дашборд с проектами
            const dashboardData = await ApiService.getDashboard();
            const projects = dashboardData.projects || [];
            const settings = dashboardData.settings || {};
            const recentTasks = dashboardData.recent_tasks || [];

            // Сохраняем настройки
            userSettings = settings;
            this.applyUserSettings(settings);

            this.renderProjects(projects);
            this.updateStats(projects, recentTasks);
            this.renderRecentTasks(recentTasks);
            this.renderSidebarProjects(projects);
            this.loadNotifications();

            console.log('Data loaded successfully');
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Ошибка загрузки данных: ' + error.message);
        }
    }

    // Применение настроек пользователя
    static applyUserSettings(settings) {
        if (settings.theme) {
            if (settings.theme === 'dark' || (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
                document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
            } else {
                document.documentElement.classList.remove('dark');
                document.getElementById('themeToggle').innerHTML = '<i class="fas fa-moon"></i>';
            }
        }
    }

    static renderProjects(projects) {
        const container = document.getElementById('projectsList');
        if (!projects || projects.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <div class="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <i class="fas fa-folder-open text-3xl text-gray-400"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Проектов пока нет</h3>
                    <p class="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">Создайте свой первый проект, чтобы начать работу</p>
                    <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-medium" onclick="App.showCreateProjectModal()">
                        <i class="fas fa-plus mr-2"></i> Создать проект
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = projects.map(project => {
            // ИСПРАВЛЕНО: Правильное получение данных проекта и статистики
            const projectData = project.project || project;
            // Получаем статистику из разных возможных источников
            const stats = project.stats || projectData.stats || {};
            // ИСПРАВЛЕНО: Правильные названия полей статистики
            const membersCount = stats.members_count || stats.membersCount || 0;
            const tasksCount = stats.tasks_count || stats.tasksCount || 0;
            const doneTasks = stats.tasks_done || stats.done_tasks || stats.doneTasks || 0;
            const inProgressTasks = stats.tasks_in_progress || stats.in_progress_tasks || stats.inProgressTasks || 0;
            const todoTasks = stats.tasks_todo || stats.todo_tasks || stats.todoTasks || 0;

            const progress = tasksCount > 0 ? (doneTasks / tasksCount) * 100 : 0;

            let badgeClass = 'bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200';
            let badgeText = 'Публичный';

            if (projectData.is_private) {
                badgeClass = projectData.requires_approval ?
                    'bg-warning-100 dark:bg-warning-900 text-warning-800 dark:text-warning-200' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
                badgeText = projectData.requires_approval ? 'Одобрение' : 'Приватный';
            }

            return `
                <div class="p-5 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all cursor-pointer premium-card" onclick="App.openProject('${projectData.hash}')">
                    <div class="flex items-start justify-between mb-3">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                                <i class="fas fa-folder text-primary-600 dark:text-primary-400"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-gray-900 dark:text-gray-100">${this.escapeHtml(projectData.title)}</h3>
                                <div class="flex items-center mt-1 space-x-2">
                                    <span class="px-2 py-1 ${badgeClass} text-xs font-medium rounded-full">${badgeText}</span>
                                    <span class="text-xs text-gray-500 dark:text-gray-400">${Math.round(progress)}% завершено</span>
                                </div>
                            </div>
                        </div>
                        <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                    <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">${this.escapeHtml(projectData.description || 'Без описания')}</p>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                            <span><i class="fas fa-users mr-1"></i> ${membersCount} участников</span>
                            <span><i class="fas fa-tasks mr-1"></i> ${tasksCount} задач</span>
                        </div>
                        <div class="flex -space-x-2">
                            <!-- Аватары участников будут добавлены здесь -->
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    static renderSidebarProjects(projects) {
        const container = document.getElementById('sidebarProjectsList');
        if (!projects || projects.length === 0) {
            container.innerHTML = `
                <div class="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">
                    Проектов нет
                </div>
            `;
            return;
        }

        container.innerHTML = projects.slice(0, 5).map(project => {
            const projectData = project.project || project;
            const stats = project.stats || projectData.stats || {};
            const tasksCount = stats.tasks_count || stats.tasksCount || 0;

            let colorClass = 'bg-primary-500';
            if (projectData.is_private) {
                colorClass = projectData.requires_approval ? 'bg-warning-500' : 'bg-gray-500';
            }

            return `
                <a href="#" class="flex items-center px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors group" onclick="App.openProject('${projectData.hash}')">
                    <div class="w-2 h-2 ${colorClass} rounded-full mr-3"></div>
                    <span class="truncate">${this.escapeHtml(projectData.title)}</span>
                    <span class="ml-auto text-xs bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 px-2 py-0.5 rounded-full">${tasksCount}</span>
                </a>
            `;
        }).join('');
    }

    // Отображение недавних задач
    static renderRecentTasks(recentTasks) {
        const container = document.getElementById('recentTasksList');
        if (!recentTasks || recentTasks.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <i class="fas fa-tasks text-xl text-gray-400"></i>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Нет недавних задач</h3>
                    <p class="text-gray-600 dark:text-gray-400">Задачи, над которыми вы работали, появятся здесь</p>
                </div>
            `;
            return;
        }

        container.innerHTML = recentTasks.map(task => `
            <div class="flex items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer" onclick="App.openTask(${task.id})">
                <div class="custom-checkbox ${task.status === 'done' ? 'checked' : ''} mr-4"></div>
                <div class="flex-1">
                    <div class="font-medium text-gray-900 dark:text-gray-100">${this.escapeHtml(task.title)}</div>
                    <div class="flex items-center mt-1 space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <span><i class="fas fa-project-diagram mr-1"></i> ${task.project_title || 'Проект'}</span>
                        <span class="flex items-center"><span class="priority-indicator priority-${task.priority}"></span> ${this.getPriorityText(task.priority)}</span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Без срока'}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${task.assigned_user ? this.escapeHtml(task.assigned_user.full_name) : 'Не назначена'}</div>
                </div>
            </div>
        `).join('');
    }

    static updateStats(projects, recentTasks) {
        // ИСПРАВЛЕНО: Правильный подсчет статистики
        document.getElementById('projectsCount').textContent = projects.length;
        const totalTasks = projects.reduce((sum, project) => {
            const projectData = project.project || project;
            const stats = project.stats || projectData.stats || {};
            return sum + (stats.tasks_count || stats.tasksCount || 0);
        }, 0);
        document.getElementById('tasksCount').textContent = totalTasks;
        document.getElementById('recentTasksCount').textContent = recentTasks ? recentTasks.length : 0;

        const completed = projects.reduce((sum, project) => {
            const projectData = project.project || project;
            const stats = project.stats || projectData.stats || {};
            return sum + (stats.tasks_done || stats.done_tasks || stats.doneTasks || 0);
        }, 0);
        document.getElementById('completedTasksCount').textContent = completed;

        // Обновляем прогресс-бары
        const totalProgress = projects.length > 0 ? (completed / totalTasks) * 100 : 0;
        document.getElementById('projectsProgress').style.width = `${Math.min(100, (projects.length / 10) * 100)}%`;
        document.getElementById('tasksProgress').style.width = `${Math.min(100, (totalTasks / 50) * 100)}%`;
        document.getElementById('recentTasksProgress').style.width = `${Math.min(100, (recentTasks.length / 10) * 100)}%`;
        document.getElementById('completedTasksProgress').style.width = `${Math.min(100, totalProgress)}%`;
    }

    static async loadNotifications() {
        try {
            const response = await ApiService.getNotifications();
            const notifications = response.notifications || [];

            // Обновляем бейдж уведомлений
            const notificationBadge = document.getElementById('notificationBadge');
            if (notificationBadge) {
                const unreadCount = notifications.filter(n => !n.read).length;
                notificationBadge.textContent = unreadCount;
                notificationBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
            }

            // Обновляем выпадающий список уведомлений
            const dropdownList = document.getElementById('notificationsDropdownList');
            if (dropdownList) {
                if (notifications.length === 0) {
                    dropdownList.innerHTML = `
                        <div class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                            <i class="fas fa-bell-slash text-2xl mb-2"></i>
                            <p>Уведомлений нет</p>
                        </div>
                    `;
                } else {
                    dropdownList.innerHTML = notifications.slice(0, 3).map(notification => `
                        <div class="p-4 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors cursor-pointer ${notification.read ? '' : 'bg-blue-50 dark:bg-blue-900/20'}">
                            <div class="flex space-x-3">
                                <div class="w-10 h-10 ${this.getNotificationIconClass(notification.type)} rounded-full flex items-center justify-center">
                                    <i class="fas ${this.getNotificationIcon(notification.type)}"></i>
                                </div>
                                <div class="flex-1">
                                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">${this.escapeHtml(notification.title)}</p>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${this.escapeHtml(notification.message)}</p>
                                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">${new Date(notification.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                    `).join('');
                }
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    static getNotificationIcon(type) {
        const icons = {
            'task_completed': 'fa-check-circle',
            'new_member': 'fa-user-plus',
            'deadline': 'fa-exclamation-triangle',
            'default': 'fa-info-circle'
        };
        return icons[type] || icons.default;
    }

    static getNotificationIconClass(type) {
        const classes = {
            'task_completed': 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400',
            'new_member': 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
            'deadline': 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400',
            'default': 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400'
        };
        return classes[type] || classes.default;
    }

    static setupEventListeners() {
        // Переключение темы
        document.getElementById('themeToggle').addEventListener('click', () => {
            UIUtils.toggleTheme();
        });

        // Переключение сайдбара на мобильных
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            UIUtils.toggleSidebar();
        });

        // Поиск
        const searchInput = document.querySelector('input[placeholder*="Поиск"]');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch(searchInput.value);
                }
            });
        }
    }

    static showView(viewId) {
        // Скрываем все вью
        document.getElementById('dashboardView').classList.add('hidden');
        document.getElementById('projectView').classList.add('hidden');
        document.getElementById('taskView').classList.add('hidden');
        document.getElementById('myTasksView').classList.add('hidden');

        // Показываем нужную вью
        document.getElementById(viewId).classList.remove('hidden');
    }

    static showDashboard() {
        this.showView('dashboardView');
        this.loadData();
    }

    static async openProject(projectHash) {
        try {
            console.log('Opening project:', projectHash);
            const projectData = await ApiService.getProject(projectHash);
            // ИСПРАВЛЕНО: Правильное получение данных проекта
            currentProject = projectData.project || projectData;
            currentProject.members = projectData.members || [];

            // Получаем сводку проекта для статистики
            const projectSummary = await ApiService.getProjectSummary(projectHash);
            console.log('Project data:', currentProject);
            console.log('Project summary:', projectSummary);

            // Рендерим представление проекта
            this.renderProjectView(currentProject, projectSummary);

            this.showView('projectView');
        } catch (error) {
            console.error('Error opening project:', error);
            this.showError('Ошибка открытия проекта: ' + error.message);
        }
    }

    static renderProjectView(project, summary) {
        const projectView = document.getElementById('projectView');

        // Формируем HTML для представления проекта
        projectView.innerHTML = `
            <div class="mb-8">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                        <h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 mb-2">${this.escapeHtml(project.title)}</h1>
                        <div class="flex items-center mt-2 space-x-4 text-sm text-gray-600 dark:text-gray-400">
                            <span><i class="fas fa-users mr-1"></i> ${summary.members_count || 0} участников</span>
                            <span><i class="fas fa-tasks mr-1"></i> ${summary.tasks_count || 0} задач</span>
                            <span><i class="fas fa-check-circle mr-1"></i> ${summary.tasks_done || 0} выполнено</span>
                            <span><i class="fas fa-sync-alt mr-1"></i> ${summary.tasks_in_progress || 0} в работе</span>
                        </div>
                    </div>
                    <div class="flex space-x-2 mt-4 md:mt-0">
                        <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2" onclick="App.showCreateTaskModal()">
                            <i class="fas fa-plus"></i>
                            <span>Новая задача</span>
                        </button>
                        <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2" onclick="App.showDashboard()">
                            <i class="fas fa-arrow-left"></i>
                            <span>Назад</span>
                        </button>
                    </div>
                </div>
                <p class="text-gray-600 dark:text-gray-400">${this.escapeHtml(project.description || 'Без описания')}</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-2">
                    <div class="premium-card rounded-2xl overflow-hidden mb-6">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <div class="flex items-center justify-between">
                                <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Задачи проекта</h2>
                                <div class="flex space-x-2">
                                    <select class="premium-input text-sm rounded-xl focus-premium" onchange="App.filterProjectTasks(this.value)">
                                        <option value="">Все статусы</option>
                                        <option value="todo">К выполнению</option>
                                        <option value="in_progress">В работе</option>
                                        <option value="done">Выполнено</option>
                                    </select>
                                    <select class="premium-input text-sm rounded-xl focus-premium" onchange="App.filterProjectTasksByPriority(this.value)">
                                        <option value="">Все приоритеты</option>
                                        <option value="low">Низкий</option>
                                        <option value="medium">Средний</option>
                                        <option value="high">Высокий</option>
                                        <option value="urgent">Срочный</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="p-6">
                            <div class="task-list space-y-4" id="projectTasksList">
                                <!-- Задачи проекта будут загружены здесь -->
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <div class="premium-card rounded-2xl overflow-hidden mb-6">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Участники</h2>
                        </div>
                        <div class="p-6">
                            <div id="projectMembersList">
                                <!-- Участники проекта будут загружены здесь -->
                            </div>
                        </div>
                    </div>

                    <div class="premium-card rounded-2xl overflow-hidden">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Статистика</h2>
                        </div>
                        <div class="p-6">
                            <div class="space-y-4">
                                <div>
                                    <div class="flex justify-between mb-1">
                                        <span class="text-sm font-medium">Общий прогресс</span>
                                        <span class="text-sm font-medium">${summary.tasks_count > 0 ? Math.round((summary.tasks_done / summary.tasks_count) * 100) : 0}%</span>
                                    </div>
                                    <div class="progress-bar">
                                        <div class="progress-fill bg-primary-500" style="width: ${summary.tasks_count > 0 ? (summary.tasks_done / summary.tasks_count) * 100 : 0}%"></div>
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                        <div class="text-2xl font-black text-primary-500">${summary.tasks_todo || 0}</div>
                                        <div class="text-sm text-gray-600 dark:text-gray-400">К выполнению</div>
                                    </div>
                                    <div class="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                        <div class="text-2xl font-black text-warning-500">${summary.tasks_in_progress || 0}</div>
                                        <div class="text-sm text-gray-600 dark:text-gray-400">В работе</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Загружаем задачи и участников проекта
        this.loadProjectTasks(project.hash);
        this.loadProjectMembers(project.hash);
    }

    static async loadProjectTasks(projectHash) {
        try {
            const response = await ApiService.getTasks(projectHash);
            const tasks = response.tasks || [];
            const container = document.getElementById('projectTasksList');

            if (!tasks || tasks.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8">
                        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <i class="fas fa-tasks text-xl text-gray-400"></i>
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Задач пока нет</h3>
                        <p class="text-gray-600 dark:text-gray-400 mb-4">Создайте первую задачу для этого проекта</p>
                        <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl font-medium" onclick="App.showCreateTaskModal()">
                            <i class="fas fa-plus mr-2"></i> Создать задачу
                        </button>
                    </div>
                `;
                return;
            }

            container.innerHTML = tasks.map(task => `
                <div class="flex items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer" onclick="App.openTask(${task.id})">
                    <div class="custom-checkbox ${task.status === 'done' ? 'checked' : ''} mr-4"></div>
                    <div class="flex-1">
                        <div class="font-medium text-gray-900 dark:text-gray-100">${this.escapeHtml(task.title)}</div>
                        <div class="flex items-center mt-1 space-x-4 text-sm text-gray-500 dark:text-gray-400">
                            <span class="flex items-center"><span class="priority-indicator priority-${task.priority}"></span> ${this.getPriorityText(task.priority)}</span>
                            <span><i class="fas fa-calendar-alt mr-1"></i> ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Без срока'}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-gray-500 dark:text-gray-400">${task.assigned_user ? this.escapeHtml(task.assigned_user.full_name) : 'Не назначена'}</div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading project tasks:', error);
            document.getElementById('projectTasksList').innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-4">Ошибка загрузки задач</p>';
        }
    }

    static async loadProjectMembers(projectHash) {
        try {
            const response = await ApiService.getProjectMembers(projectHash);
            const members = response.members || [];
            const container = document.getElementById('projectMembersList');

            if (!members || members.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-4">Участников нет</p>';
                return;
            }

            container.innerHTML = members.map(member => {
                // ИСПРАВЛЕНО: Правильное получение данных участника
                const memberData = member.user || member;
                const displayName = (memberData.full_name && memberData.full_name.trim() !== '')
                    ? memberData.full_name
                    : (member.full_name && member.full_name.trim() !== '')
                    ? member.full_name
                    : `Участник #${member.user_id || memberData.id}`;

                return `
                    <div class="flex items-center space-x-3 py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
                        <div class="avatar bg-gradient-to-br from-primary-500 to-primary-600">
                            ${displayName.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1">
                            <div class="font-medium text-gray-900 dark:text-gray-100">${this.escapeHtml(displayName)}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">${this.getRoleText(member.role)}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading project members:', error);
            document.getElementById('projectMembersList').innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-4">Ошибка загрузки участников</p>';
        }
    }

    static async openTask(taskId) {
        try {
            console.log('Opening task:', taskId);
            const response = await ApiService.getTask(taskId);
            currentTask = response.task || response;
            console.log('Current task set to:', currentTask);

            if (!currentTask) {
                this.showError('Задача не найдена');
                return;
            }

            // Рендерим представление задачи
            this.renderTaskView(currentTask);

            this.showView('taskView');
        } catch (error) {
            console.error('Error opening task:', error);
            this.showError('Ошибка открытия задачи: ' + error.message);
        }
    }

    static renderTaskView(task) {
        const taskView = document.getElementById('taskView');

        taskView.innerHTML = `
            <div class="mb-8">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                        <h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 mb-2">${this.escapeHtml(task.title)}</h1>
                        <div class="flex items-center mt-2 space-x-4 text-sm text-gray-600 dark:text-gray-400">
                            <span><i class="fas fa-calendar-alt mr-1"></i> Создана: ${new Date(task.created_at).toLocaleDateString()}</span>
                            <span><i class="fas fa-user mr-1"></i> ${task.assigned_user ? this.escapeHtml(task.assigned_user.full_name) : 'Не назначена'}</span>
                        </div>
                    </div>
                    <div class="flex space-x-2 mt-4 md:mt-0">
                        <button class="btn-premium bg-success-500 hover:bg-success-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2" onclick="App.showCreateSubtaskModal()">
                            <i class="fas fa-plus"></i>
                            <span>Подзадача</span>
                        </button>
                        <button class="btn-premium bg-warning-500 hover:bg-warning-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2" onclick="App.showEditTaskModal()">
                            <i class="fas fa-edit"></i>
                            <span>Редактировать</span>
                        </button>
                        <button class="btn-premium bg-danger-500 hover:bg-danger-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2" onclick="App.showDeleteTaskModal()">
                            <i class="fas fa-trash"></i>
                            <span>Удалить</span>
                        </button>
                        <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2" onclick="App.backToProject()">
                            <i class="fas fa-arrow-left"></i>
                            <span>Назад</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-2">
                    <div class="premium-card rounded-2xl overflow-hidden mb-6">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Описание</h2>
                        </div>
                        <div class="p-6">
                            <p class="text-gray-700 dark:text-gray-300">${this.escapeHtml(task.description || 'Без описания')}</p>
                        </div>
                    </div>

                    <div class="premium-card rounded-2xl overflow-hidden mb-6">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Подзадачи</h2>
                        </div>
                        <div class="p-6">
                            <div id="subtasksList">
                                <!-- Подзадачи будут загружены здесь -->
                            </div>
                        </div>
                    </div>

                    <div class="premium-card rounded-2xl overflow-hidden">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Комментарии</h2>
                        </div>
                        <div class="p-6">
                            <div id="taskCommentsList" class="mb-4">
                                <!-- Комментарии будут загружены здесь -->
                            </div>
                            <div class="flex space-x-2">
                                <input type="text" id="newCommentText" placeholder="Введите комментарий..." class="premium-input flex-1 rounded-xl focus-premium">
                                <button onclick="App.addComment()" class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2">
                                    <i class="fas fa-paper-plane"></i>
                                    <span>Отправить</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <div class="premium-card rounded-2xl overflow-hidden mb-6">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Информация</h2>
                        </div>
                        <div class="p-6">
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Статус</label>
                                    <select id="taskStatusSelect" onchange="App.updateTaskStatus()" class="premium-input w-full rounded-xl focus-premium">
                                        <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>К выполнению</option>
                                        <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>В работе</option>
                                        <option value="done" ${task.status === 'done' ? 'selected' : ''}>Выполнено</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Приоритет</label>
                                    <div class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${this.getPriorityClass(task.priority)}">
                                        <span class="priority-indicator priority-${task.priority} mr-2"></span>
                                        ${this.getPriorityText(task.priority)}
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Создана</label>
                                    <p class="text-gray-700 dark:text-gray-300">${new Date(task.created_at).toLocaleString()}</p>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Срок</label>
                                    <p class="text-gray-700 dark:text-gray-300">${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Не установлен'}</p>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Исполнитель</label>
                                    <p class="text-gray-700 dark:text-gray-300">${task.assigned_user ? this.escapeHtml(task.assigned_user.full_name) : 'Не назначен'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Загружаем подзадачи и комментарии
        this.loadSubtasks(task.id);
        this.loadTaskComments(task.id);
    }

    static async loadSubtasks(parentTaskId) {
        try {
            if (!currentProject || !currentProject.hash) {
                console.error('No current project for loading subtasks');
                document.getElementById('subtasksList').innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-4">Ошибка загрузки подзадач: проект не выбран</p>';
                return;
            }

            // Получаем все задачи проекта
            const response = await ApiService.getTasks(currentProject.hash);
            const tasks = response.tasks || [];
            const subtasks = tasks.filter(task => task.parent_task_id === parentTaskId);
            const container = document.getElementById('subtasksList');

            if (subtasks.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8">
                        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <i class="fas fa-tasks text-xl text-gray-400"></i>
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Подзадач нет</h3>
                        <p class="text-gray-600 dark:text-gray-400 mb-4">Создайте первую подзадачу для этой задачи</p>
                        <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl font-medium" onclick="App.showCreateSubtaskModal()">
                            <i class="fas fa-plus mr-2"></i> Создать подзадачу
                        </button>
                    </div>
                `;
                return;
            }

            container.innerHTML = subtasks.map(subtask => `
                <div class="flex items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                    <div class="custom-checkbox ${subtask.status === 'done' ? 'checked' : ''} mr-4" onclick="App.toggleSubtaskStatus(${subtask.id}, this)"></div>
                    <div class="flex-1">
                        <div class="font-medium text-gray-900 dark:text-gray-100">${this.escapeHtml(subtask.title)}</div>
                        <div class="flex items-center mt-1 space-x-4 text-sm text-gray-500 dark:text-gray-400">
                            <span class="flex items-center"><span class="priority-indicator priority-${subtask.priority}"></span> ${this.getPriorityText(subtask.priority)}</span>
                            <span><i class="fas fa-calendar-alt mr-1"></i> ${subtask.due_date ? new Date(subtask.due_date).toLocaleDateString() : 'Без срока'}</span>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading subtasks:', error);
            document.getElementById('subtasksList').innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-4">Ошибка загрузки подзадач</p>';
        }
    }

    static async loadTaskComments(taskId) {
        try {
            const response = await ApiService.getTaskComments(taskId);
            const comments = response.comments || [];
            const container = document.getElementById('taskCommentsList');

            if (!comments || comments.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-4">Комментариев нет</p>';
                return;
            }

            container.innerHTML = comments.map(comment => `
                <div class="flex space-x-3 mb-4 last:mb-0">
                    <div class="avatar bg-gradient-to-br from-primary-500 to-primary-600">
                        ${comment.author_name ? comment.author_name.charAt(0).toUpperCase() : 'A'}
                    </div>
                    <div class="flex-1">
                        <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
                            <div class="flex justify-between items-start mb-1">
                                <div class="font-medium text-gray-900 dark:text-gray-100">${this.escapeHtml(comment.author_name || 'Аноним')}</div>
                                <div class="text-xs text-gray-500 dark:text-gray-400">${new Date(comment.created_at).toLocaleString()}</div>
                            </div>
                            <p class="text-gray-700 dark:text-gray-300">${this.escapeHtml(comment.content)}</p>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading task comments:', error);
            document.getElementById('taskCommentsList').innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-4">Ошибка загрузки комментариев</p>';
        }
    }

    static showModal(modalId) {
        UIUtils.showModal(modalId);
    }

    static hideModal(modalId) {
        UIUtils.hideModal(modalId);
    }

    static toggleSidebar() {
        UIUtils.toggleSidebar();
    }

    static showCreateProjectModal() {
        this.showModal('createProjectModal');
    }

    static async handleCreateProject() {
        const title = document.getElementById('projectTitle').value.trim();
        const description = document.getElementById('projectDescription').value.trim();
        const isPrivate = document.getElementById('projectIsPrivate').checked;
        const requiresApproval = document.getElementById('projectRequiresApproval').checked;

        if (!title) {
            this.showError('Введите название проекта');
            return;
        }

        try {
            console.log('Creating project:', { title, description, isPrivate, requiresApproval });
            await ApiService.createProject({
                title,
                description,
                is_private: isPrivate,
                requires_approval: requiresApproval
            });

            // Закрываем модальное окно
            this.hideModal('createProjectModal');

            // Очищаем форму
            document.getElementById('createProjectForm').reset();

            // Перезагружаем данные
            await this.loadData();

            this.showSuccess('Проект создан успешно!');
        } catch (error) {
            console.error('Error creating project:', error);
            this.showError('Ошибка создания проекта: ' + error.message);
        }
    }

    static async showCreateTaskModal() {
        try {
            // Загружаем проекты для выбора
            const response = await ApiService.getProjects();
            const projects = response.projects || [];

            const projectSelect = document.getElementById('taskProject');
            projectSelect.innerHTML = '<option value="">Выберите проект</option>';

            projects.forEach(project => {
                const projectData = project.project || project;
                const option = document.createElement('option');
                option.value = projectData.hash;
                option.textContent = projectData.title;
                if (currentProject && projectData.hash === currentProject.hash) {
                    option.selected = true;
                }
                projectSelect.appendChild(option);
            });

            // Загружаем участников если выбран проект
            if (currentProject) {
                await this.loadTaskAssignees(currentProject.hash);
            }

            this.showModal('createTaskModal');
        } catch (error) {
            console.error('Error loading projects for task creation:', error);
            this.showError('Ошибка загрузки данных: ' + error.message);
        }
    }

    static async loadTaskAssignees(projectHash) {
        try {
            const response = await ApiService.getProjectMembers(projectHash);
            const members = response.members || [];
            const assignedToSelect = document.getElementById('taskAssignedTo');

            assignedToSelect.innerHTML = '<option value="">Не назначена</option>';

            members.forEach(member => {
                const memberData = member.user || member;
                const displayName = (memberData.full_name && memberData.full_name.trim() !== '')
                    ? memberData.full_name
                    : `Участник #${member.user_id || memberData.id}`;

                const option = document.createElement('option');
                option.value = member.user_id || memberData.id;
                option.textContent = displayName;
                assignedToSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading project members:', error);
        }
    }

    static async handleCreateTask() {
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const priority = document.getElementById('taskPriority').value;
        const dueDate = document.getElementById('taskDueDate').value;
        const projectHash = document.getElementById('taskProject').value;
        const assignedTo = document.getElementById('taskAssignedTo').value;

        if (!title) {
            this.showError('Введите название задачи');
            return;
        }

        if (!projectHash) {
            this.showError('Выберите проект');
            return;
        }

        try {
            const taskData = {
                title,
                description,
                project_hash: projectHash,
                priority,
                status: 'todo'
            };

            if (dueDate) taskData.due_date = dueDate;
            if (assignedTo) {
                taskData.assigned_to_id = parseInt(assignedTo);
            }

            console.log('Creating task with data:', taskData);
            await ApiService.createTask(taskData);

            this.hideModal('createTaskModal');

            // Очищаем форму
            document.getElementById('createTaskForm').reset();

            // Перезагружаем задачи если открыт проект
            if (currentProject && currentProject.hash === projectHash) {
                await this.loadProjectTasks(currentProject.hash);
            }

            this.showSuccess('Задача создана успешно!');
        } catch (error) {
            console.error('Error creating task:', error);
            this.showError('Ошибка создания задачи: ' + error.message);
        }
    }

    static showCreateSubtaskModal() {
        this.showInfo('Функция создания подзадачи будет реализована в ближайшее время!');
    }

    static showEditTaskModal() {
        if (!currentTask || !currentTask.id) {
            console.error('No current task for editing:', currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        this.showInfo('Функция редактирования задачи будет реализована в ближайшее время!');
    }

    static showDeleteTaskModal() {
        if (!currentTask || !currentTask.id) {
            console.error('No current task for deletion:', currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        if (confirm(`Вы уверены, что хотите удалить задачу "${currentTask.title}"?`)) {
            this.showInfo('Функция удаления задачи будет реализована в ближайшее время!');
        }
    }

    static async updateTaskStatus() {
        if (!currentTask || !currentTask.id) {
            console.error('No current task or task ID:', currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        try {
            const newStatus = document.getElementById('taskStatusSelect').value;
            console.log('Updating task status:', currentTask.id, newStatus);
            await ApiService.updateTaskStatus(currentTask.id, newStatus);

            this.showSuccess('Статус задачи обновлен!');
        } catch (error) {
            console.error('Error updating task status:', error);
            this.showError('Ошибка обновления статуса: ' + error.message);

            // Восстанавливаем предыдущее значение
            if (currentTask) {
                document.getElementById('taskStatusSelect').value = currentTask.status;
            }
        }
    }

    static async addComment() {
        if (!currentTask || !currentTask.id) {
            console.error('No current task for comment:', currentTask);
            this.showError('Ошибка: задача не выбрана');
            return;
        }

        const content = document.getElementById('newCommentText').value.trim();
        if (!content) {
            this.showError('Введите текст комментария');
            return;
        }

        try {
            await ApiService.createTaskComment(currentTask.id, content);
            document.getElementById('newCommentText').value = '';
            await this.loadTaskComments(currentTask.id);
            this.showSuccess('Комментарий добавлен!');
        } catch (error) {
            console.error('Error adding comment:', error);
            this.showError('Ошибка добавления комментария: ' + error.message);
        }
    }

    static async toggleSubtaskStatus(taskId, checkbox) {
        try {
            const isChecked = checkbox.classList.contains('checked');
            const newStatus = isChecked ? 'todo' : 'done';

            await ApiService.updateTaskStatus(taskId, newStatus);

            if (isChecked) {
                checkbox.classList.remove('checked');
            } else {
                checkbox.classList.add('checked');
            }

            this.showSuccess('Статус подзадачи обновлен!');
        } catch (error) {
            console.error('Error updating subtask status:', error);
            this.showError('Ошибка обновления статуса подзадачи: ' + error.message);
        }
    }

    static async showNotifications() {
        try {
            const response = await ApiService.getNotifications();
            const notifications = response.notifications || [];
            const container = document.getElementById('notificationsList');

            if (!notifications || notifications.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8">
                        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <i class="fas fa-bell-slash text-xl text-gray-400"></i>
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Уведомлений нет</h3>
                        <p class="text-gray-600 dark:text-gray-400">Здесь появятся ваши уведомления</p>
                    </div>
                `;
            } else {
                container.innerHTML = notifications.map(notification => `
                    <div class="flex items-start space-x-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer ${notification.read ? '' : 'bg-blue-50 dark:bg-blue-900/20'}">
                        <div class="w-10 h-10 ${this.getNotificationIconClass(notification.type)} rounded-full flex items-center justify-center">
                            <i class="fas ${this.getNotificationIcon(notification.type)}"></i>
                        </div>
                        <div class="flex-1">
                            <p class="font-medium text-gray-900 dark:text-gray-100">${this.escapeHtml(notification.title)}</p>
                            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${this.escapeHtml(notification.message)}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">${new Date(notification.created_at).toLocaleString()}</p>
                        </div>
                    </div>
                `).join('');
            }

            this.showModal('notificationsModal');
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.showError('Ошибка загрузки уведомлений: ' + error.message);
        }
    }

    static async markAllNotificationsRead() {
        try {
            await ApiService.markAllNotificationsRead();
            this.hideModal('notificationsModal');
            this.loadNotifications();
            this.showSuccess('Все уведомления отмечены как прочитанные!');
        } catch (error) {
            console.error('Error marking notifications as read:', error);
            this.showError('Ошибка отметки уведомлений: ' + error.message);
        }
    }

    static showSettings() {
        this.showInfo('Настройки будут доступны в ближайшее время!');
    }

    static async showMyTasks() {
        try {
            const response = await ApiService.getUserTasks();
            const tasks = response.tasks || [];

            const myTasksView = document.getElementById('myTasksView');
            if (!myTasksView) {
                this.showError('Вид задач не найден');
                return;
            }

            myTasksView.innerHTML = `
                <div class="mb-8">
                    <div class="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 mb-2">Мои задачи</h1>
                            <p class="text-gray-600 dark:text-gray-400">Все задачи, назначенные на вас</p>
                        </div>
                        <div class="mt-4 md:mt-0 flex space-x-3">
                            <select class="premium-input rounded-xl focus-premium" onchange="App.filterMyTasks(this.value)">
                                <option value="">Все статусы</option>
                                <option value="todo">К выполнению</option>
                                <option value="in_progress">В работе</option>
                                <option value="done">Выполнено</option>
                            </select>
                            <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2" onclick="App.showCreateTaskModal()">
                                <i class="fas fa-plus"></i>
                                <span>Новая задача</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="premium-card rounded-2xl overflow-hidden">
                    <div class="p-6">
                        <div class="task-list space-y-4" id="myTasksList">
                            ${this.renderMyTasksList(tasks)}
                        </div>
                    </div>
                </div>
            `;

            this.showView('myTasksView');
        } catch (error) {
            console.error('Error loading my tasks:', error);
            this.showError('Ошибка загрузки задач: ' + error.message);
        }
    }

    static renderMyTasksList(tasks) {
        if (!tasks || tasks.length === 0) {
            return `
                <div class="text-center py-8">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <i class="fas fa-tasks text-xl text-gray-400"></i>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Задач нет</h3>
                    <p class="text-gray-600 dark:text-gray-400">На вас пока не назначено ни одной задачи</p>
                </div>
            `;
        }

        return tasks.map(task => `
            <div class="flex items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer" onclick="App.openTask(${task.id})">
                <div class="custom-checkbox ${task.status === 'done' ? 'checked' : ''} mr-4"></div>
                <div class="flex-1">
                    <div class="font-medium text-gray-900 dark:text-gray-100">${this.escapeHtml(task.title)}</div>
                    <div class="flex items-center mt-1 space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <span><i class="fas fa-project-diagram mr-1"></i> ${task.project_title || 'Проект'}</span>
                        <span class="flex items-center"><span class="priority-indicator priority-${task.priority}"></span> ${this.getPriorityText(task.priority)}</span>
                        <span><i class="fas fa-calendar-alt mr-1"></i> ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Без срока'}</span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${this.getStatusText(task.status)}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${task.project_title || ''}</div>
                </div>
            </div>
        `).join('');
    }

    static backToProject() {
        console.log('Back to project, currentProject:', currentProject);
        if (currentProject && currentProject.hash) {
            this.openProject(currentProject.hash);
        } else {
            console.log('No current project, showing dashboard');
            this.showDashboard();
        }
    }

    // Функции, требующие заглушек
    static showInviteMemberModal() {
        this.showInfo('Функция приглашения участников будет реализована в ближайшее время!');
    }

    static showExportModal() {
        this.showInfo('Функция экспорта данных будет реализована в ближайшее время!');
    }

    static showProfileModal() {
        this.showInfo('Функция профиля пользователя будет реализована в ближайшее время!');
    }

    static showCalendar() {
        this.showInfo('Функция календаря будет реализована в ближайшее время!');
    }

    static showReports() {
        this.showInfo('Функция отчетов будет реализована в ближайшее время!');
    }

    static showTeam() {
        this.showInfo('Функция управления командой будет реализована в ближайшее время!');
    }

    static handleSearch(query) {
        this.showInfo(`Поиск по запросу "${query}" будет реализован в ближайшее время!`);
    }

    static filterProjectTasks(status) {
        this.showInfo(`Фильтрация задач по статусу "${status}" будет реализована в ближайшее время!`);
    }

    static filterProjectTasksByPriority(priority) {
        this.showInfo(`Фильтрация задач по приоритету "${priority}" будет реализована в ближайшее время!`);
    }

    static filterMyTasks(status) {
        this.showInfo(`Фильтрация моих задач по статусу "${status}" будет реализована в ближайшее время!`);
    }

    static handleLogout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('theme');
        window.location.reload();
    }

    // Вспомогательные методы
    static getStatusText(status) {
        const statusMap = {
            'todo': 'К выполнению',
            'in_progress': 'В работе',
            'done': 'Выполнено'
        };
        return statusMap[status] || status;
    }

    static getPriorityText(priority) {
        const priorityMap = {
            'low': 'Низкий',
            'medium': 'Средний',
            'high': 'Высокий',
            'urgent': 'Срочный'
        };
        return priorityMap[priority] || priority;
    }

    static getPriorityClass(priority) {
        const classMap = {
            'low': 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200',
            'medium': 'bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200',
            'high': 'bg-danger-100 text-danger-800 dark:bg-danger-900 dark:text-danger-200',
            'urgent': 'bg-danger-200 text-danger-900 dark:bg-danger-800 dark:text-danger-100'
        };
        return classMap[priority] || classMap.medium;
    }

    static getRoleText(role) {
        const roleMap = {
            'owner': 'Владелец',
            'admin': 'Администратор',
            'member': 'Участник',
            'guest': 'Гость'
        };
        return roleMap[role] || role;
    }

    static showError(message) {
        UIUtils.showToast(message, 'error');
    }

    static showSuccess(message) {
        UIUtils.showToast(message, 'success');
    }

    static showInfo(message) {
        UIUtils.showToast(message, 'info');
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
