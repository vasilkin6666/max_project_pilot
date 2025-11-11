// Менеджер модальных окон
class ModalManager {
    static currentModal = null;
    static modalStack = [];
    static currentContextMenu = null;

    static showModal(modalId, options = {}) {
        if (this.currentModal) {
            this.closeCurrentModal();
        }

        const {
            title = '',
            template = '',
            size = 'medium',
            actions = [],
            onClose = null,
            onSubmit = null,
            closeOnBackdrop = true,
            closeOnEscape = true
        } = options;

        const modalHTML = this.createModalHTML(modalId, title, template, actions, size);
        const existingModal = document.getElementById(modalId);
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modalElement = document.getElementById(modalId);
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: closeOnBackdrop ? true : 'static',
            keyboard: closeOnEscape
        });

        this.currentModal = { id: modalId, element: modalElement, instance: modal, options };
        this.modalStack.push(this.currentModal);

        this.setupModalActions(modalId, actions, onSubmit);

        modal.show();

        modalElement.addEventListener('shown.bs.modal', () => {
            EventManager.emit(APP_EVENTS.MODAL_OPENED, modalId);
            const firstInput = modalElement.querySelector('input, textarea, select');
            if (firstInput) firstInput.focus();
        });

        modalElement.addEventListener('hidden.bs.modal', () => {
            EventManager.emit(APP_EVENTS.MODAL_CLOSED, modalId);
            if (onClose) onClose();
            this.cleanupModal(modalId);
        });

        return modal;
    }

    static createModalHTML(modalId, title, template, actions, size) {
        const sizeClass = `modal-${size}`;
        const actionsHTML = this.createActionsHTML(actions);

        return `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog ${sizeClass}">
                    <div class="modal-content">
                        ${title ? `
                            <div class="modal-header">
                                <h5 class="modal-title">${Utils.escapeHTML(title)}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                        ` : ''}
                        <div class="modal-body">
                            ${template}
                        </div>
                        ${actionsHTML ? `
                            <div class="modal-footer">
                                ${actionsHTML}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    static createActionsHTML(actions) {
        if (!actions || actions.length === 0) return '';

        return actions.map(action => {
            const {
                text = '',
                type = 'secondary',
                action: actionType = 'close',
                disabled = false,
                loading = false
            } = action;

            const buttonClass = `btn btn-${type} ${loading ? 'btn-loading' : ''}`;
            const disabledAttr = disabled ? 'disabled' : '';
            const loadingHTML = loading ? '<span class="spinner-border spinner-border-sm"></span>' : '';

            let onClick = '';
            switch (actionType) {
                case 'submit':
                    onClick = 'onclick="ModalManager.handleSubmit(this)"';
                    break;
                case 'close':
                    onClick = 'data-bs-dismiss="modal"';
                    break;
                case 'custom':
                    onClick = `onclick="${action.onClick}"`;
                    break;
                default:
                    onClick = 'data-bs-dismiss="modal"';
            }

            return `
                <button type="button" class="${buttonClass}" ${onClick} ${disabledAttr}>
                    ${loadingHTML}
                    ${Utils.escapeHTML(text)}
                </button>
            `;
        }).join('');
    }

    static setupModalActions(modalId, actions, onSubmit) {
        const modalElement = document.getElementById(modalId);
        if (!modalElement) return;

        const form = modalElement.querySelector('form');
        if (form && onSubmit) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                try {
                    await onSubmit(data, form);
                } catch (error) {
                    Utils.logError('Modal form submission error:', error);
                    ToastManager.error('Ошибка при отправке формы');
                }
            });
        }

        actions.forEach((action, index) => {
            if (action.action === 'submit' && action.onClick) {
                const button = modalElement.querySelectorAll('.modal-footer .btn')[index];
                if (button) {
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        action.onClick();
                    });
                }
            }
        });
    }

    static handleSubmit(button) {
        const modal = button.closest('.modal');
        const form = modal?.querySelector('form');
        if (form) {
            form.requestSubmit();
        } else {
            this.closeCurrentModal();
        }
    }

    static closeCurrentModal() {
        if (this.currentModal) {
            this.currentModal.instance.hide();
        }
    }

    static cleanupModal(modalId) {
        const modalElement = document.getElementById(modalId);
        if (modalElement) modalElement.remove();

        this.modalStack = this.modalStack.filter(modal => modal.id !== modalId);
        this.currentModal = this.modalStack[this.modalStack.length - 1] || null;
    }

    static showConfirmation(options = {}) {
        const {
            title = 'Подтверждение',
            message = 'Вы уверены, что хотите выполнить это действие?',
            confirmText = 'Подтвердить',
            cancelText = 'Отмена',
            onConfirm = null,
            onCancel = null,
            type = 'warning'
        } = options;

        return new Promise((resolve) => {
            const modalId = 'confirmation-modal-' + Date.now();
            this.showModal(modalId, {
                title,
                template: `
                    <p>${Utils.escapeHTML(message)}</p>
                `,
                actions: [
                    {
                        text: cancelText,
                        type: 'secondary',
                        action: 'close',
                        onClick: () => {
                            if (onCancel) onCancel();
                            resolve(false);
                        }
                    },
                    {
                        text: confirmText,
                        type: type === 'danger' ? 'danger' : 'primary',
                        action: 'submit',
                        onClick: () => {
                            if (onConfirm) onConfirm();
                            resolve(true);
                        }
                    }
                ],
                onClose: () => {
                    if (onCancel) onCancel();
                    resolve(false);
                }
            });
        });
    }

    static showContextMenu(options = {}) {
        const {
            title = '',
            items = [],
            position = 'bottom-start',
            triggerElement = null
        } = options;

        this.closeContextMenu();

        const menuId = 'context-menu-' + Date.now();
        const menuHTML = this.createContextMenuHTML(menuId, title, items);

        document.body.insertAdjacentHTML('beforeend', menuHTML);

        const menuElement = document.getElementById(menuId);
        const backdrop = document.createElement('div');
        backdrop.className = 'context-menu-backdrop';
        document.body.appendChild(backdrop);

        if (triggerElement) {
            this.positionContextMenu(menuElement, triggerElement, position);
        } else {
            menuElement.style.top = '50%';
            menuElement.style.left = '50%';
            menuElement.style.transform = 'translate(-50%, -50%)';
        }

        setTimeout(() => {
            menuElement.classList.add('show');
            backdrop.classList.add('show');
        }, 10);

        this.currentContextMenu = { id: menuId, element: menuElement, backdrop, closeHandlers: {} };

        const closeHandler = () => this.closeContextMenu();
        backdrop.addEventListener('click', closeHandler);

        const escHandler = (e) => { if (e.key === 'Escape') closeHandler(); };
        document.addEventListener('keydown', escHandler);

        this.currentContextMenu.closeHandlers = { backdrop: closeHandler, esc: escHandler };

        return menuElement;
    }

    static createContextMenuHTML(menuId, title, items) {
        const itemsHTML = items.map(item => {
            if (item.type === 'separator') {
                return '<div class="context-menu-separator"></div>';
            }

            const dangerClass = item.danger ? 'danger' : '';
            const actionStr = JSON.stringify(item.action);
            // Безопасная замена только если строка
            const safeActionStr = typeof actionStr === 'string' ? actionStr.replace(/'/g, "\\'") : '';

            return `
                <button class="context-menu-item ${dangerClass}"
                        onclick="ModalManager.handleContextMenuAction('${menuId}', ${safeActionStr})">
                    <i class="fas ${item.icon || 'fa-circle'}"></i>
                    <span>${Utils.escapeHTML(item.text || '')}</span>
                </button>
            `;
        }).join('');

        return `
            <div class="context-menu" id="${menuId}">
                ${title ? `
                    <div class="context-menu-header">
                        <h6>${Utils.escapeHTML(title)}</h6>
                    </div>
                ` : ''}
                <div class="context-menu-body">
                    ${itemsHTML}
                </div>
            </div>
        `;
    }

    static positionContextMenu(menuElement, triggerElement, position) {
        const triggerRect = triggerElement.getBoundingClientRect();
        const menuRect = menuElement.getBoundingClientRect();

        let top, left;

        switch (position) {
            case 'bottom-start':
                top = triggerRect.bottom + window.scrollY;
                left = triggerRect.left + window.scrollX;
                break;
            case 'bottom-end':
                top = triggerRect.bottom + window.scrollY;
                left = triggerRect.right + window.scrollX - menuRect.width;
                break;
            case 'top-start':
                top = triggerRect.top + window.scrollY - menuRect.height;
                left = triggerRect.left + window.scrollX;
                break;
            case 'top-end':
                top = triggerRect.top + window.scrollY - menuRect.height;
                left = triggerRect.right + window.scrollX - menuRect.width;
                break;
            default:
                top = triggerRect.bottom + window.scrollY;
                left = triggerRect.left + window.scrollX;
        }

        const viewport = { width: window.innerWidth, height: window.innerHeight };

        if (left + menuRect.width > viewport.width) left = viewport.width - menuRect.width - 10;
        if (top + menuRect.height > viewport.height) top = viewport.height - menuRect.height - 10;
        if (left < 0) left = 10;
        if (top < 0) top = 10;

        menuElement.style.top = `${top}px`;
        menuElement.style.left = `${left}px`;
    }

    static handleContextMenuAction(menuId, action) {
        if (typeof action === 'function') {
            action();
        }
        this.closeContextMenu();
    }

    static closeContextMenu() {
        if (!this.currentContextMenu) return;

        const { element, backdrop, closeHandlers } = this.currentContextMenu;

        element.classList.remove('show');
        backdrop.classList.remove('show');

        setTimeout(() => {
            if (element.parentNode) element.parentNode.removeChild(element);
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
            if (closeHandlers?.esc) {
                document.removeEventListener('keydown', closeHandlers.esc);
            }
        }, 300);

        this.currentContextMenu = null;
    }

    static showLoadingModal(message = 'Загрузка...') {
        const modalId = 'loading-modal-' + Date.now();
        return this.showModal(modalId, {
            template: `
                <div class="loading-modal">
                    <div class="spinner-border text-primary"></div>
                    <p>${Utils.escapeHTML(message)}</p>
                </div>
            `,
            size: 'small',
            closeOnBackdrop: false,
            closeOnEscape: false
        });
    }

    static getCurrentModal() {
        return document.querySelector('.modal.show');
    }

    static updateModal(modalId, updates) {
        const modal = this.modalStack.find(m => m.id === modalId);
        if (!modal) return;

        const { title, template, actions } = updates;

        if (title !== undefined) {
            const titleEl = modal.element.querySelector('.modal-title');
            if (titleEl) titleEl.textContent = title;
        }

        if (template !== undefined) {
            const bodyEl = modal.element.querySelector('.modal-body');
            if (bodyEl) bodyEl.innerHTML = template;
        }

        if (actions !== undefined) {
            const footerEl = modal.element.querySelector('.modal-footer');
            if (footerEl) {
                footerEl.innerHTML = this.createActionsHTML(actions);
            }
            this.setupModalActions(modalId, actions);
        }
    }
}

window.ModalManager = ModalManager;
