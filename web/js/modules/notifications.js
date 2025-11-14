// Notification and toast manager
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.pollingInterval = null;
        this.toastContainer = null;
    }

    async init() {
        console.log('Notification manager initialized');
        this.createToastContainer();

        // Не загружаем уведомления сразу, если пользователь не авторизован
        if (window.App?.modules?.auth?.isAuthenticated) {
            await this.loadNotifications();
        }

        return Promise.resolve();
    }

    // Toast notifications
    createToastContainer() {
        try {
            this.toastContainer = document.getElementById('toastContainer');
            if (!this.toastContainer) {
                this.toastContainer = Utils.createElement('div', 'toast-container');
                document.body.appendChild(this.toastContainer);
            }
        } catch (error) {
            console.error('Error creating toast container:', error);
            // Fallback - создаем простой контейнер
            this.toastContainer = document.createElement('div');
            this.toastContainer.className = 'toast-container';
            this.toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000;';
            document.body.appendChild(this.toastContainer);
        }
    }

    showToast(message, type = 'info', duration = 5000) {
        try {
            if (!this.toastContainer) {
                this.createToastContainer();
            }

            const toast = Utils.createElement('div', `toast ${type}`);

            const icon = this.getToastIcon(type);
            toast.innerHTML = `
                <div class="toast-icon">${icon}</div>
                <div class="toast-content">${Utils.escapeHtml(message)}</div>
                <button class="toast-close" onclick="this.parentElement.remove()">×</button>
            `;

            this.toastContainer.appendChild(toast);

            // Add enter animation
            setTimeout(() => toast.classList.add('show'), 10);

            // Auto remove after duration
            if (duration > 0) {
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => {
                        if (toast.parentElement === this.toastContainer) {
                            this.toastContainer.removeChild(toast);
                        }
                    }, 300);
                }, duration);
            }

            return toast;
        } catch (error) {
            console.error('Error showing toast:', error);
            // Fallback
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    // System notifications
    async loadNotifications() {
        // Проверяем авторизацию перед загрузкой уведомлений
        if (!window.App?.modules?.auth?.isAuthenticated) {
            console.log('Skipping notifications load - user not authenticated');
            return;
        }

        try {
            const api = window.App?.modules?.api;
            if (!api) return;

            const response = await api.getNotifications();
            this.notifications = response.notifications || [];
            this.updateUnreadCount();
            this.updateNotificationBadge();
        } catch (error) {
            console.error('Error loading notifications:', error);
            // Не показываем ошибку для неавторизованных пользователей
            if (!error.message.includes('Authentication required') &&
                !error.message.includes('401')) {
                Utils.showToast('Ошибка загрузки уведомлений', 'error');
            }
        }
    }

    updateUnreadCount() {
        this.unreadCount = this.notifications.filter(n => !n.read).length;
    }

    updateNotificationBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount.toString();
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    async markAsRead(notificationId) {
        try {
            const api = window.App?.modules?.api;
            if (!api) return;

            // Update locally first for immediate feedback
            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
                this.updateUnreadCount();
                this.updateNotificationBadge();
            }

            // Then update on server
            await api.markNotificationAsRead(notificationId);
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async markAllAsRead() {
        try {
            const api = window.App?.modules?.api;
            if (!api) return;

            // Update locally first
            this.notifications.forEach(n => n.read = true);
            this.updateUnreadCount();
            this.updateNotificationBadge();

            // Then update on server
            await api.markAllNotificationsRead();
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    // Polling for new notifications
    startPolling() {
        this.pollingInterval = setInterval(async () => {
            if (document.visibilityState === 'visible') {
                await this.checkForNewNotifications();
            }
        }, 30000); // Check every 30 seconds
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    async checkForNewNotifications() {
        try {
            const api = window.App?.modules?.api;
            if (!api) return;

            const response = await api.getNotifications();
            const newNotifications = response.notifications || [];

            // Check if there are new unread notifications
            const newUnreadCount = newNotifications.filter(n => !n.read).length;
            if (newUnreadCount > this.unreadCount) {
                this.showNewNotificationAlert(newUnreadCount - this.unreadCount);
            }

            this.notifications = newNotifications;
            this.updateUnreadCount();
            this.updateNotificationBadge();
        } catch (error) {
            console.error('Error checking for new notifications:', error);
        }
    }

    showNewNotificationAlert(count) {
        if (count > 0) {
            this.showToast(`У вас ${count} нов${count === 1 ? 'ое' : 'ых'} уведомлени${count === 1 ? 'е' : 'я'}`, 'info', 3000);
        }
    }

    // Notification display
    showNotificationsModal() {
        const modalManager = window.App?.components?.modals;
        if (modalManager && modalManager.showModal) {
            // Создаем простой модал для уведомлений
            modalManager.showModal('notifications', {
                title: 'Уведомления',
                message: 'Функция уведомлений в разработке',
                type: 'info'
            });
        } else {
            // Fallback
            this.showToast('Функция уведомлений в разработке', 'info');
        }
    }

    // Push notifications (if supported)
    requestPushPermission() {
        if ('Notification' in window && 'serviceWorker' in navigator) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.setupPushNotifications();
                }
            });
        }
    }

    setupPushNotifications() {
        // Implement push notification setup
        // This would typically involve registering a service worker
        // and subscribing to push notifications
        console.log('Push notifications setup');
    }

    // Sound notifications
    playNotificationSound() {
        // Implement sound notification
        // You could use the Web Audio API or play a sound file
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.error('Error playing notification sound:', error);
        }
    }

    // Vibration (if supported)
    vibrate(pattern = [100, 50, 100]) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }

    // Task reminders
    scheduleTaskReminder(task, minutesBefore = 60) {
        if (!('Notification' in window)) return;

        const dueDate = new Date(task.due_date);
        const reminderTime = new Date(dueDate.getTime() - minutesBefore * 60000);
        const now = new Date();

        if (reminderTime > now) {
            const timeout = reminderTime.getTime() - now.getTime();

            setTimeout(() => {
                this.showTaskReminder(task);
            }, timeout);
        }
    }

    showTaskReminder(task) {
        if (Notification.permission === 'granted') {
            new Notification(`Напоминание о задаче: ${task.title}`, {
                body: `Срок выполнения: ${Utils.formatDateTime(task.due_date)}`,
                icon: '/assets/icons/icon-192x192.png',
                tag: `task-reminder-${task.id}`
            });
        } else {
            this.showToast(`Напоминание: "${task.title}" скоро истекает`, 'warning');
        }
    }

    // Cleanup
    destroy() {
        this.stopPolling();
    }
}
