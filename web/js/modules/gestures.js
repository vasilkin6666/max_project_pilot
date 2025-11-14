// Gesture and touch event manager
class GestureManager {
    constructor() {
        this.swipeThreshold = 50;
        this.longPressDuration = 500;
        this.currentGestures = new Map();
    }

    async init() {
        console.log('Gesture manager initialized');
        this.setupEventListeners();
        return Promise.resolve();
    }

    // Event listeners setup
    setupEventListeners() {
        // Swipe gestures for touch devices
        this.setupSwipeGestures();

        // Long press for context menus
        this.setupLongPress();

        // Keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Click outside handlers
        this.setupClickOutside();
    }

    // Swipe gestures
    setupSwipeGestures() {
        let startX, startY, endX, endY;
        let currentElement = null;

        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                currentElement = e.target;

                // Add active class for visual feedback
                this.addSwipeActiveClass(currentElement);
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && currentElement) {
                endX = e.touches[0].clientX;
                endY = e.touches[0].clientY;
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (currentElement) {
                this.removeSwipeActiveClass(currentElement);

                if (startX && endX) {
                    const diffX = startX - endX;
                    const diffY = startY - endY;

                    // Determine swipe direction
                    if (Math.abs(diffX) > Math.abs(diffY)) {
                        // Horizontal swipe
                        if (Math.abs(diffX) > this.swipeThreshold) {
                            if (diffX > 0) {
                                this.handleSwipe(currentElement, 'left');
                            } else {
                                this.handleSwipe(currentElement, 'right');
                            }
                        }
                    } else {
                        // Vertical swipe
                        if (Math.abs(diffY) > this.swipeThreshold) {
                            if (diffY > 0) {
                                this.handleSwipe(currentElement, 'up');
                            } else {
                                this.handleSwipe(currentElement, 'down');
                            }
                        }
                    }
                }

                // Reset
                startX = startY = endX = endY = null;
                currentElement = null;
            }
        }, { passive: true });
    }

    addSwipeActiveClass(element) {
        let current = element;
        for (let i = 0; i < 3; i++) { // Check up to 3 levels up
            if (current.classList && current.hasAttribute('data-swipeable')) {
                current.classList.add('swipe-active');
                break;
            }
            current = current.parentElement;
            if (!current) break;
        }
    }

    removeSwipeActiveClass(element) {
        let current = element;
        for (let i = 0; i < 3; i++) {
            if (current.classList && current.hasAttribute('data-swipeable')) {
                current.classList.remove('swipe-active');
                break;
            }
            current = current.parentElement;
            if (!current) break;
        }
    }

    handleSwipe(element, direction) {
        // Find the nearest swipeable element
        let swipeableElement = element;
        while (swipeableElement && !swipeableElement.hasAttribute('data-swipeable')) {
            swipeableElement = swipeableElement.parentElement;
            if (!swipeableElement) return;
        }

        const swipeAction = swipeableElement.getAttribute(`data-swipe-${direction}`);
        if (swipeAction) {
            this.executeSwipeAction(swipeAction, swipeableElement, direction);
        }

        // Trigger custom event
        const event = new CustomEvent('swipe', {
            detail: {
                element: swipeableElement,
                direction: direction,
                action: swipeAction
            }
        });
        document.dispatchEvent(event);
    }

    executeSwipeAction(action, element, direction) {
        const app = window.App;
        if (!app) return;

        switch (action) {
            case 'archive':
                if (element.dataset.taskId) {
                    app.components.tasks?.archiveTask(element.dataset.taskId);
                }
                break;

            case 'complete':
                if (element.dataset.taskId) {
                    app.components.tasks?.completeTask(element.dataset.taskId);
                }
                break;

            case 'delete':
                if (element.dataset.taskId) {
                    app.components.tasks?.deleteTask(element.dataset.taskId);
                } else if (element.dataset.projectHash) {
                    app.components.modals?.showDeleteProjectModal(element.dataset.projectHash);
                }
                break;

            case 'edit':
                if (element.dataset.taskId) {
                    app.components.tasks?.editTask(element.dataset.taskId);
                } else if (element.dataset.projectHash) {
                    app.components.modals?.showEditProjectModal(element.dataset.projectHash);
                }
                break;

            default:
                console.log(`Swipe action: ${action} for direction: ${direction}`);
        }

        // Provide haptic feedback
        this.vibrate();
    }

    // Long press gestures
    setupLongPress() {
        let pressTimer;

        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const element = e.target;
                if (element.hasAttribute('data-long-press')) {
                    pressTimer = setTimeout(() => {
                        this.handleLongPress(element, e);
                    }, this.longPressDuration);
                }
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });

        document.addEventListener('touchmove', () => {
            clearTimeout(pressTimer);
        }, { passive: true });

        // Also support mouse for desktop
        document.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click only
                const element = e.target;
                if (element.hasAttribute('data-long-press')) {
                    pressTimer = setTimeout(() => {
                        this.handleLongPress(element, e);
                    }, this.longPressDuration);
                }
            }
        });

        document.addEventListener('mouseup', () => {
            clearTimeout(pressTimer);
        });

        document.addEventListener('mousemove', () => {
            clearTimeout(pressTimer);
        });
    }

    handleLongPress(element, originalEvent) {
        // Find the nearest long-press element
        let longPressElement = element;
        while (longPressElement && !longPressElement.hasAttribute('data-long-press')) {
            longPressElement = longPressElement.parentElement;
            if (!longPressElement) return;
        }

        const action = longPressElement.getAttribute('data-long-press');
        const context = longPressElement.getAttribute('data-context');

        this.showContextMenu(longPressElement, action, context, originalEvent);

        // Provide haptic feedback
        this.vibrate([50]);
    }

    showContextMenu(element, action, context, originalEvent) {
        // Prevent default context menu
        originalEvent.preventDefault();

        const menuItems = this.getContextMenuItems(context, element);
        if (menuItems.length === 0) return;

        // Create context menu
        const menu = Utils.createElement('div', 'context-menu');
        menu.style.position = 'fixed';
        menu.style.left = `${originalEvent.clientX}px`;
        menu.style.top = `${originalEvent.clientY}px`;
        menu.style.zIndex = '1000';

        menuItems.forEach(item => {
            const menuItem = Utils.createElement('button', 'context-menu-item');
            menuItem.innerHTML = `
                <span class="context-menu-icon">${item.icon}</span>
                <span class="context-menu-text">${item.text}</span>
            `;
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                item.action(element);
                menu.remove();
            });
            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);

        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
                document.removeEventListener('touchstart', closeMenu);
            }
        };

        document.addEventListener('click', closeMenu);
        document.addEventListener('touchstart', closeMenu);
    }

    getContextMenuItems(context, element) {
        const app = window.App;
        const items = [];

        switch (context) {
            case 'task':
                items.push(
                    {
                        icon: '✅',
                        text: 'Завершить',
                        action: (el) => app.components.tasks?.completeTask(el.dataset.taskId)
                    },
                    {
                        icon: '✏️',
                        text: 'Редактировать',
                        action: (el) => app.components.tasks?.editTask(el.dataset.taskId)
                    },
                    {
                        icon: '🗑️',
                        text: 'Удалить',
                        action: (el) => app.components.tasks?.deleteTask(el.dataset.taskId)
                    }
                );
                break;

            case 'project':
                items.push(
                    {
                        icon: '✏️',
                        text: 'Редактировать',
                        action: (el) => app.components.modals?.showEditProjectModal(el.dataset.projectHash)
                    },
                    {
                        icon: '👥',
                        text: 'Участники',
                        action: (el) => app.components.modals?.showProjectMembersModal(el.dataset.projectHash)
                    },
                    {
                        icon: '🗑️',
                        text: 'Удалить',
                        action: (el) => app.components.modals?.showDeleteProjectModal(el.dataset.projectHash)
                    }
                );
                break;
        }

        return items;
    }

    // Keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only trigger if not in input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            const key = e.key.toLowerCase();
            const ctrl = e.ctrlKey || e.metaKey;
            const shift = e.shiftKey;

            // Global shortcuts
            if (ctrl) {
                switch (key) {
                    case 'k':
                        e.preventDefault();
                        this.handleQuickSearch();
                        break;
                    case 'n':
                        e.preventDefault();
                        this.handleNewItem();
                        break;
                    case '1':
                        e.preventDefault();
                        window.App?.showView('dashboard');
                        break;
                    case '2':
                        e.preventDefault();
                        window.App?.showView('myTasks');
                        break;
                }
            }

            // Navigation shortcuts
            if (key === 'escape') {
                this.handleEscape();
            }
        });
    }

    handleQuickSearch() {
        const searchBtn = document.getElementById('searchProjectsBtn');
        if (searchBtn) {
            searchBtn.click();
            const searchInput = document.getElementById('searchProjectsInput');
            if (searchInput) {
                searchInput.focus();
            }
        }
    }

    handleNewItem() {
        const currentView = window.App?.currentView;
        switch (currentView) {
            case 'dashboard':
                document.getElementById('createProjectBtn')?.click();
                break;
            case 'projectView':
                document.getElementById('createTaskBtn')?.click();
                break;
        }
    }

    handleEscape() {
        // Close modals
        const modals = document.querySelectorAll('.modal-overlay.active');
        if (modals.length > 0) {
            const lastModal = modals[modals.length - 1];
            const closeBtn = lastModal.querySelector('.modal-close');
            if (closeBtn) closeBtn.click();
            return;
        }

        // Close context menus
        const contextMenus = document.querySelectorAll('.context-menu');
        contextMenus.forEach(menu => menu.remove());

        // Navigate back
        window.App?.back();
    }

    // Click outside handlers
    setupClickOutside() {
        document.addEventListener('click', (e) => {
            // Close dropdowns when clicking outside
            const dropdowns = document.querySelectorAll('.dropdown.show');
            dropdowns.forEach(dropdown => {
                if (!dropdown.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            });

            // Close context menus
            const contextMenus = document.querySelectorAll('.context-menu');
            contextMenus.forEach(menu => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                }
            });
        });
    }

    // Utility methods
    vibrate(pattern = [50]) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }

    // Gesture configuration
    setSwipeThreshold(threshold) {
        this.swipeThreshold = threshold;
    }

    setLongPressDuration(duration) {
        this.longPressDuration = duration;
    }

    // Cleanup
    destroy() {
        // Remove any active gesture listeners if needed
    }
}
