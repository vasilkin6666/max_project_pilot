class UI {
    static currentSection = 'dashboard';
    static currentTheme = localStorage.getItem('theme') || 'light';
    static isInitialized = false;

    static init() {
        this.applyTheme();
        this.initEventListeners();
        this.initMaxBridge();
    }

    static applyTheme() {
        const body = document.body;
        const icon = document.querySelector('#theme-toggle i');
        
        if (this.currentTheme === 'dark') {
            body.classList.add('dark-theme');
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            body.classList.remove('dark-theme');
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }

        Utils.log('Theme applied');
    }

    static toggleThemeWithAnimation(event) {
        const themeToggle = document.getElementById('theme-toggle');
        themeToggle.style.pointerEvents = 'none';

        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        const newThemeColor = newTheme === 'light' ? '#f8f8f8' : '#161d31';

        const waveContainer = document.createElement('div');
        waveContainer.className = 'theme-wave-container';
        waveContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9998;
            pointer-events: none;
            overflow: hidden;
        `;

        const buttonRect = themeToggle.getBoundingClientRect();
        const buttonCenterX = buttonRect.left + buttonRect.width / 2;
        const buttonCenterY = buttonRect.top + buttonRect.height / 2;

        const wave = document.createElement('div');
        wave.className = 'theme-wave';
        wave.style.cssText = `
            position: absolute;
            left: ${buttonCenterX}px;
            top: ${buttonCenterY}px;
            width: 0;
            height: 0;
            background: ${newThemeColor};
            border-radius: 45% 55% 42% 58% / 55% 45% 55% 45%;
            transform: translate(-50%, -50%);
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 9999;
        `;

        waveContainer.appendChild(wave);
        document.body.appendChild(waveContainer);

        const maxSize = Math.max(window.innerWidth, window.innerHeight) * 2.5;

        requestAnimationFrame(() => {
            wave.style.width = `${maxSize}px`;
            wave.style.height = `${maxSize}px`;
            wave.style.borderRadius = '42% 58% 38% 62% / 52% 38% 62% 48%';
        });

        setTimeout(() => {
            this.currentTheme = newTheme;
            localStorage.setItem('theme', this.currentTheme);
            this.applyTheme();

            requestAnimationFrame(() => {
                wave.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                wave.style.width = '0';
                wave.style.height = '0';
                wave.style.borderRadius = '45% 55% 42% 58% / 55% 45% 55% 45%';
                wave.style.opacity = '0.8';
            });

            setTimeout(() => {
                if (waveContainer.parentNode) {
                    document.body.removeChild(waveContainer);
                }
                themeToggle.style.pointerEvents = 'auto';
            }, 300);

        }, 300);

        Utils.provideHapticFeedback('medium');
    }

    static initEventListeners() {
        // Навигация
        document.querySelectorAll('[data-section]').forEach(element => {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                const section = element.getAttribute('data-section');
                this.showSection(section);
            });
        });

        // Фильтры задач
        document.querySelectorAll('[data-filter]').forEach(element => {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                const filter = element.getAttribute('data-filter');
                if (filter) {
                    TasksManager.loadTasksWithFilter(filter);
                } else {
                    this.showSection('tasks');
                }
            });
        });

        // Переключатель темы
        document.getElementById('theme-toggle').addEventListener('click', (e) => {
            this.toggleThemeWithAnimation(e);
        });

        // Кнопки создания проекта
        document.querySelectorAll('#create-project-btn, #create-project-btn-2, #create-project-btn-3').forEach(btn => {
            btn.addEventListener('click', () => ProjectsManager.createProject());
        });

        // Кнопка создания задачи
        document.getElementById('create-task-btn').addEventListener('click', () => TasksManager.createTaskModal());

        // Поиск
        document.getElementById('search-tasks-btn').addEventListener('click', () => TasksManager.searchTasks());
        document.getElementById('search-projects-btn').addEventListener('click', () => ProjectsManager.searchProjects());
        document.getElementById('clear-search-btn').addEventListener('click', () => TasksManager.clearSearch());
        document.getElementById('clear-project-search-btn').addEventListener('click', () => ProjectsManager.clearProjectSearch());

        // Уведомления
        document.getElementById('refresh-notifications-btn').addEventListener('click', () => NotificationsManager.loadNotifications());
        document.getElementById('mark-all-read-btn').addEventListener('click', () => NotificationsManager.markAllNotificationsRead());

        // Поиск по Enter
        document.getElementById('searchTasksInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') TasksManager.searchTasks();
        });
        document.getElementById('searchProjectsInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') ProjectsManager.searchProjects();
        });
    }

    static initMaxBridge() {
        if (!AuthManager.isMaxEnvironment) {
            Utils.log('MAX Bridge: Running in standalone mode');
            document.body.classList.add('standalone-mode');
            return;
        }

        Utils.log('MAX Bridge: Initializing in MAX environment');
        document.body.classList.add('max-environment');

        try {
            const backButton = document.getElementById('back-button');
            window.WebApp.BackButton.onClick(() => {
                this.handleMaxBackButton();
            });

            window.WebApp.BackButton.show();
            backButton.classList.remove('d-none');

            backButton.addEventListener('click', () => {
                this.handleMaxBackButton();
            });

            window.WebApp.enableClosingConfirmation();
            window.WebApp.ready();

            Utils.log('MAX Bridge initialized successfully');
        } catch (error) {
            Utils.logError('MAX Bridge initialization error', error);
        }
    }

    static handleMaxBackButton() {
        const sections = ['dashboard', 'projects', 'tasks', 'notifications'];
        const currentSection = document.querySelector('.section.active')?.id;

        if (!currentSection) return;

        const currentIndex = sections.indexOf(currentSection);

        const currentActive = document.querySelector('.section.active');
        if (currentActive) {
            currentActive.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            currentActive.style.opacity = '0';
            currentActive.style.transform = 'translateX(-20px)';
        }

        if (currentIndex > 0) {
            setTimeout(() => {
                this.showSection(sections[currentIndex - 1]);
                const newSection = document.getElementById(sections[currentIndex - 1]);
                newSection.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                newSection.style.opacity = '0';
                newSection.style.transform = 'translateX(20px)';

                setTimeout(() => {
                    newSection.style.opacity = '1';
                    newSection.style.transform = 'translateX(0)';
                }, 50);
            }, 300);
        } else {
            setTimeout(() => {
                if (AuthManager.isMaxEnvironment) {
                    window.WebApp.close();
                }
            }, 300);
        }

        Utils.provideHapticFeedback('light');
    }

    static async showSection(sectionName) {
        Utils.log(`Showing section: ${sectionName}`);
        Utils.provideHapticFeedback('light');

        if (!AuthManager.isAuthenticated()) {
            ToastManager.showToast('Пожалуйста, войдите в систему', 'warning');
            Utils.log('No currentUserId, cannot show section');
            return;
        }

        // Анимация перехода
        const currentActive = document.querySelector('.section.active');
        const targetSection = document.getElementById(sectionName);

        if (currentActive) {
            currentActive.style.opacity = '0';
            currentActive.style.transform = 'translateY(10px)';
            setTimeout(() => {
                currentActive.classList.remove('active');
            }, 200);
        }

        setTimeout(() => {
            targetSection.classList.add('active');
            targetSection.style.opacity = '0';
            targetSection.style.transform = 'translateY(10px)';

            setTimeout(() => {
                targetSection.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                targetSection.style.opacity = '1';
                targetSection.style.transform = 'translateY(0)';
            }, 50);
        }, 250);

        // Обновить активную вкладку
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        this.currentSection = sectionName;

        // Загрузить данные для секции
        setTimeout(async () => {
            switch(sectionName) {
                case 'dashboard':
                    await DashboardManager.loadDashboardData();
                    break;
                case 'projects':
                    await ProjectsManager.loadProjects();
                    break;
                case 'tasks':
                    await TasksManager.loadTasks();
                    break;
                case 'notifications':
                    await NotificationsManager.loadNotifications();
                    break;
            }
        }, 300);
    }

    static showMainInterface() {
        document.getElementById('mainInterface').style.display = 'block';
        Utils.log('Main interface shown');
    }

    static hideLoadingOverlay() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.transition = 'opacity 0.5s ease';
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
            }, 500);
        }
    }
}

window.UI = UI;
