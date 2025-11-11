// Менеджер состояния приложения
class StateManager {
    static state = {
        user: null,
        projects: [],
        tasks: [],
        notifications: [],
        dashboard: {
            stats: {},
            recentProjects: [],
            priorityTasks: []
        },
        ui: {
            currentView: 'dashboard-view',
            theme: 'light',
            loading: false,
            modals: {
                active: null,
                data: null
            },
            search: {
                query: '',
                results: [],
                active: false
            }
        }
    };

    static subscribers = new Map();
    static history = [];
    static maxHistorySize = 50;

    static init() {
        // Загружаем состояние из localStorage
        this.loadState();

        // Настраиваем отслеживание изменений
        this.setupPersistence();

        Utils.log('State manager initialized');
    }

    static subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        this.subscribers.get(key).add(callback);

        // Возвращаем функцию отписки
        return () => {
            this.unsubscribe(key, callback);
        };
    }

    static unsubscribe(key, callback) {
        if (this.subscribers.has(key)) {
            this.subscribers.get(key).delete(callback);
        }
    }

    static setState(key, value) {
        const oldState = this.deepClone(this.state);

        // Сохраняем в историю
        this.saveToHistory(oldState);

        // Устанавливаем новое состояние
        if (key.includes('.')) {
            this.setNestedState(key, value);
        } else {
            this.state[key] = value;
        }

        this.notifySubscribers(key);
        this.saveState();

        Utils.log(`State updated: ${key}`, value);
    }

    static setNestedState(path, value) {
        const keys = path.split('.');
        let current = this.state;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = value;
    }

    static updateState(key, updater) {
        const currentValue = this.getState(key);
        let newValue;

        if (typeof updater === 'function') {
            newValue = updater(currentValue);
        } else {
            newValue = { ...currentValue, ...updater };
        }

        this.setState(key, newValue);
    }

    static getState(key = null) {
        if (!key) {
            return this.deepClone(this.state);
        }

        if (key.includes('.')) {
            return this.getNestedState(key);
        }

        return this.deepClone(this.state[key]);
    }

    static getNestedState(path) {
        const keys = path.split('.');
        let current = this.state;

        for (const key of keys) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[key];
        }

        return this.deepClone(current);
    }

    static notifySubscribers(key) {
        const callbacks = this.subscribers.get(key);
        if (callbacks) {
            const value = this.getState(key);
            callbacks.forEach(callback => {
                try {
                    callback(value);
                } catch (error) {
                    Utils.logError(`Error in state subscriber for ${key}:`, error);
                }
            });
        }
    }

    static saveToHistory(state) {
        this.history.push({
            state: this.deepClone(state),
            timestamp: Date.now()
        });

        // Ограничиваем размер истории
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    static undo() {
        if (this.history.length === 0) return false;

        const previous = this.history.pop();
        this.state = previous.state;
        this.notifyAllSubscribers();
        this.saveState();

        Utils.log('State reverted to previous version');
        return true;
    }

    static notifyAllSubscribers() {
        for (const [key] of this.subscribers) {
            this.notifySubscribers(key);
        }
    }

    static setupPersistence() {
        // Автосохранение при изменении состояния
        this.subscribe('user', () => this.saveState());
        this.subscribe('projects', () => this.saveState());
        this.subscribe('tasks', () => this.saveState());
        this.subscribe('ui.theme', () => this.saveState());
    }

    static saveState() {
        try {
            const stateToSave = {
                user: this.state.user,
                ui: {
                    theme: this.state.ui.theme
                }
                // Сохраняем только необходимые данные
            };

            localStorage.setItem('app_state', JSON.stringify(stateToSave));
        } catch (error) {
            Utils.logError('Failed to save state:', error);
        }
    }

    static loadState() {
        try {
            const saved = localStorage.getItem('app_state');
            if (saved) {
                const parsed = JSON.parse(saved);

                // Восстанавливаем состояние
                if (parsed.user) this.state.user = parsed.user;
                if (parsed.ui?.theme) this.state.ui.theme = parsed.ui.theme;

                Utils.log('State loaded from localStorage');
            }
        } catch (error) {
            Utils.logError('Failed to load state:', error);
        }
    }

    static clearState() {
        this.state = {
            user: null,
            projects: [],
            tasks: [],
            notifications: [],
            dashboard: {
                stats: {},
                recentProjects: [],
                priorityTasks: []
            },
            ui: {
                currentView: 'dashboard-view',
                theme: 'light',
                loading: false,
                modals: {
                    active: null,
                    data: null
                },
                search: {
                    query: '',
                    results: [],
                    active: false
                }
            }
        };

        this.history = [];
        localStorage.removeItem('app_state');
        this.notifyAllSubscribers();

        Utils.log('State cleared');
    }

    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));

        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        return cloned;
    }

    // Вспомогательные методы для работы с конкретными состояниями
    static setLoading(loading) {
        this.updateState('ui', ui => ({ ...ui, loading }));
    }

    static setCurrentView(view) {
        this.updateState('ui', ui => ({ ...ui, currentView: view }));
    }

    static setTheme(theme) {
        this.updateState('ui', ui => ({ ...ui, theme }));
    }

    static addProject(project) {
        this.updateState('projects', projects => [...projects, project]);
    }

    static updateProject(projectHash, updates) {
        this.updateState('projects', projects =>
            projects.map(p =>
                (p.project?.hash === projectHash || p.hash === projectHash)
                    ? { ...p, ...updates }
                    : p
            )
        );
    }

    static removeProject(projectHash) {
        this.updateState('projects', projects =>
            projects.filter(p =>
                !(p.project?.hash === projectHash || p.hash === projectHash)
            )
        );
    }

    static addTask(task) {
        this.updateState('tasks', tasks => [...tasks, task]);
    }

    static updateTask(taskId, updates) {
        this.updateState('tasks', tasks =>
            tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
        );
    }

    static removeTask(taskId) {
        this.updateState('tasks', tasks => tasks.filter(t => t.id !== taskId));
    }

    // Получение производных данных
    static getProjectByHash(hash) {
        return this.state.projects.find(p =>
            p.project?.hash === hash || p.hash === hash
        );
    }

    static getTasksByProject(projectHash) {
        return this.state.tasks.filter(t => t.project_hash === projectHash);
    }

    static getUnreadNotificationsCount() {
        return this.state.notifications.filter(n => !n.is_read).length;
    }

    static getActiveProjectsCount() {
        return this.state.projects.filter(project => {
            const stats = project.project?.stats || project.stats || {};
            const progress = stats.tasks_count > 0 ?
                Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;
            return progress < 100;
        }).length;
    }
}

window.StateManager = StateManager;
