class UI {
    static currentSection = 'projects';
    static currentTheme = localStorage.getItem('theme') || 'light';

    static init() {
        this.applyTheme();
        this.initEventListeners();
        this.initThemeToggle();
    }

    static applyTheme() {
        const body = document.body;
        const themeSwitch = document.getElementById('themeSwitch');

        if (this.currentTheme === 'dark') {
            body.classList.add('dark-theme');
            if (themeSwitch) themeSwitch.checked = true;
        } else {
            body.classList.remove('dark-theme');
            if (themeSwitch) themeSwitch.checked = false;
        }
    }

    static initEventListeners() {
        // Аватар пользователя - открытие настроек
        document.getElementById('user-avatar-btn').addEventListener('click', () => {
            this.showSettingsModal();
        });

        // Кнопка уведомлений
        document.getElementById('notifications-btn').addEventListener('click', () => {
            this.showSection('notifications');
            NotificationsManager.loadNotifications();
        });

        // Кнопки создания проекта
        document.querySelectorAll('#create-project-btn, #create-project-btn-empty').forEach(btn => {
            btn.addEventListener('click', () => ProjectsManager.createProject());
        });

        // Кнопка "Прочитать все" в уведомлениях
        document.getElementById('mark-all-read-btn').addEventListener('click', () => {
            NotificationsManager.markAllNotificationsRead();
        });

        // Клик по проектам для открытия деталей
        document.addEventListener('click', (e) => {
            const projectCard = e.target.closest('.project-card');
            if (projectCard && !e.target.closest('.swipe-action')) {
                const projectHash = projectCard.getAttribute('data-project-hash');
                ProjectsManager.openProjectDetail(projectHash);
            }

            const taskCard = e.target.closest('.task-card');
            if (taskCard && !e.target.closest('.swipe-action')) {
                const taskId = taskCard.getAttribute('data-task-id');
                TasksManager.openTaskDetail(taskId);
            }
        });
    }

    static initThemeToggle() {
        const themeSwitch = document.getElementById('themeSwitch');
        if (themeSwitch) {
            themeSwitch.addEventListener('change', (e) => {
                this.currentTheme = e.target.checked ? 'dark' : 'light';
                localStorage.setItem('theme', this.currentTheme);
                this.applyTheme();
            });
        }
    }

    static showSettingsModal() {
        const modal = new bootstrap.Modal(document.getElementById('settingsModal'));
        modal.show();
    }

    static showSection(sectionName) {
        // Скрываем все секции
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        // Показываем выбранную секцию
        document.getElementById(sectionName).classList.add('active');
        this.currentSection = sectionName;
    }

    static showMainInterface() {
        document.getElementById('mainInterface').style.display = 'block';
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
