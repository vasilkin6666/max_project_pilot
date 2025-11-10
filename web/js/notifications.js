class NotificationsManager {
    static async loadNotifications() {
        Utils.log('Loading notifications from API');

        try {
            const data = await ApiService.apiGetNotifications();
            const notifications = data.notifications || [];
            this.renderNotifications(notifications);
            this.updateNotificationsSummary(notifications);

            // Обновляем счетчики
            CountersManager.updateCounters();

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
        const targetId = notification.linked_item_id || notification.target_element_id;

        return `
            <div class="notification-item max-card mb-3 slide-in ${unreadClass}"
                 data-notification-id="${notification.id}"
                 ${targetId ? `data-target-id="${targetId}"` : ''}>
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0">${unreadIcon} ${Utils.escapeHTML(notification.title)}</h6>
                    <div class="d-flex align-items-center gap-2">
                        <small class="text-muted">${Utils.formatDate(notification.created_at)}</small>
                        <button class="btn btn-sm btn-outline-secondary notification-close"
                                onclick="NotificationsManager.closeNotification('${notification.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
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
        const persistentBadge = document.getElementById('persistent-notification-badge');
        const persistentCount = document.getElementById('persistent-notification-count');

        // Обновляем бейдж в навигации
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }

        // Обновляем персистентный бейдж
        if (count > 0) {
            persistentCount.textContent = count > 99 ? '99+' : count;
            persistentBadge.style.display = 'flex';
        } else {
            persistentBadge.style.display = 'none';
        }
    }

    static async markAllNotificationsRead() {
        try {
            Utils.provideHapticFeedback('medium');
            await ApiService.apiMarkAllNotificationsRead();
            ToastManager.showToast('Все уведомления отмечены как прочитанные', 'success');

            // Обновляем интерфейс
            await this.loadNotifications();

            // Триггерим событие обновления
            Utils.triggerEvent('notificationUpdated');
        } catch (error) {
            Utils.logError('Error marking notifications as read', error);
            ToastManager.showToast('Ошибка обновления уведомлений', 'error');
        }
    }

    static closeNotification(notificationId) {
        const notificationElement = document.querySelector(`[data-notification-id="${notificationId}"]`);
        if (notificationElement) {
            notificationElement.classList.add('fade-out');

            setTimeout(() => {
                notificationElement.remove();
                this.updateNotificationsCount();

                // Триггерим событие обновления
                Utils.triggerEvent('notificationUpdated');
            }, 350);
        }
    }

    static updateNotificationsCount() {
        const notifications = document.querySelectorAll('.notification-item');
        const unreadCount = Array.from(notifications).filter(n =>
            !n.classList.contains('fw-bold')
        ).length;

        this.updateNotificationsBadge(unreadCount);
    }

    static initNotificationHandlers() {
        document.addEventListener('click', (e) => {
            const notificationItem = e.target.closest('.notification-item');
            if (notificationItem && !e.target.classList.contains('notification-close')) {
                const targetId = notificationItem.getAttribute('data-target-id');
                if (targetId) {
                    this.navigateToTarget(targetId, notificationItem);
                }
            }
        });
    }

    static navigateToTarget(targetId, notificationElement) {
        // Закрываем уведомление
        this.closeNotification(
            notificationElement.getAttribute('data-notification-id')
        );

        // Ищем целевой элемент
        let targetElement = document.getElementById(targetId);
        if (!targetElement) {
            // Пробуем найти по data-id
            targetElement = document.querySelector(`[data-id="${targetId}"]`);
        }

        if (targetElement) {
            // Плавный скролл к элементу
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            // Подсветка элемента
            this.highlightElement(targetElement);
        } else {
            ToastManager.showToast('Связанный элемент не найден', 'warning');
        }
    }

    static highlightElement(element) {
        // Сохраняем оригинальные стили
        const originalTransition = element.style.transition;
        const originalBoxShadow = element.style.boxShadow;

        // Добавляем класс подсветки
        element.classList.add('highlight-element');

        // Убираем подсветку через 3 секунды
        setTimeout(() => {
            element.classList.remove('highlight-element');

            // Восстанавливаем оригинальные стили
            setTimeout(() => {
                element.style.transition = originalTransition;
                element.style.boxShadow = originalBoxShadow;
            }, 1500);
        }, 3000);
    }

    static initPersistentBadge() {
        const persistentBadge = document.getElementById('persistent-notification-badge');
        if (persistentBadge) {
            persistentBadge.addEventListener('click', () => {
                UI.showSection('notifications');
            });
        }
    }
}

window.NotificationsManager = NotificationsManager;
