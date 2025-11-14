// Utility functions
class Utils {
    static init() {
        console.log('Utils module initialized');
        return Promise.resolve();
    }

    // DOM utilities
    static $(selector) {
        return document.querySelector(selector);
    }

    static $$(selector) {
        return document.querySelectorAll(selector);
    }

    static createElement(tag, classes = '', content = '') {
        const element = document.createElement(tag);
        if (classes) element.className = classes;
        if (content) element.innerHTML = content;
        return element;
    }

    // String utilities
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static truncate(text, length = 100) {
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    }

    static generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    static getInitials(name) {
        return name
            .split(' ')
            .map(part => part.charAt(0))
            .join('')
            .toUpperCase()
            .substr(0, 2);
    }

    // Date utilities
    static formatDate(dateString) {
        if (!dateString) return 'Не установлен';

        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    static formatDateTime(dateString) {
        if (!dateString) return '';

        const date = new Date(dateString);
        return date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static isToday(dateString) {
        if (!dateString) return false;

        const date = new Date(dateString);
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    static isOverdue(dateString) {
        if (!dateString) return false;

        const date = new Date(dateString);
        const today = new Date();
        return date < today;
    }

    // Color utilities
    static stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }

        const hue = hash % 360;
        return `hsl(${hue}, 70%, 60%)`;
    }

    static getContrastColor(hexColor) {
        // Convert hex to RGB
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);

        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    // Validation utilities
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static isEmpty(value) {
        return value === null || value === undefined || value === '' ||
               (Array.isArray(value) && value.length === 0) ||
               (typeof value === 'object' && Object.keys(value).length === 0);
    }

    // Storage utilities
    static setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }

    static getStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return defaultValue;
        }
    }

    static removeStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    }

    // Number utilities
    static formatNumber(number) {
        return new Intl.NumberFormat('ru-RU').format(number);
    }

    static random(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Array utilities
    static sortBy(array, key, direction = 'asc') {
        return array.sort((a, b) => {
            let aVal = a[key];
            let bVal = b[key];

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    static groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = item[key];
            if (!groups[group]) {
                groups[group] = [];
            }
            groups[group].push(item);
            return groups;
        }, {});
    }

    static unique(array) {
        return [...new Set(array)];
    }

    // Object utilities
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    static merge(target, source) {
        return { ...target, ...source };
    }

    // Function utilities
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

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

    // UI utilities
    static showElement(element) {
        if (element) element.style.display = '';
    }

    static hideElement(element) {
        if (element) element.style.display = 'none';
    }

    static toggleElement(element) {
        if (element) {
            element.style.display = element.style.display === 'none' ? '' : 'none';
        }
    }

    static addClass(element, className) {
        if (element) element.classList.add(className);
    }

    static removeClass(element, className) {
        if (element) element.classList.remove(className);
    }

    static toggleClass(element, className) {
        if (element) element.classList.toggle(className);
    }

    // Notification utilities
    static showToast(message, type = 'info', duration = 5000) {
        const toastManager = window.App?.modules?.notifications;
        if (toastManager) {
            toastManager.showToast(message, type, duration);
        } else {
            // Fallback
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }

    // File utilities
    static downloadFile(content, filename, contentType = 'text/plain') {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    static readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    // Performance utilities
    static measurePerformance(fn, label = 'Operation') {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        console.log(`${label} took ${(end - start).toFixed(2)}ms`);
        return result;
    }

    // Error handling
    static handleError(error, context = '') {
        console.error(`Error in ${context}:`, error);

        const errorMessage = error.message || 'Произошла неизвестная ошибка';
        this.showToast(errorMessage, 'error');

        // You can add additional error reporting here
        // Sentry.captureException(error);
    }

    // Network utilities
    static isOnline() {
        return navigator.onLine;
    }

    static wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Make Utils available globally
window.Utils = Utils;
