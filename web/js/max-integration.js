// js/max-integration.js
class MaxIntegration {
    constructor() {
        this.isMax = typeof WebApp !== 'undefined';
        this.setupSecurity = this.setupSecurity.bind(this);
    }

    async init() {
        try {
            console.log('Initializing MAX Bridge integration...');

            if (!this.isMax) {
                console.log('MAX environment not detected, running in standalone mode');
                return;
            }

            await this.setupSecurity();
            await this.setupBackButton();

            console.log('MAX Bridge initialized successfully');
        } catch (error) {
            console.error('MAX Bridge initialization failed:', error);
            // Продолжаем работу в standalone режиме
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

    async setupSecurity() {
        try {
            if (WebApp.enableScreenCapture) {
                await WebApp.enableScreenCapture();
                console.log('Screen capture enabled');
            }
        } catch (error) {
            console.warn('Screen capture not available:', error);
        }

        try {
            if (WebApp.setupClosingBehavior) {
                await WebApp.setupClosingBehavior({ need_confirmation: true });
                console.log('Closing behavior set');
            }
        } catch (error) {
            console.warn('Closing behavior not available:', error);
        }
    }

    async setupBackButton() {
        try {
            if (WebApp.BackButton && WebApp.BackButton.onClick) {
                WebApp.BackButton.onClick(() => {
                    console.log('MAX Back button pressed');
                    if (typeof App !== 'undefined' && App.backToPreviousView) {
                        App.backToPreviousView();
                    }
                });
                console.log('Back button handler set');
            }
        } catch (error) {
            console.warn('Back button setup failed:', error);
        }
    }

    hapticFeedback(style = 'light') {
        try {
            if (WebApp.HapticFeedback && WebApp.HapticFeedback.impactOccurred) {
                WebApp.HapticFeedback.impactOccurred(style);
            }
        } catch (error) {
            console.log('Haptic feedback not available');
        }
    }
}

// Создаем глобальный экземпляр
const MaxBridge = new MaxIntegration();

    static setupHapticFeedback() {
        if (WebApp.HapticFeedback) {
            window.hapticFeedback = {
                light: () => {
                    try {
                        WebApp.HapticFeedback.impactOccurred('light');
                    } catch (error) {
                        console.log('Haptic: light');
                    }
                },
                medium: () => {
                    try {
                        WebApp.HapticFeedback.impactOccurred('medium');
                    } catch (error) {
                        console.log('Haptic: medium');
                    }
                },
                heavy: () => {
                    try {
                        WebApp.HapticFeedback.impactOccurred('heavy');
                    } catch (error) {
                        console.log('Haptic: heavy');
                    }
                },
                success: () => {
                    try {
                        WebApp.HapticFeedback.notificationOccurred('success');
                    } catch (error) {
                        console.log('Haptic: success');
                    }
                },
                error: () => {
                    try {
                        WebApp.HapticFeedback.notificationOccurred('error');
                    } catch (error) {
                        console.log('Haptic: error');
                    }
                },
                warning: () => {
                    try {
                        WebApp.HapticFeedback.notificationOccurred('warning');
                    } catch (error) {
                        console.log('Haptic: warning');
                    }
                },
                selection: () => {
                    try {
                        WebApp.HapticFeedback.selectionChanged();
                    } catch (error) {
                        console.log('Haptic: selection');
                    }
                }
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
