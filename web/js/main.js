// js/main.js - обновленная инициализация
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Project Pilot Pro - Initializing...');

    try {
        // Инициализируем MAX интеграцию
        const maxInitialized = MaxIntegration.init();
        console.log('MAX integration:', maxInitialized ? 'successful' : 'standalone mode');

        // Инициализируем аутентификацию
        console.log('Starting authentication...');
        currentUser = await EnhancedAuthManager.initialize();
        console.log('User authenticated:', currentUser);

        // Инициализируем основное приложение
        await App.init();
        console.log('Main app initialized');

        // Инициализируем мобильные функции
        if (typeof MobileApp !== 'undefined') {
            MobileApp.init();
            console.log('Mobile features initialized');
        }

        // Показываем готовность MAX
        if (maxInitialized) {
            WebApp.ready();
            console.log('MAX WebApp ready signaled');
        }

        // Инициализируем анимации
        initSparkAnimation();
        console.log('Animations initialized');

        console.log('Application initialized successfully');

        // Показываем информацию о режиме работы
        this.showEnvironmentInfo(maxInitialized);

    } catch (error) {
        console.error('Application initialization failed:', error);
        this.showInitializationError(error);
    }
});

// Показывает информацию о среде выполнения
function showEnvironmentInfo(maxInitialized) {
    const envInfo = {
        max: maxInitialized,
        platform: MaxIntegration.getPlatform(),
        version: MaxIntegration.getMaxVersion(),
        authMethod: EnhancedAuthManager.getCurrentAuthMethod(),
        user: currentUser
    };

    console.log('Environment info:', envInfo);

    // Добавляем информацию в DOM для отладки (только в development)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const debugInfo = document.createElement('div');
        debugInfo.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 10000;
            max-width: 300px;
        `;
        debugInfo.innerHTML = `
            <strong>Environment:</strong> ${maxInitialized ? 'MAX' : 'Standalone'}<br>
            <strong>Platform:</strong> ${envInfo.platform}<br>
            <strong>Auth:</strong> ${envInfo.authMethod}<br>
            <strong>User:</strong> ${currentUser?.id || 'Unknown'}
        `;
        document.body.appendChild(debugInfo);
    }
}

// Показывает ошибку инициализации
function showInitializationError(error) {
    const loadingContent = document.querySelector('.loading-content');
    if (loadingContent) {
        loadingContent.innerHTML = `
            <div style="text-align: center; color: white;">
                <div style="font-size: 3rem; margin-bottom: 20px;">⚠️</div>
                <h2>Ошибка загрузки</h2>
                <p style="margin: 20px 0; color: rgba(255,255,255,0.8);">
                    ${error.message || 'Неизвестная ошибка'}
                </p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button onclick="location.reload()"
                            class="btn btn-primary"
                            style="margin-top: 20px;">
                        Перезагрузить
                    </button>
                    <button onclick="EnhancedAuthManager.clearAuthData(); location.reload()"
                            class="btn btn-outline"
                            style="margin-top: 20px; border-color: white; color: white;">
                        Сбросить данные
                    </button>
                </div>
            </div>
        `;
    }
}

// Инициализация анимации искр
function initSparkAnimation() {
    const sparkContainer = document.getElementById('sparkContainer');
    if (!sparkContainer) return;

    const createSpark = () => {
        const spark = document.createElement('div');
        spark.classList.add('spark');

        // Случайная стартовая позиция
        const startX = Math.random() * 100;
        const startY = Math.random() * 100;

        // Случайная конечная позиция
        const endX = (Math.random() - 0.5) * 200;
        const endY = (Math.random() - 0.5) * 200;

        spark.style.setProperty('--end-x', `${endX}vw`);
        spark.style.setProperty('--end-y', `${endY}vh`);
        spark.style.left = `${startX}%`;
        spark.style.top = `${startY}%`;

        sparkContainer.appendChild(spark);

        // Удаляем искру после анимации
        setTimeout(() => {
            if (spark.parentNode === sparkContainer) {
                spark.remove();
            }
        }, 3000);
    };

    // Создаем искры каждые 200-500мс
    setInterval(createSpark, Math.random() * 300 + 200);
}

// Обработчик клика по заставке
document.getElementById('loading')?.addEventListener('click', function() {
    console.log('Loading overlay clicked, starting application...');

    // Тактильная обратная связь
    if (window.hapticFeedback) {
        window.hapticFeedback.medium();
    }

    // Плавное скрытие заставки
    this.classList.add('hidden');

    setTimeout(() => {
        this.style.display = 'none';
        document.getElementById('app').style.display = 'block';

        // Показываем дашборд
        if (typeof App.showDashboard === 'function') {
            App.showDashboard();
        }

        console.log('Application started successfully');
    }, 800);
});

// Также можно скрывать по нажатию клавиши
document.addEventListener('keydown', function(e) {
    if (e.code === 'Space' || e.code === 'Enter') {
        const loadingOverlay = document.getElementById('loading');
        if (loadingOverlay && loadingOverlay.style.display !== 'none') {
            loadingOverlay.click();
        }
    }

    // Back button simulation with Escape key
    if (e.code === 'Escape') {
        if (typeof App.backToPreviousView === 'function') {
            App.backToPreviousView();
        }
    }
});

// Обработчик онлайн/офлайн статуса
window.addEventListener('online', () => {
    console.log('Application is online');
    if (window.hapticFeedback) {
        window.hapticFeedback.success();
    }
});

window.addEventListener('offline', () => {
    console.log('Application is offline');
    if (window.hapticFeedback) {
        window.hapticFeedback.warning();
    }
});

// Service Worker регистрация для PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
