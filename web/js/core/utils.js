//utils.js
// Утилитарные функции
class Utils {
  static init() {
      this.initValidationSystem(); // ДОБАВИТЬ эту строку
  }
    // Получение вложенного значения из объекта по пути
    static getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : '';
        }, obj);
    }

    // Форматирование булевых значений для отображения
    static formatBoolean(value, trueText = 'Да', falseText = 'Нет') {
        return value ? trueText : falseText;
    }

    static initValidationSystem() {
        // Регистрируем обработчики валидации для всех форм
        const forms = ['create-project-form', 'create-task-form', 'edit-project-form', 'edit-task-form'];

        forms.forEach(formId => {
            const form = document.getElementById(formId);
            if (form) {
                form.addEventListener('submit', (e) => {
                    if (!this.validateForm(form)) {
                        e.preventDefault();
                        HapticManager.error();
                    }
                });

                // Валидация при вводе
                form.addEventListener('input', (e) => {
                    this.validateField(e.target);
                });
            }
        });
    }

    static validateForm(form) {
        const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
        let isValid = true;

        inputs.forEach(input => {
            const error = this.validateField(input);
            if (error) {
                this.showFieldError(input, error);
                isValid = false;
            } else {
                this.clearFieldError(input);
            }
        });

        return isValid;
    }

    static validateField(field) {
        const value = field.value.trim();
        const fieldName = field.getAttribute('name') || field.id;

        if (field.hasAttribute('required') && !value) {
            return 'Это поле обязательно для заполнения';
        }

        // Специфичная валидация по типу поля
        switch (fieldName) {
            case 'title':
            case 'project-title':
            case 'task-title':
                return this.validateProjectTitle(value);
            case 'description':
            case 'project-description':
            case 'task-description':
                return this.validateProjectDescription(value);
            case 'email':
                return this.validateEmail(value) ? null : 'Некорректный email адрес';
            default:
                return null;
        }
    }

    static showFieldError(field, error) {
        this.clearFieldError(field);

        field.classList.add('is-invalid');

        const errorElement = document.createElement('div');
        errorElement.className = 'invalid-feedback';
        errorElement.textContent = error;

        field.parentNode.appendChild(errorElement);
    }

    static clearFieldError(field) {
        field.classList.remove('is-invalid');

        const existingError = field.parentNode.querySelector('.invalid-feedback');
        if (existingError) {
            existingError.remove();
        }
    }

    // Генерация случайного цвета на основе строки
    static generateColorFromString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = hash % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }

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
        if (CONFIG.ENV === 'development') {
            console.log(`[LOG] ${new Date().toISOString()} - ${message}`, data || '');
        }
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

    // Новые методы для улучшения UX
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static generateGradient(seed) {
        const colors = [
            ['#7367f0', '#ce9ffc'],
            ['#28c76f', '#81fbb8'],
            ['#ff9f43', '#ffcf71'],
            ['#ea5455', '#feb692'],
            ['#00cfe8', '#6ae9ff']
        ];
        const index = Math.abs(seed) % colors.length;
        return colors[index];
    }

    static sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                return true;
            } catch (fallbackError) {
                return false;
            } finally {
                document.body.removeChild(textArea);
            }
        }
    }

    static isOnline() {
        return navigator.onLine;
    }

    static getBrowserInfo() {
        const ua = navigator.userAgent;
        return {
            isChrome: /Chrome/.test(ua),
            isFirefox: /Firefox/.test(ua),
            isSafari: /Safari/.test(ua),
            isEdge: /Edge/.test(ua),
            isMobile: this.isMobile()
        };
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
            <div id="${toastId}" class="toast toast-${type}" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-content">
                    <i class="fas ${icons[type] || 'fa-info-circle'} toast-icon" aria-hidden="true"></i>
                    <div class="toast-message">${Utils.escapeHTML(message)}</div>
                    <button class="toast-close" onclick="this.parentElement.parentElement.remove()" aria-label="Закрыть">
                        <i class="fas fa-times" aria-hidden="true"></i>
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
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
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

    // Новый метод для прогресс-уведомлений
    static showProgressToast(message, progress = 0) {
        const toastId = 'progress-toast-' + Date.now();
        const toastHTML = `
            <div id="${toastId}" class="toast toast-info" role="alert">
                <div class="toast-content">
                    <i class="fas fa-spinner fa-spin toast-icon"></i>
                    <div class="toast-message">
                        <div>${Utils.escapeHTML(message)}</div>
                        <div class="progress mt-2">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const container = document.getElementById('toast-container') || this.createToastContainer();
        container.insertAdjacentHTML('beforeend', toastHTML);

        return {
            updateProgress: (newProgress) => {
                const progressBar = document.querySelector(`#${toastId} .progress-bar`);
                if (progressBar) {
                    progressBar.style.width = `${newProgress}%`;
                }
            },
            updateMessage: (newMessage) => {
                const messageEl = document.querySelector(`#${toastId} .toast-message div:first-child`);
                if (messageEl) {
                    messageEl.textContent = newMessage;
                }
            },
            close: () => {
                const toast = document.getElementById(toastId);
                if (toast) toast.remove();
            }
        };
    }
}

// Экспорт классов
window.Utils = Utils;
window.ToastManager = ToastManager;
