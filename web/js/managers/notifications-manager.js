// Менеджер уведомлений
class NotificationsManager {
    static async loadNotifications() {
        try {
            const data = await CacheManager.getWithCache(
                'notifications',
                () => ApiService.getNotifications(),
                'notifications'
            );

            const notifications = data.notifications || [];
            StateManager.setState('notifications', notifications);

            this.updateNotificationBadge(notifications);

            // ИСПРАВЛЕНИЕ: сразу рендерим уведомления или пустое состояние
            this.renderNotifications(notifications);

            EventManager.emit(APP_EVENTS.NOTIFICATIONS_LOADED, notifications);

            Utils.log('Notifications loaded successfully', { count: notifications.length });

            return notifications;
        } catch (error) {
            Utils.logError('Notifications load error:', error);
            this.showErrorState();
            throw error;
        }
    }

    static updateNotificationBadge(notifications) {
        const unreadCount = notifications.filter(n => !n.is_read).length;

        // Обновляем бейдж в хедере
        const badge = document.getElementById('notification-count');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        // Обновляем бейдж в навигации
        const navBadge = document.getElementById('nav-notification-count');
        if (navBadge) {
            if (unreadCount > 0) {
                navBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                navBadge.style.display = 'flex';
            } else {
                navBadge.style.display = 'none';
            }
        }
    }

    static renderNotifications(notifications) {
        const container = document.getElementById('notifications-list');
        if (!container) return;

        if (!notifications || notifications.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            return;
        }

        // Фильтруем заявки на вступление
        const joinRequests = notifications.filter(n =>
            n.type && (n.type.includes('join') || n.type.includes('request')) ||
            n.title && n.title.toLowerCase().includes('вступление') ||
            n.message && n.message.toLowerCase().includes('хочет присоединиться')
        );

        // Остальные уведомления
        const otherNotifications = notifications.filter(n => !joinRequests.includes(n));

        let html = '';

        // Запросы на вступление
        if (joinRequests.length > 0) {
            html += `
                <div class="notifications-section">
                    <h4 class="section-title">Запросы на вступление</h4>
                    <div class="notifications-list">
                        ${joinRequests.map(notification =>
                            this.renderJoinRequestNotification(notification)
                        ).join('')}
                    </div>
                </div>
            `;
        }

        // Остальные уведомления
        if (otherNotifications.length > 0) {
            html += `
                <div class="notifications-section">
                    <h4 class="section-title">Уведомления</h4>
                    <div class="notifications-list">
                        ${otherNotifications.map(notification =>
                            this.renderSystemNotification(notification)
                        ).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    static renderJoinRequestNotification(notification) {
        const isUnread = !notification.is_read;
        const projectHash = this.extractProjectHashFromNotification(notification);

        return `
            <div class="notification-item join-request ${isUnread ? 'unread' : ''}"
                 data-notification-id="${notification.id}"
                 data-project-hash="${projectHash}">
                <div class="notification-content">
                    <div class="notification-icon">
                        <i class="fas fa-user-plus"></i>
                    </div>
                    <div class="notification-details">
                        <h5 class="notification-title">${Utils.escapeHTML(notification.title)}</h5>
                        <p class="notification-message">${Utils.escapeHTML(notification.message)}</p>
                        <div class="notification-actions">
                            <button class="btn btn-success btn-sm"
                                    onclick="NotificationsManager.approveJoinRequest('${notification.id}', '${projectHash}')">
                                <i class="fas fa-check"></i> Принять
                            </button>
                            <button class="btn btn-danger btn-sm"
                                    onclick="NotificationsManager.rejectJoinRequest('${notification.id}', '${projectHash}')">
                                <i class="fas fa-times"></i> Отклонить
                            </button>
                        </div>
                    </div>
                </div>
                <div class="notification-time">
                    ${Utils.formatDate(notification.created_at)}
                </div>
            </div>
        `;
    }

    static renderTaskNotification(notification) {
        const isUnread = !notification.is_read;

        return `
            <div class="notification-item task-notification ${isUnread ? 'unread' : ''}"
                 data-notification-id="${notification.id}">
                <div class="notification-content">
                    <div class="notification-icon">
                        <i class="fas fa-tasks"></i>
                    </div>
                    <div class="notification-details">
                        <h5 class="notification-title">${Utils.escapeHTML(notification.title)}</h5>
                        <p class="notification-message">${Utils.escapeHTML(notification.message)}</p>
                    </div>
                </div>
                <div class="notification-time">
                    ${Utils.formatDate(notification.created_at)}
                </div>
            </div>
        `;
    }

    static renderSystemNotification(notification) {
        const isUnread = !notification.is_read;

        return `
            <div class="notification-item system-notification ${isUnread ? 'unread' : ''}"
                 data-notification-id="${notification.id}">
                <div class="notification-content">
                    <div class="notification-icon">
                        <i class="fas fa-info-circle"></i>
                    </div>
                    <div class="notification-details">
                        <h5 class="notification-title">${Utils.escapeHTML(notification.title)}</h5>
                        <p class="notification-message">${Utils.escapeHTML(notification.message)}</p>
                    </div>
                </div>
                <div class="notification-time">
                    ${Utils.formatDate(notification.created_at)}
                </div>
            </div>
        `;
    }

    static extractProjectHashFromNotification(notification) {
        // Извлекаем project_hash из данных уведомления
        // В реальном приложении это может быть свойство notification
        if (notification.data && notification.data.project_hash) {
            return notification.data.project_hash;
        }

        // Альтернативный способ извлечения из сообщения или других полей
        const hashMatch = notification.message?.match(/project[_-]hash[:\s]*([a-zA-Z0-9]+)/i);
        return hashMatch ? hashMatch[1] : '';
    }

    static getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-bell-slash"></i>
                </div>
                <h3>Уведомлений нет</h3>
                <p>Новые уведомления появятся здесь</p>
            </div>
        `;
    }

    static showErrorState() {
        const container = document.getElementById('notifications-list');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Ошибка загрузки уведомлений</h3>
                    <button class="btn btn-primary" onclick="NotificationsManager.loadNotifications()">
                        <i class="fas fa-refresh"></i> Попробовать снова
                    </button>
                </div>
            `;
        }
    }

    static async markAllNotificationsRead() {
        try {
            await ApiService.markAllNotificationsRead();

            // Обновляем локальное состояние
            const notifications = StateManager.getState('notifications').map(n => ({
                ...n,
                is_read: true
            }));

            StateManager.setState('notifications', notifications);
            this.updateNotificationBadge(notifications);

            ToastManager.success('Все уведомления отмечены как прочитанные');
            HapticManager.success();

            // Перерисовываем уведомления
            this.renderNotifications(notifications);

        } catch (error) {
            Utils.logError('Error marking notifications as read:', error);
            ToastManager.error('Ошибка обновления уведомлений');
            HapticManager.error();
        }
    }

    static async approveJoinRequest(notificationId, projectHash) {
        try {
            // Находим requestId из данных уведомления
            const requestId = await this.getRequestIdFromNotification(notificationId);

            if (!requestId) {
                throw new Error('Не удалось найти ID запроса');
            }

            await ApiService.approveJoinRequest(projectHash, requestId);

            ToastManager.success('Запрос на вступление одобрен');
            HapticManager.success();

            // Удаляем уведомление из списка
            this.removeNotification(notificationId);

            // Инвалидируем кэш проектов
            CacheManager.invalidate('projects');

        } catch (error) {
            Utils.logError('Error approving join request:', error);
            ToastManager.error('Ошибка одобрения запроса: ' + error.message);
            HapticManager.error();
        }
    }

    static async rejectJoinRequest(notificationId, projectHash) {
        try {
            const requestId = await this.getRequestIdFromNotification(notificationId);

            if (!requestId) {
                throw new Error('Не удалось найти ID запроса');
            }

            await ApiService.rejectJoinRequest(projectHash, requestId);

            ToastManager.success('Запрос на вступление отклонен');
            HapticManager.success();

            // Удаляем уведомление из списка
            this.removeNotification(notificationId);

        } catch (error) {
            Utils.logError('Error rejecting join request:', error);
            ToastManager.error('Ошибка отклонения запроса: ' + error.message);
            HapticManager.error();
        }
    }

    static async getRequestIdFromNotification(notificationId) {
        try {
            // В реальном приложении requestId может быть свойством уведомления
            // или извлекаться из данных уведомления
            const notification = StateManager.getState('notifications')
                .find(n => n.id == notificationId);

            return notification?.data?.request_id || notificationId;
        } catch (error) {
            Utils.logError('Error extracting request ID:', error);
            return notificationId;
        }
    }

    static removeNotification(notificationId) {
        const notifications = StateManager.getState('notifications')
            .filter(n => n.id != notificationId);

        StateManager.setState('notifications', notifications);
        this.updateNotificationBadge(notifications);
        this.renderNotifications(notifications);
    }

    static async markNotificationAsRead(notificationId) {
        try {
            // Обновляем локальное состояние
            const notifications = StateManager.getState('notifications').map(n =>
                n.id == notificationId ? { ...n, is_read: true } : n
            );

            StateManager.setState('notifications', notifications);
            this.updateNotificationBadge(notifications);

            // В реальном приложении здесь был бы API вызов
            // await ApiService.markNotificationRead(notificationId);

            EventManager.emit(APP_EVENTS.NOTIFICATION_READ, notificationId);

        } catch (error) {
            Utils.logError('Error marking notification as read:', error);
        }
    }

    // Обработка кликов по уведомлениям
    static setupNotificationHandlers() {
        document.addEventListener('click', (e) => {
            const notificationItem = e.target.closest('.notification-item');
            if (notificationItem && !e.target.closest('.notification-actions')) {
                const notificationId = notificationItem.getAttribute('data-notification-id');
                const projectHash = notificationItem.getAttribute('data-project-hash');

                // Помечаем как прочитанное
                this.markNotificationAsRead(notificationId);

                // Открываем связанный проект, если есть
                if (projectHash) {
                    ProjectsManager.openProjectDetail(projectHash);
                }

                HapticManager.selection();
            }
        });
    }

    // Периодическая проверка новых уведомлений
    static startPolling() {
        // Проверяем новые уведомления каждые 2 минуты
        setInterval(() => {
            this.checkForNewNotifications();
        }, 2 * 60 * 1000);
    }

    static async checkForNewNotifications() {
        try {
            const oldNotifications = StateManager.getState('notifications');
            const newData = await ApiService.getNotifications();
            const newNotifications = newData.notifications || [];

            // Проверяем, есть ли новые уведомления
            const newUnreadCount = newNotifications.filter(n => !n.is_read).length;
            const oldUnreadCount = oldNotifications.filter(n => !n.is_read).length;

            if (newUnreadCount > oldUnreadCount) {
                // Есть новые уведомления
                StateManager.setState('notifications', newNotifications);
                this.updateNotificationBadge(newNotifications);

                // Показываем уведомление, если приложение активно
                if (document.visibilityState === 'visible') {
                    const newCount = newUnreadCount - oldUnreadCount;
                    ToastManager.info(`У вас ${newCount} новых уведомлений`);
                    HapticManager.notificationReceived();
                }
            }

        } catch (error) {
            Utils.logError('Error checking for new notifications:', error);
        }
    }

    // Инициализация менеджера уведомлений
    static init() {
        this.setupNotificationHandlers();
        this.startPolling();

        Utils.log('Notifications manager initialized');
    }
}

// Автоматическая инициализация
NotificationsManager.init();

window.NotificationsManager = NotificationsManager;
