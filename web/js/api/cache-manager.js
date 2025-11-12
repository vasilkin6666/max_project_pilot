// Менеджер кэширования
class CacheManager {
    static cache = new Map();
    static strategies = {
        'projects': { ttl: CONFIG.CACHE_TTL.PROJECTS, priority: 'high' },
        'tasks': { ttl: CONFIG.CACHE_TTL.TASKS, priority: 'high' },
        'user-data': { ttl: CONFIG.CACHE_TTL.USER_DATA, priority: 'medium' },
        'notifications': { ttl: CONFIG.CACHE_TTL.NOTIFICATIONS, priority: 'high' },
        'dashboard': { ttl: 2 * 60 * 1000, priority: 'medium' }
    };

    static init() {
        // Периодическая очистка устаревшего кэша
        setInterval(() => {
            this.cleanup();
        }, 60 * 1000); // Каждую минуту

        Utils.log('Cache manager initialized');
    }

    static async getWithCache(key, fetcher, strategyKey = 'default') {
        const strategy = this.strategies[strategyKey] || { ttl: 60 * 1000 };
        const cached = this.cache.get(key);

        // Проверяем актуальность кэша
        if (cached && Date.now() - cached.timestamp < strategy.ttl) {
            Utils.log(`Cache hit: ${key}`);
            return cached.data;
        }

        Utils.log(`Cache miss: ${key}`);

        // Загружаем свежие данные
        try {
            const data = await fetcher();
            this.set(key, data, strategyKey);
            return data;
        } catch (error) {
            // В случае ошибки возвращаем кэшированные данные, даже если они устарели
            if (cached) {
                Utils.log(`Using stale cache for: ${key} due to error`);
                return cached.data;
            }
            throw error;
        }
    }

    static set(key, data, strategyKey = 'default') {
        const strategy = this.strategies[strategyKey] || { ttl: 60 * 1000 };

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            strategy: strategyKey,
            ttl: strategy.ttl
        });

        Utils.log(`Cache set: ${key}`);
    }

    static get(key) {
        const cached = this.cache.get(key);

        if (!cached) {
            return null;
        }

        // Проверяем не устарели ли данные
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    static delete(key) {
        this.cache.delete(key);
        Utils.log(`Cache deleted: ${key}`);
    }

    static invalidate(pattern) {
        const keysToRemove = [];

        for (const key of this.cache.keys()) {
            if (key === pattern || key.includes(pattern)) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => {
            this.cache.delete(key);
            Utils.log(`Cache invalidated: ${key}`);
        });

        return keysToRemove.length;
    }

    // Добавьте метод для принудительного обновления определенных данных
    static async refreshWithFallback(key, apiCall, fallbackData = null, ttl = 5 * 60 * 1000) {
        try {
            // Пробуем получить свежие данные
            const freshData = await apiCall();
            this.set(key, freshData, ttl);
            return freshData;
        } catch (error) {
            Utils.logError(`Failed to refresh ${key}:`, error);

            // Возвращаем закешированные данные или fallback
            const cached = this.get(key);
            if (cached) {
                Utils.log(`Using cached data for ${key} due to refresh failure`);
                return cached;
            }

            return fallbackData;
        }
    }

    static clear() {
        const count = this.cache.size;
        this.cache.clear();
        Utils.log(`Cache cleared: ${count} items`);
    }

    static cleanup() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [key, cached] of this.cache) {
            if (now - cached.timestamp > cached.ttl) {
                this.cache.delete(key);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            Utils.log(`Cache cleanup: removed ${cleanedCount} expired items`);
        }
    }

    static getStats() {
        const stats = {
            total: this.cache.size,
            byStrategy: {},
            memoryUsage: this.estimateMemoryUsage()
        };

        // Статистика по стратегиям
        for (const cached of this.cache.values()) {
            const strategy = cached.strategy;
            stats.byStrategy[strategy] = (stats.byStrategy[strategy] || 0) + 1;
        }

        return stats;
    }

    static estimateMemoryUsage() {
        // Примерная оценка использования памяти
        let size = 0;

        for (const [key, value] of this.cache) {
            size += key.length * 2; // UTF-16
            try {
                size += JSON.stringify(value.data).length * 2;
            } catch (e) {
                // Игнорируем циклические ссылки
            }
        }

        return size;
    }

    // Prefetch данных
    static async prefetch(key, fetcher, strategyKey = 'default') {
        if (this.get(key)) {
            return; // Уже в кэше
        }

        try {
            const data = await fetcher();
            this.set(key, data, strategyKey);
            Utils.log(`Prefetched: ${key}`);
        } catch (error) {
            Utils.logError(`Prefetch failed for ${key}:`, error);
        }
    }
}

window.CacheManager = CacheManager;
