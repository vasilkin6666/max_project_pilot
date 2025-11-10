// MAX Bridge интеграция
class MaxBridgeIntegration {
    constructor() {
        this.isMaxEnvironment = typeof window.WebApp !== 'undefined';
        this.init();
    }

    async init() {
        if (!this.isMaxEnvironment) {
            console.log('MAX Bridge: Running in standalone mode');
            return;
        }

        console.log('MAX Bridge: Initializing in MAX environment');

        try {
            // Инициализация MAX Bridge
            await this.setupBackButton();
            this.setupClosingConfirmation();

            // Сообщаем MAX, что приложение готово
            if (window.WebApp.ready) {
                window.WebApp.ready();
            }

            console.log('MAX Bridge initialized successfully');
        } catch (error) {
            console.error('MAX Bridge initialization error:', error);
        }
    }

    async setupBackButton() {
        if (!this.isMaxEnvironment || !window.WebApp.BackButton) return;

        const backButton = document.getElementById('back-button');

        try {
            if (window.WebApp.BackButton.onClick) {
                window.WebApp.BackButton.onClick(() => {
                    this.handleBackButton();
                });
            }

            // Показываем кнопку назад когда нужно
            if (window.WebApp.BackButton.show) {
                window.WebApp.BackButton.show();
            }
            backButton.classList.remove('d-none');

            backButton.addEventListener('click', () => {
                this.handleBackButton();
            });
        } catch (error) {
            console.error('Back button setup error:', error);
        }
    }

    setupClosingConfirmation() {
        if (!this.isMaxEnvironment) return;

        try {
            // Включаем подтверждение закрытия при изменении данных
            if (window.WebApp.enableClosingConfirmation) {
                window.WebApp.enableClosingConfirmation();
            }
        } catch (error) {
            console.error('Closing confirmation setup error:', error);
        }
    }

    handleBackButton() {
        // Логика кнопки "Назад"
        const sections = ['dashboard', 'projects', 'tasks', 'notifications'];
        const currentSection = document.querySelector('.section.active')?.id;

        if (!currentSection) return;

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

        const sectionElement = document.getElementById(sectionName);
        if (sectionElement) {
            sectionElement.classList.add('active');
        }

        // Обновляем навигацию
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        // В MAX среде используем тактильную обратную связь
        if (this.isMaxEnvironment && window.WebApp.HapticFeedback) {
            try {
                window.WebApp.HapticFeedback.impactOccurred('light');
            } catch (error) {
                console.error('Haptic feedback error:', error);
            }
        }
    }

    closeApp() {
        if (this.isMaxEnvironment && window.WebApp.close) {
            try {
                window.WebApp.close();
            } catch (error) {
                console.error('App close error:', error);
            }
        } else {
            console.log('MAX Bridge: App close requested');
        }
    }

    // Методы для работы с MAX API
    shareContent(text, link) {
        if (this.isMaxEnvironment && window.WebApp.shareContent) {
            try {
                window.WebApp.shareContent(text, link);
            } catch (error) {
                console.error('Share content error:', error);
            }
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
        if (this.isMaxEnvironment && window.WebApp.openLink) {
            try {
                window.WebApp.openLink(url);
            } catch (error) {
                console.error('Open link error:', error);
            }
        } else {
            window.open(url, '_blank');
        }
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    window.maxBridge = new MaxBridgeIntegration();
});
