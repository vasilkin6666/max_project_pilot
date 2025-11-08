// Функция для отображения данных пользователя
function showUserInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');
    const userName = localStorage.getItem('user_name') || 'Гость';

    if (userId) {
        document.getElementById('user-name').textContent = userName;
        document.getElementById('user-avatar').textContent = userName.charAt(0).toUpperCase();
        showMainInterface();
    } else {
        document.getElementById('mainInterface').innerHTML = `
            <div class="max-card text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-muted mb-3"></i>
                <h6>Ошибка</h6>
                <p class="text-muted">Отсутствует идентификатор пользователя. Перейдите в бота для авторизации.</p>
            </div>
        `;
    }
}

// Проверка наличия user_id при загрузке страницы
window.addEventListener('load', () => {
    showUserInfo();
});

// Функции для отображения интерфейса
function showAuthSection() {
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('mainInterface').style.display = 'none';
}

function showMainInterface() {
    document.getElementById('mainInterface').style.display = 'block';
}
