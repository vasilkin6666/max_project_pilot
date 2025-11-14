// Advanced animations and interactions
class AppAnimations {
    static init() {
        this.initCursor();
        this.initScrollAnimations();
        this.initPageTransitions();
        this.initMicroInteractions();
    }

    // Кастомный курсор
    static initCursor() {
        const cursor = document.getElementById('cursor');
        const follower = document.getElementById('cursor-follower');

        if (!cursor || !follower) return;

        document.addEventListener('mousemove', (e) => {
            cursor.style.left = e.clientX + 'px';
            cursor.style.top = e.clientY + 'px';

            setTimeout(() => {
                follower.style.left = e.clientX + 'px';
                follower.style.top = e.clientY + 'px';
            }, 100);
        });

        // Эффекты при наведении на интерактивные элементы
        const interactiveElements = document.querySelectorAll('button, a, .project-card, .task-card');

        interactiveElements.forEach(el => {
            el.addEventListener('mouseenter', () => {
                cursor.style.transform = 'scale(1.5)';
                follower.style.transform = 'scale(1.5)';
                follower.style.borderColor = 'var(--primary)';
            });

            el.addEventListener('mouseleave', () => {
                cursor.style.transform = 'scale(1)';
                follower.style.transform = 'scale(1)';
                follower.style.borderColor = 'var(--primary)';
            });
        });
    }

    // Анимации при скролле
    static initScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animation = 'fadeIn 0.6s ease forwards';
                }
            });
        }, observerOptions);

        // Наблюдаем за элементами для анимации
        document.querySelectorAll('.neo-card, .stat-card, .project-card').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            observer.observe(el);
        });
    }

    // Плавные переходы между страницами
    static initPageTransitions() {
        const originalShowView = App.showView;

        App.showView = function(viewId) {
            const currentView = document.querySelector('.view.active');
            const newView = document.getElementById(viewId);

            if (currentView) {
                currentView.style.animation = 'slideOutLeft 0.3s ease';
                setTimeout(() => {
                    currentView.classList.remove('active');
                    currentView.style.animation = '';

                    newView.classList.add('active');
                    newView.style.animation = 'slideInRight 0.3s ease';

                    setTimeout(() => {
                        newView.style.animation = '';
                    }, 300);
                }, 300);
            } else {
                newView.classList.add('active');
            }
        };
    }

    // Микро-интеракции
    static initMicroInteractions() {
        // Анимация кнопок
        document.addEventListener('click', (e) => {
            if (e.target.matches('.neo-button, .btn')) {
                const button = e.target;
                button.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    button.style.transform = '';
                }, 150);
            }
        });

        // Параллакс эффект
        document.addEventListener('mousemove', (e) => {
            const x = (e.clientX / window.innerWidth) * 100;
            const y = (e.clientY / window.innerHeight) * 100;

            document.documentElement.style.setProperty('--mouse-x', x + '%');
            document.documentElement.style.setProperty('--mouse-y', y + '%');

            // Легкий параллакс для фоновых элементов
            const shapes = document.querySelectorAll('.shape');
            shapes.forEach((shape, index) => {
                const speed = (index + 1) * 0.5;
                const xMove = (x - 50) * speed * 0.01;
                const yMove = (y - 50) * speed * 0.01;
                shape.style.transform = `translate(${xMove}px, ${yMove}px)`;
            });
        });
    }

    // Анимация появления элементов
    static animateElement(element, animation = 'fadeIn') {
        element.style.animation = `${animation} 0.6s ease forwards`;
    }

    // Вибро-эффект для ошибок
    static shakeElement(element) {
        element.style.animation = 'shake 0.5s ease';
        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }
}

// CSS анимации для ключевых кадров
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(30px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }

    @keyframes slideOutLeft {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(-30px);
        }
    }

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }

    @keyframes fadeIn {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

// Инициализация анимаций после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    AppAnimations.init();
});
