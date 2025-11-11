class CountersManager {
    static updateCounters() {
        this.updateTaskCounters();
        this.updateProjectCounters();
        this.updateNotificationCounters();

        // Триггерим событие обновления счетчиков
        Utils.triggerEvent('countersUpdated');
    }

    static updateTaskCounters() {
        const tasks = TasksManager.allTasks || [];

        // Общее количество задач
        const totalTasks = tasks.length;

        // Задачи по статусам
        const todoCount = tasks.filter(t => t.status === 'todo').length;
        const progressCount = tasks.filter(t => t.status === 'in_progress').length;
        const doneCount = tasks.filter(t => t.status === 'done').length;

        // Задачи по приоритетам
        const lowCount = tasks.filter(t => t.priority === 'low').length;
        const mediumCount = tasks.filter(t => t.priority === 'medium').length;
        const highCount = tasks.filter(t => t.priority === 'high').length;
        const urgentCount = tasks.filter(t => t.priority === 'urgent').length;

        // Обновляем DOM
        this.updateElementText('tasks-todo-count', todoCount);
        this.updateElementText('tasks-progress-count', progressCount);
        this.updateElementText('tasks-done-count', doneCount);

        // Обновляем бейджи на вкладках приоритета
        this.updatePriorityBadges({
            low: lowCount,
            medium: mediumCount,
            high: highCount,
            urgent: urgentCount
        });

        Utils.log('Task counters updated', {
            total: totalTasks,
            todo: todoCount,
            progress: progressCount,
            done: doneCount,
            priorities: { low: lowCount, medium: mediumCount, high: highCount, urgent: urgentCount }
        });
    }

    static updatePriorityBadges(counts) {
        // Можно добавить бейджи с количеством на вкладках приоритета
        Object.keys(counts).forEach(priority => {
            const tab = document.querySelector(`.priority-tab[data-priority="${priority}"]`);
            if (tab) {
                let badge = tab.querySelector('.priority-badge');
                if (!badge && counts[priority] > 0) {
                    badge = document.createElement('span');
                    badge.className = 'priority-badge badge bg-primary ms-1';
                    tab.appendChild(badge);
                }
                if (badge) {
                    badge.textContent = counts[priority];
                    if (counts[priority] === 0) {
                        badge.remove();
                    }
                }
            }
        });
    }

    static updateProjectCounters() {
        const projects = ProjectsManager.allProjects || [];
        const activeProjects = projects.filter(projectMember => {
            const project = projectMember.project || projectMember;
            const stats = project.stats || { tasks_count: 0, tasks_done: 0 };
            const progress = stats.tasks_count > 0 ?
                Math.round((stats.tasks_done / stats.tasks_count) * 100) : 0;
            return progress < 100; // Незавершенные проекты
        }).length;

        this.updateElementText('projects-count', activeProjects);
    }

    static updateNotificationCounters() {
        // Эта функция будет вызываться из NotificationsManager
        const notifications = document.querySelectorAll('.notification-item');
        const unreadCount = Array.from(notifications).filter(n =>
            !n.classList.contains('fw-bold')
        ).length;

        NotificationsManager.updateNotificationsBadge(unreadCount);
    }

    static updateElementText(elementId, count) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = count;

            // Добавляем анимацию обновления
            element.style.transform = 'scale(1.1)';
            setTimeout(() => {
                element.style.transform = 'scale(1)';
            }, 150);
        }
    }

    static init() {
        // Слушаем события обновления данных
        document.addEventListener('taskUpdated', () => this.updateCounters());
        document.addEventListener('projectUpdated', () => this.updateCounters());
        document.addEventListener('notificationUpdated', () => this.updateCounters());

        Utils.log('Counters manager initialized');
    }
}

window.CountersManager = CountersManager;
