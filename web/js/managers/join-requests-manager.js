// Менеджер заявок на вступление
class JoinRequestsManager {
    static async getJoinRequests(projectHash) {
        try {
            const response = await ApiService.getJoinRequests(projectHash);
            return response.requests || response.join_requests || [];
        } catch (error) {
            Utils.logError('Error loading join requests:', error);

            // Если ошибка 404, значит заявок нет
            if (error.status === 404) {
                return [];
            }

            ToastManager.error('Ошибка загрузки заявок');
            return [];
        }
    }

    static async approveJoinRequest(projectHash, requestId) {
        try {
            await ApiService.approveJoinRequest(projectHash, requestId);
            ToastManager.success('Заявка одобрена');
            HapticManager.success();

            // Обновляем список уведомлений
            if (typeof NotificationsManager !== 'undefined') {
                await NotificationsManager.loadNotifications();
            }

            return true;
        } catch (error) {
            Utils.logError('Error approving join request:', error);
            ToastManager.error('Ошибка одобрения заявки: ' + error.message);
            HapticManager.error();
            return false;
        }
    }

    static async rejectJoinRequest(projectHash, requestId) {
        try {
            await ApiService.rejectJoinRequest(projectHash, requestId);
            ToastManager.success('Заявка отклонена');
            HapticManager.success();

            // Обновляем список уведомлений
            if (typeof NotificationsManager !== 'undefined') {
                await NotificationsManager.loadNotifications();
            }

            return true;
        } catch (error) {
            Utils.logError('Error rejecting join request:', error);
            ToastManager.error('Ошибка отклонения заявки: ' + error.message);
            HapticManager.error();
            return false;
        }
    }

    static showJoinRequestsModal(projectHash) {
        ModalManager.showModal('join-requests', {
            title: 'Заявки на вступление',
            size: 'medium',
            template: `
                <div class="join-requests-modal">
                    <div id="join-requests-list">
                        <div class="loading-state">
                            <div class="spinner"></div>
                            <p>Загрузка заявок...</p>
                        </div>
                    </div>
                </div>
            `,
            actions: [
                {
                    text: 'Закрыть',
                    type: 'secondary',
                    action: 'close'
                }
            ],
            onShow: () => {
                this.loadAndRenderJoinRequests(projectHash);
            }
        });
    }

    static async loadAndRenderJoinRequests(projectHash) {
        const container = document.getElementById('join-requests-list');
        if (!container) return;

        try {
            const joinRequests = await this.getJoinRequests(projectHash);

            if (joinRequests.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">
                            <i class="fas fa-user-check"></i>
                        </div>
                        <h3>Заявок на вступление нет</h3>
                        <p>Новые заявки появятся здесь</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="join-requests-list">
                    ${joinRequests.map(request => `
                        <div class="join-request-item" data-request-id="${request.id}">
                            <div class="request-user-info">
                                <div class="user-avatar">
                                    ${Utils.getInitials(request.user?.full_name || 'Пользователь')}
                                </div>
                                <div class="user-details">
                                    <h5>${Utils.escapeHTML(request.user?.full_name || 'Пользователь')}</h5>
                                    <p class="user-max-id">MAX ID: ${request.user?.max_id || 'неизвестен'}</p>
                                    <p class="request-date">${Utils.formatDate(request.created_at)}</p>
                                </div>
                            </div>
                            <div class="request-actions">
                                <button class="btn btn-success btn-sm"
                                        onclick="JoinRequestsManager.approveJoinRequest('${projectHash}', ${request.id})">
                                    <i class="fas fa-check"></i> Принять
                                </button>
                                <button class="btn btn-danger btn-sm"
                                        onclick="JoinRequestsManager.rejectJoinRequest('${projectHash}', ${request.id})">
                                    <i class="fas fa-times"></i> Отклонить
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

        } catch (error) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Ошибка загрузки заявок</h3>
                    <p>${Utils.escapeHTML(error.message)}</p>
                    <button class="btn btn-primary" onclick="JoinRequestsManager.loadAndRenderJoinRequests('${projectHash}')">
                        <i class="fas fa-refresh"></i> Попробовать снова
                    </button>
                </div>
            `;
        }
    }
}

window.JoinRequestsManager = JoinRequestsManager;
