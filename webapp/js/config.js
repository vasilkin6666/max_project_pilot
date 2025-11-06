// webapp/js/config.js
class AppConfig {
    constructor() {
        this.botBaseUrl = null;
        this.miniappUrl = null;
        this.loadConfig();
    }

    async loadConfig() {
        try {
            // Пытаемся загрузить конфиг с бота
            const response = await fetch('/api/direct/config', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            }).catch(() => null);

            if (response && response.ok) {
                const config = await response.json();
                this.botBaseUrl = config.bot_public_url;
                this.miniappUrl = config.miniapp_url;
            } else {
                // Fallback: используем значения по умолчанию
                this.botBaseUrl = 'https://your-bot-domain.com'; // Замените на ваш домен
                this.miniappUrl = 'https://vasilkin6666.github.io/max_project_pilot/webapp/';
            }

            console.log('AppConfig loaded:', this);
        } catch (error) {
            console.warn('Failed to load config from bot, using defaults:', error);
            this.botBaseUrl = 'https://your-bot-domain.com';
            this.miniappUrl = 'https://vasilkin6666.github.io/max_project_pilot/webapp/';
        }
    }

    getBotBaseUrl() {
        return this.botBaseUrl;
    }

    getMiniappUrl() {
        return this.miniappUrl;
    }

    // Статический метод для быстрого доступа
    static async create() {
        const config = new AppConfig();
        await config.loadConfig();
        return config;
    }
}

// Глобальный экземпляр конфига
window.AppConfig = AppConfig;
