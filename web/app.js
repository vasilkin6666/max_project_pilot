// Конфигурация
const CONFIG = {
    API_BASE_URL: 'https://powerfully-exotic-chamois.cloudpub.ru/api'
};

const FALLBACK_DATA = {
    projects: [],
    tasks: [],
    notifications: []
};

// Глобальные переменные
let currentProject = null;
let currentTask = null;
let currentUser = null;
let currentMemberToUpdate = null;
let currentMemberToRemove = null;
let userSettings = {};
let currentView = 'dashboardView';
let projectTeams = new Map();

// Константы ролей проекта
const ProjectRole = {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    GUEST: 'guest'
};

let currentFilters = {
    status: '',
    priority: '',
    project: '',
    assignee: '',
    dateRange: ''
};

let currentSort = {
    field: 'created_at',
    direction: 'desc'
};

let allTasks = [];
let allProjects = [];

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
              let errorText = 'Unknown error';
              try {
                  errorText = await response.text();
              } catch (e) {
                  console.error('Error reading error response:', e);
              }

              const error = new Error(`HTTP ${response.status}: ${errorText}`);
              error.status = response.status;
              throw error;
          }

          const data = await response.json();
          console.log(`API Response:`, data);
          return data;
      } catch (error) {
          console.error('API request failed:', error);

          // Показываем пользователю понятное сообщение об ошибке
          if (error.status === 401) {
              this.showError('Ошибка авторизации. Пожалуйста, войдите снова.');
              this.handleLogout();
          } else if (error.status === 403) {
              this.showError('Доступ запрещен.');
          } else if (error.status === 404) {
              this.showError('Ресурс не найден.');
          } else if (error.status >= 500) {
              this.showError('Ошибка сервера. Пожалуйста, попробуйте позже.');
          } else {
              this.showError('Ошибка сети: ' + error.message);
          }

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
        try {
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.project_hash) params.append('project_hash', filters.project_hash);
            const query = params.toString();
            return await this.get(`/tasks/${query ? `?${query}` : ''}`);
        } catch (error) {
            console.error('Failed to load user tasks, using fallback data');
            return { tasks: FALLBACK_DATA.tasks };
        }
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
            return await this.get('/dashboard/');
        } catch (error) {
            console.error('Failed to load dashboard, using fallback data');
            return FALLBACK_DATA;
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
          this.updateUserAvatar();

          // Загружаем данные
          await this.loadData();

          // Настраиваем обработчики событий
          this.setupEventListeners();

          console.log('App initialized successfully');
      } catch (error) {
          console.error('App initialization failed:', error);
          this.showError('Ошибка инициализации приложения: ' + error.message);

          // Показываем приложение даже при ошибке
          setTimeout(() => {
              const splashScreen = document.getElementById('splashScreen');
              const appContainer = document.getElementById('appContainer');
              if (splashScreen) splashScreen.style.display = 'none';
              if (appContainer) appContainer.classList.remove('hidden');
          }, 2000);
      }
  }

    static getUserPhotoUrl() {
        try {
            // Пытаемся получить из MAX WebApp
            if (typeof WebApp !== 'undefined' && WebApp.initDataUnsafe?.user?.photo_url) {
                return WebApp.initDataUnsafe.user.photo_url;
            }

            // Парсим из URL hash
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const webAppData = params.get('WebAppData');

            if (webAppData) {
                const webAppParams = new URLSearchParams(webAppData);
                const userJson = webAppParams.get('user');
                if (userJson) {
                    const userData = JSON.parse(decodeURIComponent(userJson));
                    return userData.photo_url;
                }
            }
        } catch (error) {
            console.error('Error parsing user photo URL:', error);
        }
        return null;
    }

    static async showInviteMemberModal(projectHash = null) {
        try {
            let targetProject = projectHash ? await ApiService.getProject(projectHash) : currentProject;

            if (!targetProject) {
                // Показываем выбор проекта
                await this.showProjectSelectionModal();
                return;
            }

            const projectData = targetProject.project || targetProject;
            const response = await ApiService.regenerateInvite(projectData.hash);
            const inviteLink = response.invite_url || `https://max.ru/t44_hakaton_bot?start=${projectData.hash}`;

            // Генерируем QR код
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteLink)}`;

            const modalHtml = `
                <div id="inviteMemberModal" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
                    <div class="modal premium-card rounded-2xl w-full max-w-md transform transition-transform duration-300 scale-100 opacity-100">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <div class="flex items-center justify-between">
                                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Пригласить участника</h3>
                                <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors" onclick="App.hideModal('inviteMemberModal')">
                                    <i class="fas fa-times text-xl"></i>
                                </button>
                            </div>
                        </div>
                        <div class="p-6">
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Проект</label>
                                <input type="text" value="${this.escapeHtml(projectData.title)}" readonly
                                       class="premium-input w-full rounded-xl focus-premium bg-gray-50 dark:bg-gray-800">
                            </div>
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ссылка для приглашения</label>
                                <div class="flex space-x-2 mb-3">
                                    <input type="text" id="inviteLinkInput" readonly
                                           value="${inviteLink}"
                                           class="premium-input flex-1 rounded-xl focus-premium bg-gray-50 dark:bg-gray-800">
                                    <button onclick="App.copyInviteLink()"
                                            class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="text-center">
                                <div class="qr-code mb-3">
                                    <img src="${qrCodeUrl}" alt="QR Code" class="w-full h-full">
                                </div>
                                <p class="text-sm text-gray-500 dark:text-gray-400">
                                    Отсканируйте QR-код или отправьте ссылку
                                </p>
                            </div>
                        </div>
                        <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                            <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium"
                                    onclick="App.hideModal('inviteMemberModal')">
                                Готово
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        } catch (error) {
            console.error('Error generating invite:', error);
            this.showError('Ошибка создания приглашения: ' + error.message);
        }
    }

    // Модальное окно выбора проекта
    static async showProjectSelectionModal() {
        try {
            const response = await ApiService.getProjects();
            const projects = response.projects || [];

            const modalHtml = `
                <div id="projectSelectionModal" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
                    <div class="modal premium-card rounded-2xl w-full max-w-md transform transition-transform duration-300 scale-100 opacity-100">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Выберите проект</h3>
                        </div>
                        <div class="p-6 max-h-96 overflow-y-auto">
                            <div class="space-y-2">
                                ${projects.map(project => {
                                    const projectData = project.project || project;
                                    return `
                                        <div class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer"
                                             onclick="App.selectProjectForInvite('${projectData.hash}')">
                                            <div class="font-medium text-gray-900 dark:text-gray-100">${this.escapeHtml(projectData.title)}</div>
                                            <div class="text-sm text-gray-500 dark:text-gray-400">${this.escapeHtml(projectData.description || 'Без описания')}</div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                            <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-5 py-2.5 rounded-xl font-medium"
                                    onclick="App.hideModal('projectSelectionModal')">
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        } catch (error) {
            console.error('Error loading projects:', error);
            this.showError('Ошибка загрузки проектов: ' + error.message);
        }
    }

    static async selectProjectForInvite(projectHash) {
        this.hideModal('projectSelectionModal');
        await this.showInviteMemberModal(projectHash);
    }

    static copyInviteLink() {
        const input = document.getElementById('inviteLinkInput');
        if (input) {
            input.select();
            document.execCommand('copy');
            this.showSuccess('Ссылка скопирована в буфер обмена!');
        }
    }

    static async showExportModal() {
        try {
            // Получаем данные для экспорта
            const dashboardData = await ApiService.getDashboard();
            const projects = dashboardData.projects || [];

            const modalHtml = `
                <div id="exportModal" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
                    <div class="modal premium-card rounded-2xl w-full max-w-md transform transition-transform duration-300 scale-100 opacity-100">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <div class="flex items-center justify-between">
                                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Экспорт данных</h3>
                                <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors" onclick="App.hideModal('exportModal')">
                                    <i class="fas fa-times text-xl"></i>
                                </button>
                            </div>
                        </div>
                        <div class="p-6">
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Тип экспорта</label>
                                    <select id="exportType" class="premium-input w-full rounded-xl focus-premium">
                                        <option value="json">JSON</option>
                                        <option value="csv">CSV</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Данные для экспорта</label>
                                    <div class="space-y-2">
                                        <label class="flex items-center">
                                            <input type="checkbox" id="exportProjects" checked class="rounded border-gray-300 text-primary-600 focus:ring-primary-500">
                                            <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Проекты</span>
                                        </label>
                                        <label class="flex items-center">
                                            <input type="checkbox" id="exportTasks" checked class="rounded border-gray-300 text-primary-600 focus:ring-primary-500">
                                            <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Задачи</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                            <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-5 py-2.5 rounded-xl font-medium"
                                    onclick="App.hideModal('exportModal')">
                                Отмена
                            </button>
                            <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium"
                                    onclick="App.handleExport()">
                                Экспортировать
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        } catch (error) {
            console.error('Error loading export data:', error);
            this.showError('Ошибка загрузки данных для экспорта: ' + error.message);
        }
    }

    static async handleExport() {
        try {
            const exportType = document.getElementById('exportType').value;
            const exportProjects = document.getElementById('exportProjects').checked;
            const exportTasks = document.getElementById('exportTasks').checked;

            const dashboardData = await ApiService.getDashboard();
            let exportData = {};

            if (exportProjects) {
                exportData.projects = dashboardData.projects || [];
            }

            if (exportTasks) {
                // Получаем задачи для всех проектов
                const allTasks = [];
                if (dashboardData.projects) {
                    for (const project of dashboardData.projects) {
                        const projectData = project.project || project;
                        try {
                            const tasksResponse = await ApiService.getTasks(projectData.hash);
                            const tasks = tasksResponse.tasks || [];
                            tasks.forEach(task => {
                                task.project_title = projectData.title;
                                allTasks.push(task);
                            });
                        } catch (error) {
                            console.error(`Error loading tasks for project ${projectData.title}:`, error);
                        }
                    }
                }
                exportData.tasks = allTasks;
            }

            let content, mimeType, filename;

            if (exportType === 'json') {
                content = JSON.stringify(exportData, null, 2);
                mimeType = 'application/json';
                filename = `project_pilot_export_${new Date().toISOString().split('T')[0]}.json`;
            } else {
                // CSV экспорт
                content = this.convertToCSV(exportData);
                mimeType = 'text/csv';
                filename = `project_pilot_export_${new Date().toISOString().split('T')[0]}.csv`;
            }

            // Создаем и скачиваем файл
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.hideModal('exportModal');
            this.showSuccess('Данные успешно экспортированы!');

        } catch (error) {
            console.error('Error exporting data:', error);
            this.showError('Ошибка экспорта данных: ' + error.message);
        }
    }

    static convertToCSV(data) {
        // Простая реализация конвертации в CSV
        let csv = '';

        if (data.projects && data.projects.length > 0) {
            csv += 'Проекты\n';
            csv += 'Название,Описание,Участников,Задач,Выполнено,Тип\n';
            data.projects.forEach(project => {
                const projectData = project.project || project;
                const stats = project.stats || projectData.stats || {};
                csv += `"${projectData.title}","${projectData.description || ''}",${stats.members_count || 0},${stats.tasks_count || 0},${stats.tasks_done || 0},"${projectData.is_private ? 'Приватный' : 'Публичный'}"\n`;
            });
            csv += '\n';
        }

        if (data.tasks && data.tasks.length > 0) {
            csv += 'Задачи\n';
            csv += 'Проект,Название,Описание,Статус,Приоритет,Срок,Исполнитель\n';
            data.tasks.forEach(task => {
                csv += `"${task.project_title || ''}","${task.title}","${task.description || ''}","${this.getStatusText(task.status)}","${this.getPriorityText(task.priority)}","${task.due_date || ''}","${task.assigned_user ? task.assigned_user.full_name : ''}"\n`;
            });
        }

        return csv;
    }

    static async showProfileModal() {
        try {
            const userData = await ApiService.getCurrentUser();
            const photoUrl = this.getUserPhotoUrl();

            const modalHtml = `
                <div id="profileModal" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
                    <div class="modal premium-card rounded-2xl w-full max-w-md transform transition-transform duration-300 scale-100 opacity-100 max-h-[90vh] overflow-y-auto">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <div class="flex items-center justify-between">
                                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Профиль пользователя</h3>
                                <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors" onclick="App.hideModal('profileModal')">
                                    <i class="fas fa-times text-xl"></i>
                                </button>
                            </div>
                        </div>
                        <div class="p-6">
                            <div class="text-center mb-6">
                                <div class="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-2xl font-bold">
                                    ${photoUrl ?
                                        `<img src="${photoUrl}" class="w-full h-full object-cover" alt="Аватар">` :
                                        (userData.full_name ? userData.full_name.charAt(0).toUpperCase() : 'U')
                                    }
                                </div>
                                <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">${this.escapeHtml(userData.full_name || 'Пользователь')}</h3>
                                <p class="text-gray-500 dark:text-gray-400 text-sm">${userData.username || ''}</p>
                            </div>

                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Полное имя</label>
                                    <input type="text" id="profileFullName" value="${this.escapeHtml(userData.full_name || '')}"
                                           class="premium-input w-full rounded-xl focus-premium px-4 py-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Username</label>
                                    <input type="text" id="profileUsername" value="${this.escapeHtml(userData.username || '')}"
                                           class="premium-input w-full rounded-xl focus-premium px-4 py-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ID пользователя</label>
                                    <input type="text" value="${userData.id || 'N/A'}" readonly
                                           class="premium-input w-full rounded-xl focus-premium px-4 py-3 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                                </div>
                            </div>
                        </div>
                        <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                            <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-5 py-2.5 rounded-xl font-medium"
                                    onclick="App.hideModal('profileModal')">
                                Отмена
                            </button>
                            <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium"
                                    onclick="App.handleProfileUpdate()">
                                Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        } catch (error) {
            console.error('Error loading profile data:', error);
            this.showError('Ошибка загрузки профиля: ' + error.message);
        }
    }

    static async handleProfileUpdate() {
        try {
            const fullName = document.getElementById('profileFullName').value.trim();
            const username = document.getElementById('profileUsername').value.trim();

            await ApiService.updateCurrentUser({
                full_name: fullName,
                username: username
            });

            // Обновляем текущего пользователя
            currentUser = await ApiService.getCurrentUser();
            this.updateUserInfo();
            this.updateUserAvatar();

            this.hideModal('profileModal');
            this.showSuccess('Профиль обновлен успешно!');
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showError('Ошибка обновления профиля: ' + error.message);
        }
    }

    static async showCalendar() {
        try {
            // Получаем задачи пользователя
            const response = await ApiService.getUserTasks();
            const tasks = response.tasks || [];

            // Группируем задачи по датам
            const tasksByDate = {};
            tasks.forEach(task => {
                const dateKey = task.due_date ? task.due_date.split('T')[0] : 'без срока';
                if (!tasksByDate[dateKey]) {
                    tasksByDate[dateKey] = [];
                }
                tasksByDate[dateKey].push(task);
            });

            // Создаем представление календаря
            const calendarView = document.getElementById('calendarView');
            if (!calendarView) {
                this.showError('Элемент календаря не найден');
                return;
            }

            calendarView.innerHTML = `
                <div class="mb-8">
                    <div class="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 mb-2">Календарь задач</h1>
                            <p class="text-gray-600 dark:text-gray-400">Задачи с установленными сроками выполнения</p>
                        </div>
                        <div class="mt-4 md:mt-0">
                            <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2"
                                    onclick="App.showCreateTaskModal()">
                                <i class="fas fa-plus"></i>
                                <span>Новая задача</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="premium-card rounded-2xl overflow-hidden">
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Задачи по датам</h2>
                    </div>
                    <div class="p-6">
                        ${this.renderCalendarTasks(tasksByDate)}
                    </div>
                </div>
            `;

            this.showView('calendarView');
        } catch (error) {
            console.error('Error loading calendar:', error);
            this.showError('Ошибка загрузки календаря: ' + error.message);
        }
    }

    static renderCalendarTasks(tasksByDate) {
        const dateKeys = Object.keys(tasksByDate).sort((a, b) => {
            if (a === 'без срока') return 1;
            if (b === 'без срока') return -1;
            return new Date(a) - new Date(b);
        });

        if (dateKeys.length === 0) {
            return `
                <div class="text-center py-8">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <i class="fas fa-calendar text-xl text-gray-400"></i>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Нет задач с установленными сроками</h3>
                    <p class="text-gray-600 dark:text-gray-400">Создайте задачу с указанием срока выполнения</p>
                </div>
            `;
        }

        return dateKeys.map(dateKey => `
            <div class="mb-6 last:mb-0">
                <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                    <i class="fas fa-calendar-day mr-2 text-primary-500"></i>
                    ${dateKey === 'без срока' ? 'Без срока' : new Date(dateKey).toLocaleDateString('ru-RU')}
                </h3>
                <div class="space-y-2">
                    ${tasksByDate[dateKey].map(task => `
                        <div class="flex items-center p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer"
                             onclick="App.openTask(${task.id})">
                            <div class="custom-checkbox ${task.status === 'done' ? 'checked' : ''} mr-3"></div>
                            <div class="flex-1">
                                <div class="font-medium text-gray-900 dark:text-gray-100">${this.escapeHtml(task.title)}</div>
                                <div class="flex items-center mt-1 space-x-3 text-sm text-gray-500 dark:text-gray-400">
                                    <span><i class="fas fa-project-diagram mr-1"></i> ${task.project_title || 'Проект'}</span>
                                    <span class="flex items-center"><span class="priority-indicator priority-${task.priority}"></span> ${this.getPriorityText(task.priority)}</span>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-sm font-medium ${this.getStatusColor(task.status)}">${this.getStatusText(task.status)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    static getStatusColor(status) {
        const colors = {
            'todo': 'text-gray-600 dark:text-gray-400',
            'in_progress': 'text-warning-600 dark:text-warning-400',
            'done': 'text-success-600 dark:text-success-400'
        };
        return colors[status] || colors.todo;
    }

    static async showReports() {
        try {
            const dashboardData = await ApiService.getDashboard();
            const projects = dashboardData.projects || [];

            // Собираем статистику
            const stats = {
                totalProjects: projects.length,
                totalTasks: 0,
                completedTasks: 0,
                inProgressTasks: 0,
                todoTasks: 0,
                totalMembers: 0
            };

            projects.forEach(project => {
                const projectData = project.project || project;
                const projectStats = project.stats || projectData.stats || {};

                stats.totalTasks += projectStats.tasks_count || 0;
                stats.completedTasks += projectStats.tasks_done || 0;
                stats.inProgressTasks += projectStats.tasks_in_progress || 0;
                stats.todoTasks += projectStats.tasks_todo || 0;
                stats.totalMembers += projectStats.members_count || 0;
            });

            const completionRate = stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0;

            const reportsView = document.getElementById('reportsView');
            if (!reportsView) {
                this.showError('Элемент отчетов не найден');
                return;
            }

            reportsView.innerHTML = `
                <div class="mb-8">
                    <div class="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 mb-2">Отчеты и аналитика</h1>
                            <p class="text-gray-600 dark:text-gray-400">Статистика и аналитика ваших проектов</p>
                        </div>
                        <div class="mt-4 md:mt-0">
                            <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2"
                                    onclick="App.exportReports()">
                                <i class="fas fa-file-export"></i>
                                <span>Экспорт отчета</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Общая статистика -->
                    <div class="premium-card rounded-2xl overflow-hidden">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Общая статистика</h2>
                        </div>
                        <div class="p-6">
                            <div class="grid grid-cols-2 gap-4">
                                <div class="text-center p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                                    <div class="text-2xl font-black text-primary-600 dark:text-primary-400">${stats.totalProjects}</div>
                                    <div class="text-sm text-primary-700 dark:text-primary-300">Проектов</div>
                                </div>
                                <div class="text-center p-4 bg-success-50 dark:bg-success-900/20 rounded-xl">
                                    <div class="text-2xl font-black text-success-600 dark:text-success-400">${stats.totalTasks}</div>
                                    <div class="text-sm text-success-700 dark:text-success-300">Всего задач</div>
                                </div>
                                <div class="text-center p-4 bg-warning-50 dark:bg-warning-900/20 rounded-xl">
                                    <div class="text-2xl font-black text-warning-600 dark:text-warning-400">${stats.totalMembers}</div>
                                    <div class="text-sm text-warning-700 dark:text-warning-300">Участников</div>
                                </div>
                                <div class="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                                    <div class="text-2xl font-black text-purple-600 dark:text-purple-400">${Math.round(completionRate)}%</div>
                                    <div class="text-sm text-purple-700 dark:text-purple-300">Выполнено</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Статусы задач -->
                    <div class="premium-card rounded-2xl overflow-hidden">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Статусы задач</h2>
                        </div>
                        <div class="p-6">
                            <div class="space-y-4">
                                <div>
                                    <div class="flex justify-between mb-1">
                                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Выполнено</span>
                                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${stats.completedTasks}</span>
                                    </div>
                                    <div class="progress-bar">
                                        <div class="progress-fill bg-success-500" style="width: ${stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0}%"></div>
                                    </div>
                                </div>
                                <div>
                                    <div class="flex justify-between mb-1">
                                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">В работе</span>
                                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${stats.inProgressTasks}</span>
                                    </div>
                                    <div class="progress-bar">
                                        <div class="progress-fill bg-warning-500" style="width: ${stats.totalTasks > 0 ? (stats.inProgressTasks / stats.totalTasks) * 100 : 0}%"></div>
                                    </div>
                                </div>
                                <div>
                                    <div class="flex justify-between mb-1">
                                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">К выполнению</span>
                                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${stats.todoTasks}</span>
                                    </div>
                                    <div class="progress-bar">
                                        <div class="progress-fill bg-gray-500" style="width: ${stats.totalTasks > 0 ? (stats.todoTasks / stats.totalTasks) * 100 : 0}%"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Список проектов -->
                    <div class="premium-card rounded-2xl overflow-hidden lg:col-span-2">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Статистика по проектам</h2>
                        </div>
                        <div class="p-6">
                            <div class="overflow-x-auto">
                                <table class="w-full">
                                    <thead>
                                        <tr class="border-b border-gray-200 dark:border-gray-700">
                                            <th class="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Проект</th>
                                            <th class="text-center py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Задачи</th>
                                            <th class="text-center py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Выполнено</th>
                                            <th class="text-center py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Прогресс</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${projects.map(project => {
                                            const projectData = project.project || project;
                                            const projectStats = project.stats || projectData.stats || {};
                                            const progress = projectStats.tasks_count > 0 ? (projectStats.tasks_done / projectStats.tasks_count) * 100 : 0;
                                            return `
                                                <tr class="border-b border-gray-200 dark:border-gray-700 last:border-0">
                                                    <td class="py-3 px-4">
                                                        <div class="font-medium text-gray-900 dark:text-gray-100">${this.escapeHtml(projectData.title)}</div>
                                                        <div class="text-sm text-gray-500 dark:text-gray-400">${projectStats.members_count || 0} участников</div>
                                                    </td>
                                                    <td class="text-center py-3 px-4 text-sm text-gray-700 dark:text-gray-300">${projectStats.tasks_count || 0}</td>
                                                    <td class="text-center py-3 px-4 text-sm text-gray-700 dark:text-gray-300">${projectStats.tasks_done || 0}</td>
                                                    <td class="text-center py-3 px-4">
                                                        <div class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${progress >= 70 ? 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200' : progress >= 30 ? 'bg-warning-100 text-warning-800 dark:bg-warning-900 dark:text-warning-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}">
                                                            ${Math.round(progress)}%
                                                        </div>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.showView('reportsView');
        } catch (error) {
            console.error('Error loading reports:', error);
            this.showError('Ошибка загрузки отчетов: ' + error.message);
        }
    }

    static exportReports() {
        this.showExportModal();
    }

    static async showTeam() {
    try {
        const dashboardData = await ApiService.getDashboard();
        const projects = dashboardData.projects || [];

        // Собираем всех участников из всех проектов
        const allMembers = new Map();

        for (const project of projects) {
            const projectData = project.project || project;
            try {
                const membersResponse = await ApiService.getProjectMembers(projectData.hash);
                const members = membersResponse.members || [];

                members.forEach(member => {
                    const memberData = member.user || member;
                    const memberId = member.user_id || memberData.id;

                    if (!allMembers.has(memberId)) {
                        allMembers.set(memberId, {
                            ...memberData,
                            projects: [],
                            roles: []
                        });
                    }

                    const existingMember = allMembers.get(memberId);
                    existingMember.projects.push(projectData.title);
                    existingMember.roles.push({
                        project: projectData.title,
                        role: member.role
                    });
                });
            } catch (error) {
                console.error(`Error loading members for project ${projectData.title}:`, error);
            }
        }

        const teamView = document.getElementById('teamView');
        if (!teamView) {
            this.showError('Элемент команды не найден');
            return;
        }

        teamView.innerHTML = `
            <div class="mb-8">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 mb-2">Управление командой</h1>
                        <p class="text-gray-600 dark:text-gray-400">Все участники ваших проектов</p>
                    </div>
                    <div class="mt-4 md:mt-0">
                        <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2"
                                onclick="App.showInviteMemberModal()">
                            <i class="fas fa-user-plus"></i>
                            <span>Пригласить</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="premium-card rounded-2xl overflow-hidden">
                <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Участники команды</h2>
                </div>
                <div class="p-6">
                    ${this.renderTeamMembers(Array.from(allMembers.values()))}
                </div>
            </div>
        `;

        this.showView('teamView');
    } catch (error) {
        console.error('Error loading team:', error);
        this.showError('Ошибка загрузки команды: ' + error.message);
    }
}

static renderTeamMembers(members) {
    if (members.length === 0) {
        return `
            <div class="text-center py-8">
                <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <i class="fas fa-users text-xl text-gray-400"></i>
                </div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Участников нет</h3>
                <p class="text-gray-600 dark:text-gray-400">Пригласите участников в свои проекты</p>
            </div>
        `;
    }

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${members.map(member => {
                const photoUrl = this.getUserPhotoUrl();
                const displayName = member.full_name || `Участник #${member.id}`;
                const isCurrentUser = currentUser && member.id === currentUser.id;

                return `
                    <div class="premium-card p-6 rounded-2xl text-center">
                        <div class="w-16 h-16 mx-auto mb-4 rounded-full overflow-hidden bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-xl font-bold">
                            ${photoUrl ?
                                `<img src="${photoUrl}" class="w-full h-full object-cover" alt="Аватар">` :
                                displayName.charAt(0).toUpperCase()
                            }
                        </div>
                        <h3 class="font-bold text-gray-900 dark:text-gray-100 mb-1">${this.escapeHtml(displayName)}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">${member.username || ''}</p>

                        <div class="text-left space-y-2">
                            <div class="text-sm">
                                <span class="font-medium">Проекты:</span>
                                <span class="text-gray-600 dark:text-gray-400"> ${member.projects.join(', ')}</span>
                            </div>
                            <div class="text-sm">
                                <span class="font-medium">Роли:</span>
                                ${member.roles.map(role => `
                                    <span class="inline-block px-2 py-1 text-xs rounded-full ml-1 ${
                                        role.role === 'owner' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                        role.role === 'admin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                    }">
                                        ${this.getRoleText(role.role)} (${role.project})
                                    </span>
                                `).join('')}
                            </div>
                        </div>

                        ${!isCurrentUser ? `
                            <div class="mt-4 flex space-x-2">
                                <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded-xl text-sm font-medium flex-1"
                                        onclick="App.showMemberProjects('${member.id}')">
                                    <i class="fas fa-eye mr-1"></i> Проекты
                                </button>
                            </div>
                        ` : `
                            <div class="mt-4">
                                <span class="inline-block px-3 py-1 bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200 rounded-full text-sm">
                                    Это вы
                                </span>
                            </div>
                        `}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Методы для мобильного поиска
static showMobileSearch() {
    const mobileSearch = document.getElementById('mobileSearchContainer');
    if (mobileSearch) {
        mobileSearch.classList.remove('hidden');
        const input = document.getElementById('mobileSearchInput');
        if (input) input.focus();
    }
}

static hideMobileSearch() {
    const mobileSearch = document.getElementById('mobileSearchContainer');
    if (mobileSearch) {
        mobileSearch.classList.add('hidden');
    }
}

static async handleSearch(query) {
    if (!query.trim()) {
        this.showDashboard();
        return;
    }

    try {
        // Ищем проекты по названию
        const projectsResponse = await ApiService.searchPublicProjects(query);
        const projects = projectsResponse.projects || [];

        // Ищем задачи пользователя
        const tasksResponse = await ApiService.getUserTasks();
        const allTasks = tasksResponse.tasks || [];
        const filteredTasks = allTasks.filter(task =>
            task.title.toLowerCase().includes(query.toLowerCase()) ||
            (task.description && task.description.toLowerCase().includes(query.toLowerCase()))
        );

        // Создаем представление поиска
        const searchView = document.getElementById('searchView');
        if (!searchView) {
            // Создаем элемент для поиска если его нет
            const mainContent = document.querySelector('main .p-6');
            const searchHtml = `
                <div id="searchView" class="animate-fade-in">
                    <div class="mb-8">
                        <div class="flex flex-col md:flex-row md:items-center md:justify-between">
                            <div>
                                <h1 class="text-3xl font-black text-gray-900 dark:text-gray-100 mb-2">Результаты поиска</h1>
                                <p class="text-gray-600 dark:text-gray-400">По запросу: "${this.escapeHtml(query)}"</p>
                            </div>
                            <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2 mt-4 md:mt-0"
                                    onclick="App.showDashboard()">
                                <i class="fas fa-arrow-left"></i>
                                <span>Назад</span>
                            </button>
                        </div>
                    </div>

                    <div class="space-y-8">
                        ${projects.length > 0 ? `
                            <div class="premium-card rounded-2xl overflow-hidden">
                                <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                                    <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Найденные проекты</h2>
                                </div>
                                <div class="p-6">
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        ${this.renderSearchProjects(projects)}
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        ${filteredTasks.length > 0 ? `
                            <div class="premium-card rounded-2xl overflow-hidden">
                                <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                                    <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Найденные задачи</h2>
                                </div>
                                <div class="p-6">
                                    <div class="space-y-3">
                                        ${this.renderSearchTasks(filteredTasks)}
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        ${projects.length === 0 && filteredTasks.length === 0 ? `
                            <div class="text-center py-12">
                                <div class="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                    <i class="fas fa-search text-3xl text-gray-400"></i>
                                </div>
                                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Ничего не найдено</h3>
                                <p class="text-gray-600 dark:text-gray-400">Попробуйте изменить поисковый запрос</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            mainContent.innerHTML = searchHtml;
        } else {
            searchView.innerHTML = `
                <!-- Тот же HTML что выше, но для обновления существующего view -->
            `;
        }

        this.showView('searchView');
    } catch (error) {
        console.error('Error searching:', error);
        this.showError('Ошибка поиска: ' + error.message);
    }
}

static renderSearchProjects(projects) {
    return projects.map(project => {
        const projectData = project.project || project;
        const stats = project.stats || projectData.stats || {};
        const progress = stats.tasks_count > 0 ? (stats.tasks_done / stats.tasks_count) * 100 : 0;

        return `
            <div class="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all cursor-pointer"
                 onclick="App.openProject('${projectData.hash}')">
                <div class="flex items-center space-x-3 mb-3">
                    <div class="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                        <i class="fas fa-folder text-primary-600 dark:text-primary-400"></i>
                    </div>
                    <div class="flex-1">
                        <h3 class="font-bold text-gray-900 dark:text-gray-100">${this.escapeHtml(projectData.title)}</h3>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${Math.round(progress)}% завершено</div>
                    </div>
                </div>
                <p class="text-gray-600 dark:text-gray-400 text-sm mb-3">${this.escapeHtml(projectData.description || 'Без описания')}</p>
                <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span><i class="fas fa-users mr-1"></i> ${stats.members_count || 0}</span>
                    <span><i class="fas fa-tasks mr-1"></i> ${stats.tasks_count || 0}</span>
                </div>
            </div>
        `;
    }).join('');
}

static renderSearchTasks(tasks) {
    return tasks.map(task => `
        <div class="flex items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer"
             onclick="App.openTask(${task.id})">
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
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${this.getStatusText(task.status)}</div>
            </div>
        </div>
    `).join('');
}

static filterProjectTasks(status) {
    const taskElements = document.querySelectorAll('#projectTasksList > div');

    taskElements.forEach(element => {
        const taskStatus = element.querySelector('.custom-checkbox').classList.contains('checked') ? 'done' : 'todo';
        // Предполагаем, что если не done, то in_progress или todo
        const displayStatus = taskStatus === 'done' ? 'done' :
                            element.textContent.includes('В работе') ? 'in_progress' : 'todo';

        if (!status || displayStatus === status) {
            element.style.display = 'flex';
        } else {
            element.style.display = 'none';
        }
    });
}

static filterProjectTasksByPriority(priority) {
    const taskElements = document.querySelectorAll('#projectTasksList > div');

    taskElements.forEach(element => {
        const priorityElement = element.querySelector('.priority-indicator');
        if (priorityElement) {
            const taskPriority = priorityElement.className.split('priority-')[1];
            if (!priority || taskPriority === priority) {
                element.style.display = 'flex';
            } else {
                element.style.display = 'none';
            }
        }
    });
}

static async filterMyTasks(status) {
    try {
        const filters = status ? { status } : {};
        const response = await ApiService.getUserTasks(filters);
        const tasks = response.tasks || [];

        const container = document.getElementById('myTasksList');
        if (container) {
            container.innerHTML = this.renderMyTasksList(tasks);
        }
    } catch (error) {
        console.error('Error filtering tasks:', error);
        this.showError('Ошибка фильтрации задач: ' + error.message);
    }
}

static async showCreateSubtaskModal() {
    if (!currentTask) {
        this.showError('Выберите задачу для создания подзадачи');
        return;
    }

    try {
        const modalHtml = `
            <div id="createSubtaskModal" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
                <div class="modal premium-card rounded-2xl w-full max-w-md transform transition-transform duration-300 scale-100 opacity-100">
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                        <div class="flex items-center justify-between">
                            <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Создать подзадачу</h3>
                            <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors" onclick="App.hideModal('createSubtaskModal')">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                    </div>
                    <div class="p-6">
                        <form id="createSubtaskForm">
                            <div class="mb-5">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Родительская задача</label>
                                <input type="text" value="${this.escapeHtml(currentTask.title)}" readonly
                                       class="premium-input w-full rounded-xl focus-premium bg-gray-50 dark:bg-gray-800">
                            </div>
                            <div class="mb-5">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="subtaskTitle">Название подзадачи</label>
                                <input type="text" id="subtaskTitle" class="premium-input w-full rounded-xl focus-premium" placeholder="Введите название подзадачи" required>
                            </div>
                            <div class="mb-5">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="subtaskDescription">Описание</label>
                                <textarea id="subtaskDescription" class="premium-input w-full rounded-xl focus-premium" rows="3" placeholder="Опишите подзадачу"></textarea>
                            </div>
                            <div class="grid grid-cols-2 gap-4 mb-5">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="subtaskPriority">Приоритет</label>
                                    <select id="subtaskPriority" class="premium-input w-full rounded-xl focus-premium">
                                        <option value="low">Низкий</option>
                                        <option value="medium" selected>Средний</option>
                                        <option value="high">Высокий</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="subtaskDueDate">Срок выполнения</label>
                                    <input type="date" id="subtaskDueDate" class="premium-input w-full rounded-xl focus-premium">
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                        <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-5 py-2.5 rounded-xl font-medium"
                                onclick="App.hideModal('createSubtaskModal')">
                            Отмена
                        </button>
                        <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium"
                                onclick="App.handleCreateSubtask()">
                            Создать подзадачу
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        console.error('Error creating subtask modal:', error);
        this.showError('Ошибка создания подзадачи: ' + error.message);
    }
}

static async handleCreateSubtask() {
    if (!currentTask || !currentProject) {
        this.showError('Ошибка: задача или проект не выбраны');
        return;
    }

    const title = document.getElementById('subtaskTitle').value.trim();
    const description = document.getElementById('subtaskDescription').value.trim();
    const priority = document.getElementById('subtaskPriority').value;
    const dueDate = document.getElementById('subtaskDueDate').value;

    if (!title) {
        this.showError('Введите название подзадачи');
        return;
    }

    try {
        const taskData = {
            title,
            description,
            project_hash: currentProject.hash,
            priority,
            status: 'todo',
            parent_task_id: currentTask.id
        };

        if (dueDate) taskData.due_date = dueDate;

        await ApiService.createTask(taskData);

        this.hideModal('createSubtaskModal');

        // Перезагружаем подзадачи
        await this.loadSubtasks(currentTask.id);

        this.showSuccess('Подзадача создана успешно!');
    } catch (error) {
        console.error('Error creating subtask:', error);
        this.showError('Ошибка создания подзадачи: ' + error.message);
    }
}

static async showEditTaskModal() {
    if (!currentTask) {
        this.showError('Выберите задачу для редактирования');
        return;
    }

    try {
        // Загружаем участников проекта для выбора исполнителя
        let assigneeOptions = '<option value="">Не назначена</option>';
        if (currentProject) {
            const membersResponse = await ApiService.getProjectMembers(currentProject.hash);
            const members = membersResponse.members || [];

            members.forEach(member => {
                const memberData = member.user || member;
                const displayName = (memberData.full_name && memberData.full_name.trim() !== '')
                    ? memberData.full_name
                    : `Участник #${member.user_id || memberData.id}`;

                const selected = currentTask.assigned_to_id === (member.user_id || memberData.id) ? 'selected' : '';
                assigneeOptions += `<option value="${member.user_id || memberData.id}" ${selected}>${this.escapeHtml(displayName)}</option>`;
            });
        }

        const modalHtml = `
            <div id="editTaskModal" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
                <div class="modal premium-card rounded-2xl w-full max-w-lg transform transition-transform duration-300 scale-100 opacity-100 max-h-[90vh] overflow-y-auto">
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                        <div class="flex items-center justify-between">
                            <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Редактировать задачу</h3>
                            <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors" onclick="App.hideModal('editTaskModal')">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                    </div>
                    <div class="p-6">
                        <form id="editTaskForm">
                            <div class="mb-5">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="editTaskTitle">Название задачи</label>
                                <input type="text" id="editTaskTitle" value="${this.escapeHtml(currentTask.title)}"
                                       class="premium-input w-full rounded-xl focus-premium" required>
                            </div>
                            <div class="mb-5">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="editTaskDescription">Описание</label>
                                <textarea id="editTaskDescription" class="premium-input w-full rounded-xl focus-premium" rows="3">${this.escapeHtml(currentTask.description || '')}</textarea>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="editTaskPriority">Приоритет</label>
                                    <select id="editTaskPriority" class="premium-input w-full rounded-xl focus-premium">
                                        <option value="low" ${currentTask.priority === 'low' ? 'selected' : ''}>Низкий</option>
                                        <option value="medium" ${currentTask.priority === 'medium' ? 'selected' : ''}>Средний</option>
                                        <option value="high" ${currentTask.priority === 'high' ? 'selected' : ''}>Высокий</option>
                                        <option value="urgent" ${currentTask.priority === 'urgent' ? 'selected' : ''}>Срочный</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="editTaskDueDate">Срок выполнения</label>
                                    <input type="date" id="editTaskDueDate" value="${currentTask.due_date ? currentTask.due_date.split('T')[0] : ''}"
                                           class="premium-input w-full rounded-xl focus-premium">
                                </div>
                            </div>
                            <div class="mb-5">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="editTaskAssignedTo">Исполнитель</label>
                                <select id="editTaskAssignedTo" class="premium-input w-full rounded-xl focus-premium">
                                    ${assigneeOptions}
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                        <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-5 py-2.5 rounded-xl font-medium"
                                onclick="App.hideModal('editTaskModal')">
                            Отмена
                        </button>
                        <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium"
                                onclick="App.handleEditTask()">
                            Сохранить изменения
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        console.error('Error loading edit task modal:', error);
        this.showError('Ошибка загрузки формы редактирования: ' + error.message);
    }
}

static async handleEditTask() {
    if (!currentTask) {
        this.showError('Ошибка: задача не выбрана');
        return;
    }

    const title = document.getElementById('editTaskTitle').value.trim();
    const description = document.getElementById('editTaskDescription').value.trim();
    const priority = document.getElementById('editTaskPriority').value;
    const dueDate = document.getElementById('editTaskDueDate').value;
    const assignedTo = document.getElementById('editTaskAssignedTo').value;

    if (!title) {
        this.showError('Введите название задачи');
        return;
    }

    try {
        const taskData = {
            title,
            description,
            priority
        };

        if (dueDate) {
            taskData.due_date = dueDate;
        } else {
            taskData.due_date = null;
        }

        if (assignedTo) {
            taskData.assigned_to_id = parseInt(assignedTo);
        } else {
            taskData.assigned_to_id = null;
        }

        await ApiService.updateTask(currentTask.id, taskData);

        this.hideModal('editTaskModal');

        // Перезагружаем задачу
        await this.openTask(currentTask.id);

        this.showSuccess('Задача обновлена успешно!');
    } catch (error) {
        console.error('Error updating task:', error);
        this.showError('Ошибка обновления задачи: ' + error.message);
    }
}

static async showDeleteTaskModal() {
    if (!currentTask) {
        this.showError('Выберите задачу для удаления');
        return;
    }

    const modalHtml = `
        <div id="deleteTaskModal" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
            <div class="modal premium-card rounded-2xl w-full max-w-md transform transition-transform duration-300 scale-100 opacity-100">
                <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Удаление задачи</h3>
                        <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors" onclick="App.hideModal('deleteTaskModal')">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div class="p-6">
                    <div class="text-center">
                        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center text-danger-600 dark:text-danger-400">
                            <i class="fas fa-exclamation-triangle text-2xl"></i>
                        </div>
                        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Вы уверены?</h3>
                        <p class="text-gray-600 dark:text-gray-400">
                            Задача "<span class="font-medium">${this.escapeHtml(currentTask.title)}</span>" будет удалена безвозвратно.
                        </p>
                    </div>
                </div>
                <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                    <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-5 py-2.5 rounded-xl font-medium"
                            onclick="App.hideModal('deleteTaskModal')">
                        Отмена
                    </button>
                    <button class="btn-premium bg-danger-500 hover:bg-danger-600 text-white px-5 py-2.5 rounded-xl font-medium"
                            onclick="App.handleDeleteTask()">
                        Удалить задачу
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

static async handleDeleteTask() {
    if (!currentTask) {
        this.showError('Ошибка: задача не выбрана');
        return;
    }

    try {
        await ApiService.deleteTask(currentTask.id);

        this.hideModal('deleteTaskModal');

        // Возвращаемся к проекту или дашборду
        if (currentProject) {
            await this.openProject(currentProject.hash);
        } else {
            this.showDashboard();
        }

        this.showSuccess('Задача удалена успешно!');
    } catch (error) {
        console.error('Error deleting task:', error);
        this.showError('Ошибка удаления задачи: ' + error.message);
    }
}

static async showSettings() {
    try {
        const preferences = await ApiService.getUserPreferences();

        const modalHtml = `
            <div id="settingsModal" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
                <div class="modal premium-card rounded-2xl w-full max-w-md transform transition-transform duration-300 scale-100 opacity-100 max-h-[90vh] overflow-y-auto">
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                        <div class="flex items-center justify-between">
                            <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Настройки</h3>
                            <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors" onclick="App.hideModal('settingsModal')">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                    </div>
                    <div class="p-6">
                        <div class="space-y-6">
                            <!-- Тема -->
                            <div>
                                <h4 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Внешний вид</h4>
                                <div class="space-y-3">
                                    <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                        <div class="flex items-center">
                                            <i class="fas fa-palette text-gray-500 mr-3"></i>
                                            <span>Темная тема</span>
                                        </div>
                                        <label class="toggle-switch">
                                            <input type="checkbox" id="darkThemeToggle" ${document.documentElement.classList.contains('dark') ? 'checked' : ''}>
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <!-- Уведомления -->
                            <div>
                                <h4 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Уведомления</h4>
                                <div class="space-y-3">
                                    <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                        <div class="flex items-center">
                                            <i class="fas fa-bell text-gray-500 mr-3"></i>
                                            <span>Email уведомления</span>
                                        </div>
                                        <label class="toggle-switch">
                                            <input type="checkbox" id="emailNotifications" ${preferences.email_notifications ? 'checked' : ''}>
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                    <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                        <div class="flex items-center">
                                            <i class="fas fa-mobile-alt text-gray-500 mr-3"></i>
                                            <span>Push уведомления</span>
                                        </div>
                                        <label class="toggle-switch">
                                            <input type="checkbox" id="pushNotifications" ${preferences.push_notifications ? 'checked' : ''}>
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <!-- Настройки задач -->
                            <div>
                                <h4 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Задачи</h4>
                                <div class="space-y-3">
                                    <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                        <div class="flex items-center">
                                            <i class="fas fa-tasks text-gray-500 mr-3"></i>
                                            <span>Автоматическое обновление</span>
                                        </div>
                                        <label class="toggle-switch">
                                            <input type="checkbox" id="autoRefresh" ${preferences.auto_refresh ? 'checked' : ''}>
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Напоминание о deadline</label>
                                        <select id="deadlineReminder" class="premium-input w-full rounded-xl focus-premium">
                                            <option value="1" ${preferences.deadline_reminder === 1 ? 'selected' : ''}>За 1 день</option>
                                            <option value="3" ${preferences.deadline_reminder === 3 ? 'selected' : ''}>За 3 дня</option>
                                            <option value="7" ${preferences.deadline_reminder === 7 ? 'selected' : ''}>За неделю</option>
                                            <option value="0" ${!preferences.deadline_reminder ? 'selected' : ''}>Не напоминать</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                        <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-5 py-2.5 rounded-xl font-medium"
                                onclick="App.resetSettings()">
                            Сбросить
                        </button>
                        <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium"
                                onclick="App.handleSaveSettings()">
                            Сохранить
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Настраиваем обработчик темы
        document.getElementById('darkThemeToggle').addEventListener('change', (e) => {
            if (e.target.checked) {
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            }
        });
    } catch (error) {
        console.error('Error loading settings:', error);
        this.showError('Ошибка загрузки настроек: ' + error.message);
    }
}

static async handleSaveSettings() {
    try {
        const preferences = {
            email_notifications: document.getElementById('emailNotifications').checked,
            push_notifications: document.getElementById('pushNotifications').checked,
            auto_refresh: document.getElementById('autoRefresh').checked,
            deadline_reminder: parseInt(document.getElementById('deadlineReminder').value)
        };

        await ApiService.updateUserPreferences(preferences);

        this.hideModal('settingsModal');
        this.showSuccess('Настройки сохранены успешно!');
    } catch (error) {
        console.error('Error saving settings:', error);
        this.showError('Ошибка сохранения настроек: ' + error.message);
    }
}

static async resetSettings() {
    try {
        if (confirm('Вы уверены, что хотите сбросить все настройки к значениям по умолчанию?')) {
            await ApiService.resetUserPreferences();
            this.hideModal('settingsModal');
            this.showSuccess('Настройки сброшены к значениям по умолчанию!');
        }
    } catch (error) {
        console.error('Error resetting settings:', error);
        this.showError('Ошибка сброса настроек: ' + error.message);
    }
}

    static updateUserAvatar() {
        const photoUrl = this.getUserPhotoUrl();
        const avatar = document.getElementById('userAvatar');

        if (photoUrl && avatar) {
            avatar.innerHTML = `<img src="${photoUrl}" class="w-full h-full rounded-full object-cover" alt="Аватар">`;
        } else if (currentUser && avatar) {
            // Используем первую букву имени как fallback
            const initial = currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'U';
            avatar.innerHTML = `<span>${initial}</span>`;
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
            const dashboardData = await ApiService.getDashboard();
            const projects = dashboardData.projects || [];
            const settings = dashboardData.settings || {};
            const recentTasks = dashboardData.recent_tasks || [];

            // Сохраняем настройки
            userSettings = settings;
            this.applyUserSettings(settings);

            // Сохраняем все задачи для фильтрации
            try {
                const userTasksResponse = await ApiService.getUserTasks();
                allTasks = userTasksResponse.tasks || [];
            } catch (taskError) {
                console.error('Error loading tasks:', taskError);
                allTasks = [];
            }

            this.renderProjects(projects);
            this.updateStats(projects, recentTasks);
            this.renderRecentTasks(recentTasks);
            this.renderSidebarProjects(projects);

            // ЗАГРУЖАЕМ КОМАНДУ ДЛЯ САЙДБАРА
            await this.loadSidebarTeam(projects);

            // Загружаем уведомления с обработкой ошибок
            try {
                await this.loadNotifications();
            } catch (notifError) {
                console.error('Error loading notifications:', notifError);
            }

            console.log('Data loaded successfully');
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Ошибка загрузки данных: ' + error.message);
            throw error;
        }
    }

    // Новый метод для загрузки команды в сайдбар
    static async loadSidebarTeam(projects) {
        try {
            const allMembers = new Map();

            // Собираем участников из всех проектов
            for (const project of projects.slice(0, 5)) { // Ограничиваем 5 проектами
                const projectData = project.project || project;
                try {
                    const membersResponse = await ApiService.getProjectMembers(projectData.hash);
                    const members = membersResponse.members || [];

                    members.forEach(member => {
                        const memberData = member.user || member;
                        const memberId = member.user_id || memberData.id;

                        if (!allMembers.has(memberId)) {
                            allMembers.set(memberId, {
                                ...memberData,
                                role: member.role
                            });
                        }
                    });
                } catch (error) {
                    console.error(`Error loading team for project ${projectData.title}:`, error);
                }
            }

            this.renderSidebarTeam(Array.from(allMembers.values()));
        } catch (error) {
            console.error('Error loading sidebar team:', error);
        }
    }

    // Метод для отрисовки команды в сайдбаре
    static renderSidebarTeam(members) {
        const container = document.getElementById('sidebarTeamMembers');
        if (!container) return;

        if (!members || members.length === 0) {
            container.innerHTML = `
                <div class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                    Участников нет
                </div>
            `;
            return;
        }

        container.innerHTML = members.slice(0, 5).map(member => {
            const displayName = member.full_name || `Участник #${member.id}`;
            const role = this.getRoleText(member.role);

            return `
                <div class="flex items-center px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                    <div class="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3">
                        ${displayName.charAt(0).toUpperCase()}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium truncate">${this.escapeHtml(displayName)}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 truncate">${role}</div>
                    </div>
                </div>
            `;
        }).join('');
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
            const projectData = project.project || project;
            const stats = project.stats || projectData.stats || {};

            return `
                <div class="project-with-team premium-card p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div class="flex items-start justify-between mb-3 cursor-pointer" onclick="App.openProject('${projectData.hash}')">
                        <div class="flex items-center space-x-3 flex-1">
                            <div class="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                                <i class="fas fa-folder text-primary-600 dark:text-primary-400"></i>
                            </div>
                            <div class="flex-1">
                                <h3 class="font-bold text-gray-900 dark:text-gray-100">${this.escapeHtml(projectData.title)}</h3>
                                <div class="flex items-center mt-1 space-x-2">
                                    <span class="px-2 py-1 ${this.getProjectBadgeClass(projectData)} text-xs font-medium rounded-full">${this.getProjectBadgeText(projectData)}</span>
                                    <span class="text-xs text-gray-500 dark:text-gray-400">${Math.round(this.getProjectProgress(stats))}% завершено</span>
                                </div>
                            </div>
                        </div>
                        <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors project-menu-btn"
                                onclick="event.stopPropagation(); App.showProjectMenu('${projectData.hash}', this)">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                    </div>

                    <p class="text-gray-600 dark:text-gray-400 text-sm mb-4 cursor-pointer" onclick="App.openProject('${projectData.hash}')">${this.escapeHtml(projectData.description || 'Без описания')}</p>

                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                            <span><i class="fas fa-users mr-1"></i> ${stats.members_count || 0} участников</span>
                            <span><i class="fas fa-tasks mr-1"></i> ${stats.tasks_count || 0} задач</span>
                        </div>
                        <button class="text-sm text-primary-600 dark:text-primary-400 hover:underline team-toggle-btn"
                                onclick="event.stopPropagation(); App.toggleTeamVisibility('${projectData.hash}')">
                            <i class="fas fa-chevron-down mr-1"></i> Команда
                        </button>
                    </div>

                    <div class="team-list" id="team-${projectData.hash}">
                        <!-- Команда будет загружена здесь -->
                    </div>
                </div>
            `;
        }).join('');

        // Загружаем команды для всех проектов
        projects.forEach(project => {
            const projectData = project.project || project;
            this.loadProjectTeam(projectData.hash);
        });
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

            // ИСПРАВЛЕНИЕ: Правильное получение количества задач
            const tasksCount = stats.tasks_count || stats.tasksCount || 0;

            let colorClass = 'bg-primary-500';
            if (projectData.is_private) {
                colorClass = projectData.requires_approval ? 'bg-warning-500' : 'bg-gray-500';
            }

            return `
                <a href="#" class="flex items-center px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors group" onclick="App.openProject('${projectData.hash}')">
                    <div class="w-2 h-2 ${colorClass} rounded-full mr-3"></div>
                    <span class="truncate flex-1">${this.escapeHtml(projectData.title)}</span>
                    <span class="ml-2 text-xs bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 px-2 py-0.5 rounded-full min-w-[20px] text-center">${tasksCount}</span>
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

    static async updateStats(projects, recentTasks) {
        try {
            // Получаем все задачи пользователя для точного подсчета
            const userTasksResponse = await ApiService.getUserTasks();
            const allUserTasks = userTasksResponse.tasks || [];

            // Считаем только основные задачи (без родительских)
            const mainTasks = allUserTasks.filter(task => !task.parent_task_id);

            document.getElementById('projectsCount').textContent = projects.length;
            document.getElementById('tasksCount').textContent = mainTasks.length;
            document.getElementById('recentTasksCount').textContent = recentTasks ? recentTasks.length : 0;

            const completed = mainTasks.filter(task => task.status === 'done').length;
            document.getElementById('completedTasksCount').textContent = completed;

            // Обновляем прогресс-бары
            const totalProgress = mainTasks.length > 0 ? (completed / mainTasks.length) * 100 : 0;
            document.getElementById('projectsProgress').style.width = `${Math.min(100, (projects.length / 10) * 100)}%`;
            document.getElementById('tasksProgress').style.width = `${Math.min(100, (mainTasks.length / 50) * 100)}%`;
            document.getElementById('recentTasksProgress').style.width = `${Math.min(100, (recentTasks.length / 10) * 100)}%`;
            document.getElementById('completedTasksProgress').style.width = `${Math.min(100, totalProgress)}%`;
        } catch (error) {
            console.error('Error updating stats:', error);
        }
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

        // Обработчики для кнопок фильтрации и сортировки (исправленный вариант)
        this.setupFilterAndSortButtons();

        // Закрываем меню проекта при нажатии Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const menus = document.querySelectorAll('[id^="projectMenu-"]');
                menus.forEach(menu => menu.remove());

                const createMenu = document.getElementById('createMenu');
                if (createMenu) createMenu.remove();
            }
        });
    }

    // Новый метод для настройки кнопок фильтрации и сортировки
    static setupFilterAndSortButtons() {
        // Используем делегирование событий для динамически создаваемых кнопок
        document.addEventListener('click', (e) => {
            // Проверяем, была ли нажата кнопка фильтра
            if (e.target.closest('[data-action="filter"]') ||
                (e.target.closest('button') && e.target.closest('button').textContent.includes('Фильтр'))) {
                e.preventDefault();
                this.showFilterModal();
            }

            // Проверяем, была ли нажата кнопка сортировки
            if (e.target.closest('[data-action="sort"]') ||
                (e.target.closest('button') && e.target.closest('button').textContent.includes('Сортировка'))) {
                e.preventDefault();
                this.showSortModal();
            }
        });
    }

    static showView(viewId) {
        // Скрываем все вью
        const views = ['dashboardView', 'projectView', 'taskView', 'myTasksView', 'calendarView', 'reportsView', 'teamView', 'searchView'];
        views.forEach(view => {
            const element = document.getElementById(view);
            if (element) {
                element.classList.add('hidden');
            }
        });

        // Показываем нужную вью
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.remove('hidden');
            currentView = viewId;

            // Обновляем активное состояние в навигации
            this.updateActiveNav();

            // Добавляем отступ для нижней навигации
            targetView.classList.add('fixed-bottom-nav');
        } else {
            console.error('View not found:', viewId);
            this.showError('Элемент не найден: ' + viewId);
        }
    }

    static showFilterModal() {
        const modalHtml = `
            <div id="filterModal" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
                <div class="modal premium-card rounded-2xl w-full max-w-md transform transition-transform duration-300 scale-100 opacity-100 max-h-[90vh] overflow-y-auto">
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                        <div class="flex items-center justify-between">
                            <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Фильтрация задач</h3>
                            <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors" onclick="App.hideModal('filterModal')">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                    </div>
                    <div class="p-6">
                        <form id="filterForm" class="space-y-6">
                            <!-- Статус -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Статус</label>
                                <select id="filterStatus" class="premium-input w-full rounded-xl focus-premium">
                                    <option value="">Все статусы</option>
                                    <option value="todo">К выполнению</option>
                                    <option value="in_progress">В работе</option>
                                    <option value="done">Выполнено</option>
                                </select>
                            </div>

                            <!-- Приоритет -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Приоритет</label>
                                <select id="filterPriority" class="premium-input w-full rounded-xl focus-premium">
                                    <option value="">Все приоритеты</option>
                                    <option value="low">Низкий</option>
                                    <option value="medium">Средний</option>
                                    <option value="high">Высокий</option>
                                    <option value="urgent">Срочный</option>
                                </select>
                            </div>

                            <!-- Проект -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Проект</label>
                                <select id="filterProject" class="premium-input w-full rounded-xl focus-premium">
                                    <option value="">Все проекты</option>
                                </select>
                            </div>

                            <!-- Исполнитель -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Исполнитель</label>
                                <select id="filterAssignee" class="premium-input w-full rounded-xl focus-premium">
                                    <option value="">Все исполнители</option>
                                    <option value="me">Назначенные на меня</option>
                                    <option value="unassigned">Не назначенные</option>
                                </select>
                            </div>

                            <!-- Срок выполнения -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Срок выполнения</label>
                                <select id="filterDateRange" class="premium-input w-full rounded-xl focus-premium">
                                    <option value="">Все сроки</option>
                                    <option value="today">Сегодня</option>
                                    <option value="tomorrow">Завтра</option>
                                    <option value="week">На этой неделе</option>
                                    <option value="overdue">Просроченные</option>
                                    <option value="no_date">Без срока</option>
                                </select>
                            </div>

                            <!-- Только мои задачи -->
                            <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                <div class="flex items-center">
                                    <i class="fas fa-user text-gray-500 mr-3"></i>
                                    <span>Только мои задачи</span>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="filterMyTasks">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </form>
                    </div>
                    <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                        <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-5 py-2.5 rounded-xl font-medium"
                                onclick="App.resetFilters()">
                            Сбросить
                        </button>
                        <div class="flex space-x-3">
                            <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-5 py-2.5 rounded-xl font-medium"
                                    onclick="App.hideModal('filterModal')">
                                Отмена
                            </button>
                            <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium"
                                    onclick="App.applyFilters()">
                                Применить
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.loadFilterOptions();
        this.setCurrentFilterValues();
    }

    static showSortModal() {
        const modalHtml = `
            <div id="sortModal" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
                <div class="modal premium-card rounded-2xl w-full max-w-md transform transition-transform duration-300 scale-100 opacity-100">
                    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                        <div class="flex items-center justify-between">
                            <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Сортировка задач</h3>
                            <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors" onclick="App.hideModal('sortModal')">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                    </div>
                    <div class="p-6">
                        <form id="sortForm" class="space-y-6">
                            <!-- Поле сортировки -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Сортировать по</label>
                                <select id="sortField" class="premium-input w-full rounded-xl focus-premium">
                                    <option value="created_at">Дате создания</option>
                                    <option value="due_date">Сроку выполнения</option>
                                    <option value="title">Названию</option>
                                    <option value="priority">Приоритету</option>
                                    <option value="status">Статусу</option>
                                </select>
                            </div>

                            <!-- Направление сортировки -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Направление</label>
                                <select id="sortDirection" class="premium-input w-full rounded-xl focus-premium">
                                    <option value="desc">По убыванию</option>
                                    <option value="asc">По возрастанию</option>
                                </select>
                            </div>

                            <!-- Группировка -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Группировать по</label>
                                <select id="sortGroupBy" class="premium-input w-full rounded-xl focus-premium">
                                    <option value="none">Нет группировки</option>
                                    <option value="project">Проекту</option>
                                    <option value="status">Статусу</option>
                                    <option value="priority">Приоритету</option>
                                    <option value="assignee">Исполнителю</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                        <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-5 py-2.5 rounded-xl font-medium"
                                onclick="App.resetSorting()">
                            Сбросить
                        </button>
                        <div class="flex space-x-3">
                            <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-5 py-2.5 rounded-xl font-medium"
                                    onclick="App.hideModal('sortModal')">
                                Отмена
                            </button>
                            <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium"
                                    onclick="App.applySorting()">
                                Применить
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.setCurrentSortValues();
    }

    static async loadFilterOptions() {
        try {
            // Загружаем проекты для фильтра
            const projectsResponse = await ApiService.getProjects();
            const projects = projectsResponse.projects || [];
            allProjects = projects;

            const projectSelect = document.getElementById('filterProject');
            projectSelect.innerHTML = '<option value="">Все проекты</option>';

            projects.forEach(project => {
                const projectData = project.project || project;
                const option = document.createElement('option');
                option.value = projectData.hash;
                option.textContent = projectData.title;
                projectSelect.appendChild(option);
            });

            // Устанавливаем текущие значения фильтров
            this.setCurrentFilterValues();
        } catch (error) {
            console.error('Error loading filter options:', error);
        }
    }

    static setCurrentFilterValues() {
        document.getElementById('filterStatus').value = currentFilters.status;
        document.getElementById('filterPriority').value = currentFilters.priority;
        document.getElementById('filterProject').value = currentFilters.project;
        document.getElementById('filterAssignee').value = currentFilters.assignee;
        document.getElementById('filterDateRange').value = currentFilters.dateRange;

        const myTasksCheckbox = document.getElementById('filterMyTasks');
        if (myTasksCheckbox) {
            myTasksCheckbox.checked = currentFilters.assignee === 'me';
        }
    }

    static setCurrentSortValues() {
        document.getElementById('sortField').value = currentSort.field;
        document.getElementById('sortDirection').value = currentSort.direction;

        const groupBySelect = document.getElementById('sortGroupBy');
        if (groupBySelect) {
            groupBySelect.value = currentSort.groupBy || 'none';
        }
    }

    static async applyFilters() {
        // Сохраняем фильтры
        currentFilters = {
            status: document.getElementById('filterStatus').value,
            priority: document.getElementById('filterPriority').value,
            project: document.getElementById('filterProject').value,
            assignee: document.getElementById('filterAssignee').value,
            dateRange: document.getElementById('filterDateRange').value
        };

        // Если выбрано "только мои задачи", устанавливаем соответствующий фильтр
        const myTasksCheckbox = document.getElementById('filterMyTasks');
        if (myTasksCheckbox && myTasksCheckbox.checked) {
            currentFilters.assignee = 'me';
        }

        this.hideModal('filterModal');

        // Применяем фильтры в зависимости от текущего view
        await this.applyCurrentFilters();

        this.showSuccess('Фильтры применены');
    }

    static async applySorting() {
        // Сохраняем настройки сортировки
        currentSort = {
            field: document.getElementById('sortField').value,
            direction: document.getElementById('sortDirection').value,
            groupBy: document.getElementById('sortGroupBy').value
        };

        this.hideModal('sortModal');

        // Применяем сортировку
        await this.applyCurrentSorting();

        this.showSuccess('Сортировка применена');
    }

    static resetFilters() {
        currentFilters = {
            status: '',
            priority: '',
            project: '',
            assignee: '',
            dateRange: ''
        };

        this.setCurrentFilterValues();
        this.applyFilters();
    }

    static resetSorting() {
        currentSort = {
            field: 'created_at',
            direction: 'desc',
            groupBy: 'none'
        };

        this.setCurrentSortValues();
        this.applySorting();
    }

    static async applyCurrentFilters() {
        try {
            // Получаем задачи в зависимости от текущего view
            let tasks = [];

            if (currentView === 'myTasksView' || currentView === 'dashboardView') {
                const response = await ApiService.getUserTasks();
                tasks = response.tasks || [];
            } else if (currentView === 'projectView' && currentProject) {
                const response = await ApiService.getTasks(currentProject.hash);
                tasks = response.tasks || [];
            } else if (currentView === 'calendarView') {
                const response = await ApiService.getUserTasks();
                tasks = response.tasks || [];
            }

            // Применяем фильтры
            const filteredTasks = this.filterTasks(tasks);

            // Обновляем отображение
            this.updateTasksDisplay(filteredTasks);

        } catch (error) {
            console.error('Error applying filters:', error);
            this.showError('Ошибка применения фильтров: ' + error.message);
        }
    }

    static filterTasks(tasks) {
        return tasks.filter(task => {
            // Фильтр по статусу
            if (currentFilters.status && task.status !== currentFilters.status) {
                return false;
            }

            // Фильтр по приоритету
            if (currentFilters.priority && task.priority !== currentFilters.priority) {
                return false;
            }

            // Фильтр по проекту
            if (currentFilters.project && task.project_hash !== currentFilters.project) {
                return false;
            }

            // Фильтр по исполнителю
            if (currentFilters.assignee === 'me' && (!task.assigned_to_id || task.assigned_to_id !== currentUser?.id)) {
                return false;
            }
            if (currentFilters.assignee === 'unassigned' && task.assigned_to_id) {
                return false;
            }

            // Фильтр по сроку выполнения
            if (currentFilters.dateRange) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const weekEnd = new Date(today);
                weekEnd.setDate(weekEnd.getDate() + 7);

                if (task.due_date) {
                    const dueDate = new Date(task.due_date);
                    dueDate.setHours(0, 0, 0, 0);

                    switch (currentFilters.dateRange) {
                        case 'today':
                            if (dueDate.getTime() !== today.getTime()) return false;
                            break;
                        case 'tomorrow':
                            if (dueDate.getTime() !== tomorrow.getTime()) return false;
                            break;
                        case 'week':
                            if (dueDate < today || dueDate > weekEnd) return false;
                            break;
                        case 'overdue':
                            if (dueDate >= today) return false;
                            break;
                        case 'no_date':
                            if (task.due_date) return false;
                            break;
                    }
                } else if (currentFilters.dateRange !== 'no_date') {
                    return false;
                }
            }

            return true;
        });
    }

    static async applyCurrentSorting() {
        try {
            // Получаем текущие задачи
            let tasks = [];

            if (currentView === 'myTasksView' || currentView === 'dashboardView') {
                const response = await ApiService.getUserTasks();
                tasks = response.tasks || [];
            } else if (currentView === 'projectView' && currentProject) {
                const response = await ApiService.getTasks(currentProject.hash);
                tasks = response.tasks || [];
            }

            // Применяем фильтры перед сортировкой
            const filteredTasks = this.filterTasks(tasks);

            // Сортируем задачи
            const sortedTasks = this.sortTasks(filteredTasks);

            // Обновляем отображение
            this.updateTasksDisplay(sortedTasks);

        } catch (error) {
            console.error('Error applying sorting:', error);
            this.showError('Ошибка применения сортировки: ' + error.message);
        }
    }

    static sortTasks(tasks) {
        return tasks.sort((a, b) => {
            let aValue, bValue;

            switch (currentSort.field) {
                case 'title':
                    aValue = a.title.toLowerCase();
                    bValue = b.title.toLowerCase();
                    break;
                case 'due_date':
                    aValue = a.due_date ? new Date(a.due_date) : new Date(0);
                    bValue = b.due_date ? new Date(b.due_date) : new Date(0);
                    break;
                case 'priority':
                    const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
                    aValue = priorityOrder[a.priority] || 0;
                    bValue = priorityOrder[b.priority] || 0;
                    break;
                case 'status':
                    const statusOrder = { 'todo': 1, 'in_progress': 2, 'done': 3 };
                    aValue = statusOrder[a.status] || 0;
                    bValue = statusOrder[b.status] || 0;
                    break;
                case 'created_at':
                default:
                    aValue = new Date(a.created_at);
                    bValue = new Date(b.created_at);
                    break;
            }

            if (currentSort.direction === 'asc') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
        });
    }

    static updateTasksDisplay(tasks) {
        // Обновляем отображение в зависимости от текущего view
        switch (currentView) {
            case 'myTasksView':
                this.updateMyTasksView(tasks);
                break;
            case 'dashboardView':
                this.updateDashboardTasks(tasks);
                break;
            case 'projectView':
                this.updateProjectTasks(tasks);
                break;
            case 'calendarView':
                this.updateCalendarView(tasks);
                break;
        }
    }

    static updateMyTasksView(tasks) {
        const container = document.getElementById('myTasksList');
        if (container) {
            container.innerHTML = this.renderMyTasksList(tasks);
        }
    }

    static updateDashboardTasks(tasks) {
        const container = document.getElementById('recentTasksList');
        if (container) {
            container.innerHTML = this.renderRecentTasks(tasks.slice(0, 5)); // Показываем только 5 последних
        }
    }

    static updateProjectTasks(tasks) {
        const container = document.getElementById('projectTasksList');
        if (container) {
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
        }
    }

    static updateCalendarView(tasks) {
        // Группируем задачи по датам для календаря
        const tasksByDate = {};
        tasks.forEach(task => {
            const dateKey = task.due_date ? task.due_date.split('T')[0] : 'без срока';
            if (!tasksByDate[dateKey]) {
                tasksByDate[dateKey] = [];
            }
            tasksByDate[dateKey].push(task);
        });

        const calendarView = document.getElementById('calendarView');
        if (calendarView) {
            const calendarContent = calendarView.querySelector('.premium-card .p-6');
            if (calendarContent) {
                calendarContent.innerHTML = this.renderCalendarTasks(tasksByDate);
            }
        }
    }

    // Обновляем активную навигацию
    static updateActiveNav() {
        // Обновляем нижнюю навигацию
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active', 'text-primary-600', 'dark:text-primary-400');
            item.classList.add('text-gray-500', 'dark:text-gray-400');
        });

        const activeNavItem = document.querySelector(`.nav-item[data-view="${currentView}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active', 'text-primary-600', 'dark:text-primary-400');
            activeNavItem.classList.remove('text-gray-500', 'dark:text-gray-400');
        }

        // Обновляем роль пользователя в зависимости от контекста
        this.updateUserRole();
    }

    static updateUserRole() {
        const roleElement = document.getElementById('userRole');
        if (!roleElement) return;

        if (currentProject && currentProject.members) {
            // Находим текущего пользователя в участниках проекта
            const userMember = currentProject.members.find(member =>
                (member.user && member.user.id === currentUser?.id) ||
                member.user_id === currentUser?.id
            );

            if (userMember) {
                roleElement.textContent = this.getRoleText(userMember.role);
                return;
            }
        }

        // Роль по умолчанию
        roleElement.textContent = 'Владелец';
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

      // Проверяем права пользователя
      const userMember = project.members?.find(member =>
          (member.user && member.user.id === currentUser?.id) ||
          member.user_id === currentUser?.id
      );
      const canManage = userMember?.role === 'owner' || userMember?.role === 'admin';

        // Формируем HTML для представления проекта
        projectView.innerHTML = `
        <div class="mb-8">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <div class="flex-1">
                    <h1 class="text-2xl md:text-3xl font-black text-gray-900 dark:text-gray-100 mb-2">${this.escapeHtml(project.title)}</h1>
                    <div class="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <span><i class="fas fa-users mr-1"></i> ${summary.members_count || 0} участников</span>
                        <span><i class="fas fa-tasks mr-1"></i> ${summary.tasks_count || 0} задач</span>
                        <span><i class="fas fa-check-circle mr-1"></i> ${summary.tasks_done || 0} выполнено</span>
                        <span><i class="fas fa-sync-alt mr-1"></i> ${summary.tasks_in_progress || 0} в работе</span>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 mt-4 md:mt-0">
                    <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2" onclick="App.showCreateTaskModal()">
                        <i class="fas fa-plus"></i>
                        <span class="hidden sm:inline">Новая задача</span>
                    </button>

                    ${canManage ? `
                        <button class="btn-premium bg-warning-500 hover:bg-warning-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2" onclick="App.showEditProjectModal('${project.hash}')">
                            <i class="fas fa-edit"></i>
                            <span class="hidden sm:inline">Редактировать</span>
                        </button>
                        <button class="btn-premium bg-purple-500 hover:bg-purple-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2" onclick="App.showProjectManagement('${project.hash}')">
                            <i class="fas fa-users-cog"></i>
                            <span class="hidden sm:inline">Управление</span>
                        </button>
                    ` : ''}

                    <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2" onclick="App.showDashboard()">
                        <i class="fas fa-arrow-left"></i>
                        <span class="hidden sm:inline">Назад</span>
                    </button>
                </div>
            </div>
            <p class="text-gray-600 dark:text-gray-400 text-sm md:text-base">${this.escapeHtml(project.description || 'Без описания')}</p>
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

            const today = new Date().toISOString().split('T')[0];
            document.getElementById('taskDueDate').value = today;

            this.showModal('createTaskModal');
        } catch (error) {
            console.error('Error loading create task modal:', error);
            this.showError('Ошибка загрузки формы: ' + error.message);
        }
    }

    static async loadProjectManagement(projectHash) {
        try {
            const [membersResponse, joinRequestsResponse] = await Promise.all([
                ApiService.getProjectMembers(projectHash),
                ApiService.getProjectJoinRequests(projectHash)
            ]);

            const members = membersResponse.members || [];
            const joinRequests = joinRequestsResponse.requests || [];

            // Сохраняем данные для использования в UI
            currentProject.members = members;
            currentProject.joinRequests = joinRequests;

            this.renderProjectManagementUI(members, joinRequests);
        } catch (error) {
            console.error('Error loading project management data:', error);
        }
    }

    static renderProjectManagementUI(members, joinRequests) {
        // Добавляем кнопки управления в проектное view
        const projectHeader = document.querySelector('#projectView .mb-8');
        if (projectHeader) {
            const managementHtml = `
                <div class="flex space-x-2 mt-4">
                    <button class="btn-premium bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium"
                            onclick="App.showProjectMembersModal()">
                        <i class="fas fa-users mr-2"></i>Участники
                    </button>
                    <button class="btn-premium bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-medium"
                            onclick="App.showJoinRequestsModal()">
                        <i class="fas fa-user-clock mr-2"></i>Заявки (${joinRequests.length})
                    </button>
                    <button class="btn-premium bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-medium"
                            onclick="App.showDeleteProjectModal()">
                        <i class="fas fa-trash mr-2"></i>Удалить
                    </button>
                </div>
            `;
            projectHeader.insertAdjacentHTML('beforeend', managementHtml);
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

    // Обновляем showMyTasks для отображения активных фильтров
    static async showMyTasks() {
        try {
            const response = await ApiService.getUserTasks();
            const tasks = response.tasks || [];
            const filteredTasks = this.filterTasks(tasks);
            const sortedTasks = this.sortTasks(filteredTasks);

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
                            <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2 ${this.hasActiveFilters() ? 'filter-indicator' : ''}"
                                    onclick="App.showFilterModal()">
                                <i class="fas fa-filter"></i>
                                <span>Фильтр</span>
                            </button>
                            <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2"
                                    onclick="App.showSortModal()">
                                <i class="fas fa-sort"></i>
                                <span>Сортировка</span>
                            </button>
                            <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center space-x-2"
                                    onclick="App.showCreateTaskModal()">
                                <i class="fas fa-plus"></i>
                                <span>Новая задача</span>
                            </button>
                        </div>
                    </div>

                    <!-- Активные фильтры -->
                    ${this.renderActiveFilters()}
                </div>
                <div class="premium-card rounded-2xl overflow-hidden">
                    <div class="p-6">
                        <div class="task-list space-y-4" id="myTasksList">
                            ${this.renderMyTasksList(sortedTasks)}
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

    // Вспомогательные методы для фильтров
    static hasActiveFilters() {
        return Object.values(currentFilters).some(value => value !== '');
    }

    static renderActiveFilters() {
        if (!this.hasActiveFilters()) return '';

        const activeFilters = [];

        if (currentFilters.status) {
            activeFilters.push({
                label: `Статус: ${this.getStatusText(currentFilters.status)}`,
                key: 'status'
            });
        }

        if (currentFilters.priority) {
            activeFilters.push({
                label: `Приоритет: ${this.getPriorityText(currentFilters.priority)}`,
                key: 'priority'
            });
        }

        if (currentFilters.project) {
            const project = allProjects.find(p => {
                const projectData = p.project || p;
                return projectData.hash === currentFilters.project;
            });
            if (project) {
                const projectData = project.project || project;
                activeFilters.push({
                    label: `Проект: ${projectData.title}`,
                    key: 'project'
                });
            }
        }

        if (currentFilters.assignee) {
            let label = '';
            switch (currentFilters.assignee) {
                case 'me':
                    label = 'Мои задачи';
                    break;
                case 'unassigned':
                    label = 'Не назначенные';
                    break;
            }
            if (label) {
                activeFilters.push({
                    label: label,
                    key: 'assignee'
                });
            }
        }

        if (currentFilters.dateRange) {
            let label = '';
            switch (currentFilters.dateRange) {
                case 'today':
                    label = 'Сегодня';
                    break;
                case 'tomorrow':
                    label = 'Завтра';
                    break;
                case 'week':
                    label = 'На этой неделе';
                    break;
                case 'overdue':
                    label = 'Просроченные';
                    break;
                case 'no_date':
                    label = 'Без срока';
                    break;
            }
            if (label) {
                activeFilters.push({
                    label: label,
                    key: 'dateRange'
                });
            }
        }

        if (activeFilters.length === 0) return '';

        return `
            <div class="active-filters mt-4">
                ${activeFilters.map(filter => `
                    <div class="filter-tag">
                        <span>${filter.label}</span>
                        <button onclick="App.removeFilter('${filter.key}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
                <button class="text-sm text-primary-600 dark:text-primary-400 hover:underline" onclick="App.resetFilters()">
                    Очистить все
                </button>
            </div>
        `;
    }

    static removeFilter(key) {
        currentFilters[key] = '';
        this.applyCurrentFilters();
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

    // Вспомогательные методы для проектов
    static getProjectBadgeClass(projectData) {
        if (projectData.is_private) {
            return projectData.requires_approval ?
                'bg-warning-100 dark:bg-warning-900 text-warning-800 dark:text-warning-200' :
                'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
        }
        return 'bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200';
    }

    static getProjectBadgeText(projectData) {
        if (projectData.is_private) {
            return projectData.requires_approval ? 'Одобрение' : 'Приватный';
        }
        return 'Публичный';
    }

    static getProjectProgress(stats) {
        const tasksCount = stats.tasks_count || stats.tasksCount || 0;
        const doneTasks = stats.tasks_done || stats.done_tasks || stats.doneTasks || 0;
        return tasksCount > 0 ? (doneTasks / tasksCount) * 100 : 0;
    }

    static async loadProjectTeam(projectHash) {
        try {
            const response = await ApiService.getProjectMembers(projectHash);
            const members = response.members || [];
            const container = document.getElementById(`team-${projectHash}`);

            if (!container) return;

            if (members.length === 0) {
                container.innerHTML = '<div class="text-center py-2 text-sm text-gray-500 dark:text-gray-400">Участников нет</div>';
                return;
            }

            container.innerHTML = members.map(member => {
                const memberData = member.user || member;
                const displayName = (memberData.full_name && memberData.full_name.trim() !== '')
                    ? memberData.full_name
                    : `Участник #${member.user_id || memberData.id}`;

                return `
                    <div class="team-member flex items-center space-x-2 py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                        <div class="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                            ${displayName.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1">
                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${this.escapeHtml(displayName)}</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">${this.getRoleText(member.role)}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error(`Error loading team for project ${projectHash}:`, error);
            const container = document.getElementById(`team-${projectHash}`);
            if (container) {
                container.innerHTML = '<div class="text-center py-2 text-sm text-red-500">Ошибка загрузки команды</div>';
            }
        }
    }

    static async showProjectMenu(projectHash, element) {
        try {
            const projectResponse = await ApiService.getProject(projectHash);
            const project = projectResponse.project || projectResponse;
            const isOwner = project.role === 'owner' || project.current_user_role === 'owner';

            // Создаем меню
            const menuHtml = `
                <div id="projectMenu-${projectHash}" class="absolute right-0 mt-2 w-48 glass-intense rounded-xl shadow-large border border-white/20 dark:border-gray-700/50 py-2 z-50">
                    <a href="#" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors" onclick="App.openProject('${projectHash}')">
                        <i class="fas fa-eye mr-3 text-gray-500"></i>
                        <span>Открыть</span>
                    </a>
                    ${isOwner ? `
                        <a href="#" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors" onclick="App.showEditProjectModal('${projectHash}')">
                            <i class="fas fa-edit mr-3 text-gray-500"></i>
                            <span>Редактировать</span>
                        </a>
                        <a href="#" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors" onclick="App.showInviteMemberModal('${projectHash}')">
                            <i class="fas fa-user-plus mr-3 text-gray-500"></i>
                            <span>Пригласить</span>
                        </a>
                        <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                        <a href="#" class="flex items-center px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" onclick="App.showDeleteProjectModal('${projectHash}')">
                            <i class="fas fa-trash mr-3"></i>
                            <span>Удалить</span>
                        </a>
                    ` : ''}
                </div>
            `;

            // Удаляем существующее меню
            const existingMenu = document.getElementById(`projectMenu-${projectHash}`);
            if (existingMenu) {
                existingMenu.remove();
            }

            // Добавляем меню в DOM
            element.parentElement.style.position = 'relative';
            element.parentElement.insertAdjacentHTML('beforeend', menuHtml);

            // Закрываем меню при клике вне его
            const closeMenu = (e) => {
                if (!e.target.closest(`#projectMenu-${projectHash}`) && !e.target.closest('.project-menu-btn')) {
                    const menu = document.getElementById(`projectMenu-${projectHash}`);
                    if (menu) menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', closeMenu);
            }, 100);

        } catch (error) {
            console.error('Error showing project menu:', error);
            this.showError('Ошибка загрузки меню проекта: ' + error.message);
        }
    }

    static toggleTeamVisibility(projectHash) {
        const teamList = document.getElementById(`team-${projectHash}`);
        const toggleBtn = document.querySelector(`[onclick="App.toggleTeamVisibility('${projectHash}')"]`);

        if (!teamList || !toggleBtn) return;

        if (teamList.classList.contains('expanded')) {
            teamList.classList.remove('expanded');
            toggleBtn.innerHTML = '<i class="fas fa-chevron-down mr-1"></i> Команда';
        } else {
            teamList.classList.add('expanded');
            toggleBtn.innerHTML = '<i class="fas fa-chevron-up mr-1"></i> Команда';
        }
    }

    // Модальное окно редактирования проекта
    static async showEditProjectModal(projectHash) {
        try {
            const projectResponse = await ApiService.getProject(projectHash);
            const project = projectResponse.project || projectResponse;

            const modalHtml = `
                <div id="editProjectModal" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
                    <div class="modal premium-card rounded-2xl w-full max-w-md transform transition-transform duration-300 scale-100 opacity-100">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <div class="flex items-center justify-between">
                                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Редактировать проект</h3>
                                <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors" onclick="App.hideModal('editProjectModal')">
                                    <i class="fas fa-times text-xl"></i>
                                </button>
                            </div>
                        </div>
                        <div class="p-6">
                            <form id="editProjectForm">
                                <div class="mb-5">
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="editProjectTitle">Название проекта</label>
                                    <input type="text" id="editProjectTitle" value="${this.escapeHtml(project.title)}"
                                           class="premium-input w-full rounded-xl focus-premium" required>
                                </div>
                                <div class="mb-5">
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2" for="editProjectDescription">Описание</label>
                                    <textarea id="editProjectDescription" class="premium-input w-full rounded-xl focus-premium" rows="3">${this.escapeHtml(project.description || '')}</textarea>
                                </div>
                                <div class="mb-5">
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Настройки проекта</label>
                                    <div class="space-y-3">
                                        <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                            <div class="flex items-center">
                                                <i class="fas fa-lock text-gray-500 mr-3"></i>
                                                <span>Приватный проект</span>
                                            </div>
                                            <label class="toggle-switch">
                                                <input type="checkbox" id="editProjectIsPrivate" ${project.is_private ? 'checked' : ''}>
                                                <span class="toggle-slider"></span>
                                            </label>
                                        </div>
                                        <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                            <div class="flex items-center">
                                                <i class="fas fa-user-check text-gray-500 mr-3"></i>
                                                <span>Требуется одобрение</span>
                                            </div>
                                            <label class="toggle-switch">
                                                <input type="checkbox" id="editProjectRequiresApproval" ${project.requires_approval ? 'checked' : ''}>
                                                <span class="toggle-slider"></span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                            <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-5 py-2.5 rounded-xl font-medium"
                                    onclick="App.hideModal('editProjectModal')">
                                Отмена
                            </button>
                            <button class="btn-premium bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-xl font-medium"
                                    onclick="App.handleEditProject('${projectHash}')">
                                Сохранить изменения
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        } catch (error) {
            console.error('Error loading edit project modal:', error);
            this.showError('Ошибка загрузки формы редактирования: ' + error.message);
        }
    }

    static async handleEditProject(projectHash) {
        const title = document.getElementById('editProjectTitle').value.trim();
        const description = document.getElementById('editProjectDescription').value.trim();
        const isPrivate = document.getElementById('editProjectIsPrivate').checked;
        const requiresApproval = document.getElementById('editProjectRequiresApproval').checked;

        if (!title) {
            this.showError('Введите название проекта');
            return;
        }

        try {
            await ApiService.updateProject(projectHash, {
                title,
                description,
                is_private: isPrivate,
                requires_approval: requiresApproval
            });

            this.hideModal('editProjectModal');

            // Перезагружаем данные
            await this.loadData();

            this.showSuccess('Проект обновлен успешно!');
        } catch (error) {
            console.error('Error updating project:', error);
            this.showError('Ошибка обновления проекта: ' + error.message);
        }
    }

    // Модальное окно удаления проекта
    static async showDeleteProjectModal(projectHash) {
        try {
            const projectResponse = await ApiService.getProject(projectHash);
            const project = projectResponse.project || projectResponse;

            const modalHtml = `
                <div id="deleteProjectModal" class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
                    <div class="modal premium-card rounded-2xl w-full max-w-md transform transition-transform duration-300 scale-100 opacity-100">
                        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                            <div class="flex items-center justify-between">
                                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">Удаление проекта</h3>
                                <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors" onclick="App.hideModal('deleteProjectModal')">
                                    <i class="fas fa-times text-xl"></i>
                                </button>
                            </div>
                        </div>
                        <div class="p-6">
                            <div class="text-center">
                                <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center text-danger-600 dark:text-danger-400">
                                    <i class="fas fa-exclamation-triangle text-2xl"></i>
                                </div>
                                <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Вы уверены?</h3>
                                <p class="text-gray-600 dark:text-gray-400 mb-4">
                                    Проект "<span class="font-medium">${this.escapeHtml(project.title)}</span>" будет удален безвозвратно.
                                </p>
                                <p class="text-sm text-gray-500 dark:text-gray-400">
                                    Все задачи и данные проекта будут потеряны.
                                </p>
                            </div>
                        </div>
                        <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                            <button class="btn-premium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-5 py-2.5 rounded-xl font-medium"
                                    onclick="App.hideModal('deleteProjectModal')">
                                Отмена
                            </button>
                            <button class="btn-premium bg-danger-500 hover:bg-danger-600 text-white px-5 py-2.5 rounded-xl font-medium"
                                    onclick="App.handleDeleteProject('${projectHash}')">
                                Удалить проект
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
        } catch (error) {
            console.error('Error loading delete project modal:', error);
            this.showError('Ошибка загрузки формы удаления: ' + error.message);
        }
    }

    static async handleDeleteProject(projectHash) {
        try {
            await ApiService.deleteProject(projectHash);

            this.hideModal('deleteProjectModal');

            // Возвращаемся к дашборду
            this.showDashboard();

            this.showSuccess('Проект удален успешно!');
        } catch (error) {
            console.error('Error deleting project:', error);
            this.showError('Ошибка удаления проекта: ' + error.message);
        }
    }

    // Функция для показа модального окна создания (общая)
    static showCreateModal() {
        // Показываем меню создания
        const menuHtml = `
            <div id="createMenu" class="fixed bottom-20 right-4 glass-intense rounded-xl shadow-large border border-white/20 dark:border-gray-700/50 py-2 z-50">
                <a href="#" class="flex items-center px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors" onclick="App.showCreateProjectModal()">
                    <i class="fas fa-folder-plus text-primary-500 mr-3"></i>
                    <span>Новый проект</span>
                </a>
                <a href="#" class="flex items-center px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors" onclick="App.showCreateTaskModal()">
                    <i class="fas fa-tasks text-primary-500 mr-3"></i>
                    <span>Новая задача</span>
                </a>
                <a href="#" class="flex items-center px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors" onclick="App.showInviteMemberModal()">
                    <i class="fas fa-user-plus text-primary-500 mr-3"></i>
                    <span>Пригласить участника</span>
                </a>
            </div>
        `;

        // Удаляем существующее меню
        const existingMenu = document.getElementById('createMenu');
        if (existingMenu) {
            existingMenu.remove();
            return;
        }

        document.body.insertAdjacentHTML('beforeend', menuHtml);

        // Закрываем меню при клике вне его
        const closeMenu = (e) => {
            if (!e.target.closest('#createMenu') && !e.target.closest('.fixed.bottom-0 .flex button:nth-child(3)')) {
                const menu = document.getElementById('createMenu');
                if (menu) menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    }

}

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
