// Конфигурация приложения
const CONFIG = {
    API_BASE_URL: 'https://powerfully-exotic-chamois.cloudpub.ru/api',
    APP_NAME: 'Project Pilot',
    VERSION: '1.0.0',
    ENV: 'development', // или 'production'

    // Настройки кэширования
    CACHE_TTL: {
        PROJECTS: 5 * 60 * 1000, // 5 минут
        TASKS: 2 * 60 * 1000,    // 2 минуты
        USER_DATA: 30 * 60 * 1000, // 30 минут
        NOTIFICATIONS: 1 * 60 * 1000 // 1 минута
    },

    // Настройки UI
    UI: {
        THEME: {
            LIGHT: 'light',
            DARK: 'dark'
        },
        ANIMATION_DURATION: 300
    },

    // Настройки API
    API: {
        TIMEOUT: 10000, // 10 секунд
        RETRY_ATTEMPTS: 3
    }
};

// Экспорт конфигурации
window.CONFIG = CONFIG;
