// Modal manager component
class ModalManager {
    constructor() {
        this.modals = new Map();
        this.activeModals = [];
    }

    async init() {
        console.log('Modal manager initialized');
        this.createBaseModals();
        this.setupEventListeners();
        return Promise.resolve();
    }

    // Base modal creation
    createBaseModals() {
        this.createModal('confirm', this.createConfirmModal());
        this.createModal('loading', this.createLoadingModal());
        this.createModal('alert', this.createAlertModal());
        this.createModal('notifications', this.createNotificationsModal());
    }

    createNotificationsModal() {
        return `
            <div class="modal-header">
                <h3 class="modal-title">Уведомления</h3>
                <button class="modal-close" onclick="App.components.modals.hideModal('notifications')">×</button>
            </div>
            <div class="modal-body">
                <div class="empty-state">
                    <div class="empty-state-icon">🔔</div>
                    <h3 class="empty-state-title">Уведомления</h3>
                    <p class="empty-state-description">Функция уведомлений находится в разработке</p>
                    <button class="btn btn-primary" onclick="App.components.modals.hideModal('notifications')">
                        Понятно
                    </button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Close modal on overlay click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.hideModal(e.target.id.replace('Modal', ''));
            }
        });

        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModals.length > 0) {
                this.hideModal(this.activeModals[this.activeModals.length - 1]);
            }
        });
    }

    // Modal creation and management
    createModal(name, content, options = {}) {
        const modalId = `${name}Modal`;
        const modalHtml = `
            <div id="${modalId}" class="modal-overlay">
                <div class="modal ${options.size || ''}">
                    ${content}
                </div>
            </div>
        `;

        // Add to modals container
        const modalsContainer = document.getElementById('modalsContainer');
        if (modalsContainer) {
            modalsContainer.innerHTML += modalHtml;
        } else {
            document.body.innerHTML += modalHtml;
        }

        this.modals.set(name, {
            id: modalId,
            element: document.getElementById(modalId),
            options
        });
    }

    showModal(name, data = {}) {
        const modal = this.modals.get(name);
        if (!modal) {
            console.error(`Modal "${name}" not found`);
            return;
        }

        // Update modal content if needed
        this.updateModalContent(name, data);

        // Show modal
        modal.element.classList.add('active');
        this.activeModals.push(name);

        // Focus trap
        this.setupFocusTrap(modal.element);

        // Trigger show event
        this.triggerModalEvent(name, 'show', data);
    }

    hideModal(name) {
        const modal = this.modals.get(name);
        if (!modal) return;

        // Hide modal
        modal.element.classList.remove('active');
        this.activeModals = this.activeModals.filter(m => m !== name);

        // Trigger hide event
        this.triggerModalEvent(name, 'hide');
    }

    hideAllModals() {
        this.activeModals.forEach(name => this.hideModal(name));
    }

    updateModalContent(name, data) {
        const modal = this.modals.get(name);
        if (!modal) return;

        // Custom update logic per modal type
        switch (name) {
            case 'confirm':
                this.updateConfirmModal(modal.element, data);
                break;
            case 'loading':
                this.updateLoadingModal(modal.element, data);
                break;
            case 'alert':
                this.updateAlertModal(modal.element, data);
                break;
        }
    }

    // Focus management
    setupFocusTrap(modalElement) {
        const focusableElements = modalElement.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        modalElement.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        });

        // Focus first element
        setTimeout(() => firstElement.focus(), 100);
    }

    // Event system
    onModalEvent(name, event, callback) {
        const modal = this.modals.get(name);
        if (modal) {
            modal.element.addEventListener(`modal.${event}`, callback);
        }
    }

    triggerModalEvent(name, event, data = {}) {
        const modal = this.modals.get(name);
        if (modal) {
            const customEvent = new CustomEvent(`modal.${event}`, {
                detail: data
            });
            modal.element.dispatchEvent(customEvent);
        }
    }

    // Specific modal creators
    createConfirmModal() {
        return `
            <div class="modal-header">
                <h3 class="modal-title" id="confirmModalTitle">Подтверждение</h3>
                <button class="modal-close" onclick="App.components.modals.hideModal('confirm')">×</button>
            </div>
            <div class="modal-body">
                <div class="confirmation-icon">⚠️</div>
                <h4 class="confirmation-title" id="confirmModalMessage">Вы уверены?</h4>
                <p class="confirmation-message" id="confirmModalDescription">Это действие нельзя отменить.</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.components.modals.hideModal('confirm')">Отмена</button>
                <button class="btn btn-danger" id="confirmModalConfirm">Подтвердить</button>
            </div>
        `;
    }

    createLoadingModal() {
        return `
            <div class="modal-body">
                <div class="loading-spinner"></div>
                <h4 class="confirmation-title" id="loadingModalTitle">Загрузка...</h4>
                <p class="confirmation-message" id="loadingModalMessage">Пожалуйста, подождите</p>
            </div>
        `;
    }

    createAlertModal() {
        return `
            <div class="modal-header">
                <h3 class="modal-title" id="alertModalTitle">Уведомление</h3>
                <button class="modal-close" onclick="App.components.modals.hideModal('alert')">×</button>
            </div>
            <div class="modal-body">
                <div class="confirmation-icon" id="alertModalIcon">ℹ️</div>
                <p class="confirmation-message" id="alertModalMessage">Сообщение</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="App.components.modals.hideModal('alert')">OK</button>
            </div>
        `;
    }

    // Modal content updaters
    updateConfirmModal(modalElement, data) {
        const {
            title = 'Подтверждение',
            message = 'Вы уверены?',
            description = 'Это действие нельзя отменить.',
            confirmText = 'Подтвердить',
            onConfirm = () => {},
            type = 'warning'
        } = data;

        modalElement.querySelector('#confirmModalTitle').textContent = title;
        modalElement.querySelector('#confirmModalMessage').textContent = message;
        modalElement.querySelector('#confirmModalDescription').textContent = description;

        const confirmBtn = modalElement.querySelector('#confirmModalConfirm');
        confirmBtn.textContent = confirmText;

        // Update button style based on type
        confirmBtn.className = `btn btn-${type}`;

        // Update event listener
        confirmBtn.onclick = () => {
            onConfirm();
            this.hideModal('confirm');
        };

        // Update icon based on type
        const icon = modalElement.querySelector('.confirmation-icon');
        const icons = {
            warning: '⚠️',
            danger: '❌',
            success: '✅',
            info: 'ℹ️'
        };
        icon.textContent = icons[type] || icons.warning;
    }

    updateLoadingModal(modalElement, data) {
        const {
            title = 'Загрузка...',
            message = 'Пожалуйста, подождите'
        } = data;

        modalElement.querySelector('#loadingModalTitle').textContent = title;
        modalElement.querySelector('#loadingModalMessage').textContent = message;
    }

    updateAlertModal(modalElement, data) {
        const {
            title = 'Уведомление',
            message = 'Сообщение',
            type = 'info'
        } = data;

        modalElement.querySelector('#alertModalTitle').textContent = title;
        modalElement.querySelector('#alertModalMessage').textContent = message;

        // Update icon based on type
        const icon = modalElement.querySelector('#alertModalIcon');
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        icon.textContent = icons[type] || icons.info;
    }

    // Public API methods
    confirm(options) {
        return new Promise((resolve) => {
            const enhancedOptions = {
                ...options,
                onConfirm: () => resolve(true)
            };

            this.showModal('confirm', enhancedOptions);

            // Also handle cancel
            this.onModalEvent('confirm', 'hide', () => resolve(false));
        });
    }

    alert(options) {
        this.showModal('alert', options);
    }

    showLoading(options = {}) {
        this.showModal('loading', options);
    }

    hideLoading() {
        this.hideModal('loading');
    }

    // Project-related modals
    showCreateProjectModal() {
        this.createModalIfNotExists('createProject', this.createProjectModal('create'));
        this.showModal('createProject');
    }

    showEditProjectModal(projectHash) {
        this.createModalIfNotExists('editProject', this.createProjectModal('edit'));
        // Load project data and show modal
        this.loadProjectData(projectHash).then(project => {
            this.showModal('editProject', { project });
        });
    }

    showDeleteProjectModal(projectHash) {
        this.confirm({
            title: 'Удалить проект',
            message: `Удалить проект "${projectHash}"?`,
            description: 'Все задачи и данные проекта будут удалены. Это действие нельзя отменить.',
            confirmText: 'Удалить',
            type: 'danger',
            onConfirm: () => this.deleteProject(projectHash)
        });
    }

    // Task-related modals
    showCreateTaskModal(projectHash, parentTaskId = null) {
        this.createModalIfNotExists('createTask', this.createTaskModal('create'));
        this.loadTaskModalData(projectHash, parentTaskId).then(data => {
            this.showModal('createTask', data);
        });
    }

    showEditTaskModal(taskId) {
        this.createModalIfNotExists('editTask', this.createTaskModal('edit'));
        this.loadTaskData(taskId).then(task => {
            this.showModal('editTask', { task });
        });
    }

    // Utility methods
    createModalIfNotExists(name, content) {
        if (!this.modals.has(name)) {
            this.createModal(name, content);
        }
    }

    async loadProjectData(projectHash) {
        const api = window.App?.modules?.api;
        if (!api) return null;

        try {
            return await api.getProject(projectHash);
        } catch (error) {
            console.error('Error loading project data:', error);
            return null;
        }
    }

    async loadTaskData(taskId) {
        const api = window.App?.modules?.api;
        if (!api) return null;

        try {
            return await api.getTask(taskId);
        } catch (error) {
            console.error('Error loading task data:', error);
            return null;
        }
    }

    async loadTaskModalData(projectHash, parentTaskId) {
        const api = window.App?.modules?.api;
        if (!api) return {};

        try {
            const [members, tasks] = await Promise.all([
                api.getProjectMembers(projectHash),
                api.getTasks(projectHash)
            ]);

            return {
                projectHash,
                parentTaskId,
                members: members.members || [],
                tasks: tasks.tasks || []
            };
        } catch (error) {
            console.error('Error loading task modal data:', error);
            return {};
        }
    }

    // Action handlers
    async deleteProject(projectHash) {
        const api = window.App?.modules?.api;
        if (!api) return;

        try {
            await api.deleteProject(projectHash);
            Utils.showToast('Проект удален', 'success');
            window.App?.showDashboard();
        } catch (error) {
            console.error('Error deleting project:', error);
            Utils.showToast('Ошибка удаления проекта', 'error');
        }
    }

    // Complex modal creators (simplified versions)
    createProjectModal(mode) {
        const isEdit = mode === 'edit';
        const title = isEdit ? 'Редактировать проект' : 'Создать проект';

        return `
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="modal-close" onclick="App.components.modals.hideModal('${mode}Project')">×</button>
            </div>
            <div class="modal-body">
                <form id="${mode}ProjectForm">
                    <div class="form-group">
                        <label class="form-label">Название проекта *</label>
                        <input type="text" class="form-control" id="${mode}ProjectTitle" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Описание</label>
                        <textarea class="form-control" id="${mode}ProjectDescription" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-check">
                            <input type="checkbox" class="form-check-input" id="${mode}ProjectIsPrivate" ${isEdit ? '' : 'checked'}>
                            <span class="form-check-label">Приватный проект</span>
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-check">
                            <input type="checkbox" class="form-check-input" id="${mode}ProjectRequiresApproval">
                            <span class="form-check-label">Требуется одобрение для вступления</span>
                        </label>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.components.modals.hideModal('${mode}Project')">Отмена</button>
                <button class="btn btn-primary" onclick="App.components.modals.handle${isEdit ? 'Update' : 'Create'}Project()">
                    ${isEdit ? 'Сохранить' : 'Создать'}
                </button>
            </div>
        `;
    }

    createTaskModal(mode) {
        const isEdit = mode === 'edit';
        const title = isEdit ? 'Редактировать задачу' : 'Создать задачу';

        return `
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="modal-close" onclick="App.components.modals.hideModal('${mode}Task')">×</button>
            </div>
            <div class="modal-body scrollable">
                <form id="${mode}TaskForm">
                    <div class="form-group">
                        <label class="form-label">Название задачи *</label>
                        <input type="text" class="form-control" id="${mode}TaskTitle" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Описание</label>
                        <textarea class="form-control" id="${mode}TaskDescription" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Приоритет</label>
                        <select class="form-control form-select" id="${mode}TaskPriority">
                            <option value="low">Низкий</option>
                            <option value="medium" selected>Средний</option>
                            <option value="high">Высокий</option>
                            <option value="urgent">Срочный</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Срок выполнения</label>
                        <input type="date" class="form-control" id="${mode}TaskDueDate">
                    </div>
                    ${!isEdit ? `
                    <div class="form-group">
                        <label class="form-label">Родительская задача</label>
                        <select class="form-control form-select" id="${mode}TaskParentId">
                            <option value="">Основная задача (без родителя)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Исполнитель</label>
                        <select class="form-control form-select" id="${mode}TaskAssignedTo">
                            <option value="">Не назначена</option>
                        </select>
                    </div>
                    ` : ''}
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="App.components.modals.hideModal('${mode}Task')">Отмена</button>
                <button class="btn btn-primary" onclick="App.components.modals.handle${isEdit ? 'Update' : 'Create'}Task()">
                    ${isEdit ? 'Сохранить' : 'Создать'}
                </button>
            </div>
        `;
    }

    // Action handlers for forms
    async handleCreateProject() {
        const form = document.getElementById('createProjectForm');
        if (!form) return;

        const title = document.getElementById('createProjectTitle').value.trim();
        const description = document.getElementById('createProjectDescription').value.trim();
        const isPrivate = document.getElementById('createProjectIsPrivate').checked;
        const requiresApproval = document.getElementById('createProjectRequiresApproval').checked;

        if (!title) {
            Utils.showToast('Введите название проекта', 'error');
            return;
        }

        const api = window.App?.modules?.api;
        if (!api) return;

        try {
            await api.createProject({
                title,
                description,
                is_private: isPrivate,
                requires_approval: requiresApproval
            });

            this.hideModal('createProject');
            form.reset();
            Utils.showToast('Проект создан', 'success');

            // Исправляем вызов метода
            if (window.App?.loadDashboardData) {
                window.App.loadDashboardData();
            } else if (window.App?.loadInitialData) {
                window.App.loadInitialData();
            }

        } catch (error) {
            console.error('Error creating project:', error);
            Utils.showToast('Ошибка создания проекта', 'error');
        }
    }
    async handleCreateTask() {
        // Similar implementation for task creation
        // This would handle the create task form submission
    }

    // Cleanup
    destroy() {
        this.hideAllModals();
        this.modals.clear();
        this.activeModals = [];
    }
}
