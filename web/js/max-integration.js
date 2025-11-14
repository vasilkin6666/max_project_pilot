// js/max-integration.js
class MaxIntegration {
    static init() {
        console.log('Initializing MAX Bridge integration...');

        // Проверяем наличие MAX окружения
        if (typeof WebApp === 'undefined') {
            console.warn('MAX Bridge not available - running in standalone mode');
            this.addMaxDetectionClass(false);
            return false;
        }

        try {
            // Добавляем класс для стилизации под MAX
            this.addMaxDetectionClass(true);

            // Инициализируем MAX Bridge
            WebApp.ready();
            console.log('MAX Bridge initialized successfully');

            // Настраиваем компоненты MAX
            this.setupBackButton();
            this.setupHapticFeedback();
            this.setupSecurity();
            this.setupEventListeners();

            return true;
        } catch (error) {
            console.error('MAX Bridge initialization failed:', error);
            this.addMaxDetectionClass(false);
            return false;
        }
    }

    static addMaxDetectionClass(isMax) {
        if (isMax) {
            document.body.classList.add('max-enhanced');
            if (WebApp.platform) {
                document.body.classList.add(`max-${WebApp.platform}`);
            }
        } else {
            document.body.classList.add('max-standalone');
        }
    }

    static setupBackButton() {
        if (WebApp.BackButton) {
            WebApp.BackButton.show();
            WebApp.BackButton.onClick(() => {
                // Тактильная обратная связь при нажатии назад
                if (window.hapticFeedback) {
                    window.hapticFeedback.light();
                }

                // Обработка нажатия кнопки "Назад"
                if (typeof App.backToPreviousView === 'function') {
                    App.backToPreviousView();
                } else {
                    window.history.back();
                }
            });
        }
    }

    static setupHapticFeedback() {
        if (WebApp.HapticFeedback) {
            window.hapticFeedback = {
                light: () => WebApp.HapticFeedback.impactOccurred('light'),
                medium: () => WebApp.HapticFeedback.impactOccurred('medium'),
                heavy: () => WebApp.HapticFeedback.impactOccurred('heavy'),
                success: () => WebApp.HapticFeedback.notificationOccurred('success'),
                error: () => WebApp.HapticFeedback.notificationOccurred('error'),
                warning: () => WebApp.HapticFeedback.notificationOccurred('warning'),
                selection: () => WebApp.HapticFeedback.selectionChanged()
            };
        } else {
            // Fallback для standalone режима
            window.hapticFeedback = {
                light: () => console.log('Haptic: light'),
                medium: () => console.log('Haptic: medium'),
                heavy: () => console.log('Haptic: heavy'),
                success: () => console.log('Haptic: success'),
                error: () => console.log('Haptic: error'),
                warning: () => console.log('Haptic: warning'),
                selection: () => console.log('Haptic: selection')
            };
        }
    }

    static setupSecurity() {
        // Включаем защиту от скриншотов для приватных данных
        if (WebApp.ScreenCapture) {
            WebApp.ScreenCapture.enableScreenCapture();
        }

        // Включаем подтверждение закрытия при несохраненных данных
        if (WebApp.enableClosingConfirmation) {
            WebApp.enableClosingConfirmation();
        }
    }

    static setupEventListeners() {
        // Обработка изменений темы
        if (window.matchMedia) {
            const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            darkModeMediaQuery.addListener((e) => {
                this.handleThemeChange(e.matches);
            });
            this.handleThemeChange(darkModeMediaQuery.matches);
        }
    }

    static handleThemeChange(isDark) {
        if (isDark && !document.documentElement.hasAttribute('data-theme')) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }

    // Получение данных пользователя MAX
    static getUserData() {
        if (WebApp.initDataUnsafe?.user) {
            return {
                id: WebApp.initDataUnsafe.user.id,
                firstName: WebApp.initDataUnsafe.user.first_name,
                lastName: WebApp.initDataUnsafe.user.last_name,
                username: WebApp.initDataUnsafe.user.username,
                languageCode: WebApp.initDataUnsafe.user.language_code,
                photoUrl: WebApp.initDataUnsafe.user.photo_url,
                isPremium: WebApp.initDataUnsafe.user.is_premium
            };
        }
        return null;
    }

    // Получение данных чата
    static getChatData() {
        if (WebApp.initDataUnsafe?.chat) {
            return {
                id: WebApp.initDataUnsafe.chat.id,
                type: WebApp.initDataUnsafe.chat.type,
                title: WebApp.initDataUnsafe.chat.title,
                username: WebApp.initDataUnsafe.chat.username
            };
        }
        return null;
    }

    // Открытие ссылок через MAX
    static openLink(url, text) {
        if (WebApp.openLink) {
            WebApp.openLink(url);
        } else {
            window.open(url, '_blank');
        }
    }

    // Открытие MAX ссылок
    static openMaxLink(botName, startParam = '') {
        if (WebApp.openMaxLink) {
            const url = `https://max.ru/${botName}?startapp=${startParam}`;
            WebApp.openMaxLink(url);
        } else {
            console.warn('openMaxLink not available');
        }
    }

    // Совместное использование контента
    static shareContent(text, link) {
        if (WebApp.shareMaxContent) {
            WebApp.shareMaxContent(text, link);
        } else if (WebApp.shareContent) {
            WebApp.shareContent(text, link);
        } else if (navigator.share) {
            navigator.share({ text, url: link });
        } else {
            // Fallback - копирование в буфер обмена
            this.copyToClipboard(`${text} ${link}`);
            if (window.hapticFeedback) {
                window.hapticFeedback.success();
            }
        }
    }

    // Копирование в буфер обмена
    static copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                console.log('Text copied to clipboard');
            });
        } else {
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    // Сканирование QR-кодов
    static scanQRCode(allowFileSelect = true) {
        return new Promise((resolve, reject) => {
            if (WebApp.openCodeReader) {
                WebApp.openCodeReader(allowFileSelect);

                // Обработчик результата сканирования
                const messageHandler = (e) => {
                    if (e.data && e.data.type === 'QRCodeScanned') {
                        window.removeEventListener('message', messageHandler);
                        resolve(e.data.value);
                    }
                };

                window.addEventListener('message', messageHandler);

                // Таймаут на случай ошибки
                setTimeout(() => {
                    window.removeEventListener('message', messageHandler);
                    reject(new Error('QR code scanning timeout'));
                }, 30000);
            } else {
                reject(new Error('QR code scanning not supported'));
            }
        });
    }

    // Скачивание файлов
    static downloadFile(url, fileName) {
        if (WebApp.downloadFile) {
            WebApp.downloadFile(url, fileName);
        } else {
            // Fallback для браузера
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // Получение версии MAX
    static getMaxVersion() {
        return WebApp.version || 'unknown';
    }

    // Получение платформы
    static getPlatform() {
        return WebApp.platform || 'web';
    }

    // Проверка, запущено ли в MAX
    static isInMax() {
        return typeof WebApp !== 'undefined' && WebApp.initDataUnsafe !== undefined;
    }

    // Показать подтверждение закрытия
    static enableClosingConfirmation() {
        if (WebApp.enableClosingConfirmation) {
            WebApp.enableClosingConfirmation();
        }
    }

    // Скрыть подтверждение закрытия
    static disableClosingConfirmation() {
        if (WebApp.disableClosingConfirmation) {
            WebApp.disableClosingConfirmation();
        }
    }

    // Запрос контакта пользователя
    static requestContact() {
        return new Promise((resolve, reject) => {
            if (WebApp.requestContact) {
                WebApp.requestContact();

                const messageHandler = (e) => {
                    if (e.data && e.data.type === 'ContactReceived') {
                        window.removeEventListener('message', messageHandler);
                        resolve(e.data.contact);
                    }
                };

                window.addEventListener('message', messageHandler);

                setTimeout(() => {
                    window.removeEventListener('message', messageHandler);
                    reject(new Error('Contact request timeout'));
                }, 30000);
            } else {
                reject(new Error('Contact request not supported'));
            }
        });
    }
}

// Глобальная доступность
window.MaxIntegration = MaxIntegration;
