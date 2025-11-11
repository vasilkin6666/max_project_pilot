// web/js/config.js
const CONFIG = {
    API_BASE_URL: 'https://powerfully-exotic-chamois.cloudpub.ru/api'
};

// Попытка загрузить конфигурацию из .env
async function loadConfig() {
    try {
        const response = await fetch('../.env');
        if (!response.ok) {
            console.log('Не удалось загрузить .env файл, используем значение по умолчанию');
            return;
        }

        const envContent = await response.text();
        const lines = envContent.split('\n');

        for (const line of lines) {
            // Пропускаем комментарии и пустые строки
            if (line.startsWith('#') || !line.trim()) continue;

            const [key, value] = line.split('=').map(part => part.trim());

            if (key === 'BACKEND_API_URL' && value) {
                CONFIG.API_BASE_URL = value;
                console.log('API URL загружен из .env:', CONFIG.API_BASE_URL);
                break;
            }
        }
    } catch (error) {
        console.log('Ошибка загрузки .env файла, используем значение по умолчанию:', CONFIG.API_BASE_URL);
    }
}

// Загружаем конфигурацию при импорте
loadConfig();
