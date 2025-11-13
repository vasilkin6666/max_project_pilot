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
    USER_UPDATE: 'user:update',
    USER_LOGGED_IN: 'user:logged_in',
    USER_LOGGED_OUT: 'user:logged_out',

    PROJECTS_LOADED: 'projects:loaded',       // ← ОБЯЗАТЕЛЬНО
    PROJECTS_UPDATED: 'projects:updated',
    PROJECT_CREATED: 'project:created',
    PROJECT_DELETED: 'project:deleted',

    TASKS_LOADED: 'tasks:loaded',
    TASK_CREATED: 'task:created',

    NOTIFICATIONS_LOADED: 'notifications:loaded',

    THEME_CHANGED: 'theme:changed',
    NETWORK_STATUS_CHANGED: 'network:status',
    DATA_LOADED: 'data:loaded',
    STATE_UPDATED: 'state:updated',

    MODAL_OPENED: 'modal:opened',
    MODAL_CLOSED: 'modal:closed',
};

// Экспорт
window.EventManager = EventManager;
window.APP_EVENTS = APP_EVENTS;
