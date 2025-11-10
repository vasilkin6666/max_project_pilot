// Утилитарные функции
class Utils {
    static escapeHTML(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Сегодня';
        } else if (diffDays === 1) {
            return 'Вчера';
        } else if (diffDays < 7) {
            return `${diffDays} дней назад`;
        } else {
            return date.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        }
    }

    static getStatusColor(status) {
        const colors = {
            'todo': 'warning',
            'in_progress': 'info',
            'done': 'success'
        };
        return colors[status] || 'secondary';
    }

    static getStatusText(status) {
        const texts = {
            'todo': 'К выполнению',
            'in_progress': 'В работе',
            'done': 'Завершено'
        };
        return texts[status] || status;
    }

    static getPriorityColor(priority) {
        const colors = {
            'low': 'success',
            'medium': 'warning',
            'high': 'danger',
            'urgent': 'danger'
        };
        return colors[priority] || 'secondary';
    }

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

    // УБРАТЬ HAPTIC FEEDBACK - не поддерживается в MAX WebApp
    static provideHapticFeedback(style = 'light') {
        // MAX WebApp не поддерживает haptic feedback, поэтому просто возвращаем false
        return false;
    }

    static log(message, data = null) {
        console.log(`[LOG] ${new Date().toISOString()} - ${message}`, data || '');
    }

    static logError(message, error = null) {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');
    }

    static triggerEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }
}

// Toast уведомления
class ToastManager {
    static showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container') || this.createToastContainer();

        const toastId = 'toast-' + Date.now();
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toastHTML = `
            <div id="${toastId}" class="toast align-items-center text-bg-${type} border-0 fade-in" role="alert">
                <div class="d-flex">
                    <div class="toast-body d-flex align-items-center">
                        <i class="fas ${icons[type] || 'fa-info-circle'} me-2"></i>
                        ${Utils.escapeHTML(message)}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHTML);

        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 4000
        });

        toast.show();

        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.style.transition = 'opacity 0.3s ease';
            toastElement.style.opacity = '0';
            setTimeout(() => {
                toastElement.remove();
            }, 300);
        });
    }

    static createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        return container;
    }
}

// Глобальные экспорты
window.Utils = Utils;
window.ToastManager = ToastManager;
