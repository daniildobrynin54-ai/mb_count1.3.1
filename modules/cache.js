// Cache Management
import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { Utils } from './utils.js';
import { storageGet, storageSet } from './storage.js';

export class Cache {
    static data = {};
    static pendingFetches = new Map();
    static saveTimer = null;

    static async load() {
        try {
            const raw = await storageGet(CONFIG.CACHE_KEY, '{}');
            if (!raw) { 
                this.data = {}; 
                return; 
            }
            if (typeof raw === 'string') {
                this.data = JSON.parse(raw || '{}');
            } else {
                this.data = raw;
            }
            Logger.info(`Cache loaded: ${Object.keys(this.data).length} cards`);
        } catch (e) {
            Logger.warn('Cache.load parse error, resetting cache', e);
            this.data = {};
        }
    }

    static async persist() {
        try {
            await storageSet(CONFIG.CACHE_KEY, JSON.stringify(this.data));
            Logger.info('💾 Cache saved to chrome.storage.local');
        } catch (e) {
            Logger.warn('Cache.persist error', e);
        }
    }

    static scheduleSave() {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.persist(), 2000);
    }

    static get(cardId) {
        return this.data[cardId] || null;
    }

    static set(cardId, owners, wants, manualUpdate = false) {
        this.data[cardId] = {
            owners,
            wants,
            ts: Utils.now(),
            manualUpdate: manualUpdate ? Utils.now() : (this.data[cardId]?.manualUpdate || null)
        };
        this.scheduleSave();
    }

    static clear() {
        this.data = {};
        return this.persist();
    }

    static ttlForOwners(owners) {
        if (owners === -1) return 1 * 60 * 1000;
        if (owners <= 60) return 1 * 60 * 60 * 1000;
        if (owners <= 240) return 12 * 60 * 60 * 1000;
        if (owners <= 600) return 48 * 60 * 60 * 1000;
        if (owners <= 1200) return 96 * 60 * 60 * 1000;
        return 240 * 60 * 60 * 1000;
    }

    static isValid(entry) {
        if (!entry || typeof entry.ts !== 'number') return false;
        const ttl = this.ttlForOwners(entry.owners ?? -1);
        return (Utils.now() - entry.ts) < ttl;
    }

    static isExpired(entry) {
        if (!entry || typeof entry.ts !== 'number') return true;
        const ttl = this.ttlForOwners(entry.owners ?? -1);
        return (Utils.now() - entry.ts) >= ttl;
    }

    static isRecentlyManuallyUpdated(entry) {
        if (!entry || !entry.manualUpdate) return false;
        const oneHour = 60 * 60 * 1000;
        return (Utils.now() - entry.manualUpdate) < oneHour;
    }

    static async importFromObject(obj) {
        if (!obj || typeof obj !== 'object') return;
        let imported = 0;
        
        for (const [k, v] of Object.entries(obj)) {
            if (!v || typeof v !== 'object') continue;
            
            if (typeof v.ts === 'number') {
                const existing = this.data[k];
                if (!existing || (v.ts > existing.ts)) {
                    this.data[k] = {
                        owners: v.owners,
                        wants: v.wants,
                        ts: v.ts,
                        manualUpdate: v.manualUpdate || null
                    };
                    imported++;
                }
            }
        }
        
        await this.persist();
        Logger.important(`📥 Imported ${imported} cards into cache`);
        return imported;
    }

    static async getStats() {
        return {
            total: Object.keys(this.data).length,
            expired: Object.values(this.data).filter(e => this.isExpired(e)).length
        };
    }
}
