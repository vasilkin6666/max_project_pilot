// main.js
console.log('Project Pilot Pro - Initializing...');

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Project Pilot Pro - Initializing...');

    try {
        // Инициализируем MAX интеграцию
        let maxInitialized = false;
        if (typeof MaxBridge !== 'undefined') {
            maxInitialized = await MaxBridge.init();
        }
        console.log('MAX integration:', maxInitialized ? 'successful' : 'standalone mode');

        // Инициализируем аутентификацию
        console.log('Starting authentication...');
        if (typeof EnhancedAuthManager !== 'undefined') {
            currentUser = await EnhancedAuthManager.initialize();
            console.log('User authenticated:', currentUser);
        } else {
            console.error('EnhancedAuthManager not found');
            return;
        }

        // Инициализируем основное приложение
        if (typeof App !== 'undefined') {
            await App.init();
            console.log('Main app initialized');
        } else {
            console.error('App not found');
            return;
        }

        // Инициализируем мобильные функции
        if (typeof MobileApp !== 'undefined') {
            MobileApp.init();
            console.log('Mobile features initialized');
        }

        // Показываем готовность MAX
        if (maxInitialized && typeof WebApp !== 'undefined') {
            WebApp.ready();
            console.log('MAX WebApp ready signaled');
        }

        console.log('Application initialized successfully');

    } catch (error) {
        console.error('Application initialization failed:', error);
        // Показываем ошибку пользователю
        const loadingContent = document.querySelector('.loading-content');
        if (loadingContent) {
            loadingContent.innerHTML = `
                <div style="text-align: center; color: white;">
                    <div style="font-size: 3rem; margin-bottom: 20px;">⚠️</div>
                    <h2>Ошибка загрузки</h2>
                    <p style="margin: 20px 0; color: rgba(255,255,255,0.8);">
                        ${error.message || 'Неизвестная ошибка'}
                    </p>
                    <button onclick="location.reload()"
                            class="btn btn-primary"
                            style="margin-top: 20px;">
                        Перезагрузить
                    </button>
                </div>
            `;
        }
    }
});


// Обработчик клика по заставке
document.getElementById('loading')?.addEventListener('click', function() {
    console.log('Loading overlay clicked, starting application...');

    // Плавное скрытие заставки
    this.classList.add('hidden');

    setTimeout(() => {
        this.style.display = 'none';
        const appElement = document.getElementById('app');
        if (appElement) {
            appElement.style.display = 'block';
        }

        // Показываем дашборд
        if (typeof App !== 'undefined' && App.showDashboard) {
            App.showDashboard();
        }

        console.log('Application started successfully');
    }, 800);
});
