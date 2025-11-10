// Утилитарные функции
function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
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

function getStatusColor(status) {
    const colors = {
        'todo': 'warning',
        'in_progress': 'info',
        'done': 'success'
    };
    return colors[status] || 'secondary';
}

function getStatusText(status) {
    const texts = {
        'todo': 'К выполнению',
        'in_progress': 'В работе',
        'done': 'Завершено'
    };
    return texts[status] || status;
}

function getPriorityColor(priority) {
    const colors = {
        'low': 'success',
        'medium': 'warning',
        'high': 'danger',
        'urgent': 'danger'
    };
    return colors[priority] || 'secondary';
}

function debounce(func, wait) {
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

function provideHapticFeedback(style = 'light') {
    if (window.WebApp && window.WebApp.HapticFeedback) {
        try {
            if (style === 'notification') {
                if (window.WebApp.HapticFeedback.notificationOccurred) {
                    window.WebApp.HapticFeedback.notificationOccurred('success');
                    return true;
                }
            } else {
                if (window.WebApp.HapticFeedback.impactOccurred) {
                    window.WebApp.HapticFeedback.impactOccurred(style);
                    return true;
                }
            }
        } catch (error) {
            console.log('Haptic feedback not available');
        }
    }
    return false;
}

// Функция для показа toast-уведомлений
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();

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
                    ${escapeHTML(message)}
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

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    return container;
}

// Функция для форматирования чисел
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Функция для проверки прав пользователя в проекте
function hasProjectPermission(project, permission) {
    if (!currentUser) return false;

    const userMember = project.members?.find(m => m.user_id === currentUser.id);
    if (!userMember) return false;

    const permissions = {
        'owner': ['all'],
        'admin': ['manage_tasks', 'manage_members', 'view'],
        'member': ['manage_tasks', 'view'],
        'guest': ['view']
    };

    return permissions[userMember.role]?.includes('all') ||
           permissions[userMember.role]?.includes(permission);
}
