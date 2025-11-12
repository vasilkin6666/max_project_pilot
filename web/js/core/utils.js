// Утилитарные функции
class Utils {
    // Экранирование HTML
    static escapeHTML(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // В класс Utils добавить методы валидации
    static validateProjectTitle(title) {
        if (!title || title.trim().length === 0) {
            return 'Название проекта не может быть пустым';
        }
        if (title.length > 100) {
            return 'Название проекта не должно превышать 100 символов';
        }
        return null;
    }

    static validateProjectDescription(description) {
        if (description && description.length > 500) {
            return 'Описание проекта не должно превышать 500 символов';
        }
        return null;
    }

    static validateTaskTitle(title) {
        if (!title || title.trim().length === 0) {
            return 'Название задачи не может быть пустым';
        }
        if (title.length > 200) {
            return 'Название задачи не должно превышать 200 символов';
        }
        return null;
    }

    static validateTaskDescription(description) {
        if (description && description.length > 1000) {
            return 'Описание задачи не должно превышать 1000 символов';
        }
        return null;
    }

    // Метод для обрезки текста с многоточием
    static truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // Форматирование даты
    static formatDate(dateString) {
        if (!dateString) return '';

        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffMinutes < 1) {
            return 'только что';
        } else if (diffMinutes < 60) {
            return `${diffMinutes} мин назад`;
        } else if (diffHours < 24) {
            return `${diffHours} ч назад`;
        } else if (diffDays === 0) {
            return 'сегодня';
        } else if (diffDays === 1) {
            return 'вчера';
        } else if (diffDays < 7) {
            return `${diffDays} дн назад`;
        } else {
            return date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        }
    }

    // Форматирование даты и времени
    static formatDateTime(dateString) {
        if (!dateString) return '';

        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Получение цвета статуса
    static getStatusColor(status) {
        const colors = {
            'todo': 'warning',
            'in_progress': 'info',
            'done': 'success'
        };
        return colors[status] || 'secondary';
    }

    // Получение текста статуса
    static getStatusText(status) {
        const texts = {
            'todo': 'К выполнению',
            'in_progress': 'В работе',
            'done': 'Завершено'
        };
        return texts[status] || status;
    }

    // Получение цвета приоритета
    static getPriorityColor(priority) {
        const colors = {
            'low': 'success',
            'medium': 'warning',
            'high': 'danger',
            'urgent': 'dark'
        };
        return colors[priority] || 'secondary';
    }

    // Получение текста приоритета
    static getPriorityText(priority) {
        const texts = {
            'low': 'Низкий',
            'medium': 'Средний',
            'high': 'Высокий',
            'urgent': 'Срочный'
        };
        return texts[priority] || priority;
    }

    // Debounce функция
    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }

    // Throttle функция
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Генерация уникального ID
    static generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }

    // Проверка на мобильное устройство
    static isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // Проверка на MAX окружение
    static isMaxEnvironment() {
        return typeof window.WebApp !== 'undefined';
    }

    // Логирование
    static log(message, data = null) {
        console.log(`[LOG] ${new Date().toISOString()} - ${message}`, data || '');
    }

    // Логирование ошибок
    static logError(message, error = null) {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');
    }

    // Валидация email
    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Валидация URL
    static validateURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    // Очистка объекта от null/undefined значений
    static cleanObject(obj) {
        return Object.fromEntries(
            Object.entries(obj).filter(([_, v]) => v != null)
        );
    }

    // Глубокое клонирование объекта
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // Форматирование числа с разделителями
    static formatNumber(number) {
        return new Intl.NumberFormat('ru-RU').format(number);
    }

    // Получение инициалов из имени
    static getInitials(name) {
        if (!name) return 'U';
        return name
            .split(' ')
            .map(part => part.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    // Проверка просроченности даты
    static isOverdue(dateString) {
        if (!dateString) return false;
        return new Date(dateString) < new Date();
    }

    // Расчет прогресса
    static calculateProgress(completed, total) {
        if (total === 0) return 0;
        return Math.round((completed / total) * 100);
    }
}

// Toast уведомления
class ToastManager {
    static showToast(message, type = 'info', duration = 4000) {
        const toastContainer = document.getElementById('toast-container') || this.createToastContainer();

        const toastId = 'toast-' + Date.now();
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toastHTML = `
            <div id="${toastId}" class="toast toast-${type}" role="alert">
                <div class="toast-content">
                    <i class="fas ${icons[type] || 'fa-info-circle'} toast-icon"></i>
                    <div class="toast-message">${Utils.escapeHTML(message)}</div>
                    <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHTML);

        const toastElement = document.getElementById(toastId);

        // Автоматическое скрытие
        if (duration > 0) {
            setTimeout(() => {
                if (toastElement && toastElement.parentNode) {
                    toastElement.remove();
                }
            }, duration);
        }

        return toastElement;
    }

    static createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }

    static success(message, duration = 4000) {
        return this.showToast(message, 'success', duration);
    }

    static error(message, duration = 4000) {
        return this.showToast(message, 'error', duration);
    }

    static warning(message, duration = 4000) {
        return this.showToast(message, 'warning', duration);
    }

    static info(message, duration = 4000) {
        return this.showToast(message, 'info', duration);
    }
}

// Экспорт классов
window.Utils = Utils;
window.ToastManager = ToastManager;
