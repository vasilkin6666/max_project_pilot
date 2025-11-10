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
    return date.toLocaleDateString('ru-RU');
}

function getStatusColor(status) {
    const colors = {'todo': 'warning', 'in_progress': 'info', 'done': 'success'};
    return colors[status] || 'secondary';
}

function getStatusText(status) {
    const texts = {'todo': 'К выполнению', 'in_progress': 'В работе', 'done': 'Завершено'};
    return texts[status] || status;
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
                }
            } else {
                if (window.WebApp.HapticFeedback.impactOccurred) {
                    window.WebApp.HapticFeedback.impactOccurred(style);
                }
            }
        } catch (error) {
            console.log('Haptic feedback not available');
        }
    }
}
