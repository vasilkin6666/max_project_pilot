class ActionMenuManager {
    static currentMenu = null;

    static showMenu(triggerElement, items, onItemClick) {
        // Закрываем предыдущее меню
        this.hideMenu();

        // Создаем backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'action-menu-backdrop';
        backdrop.addEventListener('click', () => this.hideMenu());

        // Создаем меню
        const menu = document.createElement('div');
        menu.className = 'action-menu';

        // Позиционируем меню
        const rect = triggerElement.getBoundingClientRect();
        menu.style.top = `${rect.bottom + window.scrollY}px`;
        menu.style.right = `${window.innerWidth - rect.right}px`;

        // Добавляем элементы меню
        items.forEach(item => {
            const menuItem = document.createElement('button');
            menuItem.className = `action-menu-item ${item.danger ? 'danger' : ''}`;
            menuItem.innerHTML = `
                <i class="fas ${item.icon}"></i>
                <span>${item.text}</span>
            `;
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                onItemClick(item);
                this.hideMenu();
            });
            menu.appendChild(menuItem);
        });

        document.body.appendChild(backdrop);
        document.body.appendChild(menu);

        this.currentMenu = { menu, backdrop };

        // Анимация появления
        requestAnimationFrame(() => {
            menu.classList.add('show');
        });

        // Закрытие по Esc
        const escHandler = (e) => {
            if (e.key === 'Escape') this.hideMenu();
        };
        document.addEventListener('keydown', escHandler);
        this.currentMenu.escHandler = escHandler;
    }

    static hideMenu() {
        if (this.currentMenu) {
            const { menu, backdrop, escHandler } = this.currentMenu;

            if (menu) {
                menu.classList.remove('show');
                setTimeout(() => {
                    if (menu.parentNode) menu.parentNode.removeChild(menu);
                }, 250);
            }

            if (backdrop && backdrop.parentNode) {
                backdrop.parentNode.removeChild(backdrop);
            }

            if (escHandler) {
                document.removeEventListener('keydown', escHandler);
            }

            this.currentMenu = null;
        }
    }

    static initTaskActionMenu() {
        // Инициализация меню действий для задач
        document.addEventListener('click', (e) => {
            const actionButton = e.target.closest('.task-action-button');
            if (actionButton) {
                e.stopPropagation();

                const taskId = actionButton.getAttribute('data-task-id');
                const task = TasksManager.allTasks.find(t => t.id == taskId);

                if (task) {
                    const menuItems = [
                        {
                            text: 'Редактировать',
                            icon: 'fa-edit',
                            action: 'edit'
                        },
                        {
                            text: 'Изменить статус',
                            icon: 'fa-exchange-alt',
                            action: 'change_status'
                        },
                        {
                            text: 'Добавить комментарий',
                            icon: 'fa-comment',
                            action: 'add_comment'
                        },
                        {
                            text: 'Показать зависимости',
                            icon: 'fa-link',
                            action: 'show_dependencies'
                        },
                        {
                            text: 'Удалить',
                            icon: 'fa-trash',
                            action: 'delete',
                            danger: true
                        }
                    ];

                    this.showMenu(actionButton, menuItems, (item) => {
                        this.handleTaskAction(task, item.action);
                    });
                }
            }
        });
    }

    static handleTaskAction(task, action) {
        switch (action) {
            case 'edit':
                TasksManager.showEditTaskModal(task);
                break;
            case 'change_status':
                TasksManager.showStatusChangeModal(task);
                break;
            case 'add_comment':
                TasksManager.showTaskComments(task.id);
                break;
            case 'show_dependencies':
                TasksManager.showTaskDependencies(task.id);
                break;
            case 'delete':
                TasksManager.deleteTask(task.id);
                break;
        }
    }

    static showStatusChangeModal(task) {
        const modalHTML = `
            <div class="modal fade" id="statusChangeModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Изменить статус задачи</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p>Выберите новый статус для задачи: <strong>${Utils.escapeHTML(task.title)}</strong></p>
                            <div class="d-grid gap-2">
                                <button class="btn btn-warning" onclick="TasksManager.updateTaskStatus('${task.id}', 'todo')">
                                    <i class="fas fa-hourglass-start"></i> К выполнению
                                </button>
                                <button class="btn btn-info" onclick="TasksManager.updateTaskStatus('${task.id}', 'in_progress')">
                                    <i class="fas fa-cogs"></i> В работу
                                </button>
                                <button class="btn btn-success" onclick="TasksManager.updateTaskStatus('${task.id}', 'done')">
                                    <i class="fas fa-check-circle"></i> Завершить
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        const existingModal = document.getElementById('statusChangeModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('statusChangeModal'));
        modal.show();
    }
}

window.ActionMenuManager = ActionMenuManager;
