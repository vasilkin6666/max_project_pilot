// webapp/js/bot-client.js
class BotDirectClient {
    constructor(appConfig) {
        this.appConfig = appConfig;
        this.botBaseUrl = appConfig.getBotBaseUrl();
        this.userId = null;
        this.userData = null;
    }

    // Инициализация с данными из MAX Web App
    async init() {
        try {
            const initData = WebApp.initDataUnsafe;
            this.userId = initData.user.id.toString();
            this.userData = initData.user;

            console.log('BotDirectClient initialized for user:', this.userId);
            console.log('Bot URL:', this.botBaseUrl);

            // Проверяем есть ли инвайт в URL
            await this.handleInviteFromUrl();

            return true;
        } catch (error) {
            console.error('Failed to initialize BotDirectClient:', error);
            return false;
        }
    }

    // Обработка инвайт-ссылки из URL
    async handleInviteFromUrl() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const inviteHash = urlParams.get('invite');

            if (inviteHash) {
                console.log('Processing invite:', inviteHash);
                const result = await this.callBot('invite_user', {
                    project_hash: inviteHash,
                    target_user_id: this.userId
                });

                if (result) {
                    if (WebApp.HapticFeedback) {
                        WebApp.HapticFeedback.notificationOccurred('success');
                    }
                    alert(`Вы присоединились к проекту!`);

                    // Убираем параметр из URL
                    window.history.replaceState({}, '', window.location.pathname);
                }
            }
        } catch (error) {
            console.error('Error handling invite:', error);
            if (WebApp.HapticFeedback) {
                WebApp.HapticFeedback.notificationOccurred('error');
            }
        }
    }

    // Прямой запрос к боту
    async callBot(action, data = null) {
        if (!this.userId) {
            throw new Error('Client not initialized. Call init() first.');
        }

        try {
            const response = await fetch(`${this.botBaseUrl}/api/direct/user/${this.userId}/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action,
                    data: data,
                    timestamp: Date.now()
                })
            });

            if (!response.ok) {
                throw new Error(`Bot responded with status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Unknown bot error');
            }

            return result.data;
        } catch (error) {
            console.error('Error calling bot:', error);
            throw error;
        }
    }

    // Получить проекты пользователя
    async getUserProjects() {
        return await this.callBot('get_projects');
    }

    // Создать проект
    async createProject(title, description = '', isPrivate = true) {
        return await this.callBot('create_project', {
            title: title,
            description: description,
            is_private: isPrivate
        });
    }

    // Получить задачи проекта
    async getProjectTasks(projectHash) {
        return await this.callBot('get_project_tasks', {
            project_hash: projectHash
        });
    }

    // Создать задачу
    async createTask(projectHash, title, description = '', priority = 'medium') {
        return await this.callBot('create_task', {
            project_hash: projectHash,
            title: title,
            description: description,
            priority: priority
        });
    }

    // Пригласить пользователя
    async inviteUser(projectHash, targetUserId) {
        return await this.callBot('invite_user', {
            project_hash: projectHash,
            target_user_id: targetUserId
        });
    }

    // Генерация инвайт-ссылки
    async generateInviteLink(projectHash) {
        return await this.callBot('generate_invite', {
            project_hash: projectHash
        });
    }

    // Проверка связи с ботом
    async ping() {
        try {
            const response = await fetch(`${this.botBaseUrl}/api/direct/user/${this.userId}/ping`);
            const result = await response.json();
            return result.success;
        } catch (error) {
            return false;
        }
    }
}

// Глобальный экземпляр
window.BotDirectClient = BotDirectClient;
