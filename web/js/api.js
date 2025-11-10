// Конфигурация API
const CONFIG = {
    API_BASE_URL: 'https://powerfully-exotic-chamois.cloudpub.ru/api'
};

class ApiService {
  static async apiCall(endpoint, method = 'GET', data = null, params = null) {
      const token = localStorage.getItem('access_token');
      let url = `${CONFIG.API_BASE_URL}${endpoint}`;

      // Обработка query параметров для GET запросов
      if (params && method === 'GET') {
          const queryParams = new URLSearchParams();
          for (const key in params) {
              if (params[key] !== null && params[key] !== undefined) {
                  queryParams.append(key, params[key]);
              }
          }
          if (queryParams.toString()) {
              url += `?${queryParams.toString()}`;
          }
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
      };

      // Добавляем body для POST/PUT запросов
      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          config.body = JSON.stringify(data);
      }

      Utils.log(`API call: ${method} ${url}`, { hasToken: !!token, data, params });

      try {
          const response = await fetch(url, config);

          // Обработка ошибки сети
          if (!response.ok && response.status === 0) {
              throw new Error('Network error - cannot reach server');
          }

          // Обработка ошибки аутентификации
          if (response.status === 401) {
              localStorage.removeItem('access_token');
              ToastManager.showToast('Сессия истекла. Пожалуйста, обновите страницу.', 'warning');
              throw new Error('Authentication required');
          }

          // Обработка ошибок валидации
          if (response.status === 422) {
              const errorData = await response.json();
              Utils.logError('Validation error:', errorData);
              // Показываем детальную информацию об ошибке валидации
              const errorMessage = errorData.detail ?
                  (Array.isArray(errorData.detail) ?
                   errorData.detail.map(err => err.msg || err.loc?.join('.')).join(', ') :
                   errorData.detail) :
                  'Invalid data';
              throw new Error(`Validation error: ${errorMessage}`);
          }

          // Обработка других ошибок
          if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.detail || errorData.message || 'Unknown error'}`);
          }

          // Для DELETE запросов или 204 No Content
          if (response.status === 204 || method === 'DELETE') {
              return { status: 'success' };
          }

          const responseData = await response.json();
          return responseData;
      } catch (error) {
          Utils.logError(`API Error: ${method} ${url}`, error);

          // Специальная обработка сетевых ошибок
          if (error.message.includes('Failed to fetch') ||
              error.message.includes('ERR_NAME_NOT_RESOLVED') ||
              error.message.includes('Network error') ||
              error.name === 'TypeError') {
              throw new Error('Проблемы с подключением к серверу. Проверьте интернет-соединение и попробуйте снова.');
          }

          throw error;
      }
  }
    // 🔐 Аутентификация
    static async apiGetAuthToken(maxId, fullName, username = '') {
        return await this.apiCall('/auth/token', 'POST', {
            max_id: maxId,
            full_name: fullName,
            username: username
        });
    }

    // 👤 Пользователи
    static async apiGetCurrentUser() {
        return await this.apiCall('/users/me', 'GET');
    }

    static async apiUpdateCurrentUser(fullName, username) {
        return await this.apiCall('/users/me', 'PUT', {
            full_name: fullName,
            username: username
        });
    }

    static async apiGetUserById(userId) {
        return await this.apiCall(`/users/${userId}`, 'GET');
    }

    // ИСПРАВЛЕНО: Правильный endpoint для проектов пользователя
    static async apiGetUserProjects() {
        return await this.apiCall('/users/me/projects', 'GET');
    }

    // 🏢 Проекты
    static async apiCreateProject(projectData) {
        return await this.apiCall('/projects/', 'POST', projectData);
    }

    static async apiGetProjectByHash(projectHash) {
        return await this.apiCall(`/projects/${projectHash}`, 'GET');
    }

    static async apiGetProjectSummary(projectHash) {
        return await this.apiCall(`/projects/${projectHash}/summary`, 'GET');
    }

    static async apiJoinProject(projectHash) {
        return await this.apiCall(`/projects/${projectHash}/join`, 'POST');
    }

    static async apiGetProjectJoinRequests(projectHash) {
        return await this.apiCall(`/projects/${projectHash}/join-requests`, 'GET');
    }

    static async apiApproveJoinRequest(projectHash, requestId) {
        return await this.apiCall(`/projects/${projectHash}/join-requests/${requestId}/approve`, 'POST');
    }

    static async apiRejectJoinRequest(projectHash, requestId) {
        return await this.apiCall(`/projects/${projectHash}/join-requests/${requestId}/reject`, 'POST');
    }

    static async apiRegenerateProjectInvite(projectHash) {
        return await this.apiCall(`/projects/${projectHash}/regenerate-invite`, 'POST');
    }

    static async apiUpdateProject(projectHash, updateData) {
        return await this.apiCall(`/projects/${projectHash}`, 'PUT', updateData);
    }

    static async apiDeleteProject(projectHash) {
        return await this.apiCall(`/projects/${projectHash}`, 'DELETE');
    }

    static async apiGetAllTasks(status = null, projectHash = null) {
        const params = {};
        if (status) params.status = status;
        if (projectHash) params.project_hash = projectHash;

        return await this.apiCall('/tasks/', 'GET', null, params);
    }

    static async apiGetTaskById(taskId) {
        const numericId = parseInt(taskId);
        if (isNaN(numericId)) {
            throw new Error(`Invalid task ID: ${taskId}`);
        }
        return await this.apiCall(`/tasks/${numericId}`, 'GET');
    }

    static async apiGetProjectTasks(projectHash) {
        return await this.apiCall('/tasks/', 'GET', null, { project_hash: projectHash });
    }

    static async apiCreateTask(taskData) {
        return await this.apiCall('/tasks/', 'POST', taskData);
    }

    static async apiUpdateTaskStatus(taskId, status) {
        const numericId = parseInt(taskId);
        if (isNaN(numericId)) {
            throw new Error(`Invalid task ID: ${taskId}`);
        }
        // ИСПРАВЛЕНО: Правильная структура данных
        return await this.apiCall(`/tasks/${numericId}/status`, 'PUT', { status: status });
    }

    static async apiGetTaskDependencies(taskId) {
        const numericId = parseInt(taskId);
        if (isNaN(numericId)) {
            throw new Error(`Invalid task ID: ${taskId}`);
        }
        return await this.apiCall(`/tasks/${numericId}/dependencies`, 'GET');
    }

    static async apiAddTaskDependency(taskId, dependsOnId) {
        const numericTaskId = parseInt(taskId);
        const numericDependsOnId = parseInt(dependsOnId);

        if (isNaN(numericTaskId) || isNaN(numericDependsOnId)) {
            throw new Error(`Invalid task IDs: ${taskId}, ${dependsOnId}`);
        }
        // ИСПРАВЛЕНО: Правильная структура данных
        return await this.apiCall(`/tasks/${numericTaskId}/dependencies`, 'POST', {
            depends_on_id: numericDependsOnId
        });
    }
    
    static async apiGetTaskComments(taskId) {
        const numericId = parseInt(taskId);
        if (isNaN(numericId)) {
            throw new Error(`Invalid task ID: ${taskId}`);
        }
        return await this.apiCall(`/tasks/${numericId}/comments`, 'GET');
    }

    static async apiAddTaskComment(taskId, content) {
        const numericId = parseInt(taskId);
        if (isNaN(numericId)) {
            throw new Error(`Invalid task ID: ${taskId}`);
        }
        // ИСПРАВЛЕНО: Правильная структура данных
        return await this.apiCall(`/tasks/${numericId}/comments`, 'POST', { content: content });
    }

    static async apiDeleteTask(taskId) {
        const numericId = parseInt(taskId);
        if (isNaN(numericId)) {
            throw new Error(`Invalid task ID: ${taskId}`);
        }
        return await this.apiCall(`/tasks/${numericId}`, 'DELETE');
    }

    // 🔔 Уведомления
    static async apiGetNotifications() {
        return await this.apiCall('/notifications/', 'GET');
    }

    static async apiMarkAllNotificationsRead() {
        return await this.apiCall('/notifications/mark_all_read', 'PUT');
    }

    // 🩺 Health Checks
    static async apiCheckAppHealth() {
        return await this.apiCall('/health', 'GET');
    }

    static async apiCheckApiHealth() {
        return await this.apiCall('/api/health', 'GET');
    }
}

// Глобальные экспорты
window.ApiService = ApiService;
window.CONFIG = CONFIG;
