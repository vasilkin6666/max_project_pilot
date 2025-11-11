// Менеджер тактильной обратной связи
class HapticManager {
    static isSupported = 'vibrate' in navigator;
    static isMaxEnvironment = Utils.isMaxEnvironment();

    static init() {
        Utils.log('Haptic manager initialized', {
            supported: this.isSupported,
            maxEnvironment: this.isMaxEnvironment
        });
    }

    static success() {
        this.provideFeedback('success');
    }

    static error() {
        this.provideFeedback('error');
    }

    static warning() {
        this.provideFeedback('warning');
    }

    static light() {
        this.provideFeedback('light');
    }

    static medium() {
        this.provideFeedback('medium');
    }

    static heavy() {
        this.provideFeedback('heavy');
    }

    static selection() {
        this.provideFeedback('selection');
    }

    static provideFeedback(type) {
        if (!this.isSupported) return;

        try {
            if (this.isMaxEnvironment) {
                this.getMaxCompatibleFeedback(type);
            } else {
                this.getStandardFeedback(type);
            }
        } catch (error) {
            Utils.logError('Haptic feedback error:', error);
        }
    }

    static getMaxCompatibleFeedback(type) {
        // Оптимизированные паттерны для MAX WebApp
        const patterns = {
            'success': [50],
            'error': [100, 50, 100],
            'warning': [75],
            'light': [25],
            'medium': [50],
            'heavy': [100],
            'selection': [10]
        };

        const pattern = patterns[type];
        if (pattern) {
            navigator.vibrate(pattern);
        }
    }

    static getStandardFeedback(type) {
        // Расширенные паттерны для standalone приложений
        const patterns = {
            'success': [100, 50, 100],
            'error': [200, 100, 200, 100, 200],
            'warning': [150, 75, 150],
            'light': [50],
            'medium': [100],
            'heavy': [200],
            'selection': [20]
        };

        const pattern = patterns[type];
        if (pattern) {
            navigator.vibrate(pattern);
        }
    }

    // Специфичные методы для различных взаимодействий
    static projectCreated() {
        this.success();
    }

    static projectDeleted() {
        this.error();
    }

    static taskCompleted() {
        this.success();
    }

    static taskOverdue() {
        this.warning();
    }

    static notificationReceived() {
        this.medium();
    }

    static swipeAction() {
        this.light();
    }

    static buttonPress() {
        this.selection();
    }

    static toggleSwitch() {
        this.light();
    }

    // Методы для настройки интенсивности
    static setIntensity(level) {
        // level: 'low', 'medium', 'high'
        const intensities = {
            'low': 0.5,
            'medium': 1.0,
            'high': 1.5
        };

        this.intensityMultiplier = intensities[level] || 1.0;
    }

    static enable() {
        this.enabled = true;
    }

    static disable() {
        this.enabled = false;
    }

    static isEnabled() {
        return this.enabled !== false && this.isSupported;
    }
}

// Инициализация по умолчанию
HapticManager.enabled = true;
HapticManager.intensityMultiplier = 1.0;

window.HapticManager = HapticManager;
