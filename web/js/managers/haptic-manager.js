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
    }

    static success() { this.provideFeedback('success'); }
    static error() { this.provideFeedback('error'); }
    static warning() { this.provideFeedback('warning'); }
    static light() { this.provideFeedback('light'); }
    static medium() { this.provideFeedback('medium'); }
    static heavy() { this.provideFeedback('heavy'); }
    static selection() { this.provideFeedback('selection'); }

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
    static projectDeleted() { this.error(); }
    static taskCompleted() { this.success(); }
    static taskOverdue() { this.warning(); }
    static notificationReceived() { this.medium(); }
    static swipeAction() { this.light(); }
    static buttonPress() { this.selection(); }
    static toggleSwitch() { this.light(); }

    static setIntensity(level) {
        const intensities = { low: 0.5, medium: 1.0, high: 1.5 };
        this.intensityMultiplier = intensities[level] || 1.0;
    }

    static enable() { this.enabled = true; }
    static disable() { this.enabled = false; }
    static isEnabled() { return this.enabled !== false && this.isSupported && this.hasUserInteracted; }
}

HapticManager.enabled = true;
HapticManager.intensityMultiplier = 1.0;

window.HapticManager = HapticManager;
