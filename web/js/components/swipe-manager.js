// Менеджер свайп-жестов (исправленная версия)
class SwipeManager {
    static isSwiping = false;
    static startX = 0;
    static startY = 0;
    static currentElement = null;
    static currentType = null;
    static threshold = 60;
    static maxSwipe = 80;
    static swipeStartTime = 0;
    static longPressTimer = null;
    static longPressDelay = 500; // 500ms для долгого нажатия

    static init() {
        this.setupGlobalHandlers();
        Utils.log('Swipe manager initialized');
    }

    static setupGlobalHandlers() {
        // Touch events
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Mouse events
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        document.addEventListener('contextmenu', this.handleContextMenu.bind(this));

        // Отключаем стандартное контекстное меню на свайпаемых элементах
        document.addEventListener('contextmenu', (e) => {
            if (this.getSwipeableElement(e.target)) {
                e.preventDefault();
            }
        });
    }

    static handleTouchStart(e) {
        if (e.touches.length !== 1) return;

        const element = this.getSwipeableElement(e.target);
        if (!element) return;

        const touch = e.touches[0];
        this.startSwipe(element, touch.clientX, touch.clientY);

        // Запускаем таймер для долгого нажатия
        this.longPressTimer = setTimeout(() => {
            this.handleLongPress(element);
        }, this.longPressDelay);
    }

    static handleMouseDown(e) {
        const element = this.getSwipeableElement(e.target);
        if (!element) return;

        this.startSwipe(element, e.clientX, e.clientY);

        // Запускаем таймер для долгого нажатия
        this.longPressTimer = setTimeout(() => {
            this.handleLongPress(element);
        }, this.longPressDelay);
    }

    static startSwipe(element, startX, startY) {
        this.isSwiping = false;
        this.startX = startX;
        this.startY = startY;
        this.currentElement = element;
        this.currentType = this.getElementType(element);
        this.swipeStartTime = Date.now();

        element.classList.add('swipe-active');
        HapticManager.light();
    }

    static handleTouchMove(e) {
        if (!this.currentElement || e.touches.length !== 1) return;

        const touch = e.touches[0];
        this.processSwipe(touch.clientX, touch.clientY);

        // Если начался свайп, отменяем долгое нажатие
        if (this.isSwiping && this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        e.preventDefault();
    }

    static handleMouseMove(e) {
        if (!this.currentElement) return;

        this.processSwipe(e.clientX, e.clientY);

        // Если начался свайп, отменяем долгое нажатие
        if (this.isSwiping && this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    static processSwipe(currentX, currentY) {
        const diffX = currentX - this.startX;
        const diffY = currentY - this.startY;

        // Проверяем, что это горизонтальный свайп (преобладает движение по X)
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
            this.isSwiping = true;

            // Ограничиваем максимальный свайп
            const swipeDistance = Math.max(-this.maxSwipe, Math.min(this.maxSwipe, diffX));
            this.currentElement.style.transform = `translateX(${swipeDistance}px)`;

            // Добавляем/убираем класс порога
            if (Math.abs(swipeDistance) > this.threshold) {
                this.currentElement.classList.add('swipe-threshold');
                if (swipeDistance > 0) {
                    this.currentElement.classList.add('swipe-right');
                    this.currentElement.classList.remove('swipe-left');
                } else {
                    this.currentElement.classList.add('swipe-left');
                    this.currentElement.classList.remove('swipe-right');
                }

                // Тактильная обратная связь при достижении порога
                if (Math.abs(Math.abs(swipeDistance) - this.threshold) < 5) {
                    HapticManager.light();
                }
            } else {
                this.currentElement.classList.remove('swipe-threshold', 'swipe-left', 'swipe-right');
            }
        }
    }

    static handleTouchEnd(e) {
        this.endSwipe();
    }

    static handleMouseUp(e) {
        this.endSwipe();
    }

    static endSwipe() {
        // Очищаем таймер долгого нажатия
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        if (!this.currentElement) return;

        const rect = this.currentElement.getBoundingClientRect();
        const diffX = rect.left - this.startX;

        this.currentElement.classList.remove('swipe-active', 'swipe-threshold');

        if (this.isSwiping && Math.abs(diffX) > this.threshold) {
            const elementId = this.getElementId(this.currentElement, this.currentType);

            if (diffX > 0) {
                // Свайп вправо - редактирование
                this.handleSwipeRight(this.currentType, elementId);
            } else {
                // Свайп влево - удаление
                this.handleSwipeLeft(this.currentType, elementId);
            }

            HapticManager.success();
        } else if (!this.isSwiping) {
            // Если не было свайпа, обрабатываем как обычный клик
            const clickTime = Date.now() - this.swipeStartTime;
            if (clickTime < 300) { // Быстрый клик
                this.handleClick(this.currentType, this.getElementId(this.currentElement, this.currentType));
            }
        }

        // Сброс анимации
        this.resetElement();
        this.clearState();
    }

    static handleLongPress(element) {
        if (this.isSwiping) return; // Не показываем меню если уже начался свайп

        element.classList.add('long-press');
        const elementType = this.getElementType(element);
        const elementId = this.getElementId(element, elementType);

        // Небольшая задержка для визуального эффекта
        setTimeout(() => {
            this.showContextMenu(elementType, elementId, element);
            element.classList.remove('long-press');
            HapticManager.medium();
        }, 100);
    }

    static showContextMenu(type, id, element) {
        let menuItems = [];

        switch (type) {
            case 'project':
                menuItems = [
                    {
                        text: 'Редактировать',
                        icon: 'fa-edit',
                        action: () => ProjectsManager.editProject(id)
                    },
                    {
                        text: 'Поделиться',
                        icon: 'fa-share-alt',
                        action: () => ProjectsManager.showInviteDialog(id)
                    },
                    { type: 'separator' },
                    {
                        text: 'Удалить',
                        icon: 'fa-trash',
                        danger: true,
                        action: () => ProjectsManager.deleteProjectWithConfirmation(id)
                    }
                ];
                break;
            case 'task':
                menuItems = [
                    {
                        text: 'Редактировать',
                        icon: 'fa-edit',
                        action: () => TasksManager.editTask(id)
                    },
                    {
                        text: 'Отметить как выполненную',
                        icon: 'fa-check',
                        action: () => TasksManager.updateTaskStatus(id, 'done')
                    },
                    { type: 'separator' },
                    {
                        text: 'Удалить',
                        icon: 'fa-trash',
                        danger: true,
                        action: () => TasksManager.deleteTaskWithConfirmation(id)
                    }
                ];
                break;
        }

        if (menuItems.length > 0) {
            ModalManager.showContextMenu({
                triggerElement: element,
                position: 'bottom-start',
                items: menuItems
            });
        }
    }

    static handleClick(type, id) {
        switch (type) {
            case 'project':
                ProjectsManager.openProjectDetail(id);
                break;
            case 'task':
                TasksManager.openTaskDetail(id);
                break;
        }
        HapticManager.selection();
    }

    static handleContextMenu(e) {
        const element = this.getSwipeableElement(e.target);
        if (element) {
            e.preventDefault();
            const elementType = this.getElementType(element);
            const elementId = this.getElementId(element, elementType);
            this.showContextMenu(elementType, elementId, element);
        }
    }

    static resetElement() {
        if (this.currentElement) {
            this.currentElement.style.transform = '';
            this.currentElement.classList.remove('swipe-left', 'swipe-right', 'swipe-active', 'swipe-threshold', 'long-press');
        }
    }

    static clearState() {
        this.isSwiping = false;
        this.currentElement = null;
        this.currentType = null;
        this.startX = 0;
        this.startY = 0;
        this.swipeStartTime = 0;
    }

    static getSwipeableElement(target) {
        return target.closest('.project-card, .task-card, .member-item, .notification-item');
    }

    static getElementType(element) {
        if (element.classList.contains('project-card')) return 'project';
        if (element.classList.contains('task-card')) return 'task';
        if (element.classList.contains('member-item')) return 'member';
        if (element.classList.contains('notification-item')) return 'notification';
        return null;
    }

    static getElementId(element, type) {
        switch (type) {
            case 'project':
                return element.getAttribute('data-project-hash') || element.getAttribute('data-project-id');
            case 'task':
                return element.getAttribute('data-task-id');
            case 'member':
                return element.getAttribute('data-member-id');
            case 'notification':
                return element.getAttribute('data-notification-id');
            default:
                return null;
        }
    }

    static handleSwipeRight(type, id) {
        switch (type) {
            case 'project':
                ProjectsManager.editProject(id);
                break;
            case 'task':
                TasksManager.editTask(id);
                break;
            case 'notification':
                // Для уведомлений - помечаем как прочитанное
                NotificationsManager.markNotificationAsRead(id);
                break;
        }
    }

    static handleSwipeLeft(type, id) {
        switch (type) {
            case 'project':
                ProjectsManager.deleteProjectWithConfirmation(id);
                break;
            case 'task':
                TasksManager.deleteTaskWithConfirmation(id);
                break;
            case 'notification':
                // Для уведомлений - удаление
                NotificationsManager.deleteNotification(id);
                break;
        }
    }

    // Методы для принудительной блокировки/разблокировки свайпов
    static enableSwipes() {
        document.body.classList.remove('swipes-disabled');
    }

    static disableSwipes() {
        document.body.classList.add('swipes-disabled');
    }

    // Настройка параметров свайпов
    static setThreshold(value) {
        this.threshold = value;
    }

    static setMaxSwipe(value) {
        this.maxSwipe = value;
    }

    static setLongPressDelay(value) {
        this.longPressDelay = value;
    }
}

window.SwipeManager = SwipeManager;
