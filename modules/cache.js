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
        // Ошибки не кэшируются - считаются неспрошенными
        if (owners === -1) return 0;
        
        if (owners <= 60) return 2 * 60 * 60 * 1000;      // ≤ 60: 2 часа
        if (owners <= 110) return 6 * 60 * 60 * 1000;     // 61-110: 6 часов
        if (owners <= 240) return 24 * 60 * 60 * 1000;    // 111-240: 24 часа
        if (owners <= 600) return 96 * 60 * 60 * 1000;    // 241-600: 4 дня
        if (owners <= 1200) return 192 * 60 * 60 * 1000;  // 601-1200: 8 дней
        return 336 * 60 * 60 * 1000;                       // > 1200: 14 дней
    }

    static isValid(entry) {
        if (!entry || typeof entry.ts !== 'number') return false;
        
        // Ошибки всегда невалидны - будут пересчитаны как новые карты
        if (entry.owners === -1) return false;
        
        const ttl = this.ttlForOwners(entry.owners ?? -1);
        return (Utils.now() - entry.ts) < ttl;
    }

    static isExpired(entry) {
        if (!entry || typeof entry.ts !== 'number') return true;
        
        // Ошибки всегда expired
        if (entry.owners === -1) return true;
        
        const ttl = this.ttlForOwners(entry.owners ?? -1);
        return (Utils.now() - entry.ts) >= ttl;
    }

    static hasError(entry) {
        return entry && entry.owners === -1;
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
        const entries = Object.values(this.data);
        return {
            total: Object.keys(this.data).length,
            expired: entries.filter(e => this.isExpired(e)).length,
            errors: entries.filter(e => this.hasError(e)).length
        };
    }
}