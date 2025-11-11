// Менеджер сохранения данных
class PersistenceManager {
    static async saveData(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            Utils.logError(`Failed to save data for key: ${key}`, error);
            return false;
        }
    }

    static async loadData(key, defaultValue = null) {
        try {
            const serialized = localStorage.getItem(key);
            if (serialized) {
                return JSON.parse(serialized);
            }
            return defaultValue;
        } catch (error) {
            Utils.logError(`Failed to load data for key: ${key}`, error);
            return defaultValue;
        }
    }

    static async removeData(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            Utils.logError(`Failed to remove data for key: ${key}`, error);
            return false;
        }
    }

    static async clearAll() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            Utils.logError('Failed to clear all data', error);
            return false;
        }
    }

    static async exportData() {
        try {
            const data = {};

            // Собираем все данные из localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) {
                    data[key] = await this.loadData(key);
                }
            }

            // Создаем файл для скачивания
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `project-pilot-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return true;
        } catch (error) {
            Utils.logError('Failed to export data', error);
            return false;
        }
    }

    static async importData(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Восстанавливаем данные
            for (const [key, value] of Object.entries(data)) {
                await this.saveData(key, value);
            }

            ToastManager.success('Данные успешно восстановлены');
            return true;
        } catch (error) {
            Utils.logError('Failed to import data', error);
            ToastManager.error('Ошибка при восстановлении данных');
            return false;
        }
    }

    static getStorageInfo() {
        let totalSize = 0;
        const items = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                const value = localStorage.getItem(key);
                const size = new Blob([value]).size;
                totalSize += size;
                items.push({ key, size });
            }
        }

        return {
            totalItems: localStorage.length,
            totalSize,
            items: items.sort((a, b) => b.size - a.size)
        };
    }

    static async cleanupOldData() {
        try {
            const now = Date.now();
            const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
            let cleanedCount = 0;

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('cache_')) {
                    const data = await this.loadData(key);
                    if (data && data.timestamp && data.timestamp < oneWeekAgo) {
                        await this.removeData(key);
                        cleanedCount++;
                    }
                }
            }

            if (cleanedCount > 0) {
                Utils.log(`Cleaned up ${cleanedCount} old cache items`);
            }

            return cleanedCount;
        } catch (error) {
            Utils.logError('Failed to cleanup old data', error);
            return 0;
        }
    }
}

window.PersistenceManager = PersistenceManager;
