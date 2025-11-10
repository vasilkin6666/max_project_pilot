// MAX Bridge интеграция
class MaxBridgeIntegration {
    constructor() {
        this.isMaxEnvironment = typeof window.WebApp !== 'undefined';
        this.init();
    }

    init() {
        if (!this.isMaxEnvironment) {
            console.log('MAX Bridge: Running in standalone mode');
            return;
        }

        console.log('MAX Bridge: Initializing in MAX environment');

        // Инициализация MAX Bridge
        this.setupBackButton();
        this.setupClosingConfirmation();
        this.setupUserData();

        // Сообщаем MAX, что приложение готово
        window.WebApp.ready();
    }

    setupBackButton() {
        if (!this.isMaxEnvironment) return;

        const backButton = document.getElementById('back-button');

        window.WebApp.BackButton.onClick(() => {
            this.handleBackButton();
        });

        // Показываем кнопку назад когда нужно
        window.WebApp.BackButton.show();
        backButton.classList.remove('d-none');

        backButton.addEventListener('click', () => {
            this.handleBackButton();
        });
    }

    setupClosingConfirmation() {
        if (!this.isMaxEnvironment) return;

        // Включаем подтверждение закрытия при изменении данных
        window.WebApp.enableClosingConfirmation();
    }

    setupUserData() {
        if (!this.isMaxEnvironment) return;

        const initData = window.WebApp.initDataUnsafe;

        if (initData && initData.user) {
            this.updateUserInterface(initData.user);
        }
    }

    updateUserInterface(userData) {
        const userNameElement = document.getElementById('user-name');
        const userAvatarElement = document.getElementById('user-avatar');

        if (userData.first_name || userData.last_name) {
            const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
            userNameElement.textContent = fullName || 'Пользователь MAX';
            userAvatarElement.textContent = fullName.charAt(0).toUpperCase() || 'U';
        }

        if (userData.username) {
            // Можно использовать username для дополнительной информации
            console.log('MAX user:', userData.username);
        }
    }

    handleBackButton() {
        // Логика кнопки "Назад"
        const sections = ['dashboard', 'projects', 'tasks', 'notifications'];
        const currentSection = document.querySelector('.section.active').id;
        const currentIndex = sections.indexOf(currentSection);

        if (currentIndex > 0) {
            // Возврат к предыдущей секции
            this.showSection(sections[currentIndex - 1]);
        } else {
            // Если на главной - закрываем приложение
            this.closeApp();
        }
    }

    showSection(sectionName) {
        // Адаптированная версия showSection для MAX
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        document.getElementById(sectionName).classList.add('active');

        // Обновляем навигацию
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // В MAX среде используем тактильную обратную связь
        if (this.isMaxEnvironment) {
            window.WebApp.HapticFeedback.impactOccurred('light');
        }
    }

    closeApp() {
        if (this.isMaxEnvironment) {
            window.WebApp.close();
        } else {
            console.log('MAX Bridge: App close requested');
        }
    }

    // Методы для работы с MAX API
    shareContent(text, link) {
        if (this.isMaxEnvironment) {
            window.WebApp.shareContent(text, link);
        } else {
            // Fallback для обычного браузера
            if (navigator.share) {
                navigator.share({
                    title: text,
                    url: link
                });
            } else {
                // Копирование в буфер обмена
                navigator.clipboard.writeText(link);
                alert('Ссылка скопирована в буфер обмена: ' + link);
            }
        }
    }

    openLink(url) {
        if (this.isMaxEnvironment) {
            window.WebApp.openLink(url);
        } else {
            window.open(url, '_blank');
        }
    }

    // Биометрическая аутентификация
    async setupBiometricAuth() {
        if (!this.isMaxEnvironment || !window.WebApp.BiometricManager) {
            return false;
        }

        try {
            const biometricManager = window.WebApp.BiometricManager;

            if (!biometricManager.isInited) {
                await biometricManager.init();
            }

            if (biometricManager.isBiometricAvailable && !biometricManager.isAccessGranted) {
                await biometricManager.requestAccess();
            }

            return biometricManager.isAccessGranted;
        } catch (error) {
            console.error('Biometric auth setup failed:', error);
            return false;
        }
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    window.maxBridge = new MaxBridgeIntegration();
});
