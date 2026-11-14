import CONFIG from "../config/constants.js";

/**
 * In-memory TTL cache for search queries and research reports.
 * Reduces redundant calls to Tavily and Groq to stay within free-tier quotas.
 */
class CacheService {
    constructor() {
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0
        };

        // Periodic cleanup every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
    }

    normalizeKey(key) {
        if (!key || typeof key !== "string") return "";
        return key.toLowerCase().replace(/\s+/g, " ").trim();
    }

    get(key) {
        const normKey = this.normalizeKey(key);
        const item = this.cache.get(normKey);

        if (!item) {
            this.stats.misses++;
            return null;
        }

        if (Date.now() > item.expiresAt) {
            this.cache.delete(normKey);
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return item.value;
    }

    set(key, value, ttlMinutes = CONFIG.RESEARCH_CACHE_TTL_MINUTES) {
        const normKey = this.normalizeKey(key);
        const expiresAt = Date.now() + (ttlMinutes * 60 * 1000);

        this.cache.set(normKey, {
            value,
            expiresAt,
            createdAt: new Date().toISOString()
        });
    }

    has(key) {
        return this.get(key) !== null;
    }

    delete(key) {
        const normKey = this.normalizeKey(key);
        return this.cache.delete(normKey);
    }

    clear() {
        this.cache.clear();
        this.stats.hits = 0;
        this.stats.misses = 0;
    }

    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRatio = total > 0 ? (this.stats.hits / total).toFixed(2) : "0.00";

        return {
            size: this.cache.size,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRatio: Number(hitRatio),
            ttlMinutes: CONFIG.RESEARCH_CACHE_TTL_MINUTES
        };
    }
}

export const cacheService = new CacheService();
export default cacheService;
