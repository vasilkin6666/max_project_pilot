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

  // ОБНОВЛЕННЫЙ МЕТОД renderNotifications
  static renderNotifications(notifications) {
      const container = document.getElementById('notifications-list');
      if (!container) return;

      if (!notifications || notifications.length === 0) {
          container.innerHTML = this.getEmptyStateHTML();
          return;
      }

      // Получаем проекты, где пользователь имеет права администратора/владельца
      const projects = StateManager.getState('projects') || [];
      const userProjectsWithAccess = projects.filter(project => {
          const role = project.current_user_role || project.user_role;
          return ['owner', 'admin'].includes(role);
      });

      let html = '';

      // Уведомления о заявках на вступление (только для проектов с правами)
      if (userProjectsWithAccess.length > 0) {
          const joinRequestNotifications = notifications.filter(n =>
              n.type === 'join_request' ||
              (n.title && n.title.includes('вступление')) ||
              (n.message && n.message.includes('хочет присоединиться')) ||
              (n.message && n.message.includes('join request'))
          );

          if (joinRequestNotifications.length > 0) {
              html += `
                  <div class="notifications-section">
                      <h4 class="section-title">Заявки на вступление в проекты</h4>
                      <div class="notifications-list">
                          ${joinRequestNotifications.map(notification =>
                              this.renderJoinRequestNotification(notification)
                          ).join('')}
                      </div>
                  </div>
              `;
          }
      }

      // Остальные уведомления
      const otherNotifications = notifications.filter(n => {
          const isJoinRequest = n.type === 'join_request' ||
                              (n.title && n.title.includes('вступление')) ||
                              (n.message && n.message.includes('хочет присоединиться')) ||
                              (n.message && n.message.includes('join request'));
          return !isJoinRequest;
      });

      if (otherNotifications.length > 0) {
          html += `
              <div class="notifications-section">
                  <h4 class="section-title">Системные уведомления</h4>
                  <div class="notifications-list">
                      ${otherNotifications.map(notification =>
                          this.renderSystemNotification(notification)
                      ).join('')}
                  </div>
              </div>
          `;
      }

      container.innerHTML = html || this.getEmptyStateHTML();
  }

  // УЛУЧШЕННЫЙ МЕТОД ДЛЯ ЗАЯВОК НА ВСТУПЛЕНИЕ
  static renderJoinRequestNotification(notification) {
      const isUnread = !notification.is_read;

      // Извлекаем информацию о проекте из уведомления
      const projectHash = this.extractProjectHashFromNotification(notification);

      // Извлекаем информацию о пользователе
      const userName = notification.data?.user_name ||
                      notification.data?.user?.full_name ||
                      'Пользователь';

      const projectName = notification.data?.project_name ||
                         notification.data?.project?.title ||
                         'Проект';

      // Извлекаем requestId
      const requestId = notification.data?.request_id ||
                       notification.id;

      return `
          <div class="notification-item join-request ${isUnread ? 'unread' : ''}"
               data-notification-id="${notification.id}"
               data-project-hash="${projectHash}">
              <div class="notification-content">
                  <div class="notification-icon">
                      <i class="fas fa-user-plus"></i>
                  </div>
                  <div class="notification-details">
                      <h5 class="notification-title">Запрос на вступление</h5>
                      <p class="notification-message">
                          ${Utils.escapeHTML(userName)} хочет присоединиться к проекту "${Utils.escapeHTML(projectName)}"
                      </p>
                      <div class="notification-actions">
                          <button class="btn btn-success btn-sm"
                                  onclick="JoinRequestsManager.approveJoinRequest('${projectHash}', ${requestId})">
                              <i class="fas fa-check"></i> Принять
                          </button>
                          <button class="btn btn-danger btn-sm"
                                  onclick="JoinRequestsManager.rejectJoinRequest('${projectHash}', ${requestId})">
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

  // УЛУЧШЕННЫЙ МЕТОД ИЗВЛЕЧЕНИЯ PROJECT_HASH
  static extractProjectHashFromNotification(notification) {
      // Пробуем разные способы извлечения project_hash
      if (notification.data && notification.data.project_hash) {
          return notification.data.project_hash;
      }

      if (notification.project_hash) {
          return notification.project_hash;
      }

      if (notification.data && notification.data.project) {
          return notification.data.project.hash || notification.data.project.project_hash;
      }

      // Ищем в сообщении
      const hashMatch = notification.message?.match(/project[_-]hash[:\s]*([a-zA-Z0-9]+)/i);
      if (hashMatch) {
          return hashMatch[1];
      }

      // Ищем в дополнительных данных
      if (notification.extra_data) {
          try {
              const extraData = typeof notification.extra_data === 'string'
                  ? JSON.parse(notification.extra_data)
                  : notification.extra_data;
              return extraData.project_hash || extraData.projectHash || '';
          } catch (e) {
              return '';
          }
      }

      return '';
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
