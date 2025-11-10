class NotificationsManager {
    static async loadNotifications() {
        Utils.log('Loading notifications from API');

        try {
            const data = await ApiService.apiGetNotifications();
            const notifications = data.notifications || [];
            this.renderNotifications(notifications);
            this.updateNotificationsSummary(notifications);
            Utils.log('Notifications loaded successfully', { count: notifications.length });
        } catch (error) {
            Utils.logError('Notifications load error', error);
            ToastManager.showToast('Ошибка загрузки уведомлений', 'error');
            this.renderError();
        }
    }

    static renderNotifications(notifications) {
        const container = document.getElementById('notifications-list');

        if (notifications.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }

        container.innerHTML = notifications.map(notification => this.renderNotificationCard(notification)).join('');
    }

    static renderNotificationCard(notification) {
        const unreadClass = notification.is_read ? '' : 'fw-bold';
        const unreadIcon = notification.is_read ? '⚪' : '🔵';

        return `
            <div class="max-card mb-3 ${unreadClass}">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0">${unreadIcon} ${Utils.escapeHTML(notification.title)}</h6>
                    <small class="text-muted">${Utils.formatDate(notification.created_at)}</small>
                </div>
                <p class="mb-0">${Utils.escapeHTML(notification.message)}</p>
            </div>`;
    }

    static getEmptyStateHTML() {
        return `
            <div class="max-card text-center">
                <i class="fas fa-bell fa-2x text-muted mb-3"></i>
                <h6>Уведомлений нет</h6>
                <p class="text-muted">Новые уведомления появятся здесь</p>
            </div>`;
    }

    static renderError() {
        document.getElementById('notifications-list').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка загрузки</h6>
                <p class="text-muted">Не удалось загрузить уведомления</p>
                <button class="btn max-btn-primary btn-sm" onclick="NotificationsManager.loadNotifications()">
                    <i class="fas fa-refresh"></i> Попробовать снова
                </button>
            </div>`;
    }

    static updateNotificationsSummary(notifications) {
        const total = notifications.length;
        const unread = notifications.filter(n => !n.is_read).length;
        const read = total - unread;

        document.getElementById('notifications-summary').textContent =
            `Всего: ${total}, Прочитано: ${read}, Непрочитано: ${unread}`;

        document.getElementById('unread-notifications-count').textContent = unread;

        this.updateNotificationsBadge(unread);
    }

    static updateNotificationsBadge(count) {
        const badge = document.getElementById('notifications-badge');
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    }

    static async markAllNotificationsRead() {
        try {
            Utils.provideHapticFeedback('medium');
            await ApiService.apiMarkAllNotificationsRead();
            ToastManager.showToast('Все уведомления отмечены как прочитанные', 'success');

            // Обновляем интерфейс
            await this.loadNotifications();
        } catch (error) {
            Utils.logError('Error marking notifications as read', error);
            ToastManager.showToast('Ошибка обновления уведомлений', 'error');
        }
    }
}

window.NotificationsManager = NotificationsManager;
