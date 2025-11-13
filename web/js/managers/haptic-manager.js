// Менеджер тактильной обратной связи
class HapticManager {
    static isSupported = 'vibrate' in navigator;
    static isMaxEnvironment = Utils.isMaxEnvironment();
    static hasUserInteracted = false;

    static init() {
        // Разрешаем вибрацию только после первого взаимодействия
        const enableOnInteraction = () => {
            this.hasUserInteracted = true;
            document.removeEventListener('click', enableOnInteraction);
            document.removeEventListener('touchstart', enableOnInteraction);
        };
        document.addEventListener('click', enableOnInteraction, { once: true });
        document.addEventListener('touchstart', enableOnInteraction, { once: true });

        Utils.log('Haptic manager initialized', {
            supported: this.isSupported,
            maxEnvironment: this.isMaxEnvironment
        });
        this.initHapticIntegration();
    }

    static success() { this.provideFeedback('success'); }
    static error() { this.provideFeedback('error'); }
    static warning() { this.provideFeedback('warning'); }
    static light() { this.provideFeedback('light'); }
    static medium() { this.provideFeedback('medium'); }
    static heavy() { this.provideFeedback('heavy'); }
    static selection() { this.provideFeedback('selection'); }

    static longPress() {
        this.provideFeedback('medium');
    }

    static initHapticIntegration() {
        // Интеграция с событиями проектов
        EventManager.on(APP_EVENTS.PROJECT_CREATED, () => this.projectCreated());
        EventManager.on(APP_EVENTS.PROJECT_UPDATED, () => this.success());
        EventManager.on(APP_EVENTS.PROJECT_DELETED, () => this.projectDeleted());

        // Интеграция с событиями задач
        EventManager.on(APP_EVENTS.TASK_CREATED, () => this.taskCompleted());
        EventManager.on(APP_EVENTS.TASK_UPDATED, (task) => {
            if (task.status === 'done') this.taskCompleted();
            if (Utils.isOverdue(task.due_date)) this.taskOverdue();
        });
        EventManager.on(APP_EVENTS.TASK_DELETED, () => this.error());

        // Интеграция с уведомлениями
        EventManager.on(APP_EVENTS.NOTIFICATIONS_LOADED, (notifications) => {
            const unreadCount = notifications.filter(n => !n.is_read).length;
            if (unreadCount > 0) this.notificationReceived();
        });

        // Интеграция с сетью
        EventManager.on(APP_EVENTS.NETWORK_STATUS_CHANGED, (status) => {
            if (status === 'online') this.success();
            else this.warning();
        });
    }

    static provideFeedback(type) {
        if (!this.isSupported || !this.hasUserInteracted) return;

        try {
            const pattern = this.isMaxEnvironment
                ? this.getMaxPattern(type)
                : this.getStandardPattern(type);
            if (pattern) navigator.vibrate(pattern);
        } catch (error) {
            Utils.logError('Haptic feedback error:', error);
        }
    }

    static getMaxPattern(type) {
        const patterns = {
            success: [50], error: [100, 50, 100], warning: [75],
            light: [25], medium: [50], heavy: [100], selection: [10]
        };
        return patterns[type];
    }

    static getStandardPattern(type) {
        const patterns = {
            success: [100, 50, 100], error: [200, 100, 200, 100, 200],
            warning: [150, 75, 150], light: [50], medium: [100],
            heavy: [200], selection: [20]
        };
        return patterns[type];
    }

    static projectCreated() { this.success(); }
    static projectDeleted() { this.heavy(); }
    static taskCompleted() { this.success(); }
    static taskOverdue() { this.warning(); }
    static notificationReceived() { this.medium(); }
    static swipeAction() { this.light(); }
    static buttonPress() { this.selection(); }
    static toggleSwitch() { this.light(); }

    static setIntensity(level) {
        const intensities = {
            low: 0.3,
            medium: 0.6,
            high: 1.0,
            off: 0
        };
        this.intensityMultiplier = intensities[level] || 1.0;
        this.enabled = level !== 'off';
    }

    static enable() { this.enabled = true; }
    static disable() { this.enabled = false; }
    static isEnabled() { return this.enabled !== false && this.isSupported && this.hasUserInteracted; }
}

HapticManager.enabled = true;
HapticManager.intensityMultiplier = 1.0;

window.HapticManager = HapticManager;
