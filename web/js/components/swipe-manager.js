// Менеджер свайп-жестов
class SwipeManager {
    static isSwiping = false;
    static startX = 0;
    static startY = 0;
    static currentElement = null;
    static currentType = null;
    static threshold = 60;
    static maxSwipe = 80;

    static init() {
        this.setupProjectSwipes();
        this.setupTaskSwipes();
        this.setupGlobalHandlers();

        Utils.log('Swipe manager initialized');
    }

    static setupProjectSwipes() {
        // Обработчики будут добавлены динамически при рендере проектов
    }

    static setupTaskSwipes() {
        // Обработчики будут добавлены динамически при рендере задач
    }

    static setupGlobalHandlers() {
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Для desktop с mouse events
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    static handleTouchStart(e) {
        const element = this.getSwipeableElement(e.target);
        if (!element) return;

        const touch = e.touches[0];
        this.startSwipe(element, touch.clientX, touch.clientY);
        e.preventDefault();
    }

    static handleMouseDown(e) {
        const element = this.getSwipeableElement(e.target);
        if (!element) return;

        this.startSwipe(element, e.clientX, e.clientY);
        e.preventDefault();
    }

    static startSwipe(element, startX, startY) {
        this.isSwiping = true;
        this.startX = startX;
        this.startY = startY;
        this.currentElement = element;
        this.currentType = this.getElementType(element);

        element.classList.add('swiping');
        HapticManager.light();
    }

    static handleTouchMove(e) {
        if (!this.isSwiping || !this.currentElement) return;

        const touch = e.touches[0];
        this.processSwipe(touch.clientX, touch.clientY);
        e.preventDefault();
    }

    static handleMouseMove(e) {
        if (!this.isSwiping || !this.currentElement) return;

        this.processSwipe(e.clientX, e.clientY);
        e.preventDefault();
    }

    static processSwipe(currentX, currentY) {
        const diffX = currentX - this.startX;
        const diffY = currentY - this.startY;

        // Проверяем, что это горизонтальный свайп
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
            // Ограничиваем максимальный свайп
            const swipeDistance = Math.max(-this.maxSwipe, Math.min(this.maxSwipe, diffX));

            this.currentElement.style.transform = `translateX(${swipeDistance}px)`;

            // Показываем действия при достаточном свайпе
            if (Math.abs(swipeDistance) > this.threshold) {
                if (swipeDistance > 0) {
                    this.currentElement.classList.add('swipe-right');
                    this.currentElement.classList.remove('swipe-left');
                } else {
                    this.currentElement.classList.add('swipe-left');
                    this.currentElement.classList.remove('swipe-right');
                }

                // Haptic feedback при достижении порога
                if (Math.abs(swipeDistance) > this.threshold && Math.abs(swipeDistance - diffX) < 5) {
                    HapticManager.light();
                }
            } else {
                this.currentElement.classList.remove('swipe-left', 'swipe-right');
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
        if (!this.isSwiping || !this.currentElement) return;

        const rect = this.currentElement.getBoundingClientRect();
        const diffX = rect.left - this.startX;

        this.currentElement.classList.remove('swiping');

        if (Math.abs(diffX) > this.threshold) {
            const elementId = this.getElementId(this.currentElement, this.currentType);

            if (diffX > 0) {
                // Свайп вправо - редактирование
                this.handleSwipeRight(this.currentType, elementId);
            } else {
                // Свайп влево - удаление
                this.handleSwipeLeft(this.currentType, elementId);
            }

            HapticManager.success();
        }

        // Сброс анимации
        this.resetElement();
        this.clearState();
    }

    static resetElement() {
        if (this.currentElement) {
            this.currentElement.style.transform = '';
            this.currentElement.classList.remove('swipe-left', 'swipe-right');
        }
    }

    static clearState() {
        this.isSwiping = false;
        this.currentElement = null;
        this.currentType = null;
        this.startX = 0;
        this.startY = 0;
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
            case 'member':
                // Обработка для участников
                break;
            case 'notification':
                // Пометить уведомление как прочитанное
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
            case 'member':
                // Удаление участника
                break;
            case 'notification':
                // Удаление уведомления
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
}

window.SwipeManager = SwipeManager;
