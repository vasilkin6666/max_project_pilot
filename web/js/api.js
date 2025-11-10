const API_BASE_URL = 'https://powerfully-exotic-chamois.cloudpub.ru/api';

async function apiCall(endpoint, method = 'GET', data = null, token = null) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
    };

    const authToken = token || localStorage.getItem('access_token');
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const config = {
        method,
        headers,
    };

    if (data && method !== 'GET') {
        config.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, config);

        if (response.status === 401) {
            localStorage.removeItem('access_token');
            throw new Error('Authentication required');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData)}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

async function getProjects(userId, token) {
    return await apiCall(`/users/${userId}/projects`, 'GET', null, token);
}

async function getTasks(userId, token, status = null) {
    const endpoint = status ? `/tasks/?status=${status}` : '/tasks/';
    return await apiCall(endpoint, 'GET', null, token);
}

async function getNotifications(userId, token) {
    return await apiCall('/notifications/', 'GET', null, token);
}

async function createProject(title, description, token) {
    return await apiCall(
        `/projects/?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&is_private=true&requires_approval=false`,
        'POST',
        null,
        token
    );
}

async function getAuthToken(userId, fullName, username = '') {
    const url = `${API_BASE_URL}/auth/token`;
    const data = {
        max_id: userId,
        full_name: fullName,
        username: username
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result && result.access_token) {
            localStorage.setItem('access_token', result.access_token);
            return result.access_token;
        } else {
            throw new Error('No access token in response');
        }
    } catch (error) {
        console.error('Error getting auth token:', error);
        throw error;
    }
}
