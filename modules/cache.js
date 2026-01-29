// Optimized cache management with memory limits and better performance
import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { Utils } from './utils.js';
import { storageGet, storageSet } from './storage.js';

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {number} owners - Number of owners
 * @property {number} wants - Number of wants
 * @property {number} ts - Timestamp
 * @property {number|null} manualUpdate - Manual update timestamp
 */

export class Cache {
    static data = new Map(); // Use Map instead of Object for better performance
    static pendingFetches = new Map();
    static saveTimer = null;
    static isDirty = false;
    static savePromise = null;

    /**
     * Load cache from storage
     */
    static async load() {
        try {
            const raw = await storageGet(CONFIG.CACHE_KEY, null);
            
            if (!raw) {
                this.data = new Map();
                Logger.info('Cache initialized (empty)');
                return;
            }

            // Handle both object and string formats
            const parsed = typeof raw === 'string' 
                ? Utils.safeJsonParse(raw, {}) 
                : raw;

            // Convert to Map
            this.data = new Map(Object.entries(parsed));
            
            // Clean up old entries on load
            this._cleanupOldEntries();
            
            Logger.info(`Cache loaded: ${this.data.size} entries`);
        } catch (e) {
            Logger.error('Cache load error:', e);
            this.data = new Map();
        }
    }

    /**
     * Persist cache to storage with batching
     */
    static async persist() {
        // If save is already in progress, wait for it
        if (this.savePromise) {
            return this.savePromise;
        }

        this.savePromise = this._doPersist();
        
        try {
            await this.savePromise;
        } finally {
            this.savePromise = null;
        }
    }

    static async _doPersist() {
        if (!this.isDirty) return;

        try {
            // Convert Map to Object for storage
            const obj = Object.fromEntries(this.data);
            await storageSet(CONFIG.CACHE_KEY, obj);
            
            this.isDirty = false;
            Logger.info(`💾 Cache saved: ${this.data.size} entries`);
        } catch (e) {
            Logger.error('Cache persist error:', e);
        }
    }

    /**
     * Schedule save with debouncing
     */
    static scheduleSave() {
        this.isDirty = true;
        
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        
        this.saveTimer = setTimeout(() => {
            this.persist();
        }, 2000);
    }

    /**
     * Get cache entry
     */
    static get(cardId) {
        return this.data.get(cardId) || null;
    }

    /**
     * Set cache entry with automatic cleanup
     */
    static set(cardId, owners, wants, manualUpdate = false) {
        // Check cache size limit
        if (this.data.size >= CONFIG.MAX_CACHE_ENTRIES && !this.data.has(cardId)) {
            this._removeOldestEntry();
        }

        const existing = this.data.get(cardId);
        
        this.data.set(cardId, {
            owners,
            wants,
            ts: Utils.now(),
            manualUpdate: manualUpdate ? Utils.now() : (existing?.manualUpdate || null)
        });
        
        this.scheduleSave();
    }

    /**
     * Remove oldest entry (LRU-like behavior)
     */
    static _removeOldestEntry() {
        let oldestKey = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.data.entries()) {
            if (entry.ts < oldestTime) {
                oldestTime = entry.ts;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.data.delete(oldestKey);
            Logger.info(`Removed oldest cache entry: ${oldestKey}`);
        }
    }

    /**
     * Clean up expired and error entries
     */
    static _cleanupOldEntries() {
        let removed = 0;
        const now = Utils.now();
        const maxAge = CONFIG.TTL.VERY_COMMON; // Keep entries up to 14 days

        for (const [key, entry] of this.data.entries()) {
            // Remove very old entries regardless of validity
            if (now - entry.ts > maxAge) {
                this.data.delete(key);
                removed++;
            }
        }

        if (removed > 0) {
            Logger.info(`Cleaned up ${removed} old cache entries`);
            this.isDirty = true;
        }
    }

    /**
     * Clear all cache
     */
    static async clear() {
        this.data.clear();
        this.pendingFetches.clear();
        
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        
        await storageSet(CONFIG.CACHE_KEY, {});
        this.isDirty = false;
        
        Logger.important('Cache cleared');
    }

    /**
     * Get TTL based on owner count
     */
    static getTTL(owners) {
        if (owners === -1) return 0; // Errors not cached
        if (owners <= 60) return CONFIG.TTL.VERY_RARE;
        if (owners <= 110) return CONFIG.TTL.RARE;
        if (owners <= 240) return CONFIG.TTL.UNCOMMON;
        if (owners <= 600) return CONFIG.TTL.COMMON;
        if (owners <= 1200) return CONFIG.TTL.FREQUENT;
        return CONFIG.TTL.VERY_COMMON;
    }

    /**
     * Check if entry is valid
     */
    static isValid(entry) {
        if (!entry || typeof entry.ts !== 'number') return false;
        if (entry.owners === -1) return false; // Errors always invalid
        
        const ttl = this.getTTL(entry.owners);
        return (Utils.now() - entry.ts) < ttl;
    }

    /**
     * Check if entry is expired
     */
    static isExpired(entry) {
        return !this.isValid(entry);
    }

    /**
     * Check if entry has error
     */
    static hasError(entry) {
        return entry && entry.owners === -1;
    }

    /**
     * Check if recently manually updated
     */
    static isRecentlyManuallyUpdated(entry) {
        if (!entry || !entry.manualUpdate) return false;
        return (Utils.now() - entry.manualUpdate) < CONFIG.MANUAL_UPDATE_COOLDOWN;
    }

    /**
     * Import cache from object (for cache import feature)
     */
    static async importFromObject(obj) {
        if (!obj || typeof obj !== 'object') {
            Logger.warn('Invalid import data');
            return 0;
        }

        let imported = 0;
        const entries = Object.entries(obj);

        for (const [key, value] of entries) {
            if (!value || typeof value !== 'object') continue;
            if (typeof value.ts !== 'number') continue;

            const existing = this.data.get(key);
            
            // Import if newer or doesn't exist
            if (!existing || value.ts > existing.ts) {
                this.data.set(key, {
                    owners: value.owners,
                    wants: value.wants,
                    ts: value.ts,
                    manualUpdate: value.manualUpdate || null
                });
                imported++;
            }
        }

        if (imported > 0) {
            this.isDirty = true;
            await this.persist();
            Logger.important(`📥 Imported ${imported}/${entries.length} cache entries`);
        }

        return imported;
    }

    /**
     * Export cache to object
     */
    static exportToObject() {
        return Object.fromEntries(this.data);
    }

    /**
     * Get cache statistics
     */
    static async getStats() {
        const entries = Array.from(this.data.values());
        const now = Utils.now();

        return {
            total: this.data.size,
            expired: entries.filter(e => this.isExpired(e)).length,
            errors: entries.filter(e => this.hasError(e)).length,
            valid: entries.filter(e => this.isValid(e)).length,
            pendingFetches: this.pendingFetches.size,
            oldestEntry: entries.length > 0 
                ? Math.floor((now - Math.min(...entries.map(e => e.ts))) / 1000 / 60 / 60)
                : 0,
            newestEntry: entries.length > 0
                ? Math.floor((now - Math.max(...entries.map(e => e.ts))) / 1000 / 60)
                : 0
        };
    }

    /**
     * Get entries by status
     */
    static getEntriesByStatus() {
        const valid = [];
        const expired = [];
        const errors = [];

        for (const [key, entry] of this.data.entries()) {
            if (this.hasError(entry)) {
                errors.push({ id: key, ...entry });
            } else if (this.isExpired(entry)) {
                expired.push({ id: key, ...entry });
            } else {
                valid.push({ id: key, ...entry });
            }
        }

        return { valid, expired, errors };
    }

    /**
     * Prune cache to max size
     */
    static pruneToMaxSize(maxSize = CONFIG.MAX_CACHE_ENTRIES) {
        if (this.data.size <= maxSize) return 0;

        // Sort by timestamp (oldest first)
        const sorted = Array.from(this.data.entries())
            .sort((a, b) => a[1].ts - b[1].ts);

        const toRemove = sorted.slice(0, this.data.size - maxSize);
        
        for (const [key] of toRemove) {
            this.data.delete(key);
        }

        if (toRemove.length > 0) {
            this.isDirty = true;
            Logger.important(`Pruned ${toRemove.length} cache entries`);
        }

        return toRemove.length;
    }

    /**
     * Get memory usage estimate (rough)
     */
    static getMemoryEstimate() {
        const entrySize = 100; // Rough estimate per entry in bytes
        return {
            bytes: this.data.size * entrySize,
            mb: (this.data.size * entrySize / 1024 / 1024).toFixed(2)
        };
    }
}