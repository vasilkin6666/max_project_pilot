// API клиент для взаимодействия с ботом
class ProjectPilotAPI {
    constructor(baseURL = 'http://localhost:8000') {
        this.baseURL = baseURL;
        this.userData = null;
    }

    // Инициализация пользователя
    async initUser() {
        try {
            const initData = WebApp.initDataUnsafe;
            this.userData = initData.user;

            // Валидация данных (опционально)
            const isValid = await this.validateUserData(initData);
            if (!isValid) {
                console.warn('User data validation failed');
            }

            return this.userData;
        } catch (error) {
            console.error('Error initializing user:', error);
            throw error;
        }
    }

    // Получить проекты пользователя
    async getUserProjects() {
        if (!this.userData) {
            await this.initUser();
        }

        try {
            const response = await fetch(
                `${this.baseURL}/api/miniapp/user/${this.userData.id}/projects`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching projects:', error);
            throw error;
        }
    }

    // Создать проект
    async createProject(projectData) {
        if (!this.userData) {
            await this.initUser();
        }

        try {
            const response = await fetch(
                `${this.baseURL}/api/miniapp/user/${this.userData.id}/projects`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(projectData)
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Тактильный отклик при успехе
            WebApp.HapticFeedback.notificationOccurred('success');

            return data;
        } catch (error) {
            console.error('Error creating project:', error);
            WebApp.HapticFeedback.notificationOccurred('error');
            throw error;
        }
    }

    // Получить задачи проекта
    async getProjectTasks(projectHash) {
        try {
            const response = await fetch(
                `${this.baseURL}/api/miniapp/projects/${projectHash}/tasks`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching tasks:', error);
            throw error;
        }
    }

    // Создать задачу
    async createTask(taskData) {
        try {
            const response = await fetch(
                `${this.baseURL}/api/miniapp/tasks`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(taskData)
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            WebApp.HapticFeedback.notificationOccurred('success');
            return data;
        } catch (error) {
            console.error('Error creating task:', error);
            WebApp.HapticFeedback.notificationOccurred('error');
            throw error;
        }
    }

    // Завершить задачу
    async completeTask(taskId) {
        try {
            const response = await fetch(
                `${this.baseURL}/api/miniapp/tasks/${taskId}/complete`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({})
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            WebApp.HapticFeedback.notificationOccurred('success');
            return data;
        } catch (error) {
            console.error('Error completing task:', error);
            WebApp.HapticFeedback.notificationOccurred('error');
            throw error;
        }
    }

    // Пригласить пользователя в проект
    async inviteToProject(projectHash, userMaxId) {
        try {
            const response = await fetch(
                `${this.baseURL}/api/miniapp/projects/${projectHash}/invite/${userMaxId}`,
                {
                    method: 'POST'
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            WebApp.HapticFeedback.notificationOccurred('success');
            return data;
        } catch (error) {
            console.error('Error inviting user:', error);
            WebApp.HapticFeedback.notificationOccurred('error');
            throw error;
        }
    }

    // Валидация данных пользователя (опционально)
    async validateUserData(initData) {
        // Здесь можно добавить валидацию данных из MAX
        // См. документацию по валидации данных
        return true; // Пропускаем для демо
    }
}

// Создаем глобальный экземпляр API
window.ProjectPilotAPI = new ProjectPilotAPI();
