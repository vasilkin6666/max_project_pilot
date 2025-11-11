// Система событий
class EventManager {
    static events = new Map();

    // Подписка на событие
    static on(eventName, callback) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, new Set());
        }
        this.events.get(eventName).add(callback);

        // Возвращаем функцию отписки
        return () => {
            this.off(eventName, callback);
        };
    }

    // Отписка от события
    static off(eventName, callback) {
        if (this.events.has(eventName)) {
            this.events.get(eventName).delete(callback);
        }
    }

    // Триггер события
    static emit(eventName, data = null) {
        if (this.events.has(eventName)) {
            this.events.get(eventName).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for ${eventName}:`, error);
                }
            });
        }
    }

    // Одноразовая подписка
    static once(eventName, callback) {
        const onceCallback = (data) => {
            callback(data);
            this.off(eventName, onceCallback);
        };
        this.on(eventName, onceCallback);
    }

    // Очистка всех подписок
    static clear(eventName = null) {
        if (eventName) {
            this.events.delete(eventName);
        } else {
            this.events.clear();
        }
    }
}

// Глобальные события приложения
const APP_EVENTS = {
    // Аутентификация
    USER_LOGIN: 'user:login',
    USER_LOGOUT: 'user:logout',
    USER_UPDATE: 'user:update',

    // Проекты
    PROJECTS_LOADED: 'projects:loaded',
    PROJECT_CREATED: 'project:created',
    PROJECT_UPDATED: 'project:updated',
    PROJECT_DELETED: 'project:deleted',

    // Задачи
    TASKS_LOADED: 'tasks:loaded',
    TASK_CREATED: 'task:created',
    TASK_UPDATED: 'task:updated',
    TASK_DELETED: 'task:deleted',

    // Уведомления
    NOTIFICATIONS_LOADED: 'notifications:loaded',
    NOTIFICATION_READ: 'notification:read',

    // UI события
    THEME_CHANGED: 'ui:theme-changed',
    VIEW_CHANGED: 'ui:view-changed',
    MODAL_OPENED: 'ui:modal-opened',
    MODAL_CLOSED: 'ui:modal-closed',

    // Данные
    DATA_LOADING: 'data:loading',
    DATA_LOADED: 'data:loaded',
    DATA_ERROR: 'data:error',

    // Синхронизация
    SYNC_STARTED: 'sync:started',
    SYNC_COMPLETED: 'sync:completed',
    SYNC_FAILED: 'sync:failed'
};

// Экспорт
window.EventManager = EventManager;
window.APP_EVENTS = APP_EVENTS;
