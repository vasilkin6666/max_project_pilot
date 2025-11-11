class SwipeManager {
    static init() {
        this.initProjectSwipes();
        this.initTaskSwipes();
        this.initMemberSwipes();
    }

    static initProjectSwipes() {
        document.addEventListener('touchstart', this.handleTouchStart, false);
        document.addEventListener('touchmove', this.handleTouchMove, false);
        document.addEventListener('touchend', this.handleTouchEnd, false);
    }

    static initTaskSwipes() {
        // Аналогичная логика для задач
    }

    static initMemberSwipes() {
        // Аналогичная логика для участников
    }

    static handleTouchStart(e) {
        const projectCard = e.target.closest('.project-card');
        if (projectCard) {
            const touch = e.touches[0];
            this.startX = touch.clientX;
            this.startY = touch.clientY;
            this.currentCard = projectCard;
            projectCard.classList.add('swiping');
        }
    }

    static handleTouchMove(e) {
        if (!this.currentCard) return;

        const touch = e.touches[0];
        const diffX = touch.clientX - this.startX;
        const diffY = touch.clientY - this.startY;

        // Проверяем, что это горизонтальный свайп
        if (Math.abs(diffX) > Math.abs(diffY)) {
            e.preventDefault();

            if (diffX > 0) {
                // Свайп вправо - редактирование
                this.currentCard.classList.add('swipe-right');
                this.currentCard.classList.remove('swipe-left');
            } else {
                // Свайп влево - удаление
                this.currentCard.classList.add('swipe-left');
                this.currentCard.classList.remove('swipe-right');
            }

            this.currentCard.style.transform = `translateX(${diffX}px)`;
        }
    }

    static handleTouchEnd(e) {
        if (!this.currentCard) return;

        const touch = e.changedTouches[0];
        const diffX = touch.clientX - this.startX;
        const threshold = 60;

        this.currentCard.classList.remove('swiping');

        if (Math.abs(diffX) > threshold) {
            const projectId = this.currentCard.getAttribute('data-project-id');

            if (diffX > 0) {
                // Свайп вправо - редактирование
                ProjectsManager.editProject(projectId);
            } else {
                // Свайп влево - удаление
                ProjectsManager.deleteProjectWithConfirmation(projectId);
            }
        }

        // Сброс стилей
        this.currentCard.style.transform = '';
        this.currentCard.classList.remove('swipe-left', 'swipe-right');
        this.currentCard = null;
    }
}

window.SwipeManager = SwipeManager;
