// web/js/api.js - Полная интеграция со всеми API endpoints

// Базовый API вызов
async function apiCall(endpoint, method = 'GET', data = null, params = null) {
    const token = localStorage.getItem('access_token');

    let url = `${CONFIG.API_BASE_URL}${endpoint}`;

    // Для POST/PUT с query параметрами (согласно документации API)
    if (params && (method === 'POST' || method === 'PUT')) {
        const queryParams = new URLSearchParams();
        for (const key in params) {
            if (params[key] !== null && params[key] !== undefined) {
                if (Array.isArray(params[key])) {
                    params[key].forEach(value => queryParams.append(key, value));
                } else {
                    queryParams.append(key, params[key]);
                }
            }
        }
        url += `?${queryParams.toString()}`;
    }
    // Для GET с query параметрами
    else if (params && method === 'GET') {
        const queryParams = new URLSearchParams();
        for (const key in params) {
            if (params[key] !== null && params[key] !== undefined) {
                queryParams.append(key, params[key]);
            }
        }
        url += `?${queryParams.toString()}`;
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

    // Для POST/PUT с данными в body (если не query params)
    if (data && method !== 'GET' && !params) {
        config.body = JSON.stringify(data);
    }

    console.log(`API call: ${method} ${url}`, { hasToken: !!token, data, params });

    try {
        const response = await fetch(url, config);

        if (response.status === 401) {
            localStorage.removeItem('access_token');
            showToast('Сессия истекла. Пожалуйста, обновите страницу.', 'warning');
            throw new Error('Authentication required');
        }

        if (response.status === 422) {
            const errorData = await response.json();
            console.error('Validation error:', errorData);
            throw new Error(`Validation error: ${errorData.detail?.[0]?.msg || 'Invalid data'}`);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.detail || errorData.message || 'Unknown error'}`);
        }

        if (response.status === 204 || method === 'DELETE') {
            return { status: 'success' };
        }

        const responseData = await response.json();
        return responseData;
    } catch (error) {
        console.error(`API Error: ${method} ${url}`, error);
        throw error;
    }
}

// 🔐 Аутентификация
async function apiGetAuthToken(maxId, fullName, username = '') {
    return await apiCall('/auth/token', 'POST', {
        max_id: maxId,
        full_name: fullName,
        username: username
    });
}

// 👤 Пользователи
async function apiGetCurrentUser() {
    return await apiCall('/users/me', 'GET');
}

async function apiGetUserById(userId) {
    return await apiCall(`/users/${userId}`, 'GET');
}

async function apiGetUserProjects(userId) {
    return await apiCall(`/users/${userId}/projects`, 'GET');
}

// 🏢 Проекты
async function apiCreateProject(title, description = '', isPrivate = true, requiresApproval = false) {
    const params = {
        title: title,
        description: description,
        is_private: isPrivate,
        requires_approval: requiresApproval
    };
    return await apiCall('/projects/', 'POST', null, params);
}

async function apiGetProjectByHash(projectHash) {
    return await apiCall(`/projects/${projectHash}`, 'GET');
}

async function apiJoinProject(projectHash) {
    return await apiCall(`/projects/${projectHash}/join`, 'POST');
}

async function apiGetProjectJoinRequests(projectHash) {
    return await apiCall(`/projects/${projectHash}/join-requests`, 'GET');
}

async function apiApproveJoinRequest(projectHash, requestId) {
    return await apiCall(`/projects/${projectHash}/join-requests/${requestId}/approve`, 'POST');
}

async function apiRejectJoinRequest(projectHash, requestId) {
    return await apiCall(`/projects/${projectHash}/join-requests/${requestId}/reject`, 'POST');
}

async function apiRegenerateProjectInvite(projectHash) {
    return await apiCall(`/projects/${projectHash}/regenerate-invite`, 'POST');
}

async function apiGetProjectSummary(projectHash) {
    return await apiCall(`/projects/${projectHash}/summary`, 'GET');
}

// ✅ Задачи
async function apiGetAllTasks(status = null, projectHash = null) {
    const params = {};
    if (status) params.status = status;
    if (projectHash) params.project_hash = projectHash;

    return await apiCall('/tasks/', 'GET', null, params);
}

async function apiGetProjectTasks(projectHash) {
    return await apiCall(`/tasks/project/${projectHash}`, 'GET');
}

async function apiCreateTask(taskData) {
    // Согласно документации - все параметры через query
    return await apiCall('/tasks/', 'POST', null, taskData);
}

async function apiUpdateTaskStatus(taskId, status) {
    return await apiCall(`/tasks/${taskId}/status`, 'PUT', null, { status });
}

async function apiGetTaskDependencies(taskId) {
    return await apiCall(`/tasks/${taskId}/dependencies`, 'GET');
}

async function apiAddTaskDependency(taskId, dependsOnId) {
    return await apiCall(`/tasks/${taskId}/dependencies`, 'POST', null, { depends_on_id: dependsOnId });
}

async function apiGetTaskComments(taskId) {
    return await apiCall(`/tasks/${taskId}/comments`, 'GET');
}

async function apiAddTaskComment(taskId, content) {
    return await apiCall(`/tasks/${taskId}/comments`, 'POST', null, { content });
}

async function apiDeleteTask(taskId) {
    return await apiCall(`/tasks/${taskId}`, 'DELETE');
}

// 🔔 Уведомления
async function apiGetNotifications() {
    return await apiCall('/notifications/', 'GET');
}

async function apiMarkAllNotificationsRead() {
    return await apiCall('/notifications/mark_all_read', 'PUT');
}

// 🩺 Health Checks
async function apiCheckAppHealth() {
    return await apiCall('/health', 'GET');
}

async function apiCheckApiHealth() {
    return await apiCall('/api/health', 'GET');
}

// 🏢 Проекты - Управление запросами на присоединение
async function apiGetProjectJoinRequests(projectHash) {
    return await apiCall(`/projects/${projectHash}/join-requests`, 'GET');
}

async function apiApproveJoinRequest(projectHash, requestId) {
    return await apiCall(`/projects/${projectHash}/join-requests/${requestId}/approve`, 'POST');
}

async function apiRejectJoinRequest(projectHash, requestId) {
    return await apiCall(`/projects/${projectHash}/join-requests/${requestId}/reject`, 'POST');
}

// ✅ Задачи - Зависимости
async function apiGetTaskDependencies(taskId) {
    return await apiCall(`/tasks/${taskId}/dependencies`, 'GET');
}

async function apiAddTaskDependency(taskId, dependsOnId) {
    return await apiCall(`/tasks/${taskId}/dependencies`, 'POST', null, { depends_on_id: dependsOnId });
}

// ✅ Задачи - Комментарии
async function apiGetTaskComments(taskId) {
    return await apiCall(`/tasks/${taskId}/comments`, 'GET');
}

async function apiAddTaskComment(taskId, content) {
    return await apiCall(`/tasks/${taskId}/comments`, 'POST', null, { content });
}
