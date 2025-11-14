// Cache management
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes
        this.cleanupInterval = 10 * 60 * 1000; // 10 minutes
    }

    async init() {
        console.log('Cache manager initialized');
        this.loadPersistentCache();
        this.startCleanupInterval();
        return Promise.resolve();
    }

    // Basic cache operations
    set(key, value, ttl = this.defaultTTL) {
        const expiresAt = Date.now() + ttl;
        this.cache.set(key, {
            value,
            expiresAt,
            ttl
        });

        // Also persist to localStorage for important data
        if (key.startsWith('persistent:')) {
            this.persistToStorage(key, { value, expiresAt, ttl });
        }
    }

    get(key) {
        const item = this.cache.get(key);

        if (!item) {
            // Try to load from persistent storage
            const persistentItem = this.getFromStorage(key);
            if (persistentItem && !this.isExpired(persistentItem)) {
                this.cache.set(key, persistentItem);
                return persistentItem.value;
            }
            return null;
        }

        if (this.isExpired(item)) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    delete(key) {
        this.cache.delete(key);
        this.removeFromStorage(key);
    }

    clear() {
        this.cache.clear();
        this.clearStorage();
    }

    has(key) {
        const item = this.get(key);
        return item !== null;
    }

    // TTL management
    isExpired(item) {
        return Date.now() > item.expiresAt;
    }

    getExpiration(key) {
        const item = this.cache.get(key);
        return item ? item.expiresAt - Date.now() : 0;
    }

    extendTTL(key, ttl = this.defaultTTL) {
        const item = this.cache.get(key);
        if (item) {
            item.expiresAt = Date.now() + ttl;
            return true;
        }
        return false;
    }

    // Cache patterns
    async getOrSet(key, fetchFn, ttl = this.defaultTTL) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        try {
            const value = await fetchFn();
            this.set(key, value, ttl);
            return value;
        } catch (error) {
            console.error(`Error fetching data for cache key "${key}":`, error);
            throw error;
        }
    }

    async getWithFallback(key, fetchFn, ttl = this.defaultTTL) {
        const cached = this.get(key);
        if (cached !== null) {
            // Return cached but refresh in background
            this.refreshInBackground(key, fetchFn, ttl);
            return cached;
        }

        return this.getOrSet(key, fetchFn, ttl);
    }

    async refreshInBackground(key, fetchFn, ttl = this.defaultTTL) {
        try {
            const value = await fetchFn();
            this.set(key, value, ttl);
        } catch (error) {
            console.error(`Background refresh failed for key "${key}":`, error);
        }
    }

    // Cache invalidation
    invalidate(pattern) {
        const keysToDelete = [];

        for (const key of this.cache.keys()) {
            if (this.matchesPattern(key, pattern)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.delete(key));
        return keysToDelete.length;
    }

    invalidatePrefix(prefix) {
        return this.invalidate(new RegExp(`^${prefix}`));
    }

    invalidateSuffix(suffix) {
        return this.invalidate(new RegExp(`${suffix}$`));
    }

    matchesPattern(key, pattern) {
        if (pattern instanceof RegExp) {
            return pattern.test(key);
        }
        if (typeof pattern === 'string') {
            return key.includes(pattern);
        }
        if (typeof pattern === 'function') {
            return pattern(key);
        }
        return false;
    }

    // Cache statistics
    getStats() {
        const stats = {
            total: this.cache.size,
            expired: 0,
            memoryUsage: 0,
            hitRate: this.calculateHitRate()
        };

        for (const [key, item] of this.cache) {
            if (this.isExpired(item)) {
                stats.expired++;
            }
            // Rough memory estimation
            stats.memoryUsage += this.estimateSize(item.value);
        }

        return stats;
    }

    calculateHitRate() {
        // This would require tracking hits/misses
        // For now, return a placeholder
        return 0;
    }

    estimateSize(obj) {
        const str = JSON.stringify(obj);
        return new Blob([str]).size;
    }

    // Persistent storage (localStorage)
    persistToStorage(key, item) {
        try {
            localStorage.setItem(`cache_${key}`, JSON.stringify({
                ...item,
                persistedAt: Date.now()
            }));
        } catch (error) {
            console.error('Error persisting to storage:', error);
            this.cleanupStorage(); // Try to free up space
        }
    }

    getFromStorage(key) {
        try {
            const item = localStorage.getItem(`cache_${key}`);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error('Error reading from storage:', error);
            return null;
        }
    }

    removeFromStorage(key) {
        try {
            localStorage.removeItem(`cache_${key}`);
        } catch (error) {
            console.error('Error removing from storage:', error);
        }
    }

    clearStorage() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('cache_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (error) {
            console.error('Error clearing storage:', error);
        }
    }

    loadPersistentCache() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('cache_')) {
                    const item = JSON.parse(localStorage.getItem(key));
                    const cacheKey = key.replace('cache_', '');

                    // Only load if not expired
                    if (!this.isExpired(item)) {
                        this.cache.set(cacheKey, item);
                    } else {
                        this.removeFromStorage(cacheKey);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading persistent cache:', error);
        }
    }

    cleanupStorage() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('cache_')) {
                    const item = JSON.parse(localStorage.getItem(key));
                    if (this.isExpired(item)) {
                        keysToRemove.push(key);
                    }
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (error) {
            console.error('Error cleaning up storage:', error);
        }
    }

    // Cleanup and maintenance
    startCleanupInterval() {
        setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }

    cleanup() {
        const now = Date.now();
        const keysToDelete = [];

        for (const [key, item] of this.cache) {
            if (now > item.expiresAt) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));

        // Also cleanup storage
        this.cleanupStorage();

        if (keysToDelete.length > 0) {
            console.log(`Cache cleanup: removed ${keysToDelete.length} expired items`);
        }
    }

    // Cache keys for different data types
    static Keys = {
        PROJECTS: 'projects',
        PROJECT: (hash) => `project:${hash}`,
        PROJECT_SUMMARY: (hash) => `project_summary:${hash}`,
        PROJECT_MEMBERS: (hash) => `project_members:${hash}`,
        PROJECT_TASKS: (hash) => `project_tasks:${hash}`,
        TASK: (id) => `task:${id}`,
        USER_TASKS: (filters = '') => `user_tasks:${JSON.stringify(filters)}`,
        USER_PROFILE: 'user_profile',
        USER_PREFERENCES: 'user_preferences',
        NOTIFICATIONS: 'notifications',
        SEARCH_RESULTS: (query) => `search:${query}`
    };

    // Predefined TTL values
    static TTL = {
        SHORT: 1 * 60 * 1000, // 1 minute
        MEDIUM: 5 * 60 * 1000, // 5 minutes
        LONG: 30 * 60 * 1000, // 30 minutes
        VERY_LONG: 2 * 60 * 60 * 1000, // 2 hours
        PERSISTENT: 24 * 60 * 60 * 1000 // 24 hours
    };
}
