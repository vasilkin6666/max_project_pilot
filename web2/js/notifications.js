class NotificationsManager {
    static async loadNotifications() {
        Utils.log('Loading notifications from API');

        try {
            const data = await ApiService.apiGetNotifications();
            const notifications = data.notifications || [];
            this.renderNotifications(notifications);
            this.updateNotificationsBadge(notifications.filter(n => !n.is_read).length);

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

        // Разделяем уведомления на типы
        const joinRequests = notifications.filter(n => n.type === 'join_request');
        const otherNotifications = notifications.filter(n => n.type !== 'join_request');

        let html = '';

        // Запросы на вступление
        if (joinRequests.length > 0) {
            html += `
                <div class="mb-3">
                    <h6 class="text-muted">Запросы на вступление</h6>
                    ${joinRequests.map(notification => this.renderJoinRequestNotification(notification)).join('')}
                </div>`;
        }

        // Остальные уведомления
        if (otherNotifications.length > 0) {
            html += `
                <div class="mb-3">
                    <h6 class="text-muted">Уведомления</h6>
                    ${otherNotifications.map(notification => this.renderRegularNotification(notification)).join('')}
                </div>`;
        }

        container.innerHTML = html;
    }

    static renderJoinRequestNotification(notification) {
        return `
            <div class="notification-item request ${notification.is_read ? '' : 'unread'}" data-notification-id="${notification.id}">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${Utils.escapeHTML(notification.title)}</h6>
                        <p class="mb-2">${Utils.escapeHTML(notification.message)}</p>
                        <div class="join-request-actions">
                            <button class="btn btn-success btn-sm" onclick="NotificationsManager.approveJoinRequest('${notification.id}', '${notification.project_hash}')">
                                <i class="fas fa-check"></i> Принять
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="NotificationsManager.rejectJoinRequest('${notification.id}', '${notification.project_hash}')">
                                <i class="fas fa-times"></i> Отклонить
                            </button>
                        </div>
                    </div>
                    <small class="text-muted">${Utils.formatDate(notification.created_at)}</small>
                </div>
            </div>`;
    }

    static renderRegularNotification(notification) {
        return `
            <div class="notification-item ${notification.is_read ? '' : 'unread'}" data-notification-id="${notification.id}">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${Utils.escapeHTML(notification.title)}</h6>
                        <p class="mb-0">${Utils.escapeHTML(notification.message)}</p>
                    </div>
                    <small class="text-muted">${Utils.formatDate(notification.created_at)}</small>
                </div>
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

    static updateNotificationsBadge(count) {
        const badge = document.getElementById('notifications-badge');
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    }

    static async markAllNotificationsRead() {
        try {
            // Помечаем как прочитанные только не-запросы
            const notifications = document.querySelectorAll('.notification-item:not(.request)');
            const notificationIds = Array.from(notifications)
                .map(item => item.getAttribute('data-notification-id'))
                .filter(id => id);

            if (notificationIds.length > 0) {
                await ApiService.apiMarkNotificationsRead(notificationIds);
            }

            ToastManager.showToast('Уведомления отмечены как прочитанные', 'success');
            await this.loadNotifications();
        } catch (error) {
            Utils.logError('Error marking notifications as read', error);
            ToastManager.showToast('Ошибка обновления уведомлений', 'error');
        }
    }

    static async approveJoinRequest(notificationId, projectHash) {
        try {
            // Находим requestId из данных уведомления
            const requestId = await this.getRequestIdFromNotification(notificationId);
            await ApiService.apiApproveJoinRequest(projectHash, requestId);

            ToastManager.showToast('Запрос на вступление одобрен', 'success');
            await this.loadNotifications();

            // Уведомляем владельцев и админов
            await this.notifyAdminsAboutJoinRequestApproval(projectHash);
        } catch (error) {
            Utils.logError('Error approving join request', error);
            ToastManager.showToast('Ошибка одобрения запроса', 'error');
        }
    }

    static async rejectJoinRequest(notificationId, projectHash) {
        try {
            const requestId = await this.getRequestIdFromNotification(notificationId);
            await ApiService.apiRejectJoinRequest(projectHash, requestId);

            ToastManager.showToast('Запрос на вступление отклонен', 'success');
            await this.loadNotifications();

            // Уведомляем владельцев и админов
            await this.notifyAdminsAboutJoinRequestRejection(projectHash);
        } catch (error) {
            Utils.logError('Error rejecting join request', error);
            ToastManager.showToast('Ошибка отклонения запроса', 'error');
        }
    }

    static async getRequestIdFromNotification(notificationId) {
        // Здесь должна быть логика получения requestId из уведомления
        // В реальном приложении это может быть свойство уведомления
        return notificationId; // Заглушка
    }

    static async notifyAdminsAboutJoinRequestApproval(projectHash) {
        // Логика уведомления админов и владельцев
        // В реальном приложении это может быть отдельный API вызов
    }

    static async notifyAdminsAboutJoinRequestRejection(projectHash) {
        // Аналогично approve
    }

    static initNotificationHandlers() {
        document.addEventListener('click', (e) => {
            const notificationItem = e.target.closest('.notification-item');
            if (notificationItem && !e.target.closest('.join-request-actions')) {
                const projectHash = notificationItem.getAttribute('data-project-hash');
                if (projectHash) {
                    ProjectsManager.openProjectDetail(projectHash);

                    // Помечаем как прочитанное, если это не запрос на вступление
                    if (!notificationItem.classList.contains('request')) {
                        this.markNotificationAsRead(notificationItem.getAttribute('data-notification-id'));
                    }
                }
            }
        });
    }

    static async markNotificationAsRead(notificationId) {
        try {
            await ApiService.apiMarkNotificationsRead([notificationId]);
        } catch (error) {
            Utils.logError('Error marking notification as read', error);
        }
    }
}

window.NotificationsManager = NotificationsManager;
