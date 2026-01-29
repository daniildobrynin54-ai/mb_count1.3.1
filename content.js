(function() {
    'use strict';

    const CONFIG = {
        CARD_SELECTORS: [
            '.manga-cards__item',
            '.card-filter-list__card',
            '.deck__item',
            '.deck__list .deck__item',
            '.trade__main-item',
            '.trade__main-items a',
            '.trade__main-items--creator a',
            '.trade__main-items--receiver a',
            '.exchange-card',
            '.exchange__card',
            '.exchange-item__card',
            '.trade-card',
            '.trade__card',
            '[data-exchange-card]',
            '.pack-card',
            '.pack__card',
            '.pack-opening__card',
            '.lootbox__card',
            '.gacha-card',
            '.gacha__result-card',
            '[data-pack-card]',
            '.modal-card',
            '.popup-card'
        ],
        BATCH_SIZE: 4,
        PAUSE_BETWEEN_REQUESTS: 4200,
        REQUEST_TIMEOUT: 10000,
        MAX_RETRIES: 3,
        RETRY_429_DELAY: 15000,
        RETRY_429_MAX_ATTEMPTS: 3,
        OWNERS_PER_PAGE: 36,
        WANTS_PER_PAGE: 60,
        CACHE_KEY: 'mbuf_cache_v3',
        ENABLED_KEY: 'mbuf_enabled',
        MAX_REQUESTS_PER_MINUTE: 70,
        RATE_LIMIT_WINDOW: 60000,
        OWNERS_APPROXIMATE_THRESHOLD: 11,
        WANTS_APPROXIMATE_THRESHOLD: 5,
        OWNERS_LAST_PAGE_ESTIMATE: 18,
        WANTS_LAST_PAGE_ESTIMATE: 30,
        DEBUG: false
    };

    // -------------------------
    // Logger
    // -------------------------
    const Logger = {
        info(...args) {
            if (CONFIG.DEBUG) console.log('[MBUF]', ...args);
        },
        warn(...args) {
            console.warn('[MBUF]', ...args);
        },
        error(...args) {
            console.error('[MBUF]', ...args);
        },
        important(...args) {
            console.log('[MBUF]', ...args);
        }
    };

    // -------------------------
    // Notification Manager (ОБНОВЛЕННЫЙ)
    // -------------------------
// -------------------------
// Notification Manager (ИСПРАВЛЕННЫЙ)
// -------------------------
class NotificationManager {
    static currentNotification = null;
    static countdownInterval = null;
    static autoHideTimeout = null;

    static showRateLimitWarning(seconds) {
        this.hideNotification();

        const notification = document.createElement('div');
        notification.className = 'mbuf-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #FF6B6B, #FF8E53);
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideDown 0.3s ease;
            border: 2px solid rgba(255, 255, 255, 0.3);
            min-width: 280px;
            max-width: 400px;
        `;

        notification.innerHTML = `
            <div style="font-size: 24px;">⚠️</div>
            <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">Rate Limit достигнут!</div>
                <div style="font-size: 12px; opacity: 0.95;">Ожидание: <span id="mbuf-countdown" style="font-weight: 700; color: #FFD93D;">${seconds}</span> сек</div>
            </div>
            <div class="mbuf-close-btn" style="font-size: 18px; opacity: 0.7; margin-left: 8px; cursor: pointer; padding: 4px;" title="Закрыть">✕</div>
        `;

        // ИСПРАВЛЕНИЕ: Добавляем в DOM ПЕРЕД получением элемента
        document.body.appendChild(notification);
        this.currentNotification = notification;

        // ИСПРАВЛЕНИЕ: Теперь элемент точно существует в DOM
        const countdownElement = document.getElementById('mbuf-countdown');
        
        // Клик по крестику для закрытия (с остановкой всплытия)
        const closeBtn = notification.querySelector('.mbuf-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Останавливаем всплытие
                this.hideNotification();
            });
        }

        // Клик по всему уведомлению тоже закрывает
        notification.addEventListener('click', () => {
            this.hideNotification();
        });

        // ИСПРАВЛЕНИЕ: Очищаем старый интервал
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        let remaining = seconds;
        
        this.countdownInterval = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                this.hideNotification();
            } else {
                if (countdownElement) {
                    countdownElement.textContent = remaining;
                    if (remaining <= 5) {
                        countdownElement.style.color = '#4CAF50';
                    }
                }
            }
        }, 1000);

        Logger.info(`⏳ Rate limit notification: ${seconds}s countdown started`);
    }

    static show429Error(seconds, attempt, maxAttempts) {
        this.hideNotification();

        const notification = document.createElement('div');
        notification.className = 'mbuf-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #E91E63, #F44336);
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideDown 0.3s ease;
            border: 2px solid rgba(255, 255, 255, 0.3);
            min-width: 280px;
            max-width: 400px;
        `;

        notification.innerHTML = `
            <div style="font-size: 24px;">🚫</div>
            <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">Ошибка 429</div>
                <div style="font-size: 12px; opacity: 0.95;">Сервер отклонил запрос (${attempt}/${maxAttempts})</div>
            </div>
            <div class="mbuf-close-btn" style="font-size: 18px; opacity: 0.7; margin-left: 8px; cursor: pointer; padding: 4px;" title="Закрыть">✕</div>
        `;

        // ИСПРАВЛЕНИЕ: Добавляем в DOM сразу
        document.body.appendChild(notification);
        this.currentNotification = notification;

        // Клик по крестику для закрытия (с остановкой всплытия)
        const closeBtn = notification.querySelector('.mbuf-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideNotification();
            });
        }

        // Клик по всему уведомлению тоже закрывает
        notification.addEventListener('click', () => {
            this.hideNotification();
        });

        // ИСПРАВЛЕНИЕ: Автоматически скрываем через 5 секунд
        if (this.autoHideTimeout) {
            clearTimeout(this.autoHideTimeout);
            this.autoHideTimeout = null;
        }
        
        this.autoHideTimeout = setTimeout(() => {
            this.hideNotification();
        }, 5000);

        Logger.info('🚫 429 Error notification shown, auto-hide in 5s');
    }

    static hideNotification() {
        // ИСПРАВЛЕНИЕ: Очищаем все таймеры надежно
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        if (this.autoHideTimeout) {
            clearTimeout(this.autoHideTimeout);
            this.autoHideTimeout = null;
        }

        if (this.currentNotification) {
            // Плавное скрытие
            this.currentNotification.style.animation = 'slideUp 0.3s ease';
            
            // Удаляем после анимации
            const notifToRemove = this.currentNotification;
            setTimeout(() => {
                if (notifToRemove && notifToRemove.parentNode) {
                    notifToRemove.remove();
                }
            }, 300);
            
            this.currentNotification = null;
        }

        Logger.info('🔕 Notification hidden');
    }

    static hideRateLimitWarning() {
        this.hideNotification();
    }
}

    // Добавляем CSS анимации
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                transform: translateX(-50%) translateY(-100%);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
        @keyframes slideUp {
            from {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
            to {
                transform: translateX(-50%) translateY(-100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // -------------------------
    // Extension State Manager
    // -------------------------
    class ExtensionState {
        static enabled = true;

        static async load() {
            try {
                const enabled = await storageGet(CONFIG.ENABLED_KEY, true);
                this.enabled = enabled;
                Logger.important(`Extension is ${this.enabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
                return this.enabled;
            } catch (e) {
                Logger.warn('ExtensionState load error:', e);
                this.enabled = true;
                return true;
            }
        }

        static async setEnabled(enabled) {
            this.enabled = enabled;
            await storageSet(CONFIG.ENABLED_KEY, enabled);
            Logger.important(`Extension ${enabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
            
            if (!enabled) {
                CardProcessor.cancelCurrentBatch();
                document.querySelectorAll('.mbuf_card_overlay').forEach(badge => badge.remove());
            } else {
                await CardProcessor.processAll();
            }
        }

        static isEnabled() {
            return this.enabled;
        }
    }

    // -------------------------
    // Rate Limit Tracker
    // -------------------------
    class RateLimitTracker {
        static STORAGE_KEY = 'mbuf_rate_limit_requests';
        static requests = [];
        static initialized = false;

        static async init() {
            if (this.initialized) return;
            
            try {
                const stored = await storageGet(this.STORAGE_KEY, []);
                this.requests = Array.isArray(stored) ? stored : [];
                this.cleanup();
                await this.persist();
                this.initialized = true;
                Logger.info(`RateLimitTracker: ${this.requests.length} requests in history`);
            } catch (e) {
                Logger.warn('RateLimitTracker init error:', e);
                this.requests = [];
                this.initialized = true;
            }
        }

        static async addRequest() {
            const now = Date.now();
            this.requests.push(now);
            this.cleanup();
            await this.persist();
        }

        static cleanup() {
            const now = Date.now();
            const cutoff = now - CONFIG.RATE_LIMIT_WINDOW;
            this.requests = this.requests.filter(time => time > cutoff);
        }

        static async persist() {
            try {
                await storageSet(this.STORAGE_KEY, this.requests);
            } catch (e) {
                Logger.warn('RateLimitTracker persist error:', e);
            }
        }

        static getRequestsInWindow() {
            this.cleanup();
            return this.requests.length;
        }

        static canMakeRequest() {
            return this.getRequestsInWindow() < CONFIG.MAX_REQUESTS_PER_MINUTE;
        }

        static async waitForSlot() {
            while (!this.canMakeRequest()) {
                const oldest = this.requests[0];
                if (!oldest) {
                    Logger.warn('Rate limit inconsistency, resetting...');
                    this.requests = [];
                    await this.persist();
                    break;
                }
                
                const waitTime = oldest + CONFIG.RATE_LIMIT_WINDOW - Date.now() + 1000;
                const waitSeconds = Math.ceil(waitTime / 1000);
                
                Logger.important(`Rate limit: ${this.getRequestsInWindow()}/${CONFIG.MAX_REQUESTS_PER_MINUTE} requests, waiting ${waitSeconds}s...`);
                
                NotificationManager.showRateLimitWarning(waitSeconds);
                
                await Utils.sleep(Math.max(waitTime, 1000));
                this.cleanup();
            }
        }

        static getStats() {
            const now = Date.now();
            const inWindow = this.getRequestsInWindow();
            const oldest = this.requests[0];
            const timeUntilReset = oldest ? Math.ceil((oldest + CONFIG.RATE_LIMIT_WINDOW - now) / 1000) : 0;
            
            return {
                current: inWindow,
                max: CONFIG.MAX_REQUESTS_PER_MINUTE,
                remaining: CONFIG.MAX_REQUESTS_PER_MINUTE - inWindow,
                resetIn: timeUntilReset > 0 ? timeUntilReset : 0
            };
        }

        static async forceReset() {
            Logger.important('Force resetting rate limit tracker');
            this.requests = [];
            await this.persist();
        }
    }

    // -------------------------
    // Storage helpers
    // -------------------------
    async function storageGet(key, defaultValue = null) {
        try {
            const result = await chrome.storage.local.get(key);
            return result[key] !== undefined ? result[key] : defaultValue;
        } catch (e) {
            Logger.warn('storageGet error', e);
            return defaultValue;
        }
    }

    async function storageSet(key, value) {
        try {
            await chrome.storage.local.set({ [key]: value });
        } catch (e) {
            Logger.warn('storageSet error', e);
        }
    }

    // -------------------------
    // Utils
    // -------------------------
    const Utils = {
        getCardId(cardElem) {
            if (!cardElem) return null;

            if (cardElem.tagName === 'A' && cardElem.href) {
                const tradeMatch = cardElem.href.match(/\/cards\/(\d+)\/users/);
                if (tradeMatch) return tradeMatch[1];
            }

            const tradeLink = cardElem.querySelector('a[href*="/cards/"][href*="/users"]');
            if (tradeLink) {
                const tradeMatch = tradeLink.href.match(/\/cards\/(\d+)\/users/);
                if (tradeMatch) return tradeMatch[1];
            }

            const tryAttr = el => {
                if (!el) return null;
                return el.getAttribute?.('data-card-id') ||
                       el.getAttribute?.('data-id') ||
                       el.getAttribute?.('data-card') ||
                       el.getAttribute?.('data-item-id') ||
                       null;
            };

            let id = tryAttr(cardElem);
            if (id) return id;

            const parent = cardElem.closest?.('[data-card-id], [data-id], [data-card], [data-item-id]');
            id = tryAttr(parent);
            if (id) return id;

            const child = cardElem.querySelector?.('[data-card-id], [data-id], [data-card], [data-item-id]');
            id = tryAttr(child);
            if (id) return id;

            const link = cardElem.querySelector('a[href*="/cards/"]');
            if (link) {
                const match = link.href.match(/\/cards\/(\d+)(?:\/|$)/);
                if (match) return match[1];
            }

            if (cardElem.tagName === 'A' && cardElem.href) {
                const match = cardElem.href.match(/\/cards\/(\d+)(?:\/|$)/);
                if (match) return match[1];
            }

            return null;
        },

        parsePageNumbers(doc) {
            const pageElements = doc.querySelectorAll('.pagination__button, .pagination > li > a, .pagination > li, .paginator a');
            const pages = Array.from(pageElements)
                .map(el => parseInt(el.textContent.trim(), 10))
                .filter(num => !isNaN(num) && num > 0);
            return pages.length ? Math.max(...pages) : 1;
        },

        sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
        now() { return Date.now(); }
    };

    // -------------------------
    // HTTP Client
    // -------------------------
    class HttpClient {
        static async makeRequest(url, retries = 0, attempt429 = 0, skipRateLimit = false) {
            if (!skipRateLimit) {
                await RateLimitTracker.waitForSlot();
            }
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

                if (!skipRateLimit) {
                    await RateLimitTracker.addRequest();
                }
                
                const response = await fetch(url, {
                    signal: controller.signal,
                    credentials: 'include',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml',
                        'User-Agent': navigator.userAgent
                    }
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const text = await response.text();
                    return { responseText: text, status: response.status };
                } else if (response.status === 429) {
                    throw { status: 429, message: 'Rate limit exceeded' };
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    Logger.warn(`Request timeout for ${url}`);
                    throw new Error('Request timeout');
                }

                if (error.status === 429 && attempt429 < CONFIG.RETRY_429_MAX_ATTEMPTS) {
                    const delay = CONFIG.RETRY_429_DELAY * (attempt429 + 1);
                    Logger.important(`Rate limit (429), waiting ${delay}ms (${attempt429 + 1}/${CONFIG.RETRY_429_MAX_ATTEMPTS})`);
                    
                    NotificationManager.show429Error(delay, attempt429 + 1, CONFIG.RETRY_429_MAX_ATTEMPTS);
                    
                    await Utils.sleep(delay);
                    return this.makeRequest(url, retries, attempt429 + 1, skipRateLimit);
                }

                if (retries < CONFIG.MAX_RETRIES && error.status !== 429) {
                    const delay = 2000 * (retries + 1);
                    Logger.warn(`Retrying after ${delay}ms (${retries + 1}/${CONFIG.MAX_RETRIES})`);
                    await Utils.sleep(delay);
                    return this.makeRequest(url, retries + 1, attempt429, skipRateLimit);
                }

                throw error;
            }
        }
    }

    // -------------------------
    // Optimized Counters
    // -------------------------
    class OwnersCounter {
        static async count(cardId, forceAccurate = false, skipRateLimit = false) {
            try {
                const url = `https://mangabuff.ru/cards/${cardId}/users`;
                const response = await HttpClient.makeRequest(url, 0, 0, skipRateLimit);
                const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                const maxPage = Utils.parsePageNumbers(doc);
                
                if (maxPage === 1) {
                    const count = doc.querySelectorAll('.card-show__owner').length;
                    Logger.info(`Card ${cardId}: ${count} owners (1 page)`);
                    return count;
                }

                if (maxPage >= CONFIG.OWNERS_APPROXIMATE_THRESHOLD && !forceAccurate) {
                    const approximateCount = (maxPage - 1) * CONFIG.OWNERS_PER_PAGE + CONFIG.OWNERS_LAST_PAGE_ESTIMATE;
                    Logger.info(`Card ${cardId}: ~${approximateCount} owners (${maxPage} pages, approximate)`);
                    return approximateCount;
                }

                await Utils.sleep(800);

                const lastPageUrl = `${url}${url.includes('?') ? '&' : '?'}page=${maxPage}`;
                const lastPageResponse = await HttpClient.makeRequest(lastPageUrl, 0, 0, skipRateLimit);
                const lastPageDoc = new DOMParser().parseFromString(lastPageResponse.responseText, 'text/html');
                const lastPageCount = lastPageDoc.querySelectorAll('.card-show__owner').length;
                const exactCount = (maxPage - 1) * CONFIG.OWNERS_PER_PAGE + lastPageCount;
                
                Logger.info(`Card ${cardId}: ${exactCount} owners (${maxPage} pages, exact)`);
                return exactCount;
                
            } catch (error) {
                Logger.error('OwnersCounter error', cardId, error);
                return -1;
            }
        }
    }

    class WantsCounter {
        static async count(cardId, forceAccurate = false, skipRateLimit = false) {
            try {
                const url = `https://mangabuff.ru/cards/${cardId}/offers/want`;
                const response = await HttpClient.makeRequest(url, 0, 0, skipRateLimit);
                const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                const maxPage = Utils.parsePageNumbers(doc);
                const selectors = '.profile__friends-item, .users-list__item, .user-card';
                
                if (maxPage === 1) {
                    const count = doc.querySelectorAll(selectors).length;
                    Logger.info(`Card ${cardId}: ${count} wants (1 page)`);
                    return count;
                }

                if (maxPage >= CONFIG.WANTS_APPROXIMATE_THRESHOLD && !forceAccurate) {
                    const approximateCount = (maxPage - 1) * CONFIG.WANTS_PER_PAGE + CONFIG.WANTS_LAST_PAGE_ESTIMATE;
                    Logger.info(`Card ${cardId}: ~${approximateCount} wants (${maxPage} pages, approximate)`);
                    return approximateCount;
                }

                await Utils.sleep(800);

                const lastPageUrl = `${url}${url.includes('?') ? '&' : '?'}page=${maxPage}`;
                const lastPageResponse = await HttpClient.makeRequest(lastPageUrl, 0, 0, skipRateLimit);
                const lastPageDoc = new DOMParser().parseFromString(lastPageResponse.responseText, 'text/html');
                const lastPageCount = lastPageDoc.querySelectorAll(selectors).length;
                const exactCount = (maxPage - 1) * CONFIG.WANTS_PER_PAGE + lastPageCount;
                
                Logger.info(`Card ${cardId}: ${exactCount} wants (${maxPage} pages, exact)`);
                return exactCount;
                
            } catch (error) {
                Logger.error('WantsCounter error', cardId, error);
                return -1;
            }
        }
    }

    // -------------------------
    // Cache Management
    // -------------------------
    class Cache {
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

    // -------------------------
    // UI Badge
    // -------------------------
    class StatsBadge {
        static update(cardElem, owners, wants, isExpired = false, isManuallyUpdated = false) {
            if (!cardElem) return;
            
            const badgeClass = 'mbuf_card_overlay';
            let badge = cardElem.querySelector(`.${badgeClass}`);
            if (!badge) badge = this.create(cardElem, badgeClass);
            this.render(badge, owners, wants, isExpired, isManuallyUpdated);
        }

        static create(cardElem, badgeClass) {
            const badge = document.createElement('div');
            badge.className = badgeClass;

            const isTradeCard = cardElem.classList.contains('trade__main-item');
            const isMobile = window.innerWidth <= 768;

            Object.assign(badge.style, {
                position: 'absolute',
                right: isTradeCard ? '4px' : '6px',
                top: isTradeCard ? '4px' : '6px',
                zIndex: '10',
                background: 'rgba(0,0,0,0.85)',
                color: '#fff',
                fontSize: isMobile ? '10px' : (isTradeCard ? '11px' : '12px'),
                padding: isMobile ? '2px 5px' : (isTradeCard ? '3px 6px' : '4px 8px'),
                borderRadius: '12px',
                display: 'flex',
                gap: isMobile ? '4px' : (isTradeCard ? '6px' : '8px'),
                alignItems: 'center',
                pointerEvents: 'auto',
                border: '1px solid rgba(255,255,255,0.06)',
                transition: 'background 0.3s ease',
                cursor: 'pointer',
                touchAction: 'manipulation'
            });

            badge.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const cardId = Utils.getCardId(cardElem);
                if (cardId) {
                    await CardProcessor.priorityUpdateCard(cardElem, cardId);
                }
            });

            if (getComputedStyle(cardElem).position === 'static') {
                cardElem.style.position = 'relative';
            }
            cardElem.appendChild(badge);
            return badge;
        }

        static render(badge, owners, wants, isExpired = false, isManuallyUpdated = false) {
            if (!badge) return;

            if (owners === '⌛' && isManuallyUpdated) {
                badge.style.background = 'linear-gradient(135deg, rgba(255,215,0,0.95), rgba(255,165,0,0.95))';
                badge.style.border = '2px solid rgba(255,223,0,0.8)';
                badge.style.boxShadow = '0 0 20px rgba(255,215,0,0.6)';
            } else if (isManuallyUpdated) {
                badge.style.background = 'linear-gradient(135deg, rgba(255,215,0,0.9), rgba(218,165,32,0.9))';
                badge.style.border = '1px solid rgba(255,223,0,0.5)';
                badge.style.boxShadow = 'none';
            } else if (isExpired && owners !== '⌛' && owners !== -1) {
                badge.style.background = 'rgba(200, 50, 50, 0.9)';
                badge.style.border = '1px solid rgba(255, 100, 100, 0.3)';
                badge.style.boxShadow = 'none';
            } else {
                badge.style.background = 'rgba(0,0,0,0.85)';
                badge.style.border = '1px solid rgba(255,255,255,0.06)';
                badge.style.boxShadow = 'none';
            }

            const fmt = c => {
                if (c === -1) return '<span style="color:#ff6b6b">err</span>';
                if (c === '⌛') return '<span style="color:#ffd93d">⌛</span>';
                return String(c);
            };

            const expiredIndicator = isExpired ? ' 🔄' : '';
            const manualIndicator = isManuallyUpdated ? ' ✨' : '';
            
            const ownersTooltip = isManuallyUpdated 
                ? `Владельцев: ${owners === -1 ? 'ошибка' : owners} (ТОЧНОЕ, обновлено вручную)`
                : `Владельцев: ${owners === -1 ? 'ошибка' : owners}${isExpired ? ' (устарело)' : ''} - Клик для ТОЧНОГО обновления (игнорирует rate limit)`;
            
            const wantsTooltip = isManuallyUpdated
                ? `Желающих: ${wants === -1 ? 'ошибка' : wants} (ТОЧНОЕ, обновлено вручную)`
                : `Желающих: ${wants === -1 ? 'ошибка' : wants}${isExpired ? ' (устарело)' : ''} - Клик для ТОЧНОГО обновления (игнорирует rate limit)`;

            badge.innerHTML = `
                <span title="${ownersTooltip}">
                    👥${fmt(owners)}${expiredIndicator}${manualIndicator}
                </span>
                <span title="${wantsTooltip}">
                    ⭐${fmt(wants)}
                </span>
            `;
        }
    }

    // -------------------------
    // Card Processor
    // -------------------------
    class CardProcessor {
        static expiredCards = new Set();
        static processedInSession = new Set();
        static currentBatchUrl = null;
        static cancelledBatch = false;
        static currentBatchProgress = { current: 0, total: 0 };

        static async processAll() {
            if (!ExtensionState.isEnabled()) {
                Logger.info('Extension is disabled, skipping processing');
                return;
            }

            this.currentBatchUrl = location.href;
            this.cancelledBatch = false;

            const nodes = CONFIG.CARD_SELECTORS.flatMap(sel => {
                try {
                    return Array.from(document.querySelectorAll(sel));
                } catch (e) {
                    return [];
                }
            });

            const uniqueNodes = Array.from(new Set(nodes));
            Logger.important(`🔍 Found ${uniqueNodes.length} cards on ${this.currentBatchUrl}`);

            const toFetch = [];
            const toRefresh = [];

            for (const cardElem of uniqueNodes) {
                const cardId = Utils.getCardId(cardElem);
                if (!cardId) continue;

                const cached = Cache.get(cardId);

                if (cached) {
                    const isExpired = Cache.isExpired(cached);
                    const isManuallyUpdated = Cache.isRecentlyManuallyUpdated(cached);
                    StatsBadge.update(cardElem, cached.owners, cached.wants, isExpired, isManuallyUpdated);

                    if (isExpired) {
                        toRefresh.push({ elem: cardElem, id: cardId });
                        this.expiredCards.add(cardId);
                    }

                    cardElem.classList.add('mb_processed');
                    cardElem.setAttribute('data-mb-processed', 'true');
                } else {
                    if (!cardElem.classList.contains('mb_processed')) {
                        toFetch.push({ elem: cardElem, id: cardId });
                    }
                }
            }

            if (toFetch.length > 0 || toRefresh.length > 0) {
                Logger.important(`🎯 Priority: NEW cards: ${toFetch.length}, EXPIRED cards: ${toRefresh.length}`);
            }

            if (toFetch.length > 0) {
                Logger.important('🔥 Processing NEW cards first...');
                this.currentBatchProgress = { current: 0, total: toFetch.length };
                await this.processBatch(toFetch, false, false);
            }

            if (toRefresh.length > 0 && !this.cancelledBatch) {
                Logger.important('🔄 Processing EXPIRED cards...');
                this.currentBatchProgress = { current: 0, total: toRefresh.length };
                await this.processBatch(toRefresh, true, false);
            }

            this.currentBatchProgress = { current: 0, total: 0 };
        }

        static cancelCurrentBatch() {
            Logger.important('❌ Cancelling current batch');
            this.cancelledBatch = true;
        }

        static async processBatch(items, isRefresh = false, forceAccurate = false) {
            const batchSize = CONFIG.BATCH_SIZE;
            const batchUrl = this.currentBatchUrl;

            for (let i = 0; i < items.length; i += batchSize) {
                if (location.href !== batchUrl || this.cancelledBatch) {
                    Logger.important(`⚠️ URL changed or batch cancelled, stopping batch processing`);
                    return;
                }

                const batch = items.slice(i, i + batchSize);
                Logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);

                await Promise.all(batch.map((item, idx) => {
                    if (!document.body.contains(item.elem)) {
                        Logger.info(`Card ${item.id} removed from DOM, skipping`);
                        return Promise.resolve();
                    }
                    this.currentBatchProgress.current = i + idx + 1;
                    return this.processCard(item.elem, item.id, isRefresh, forceAccurate);
                }));

                if (i + batchSize < items.length) {
                    await Utils.sleep(CONFIG.PAUSE_BETWEEN_REQUESTS);
                }
            }
        }

        static async processCard(cardElem, cardId, isRefresh = false, forceAccurate = false) {
            if (!cardElem || !cardId) return;

            if (!document.body.contains(cardElem)) {
                Logger.info(`Card ${cardId} not in DOM, skipping`);
                return;
            }

            if (Cache.pendingFetches.has(cardId)) {
                const result = await Cache.pendingFetches.get(cardId);
                const cached = Cache.get(cardId);
                const isManuallyUpdated = cached ? Cache.isRecentlyManuallyUpdated(cached) : false;
                StatsBadge.update(cardElem, result.owners, result.wants, false, isManuallyUpdated);
                return;
            }

            cardElem.classList.add('mb_processed');
            cardElem.setAttribute('data-mb-processed', 'true');

            if (!isRefresh) {
                StatsBadge.update(cardElem, '⌛', '⌛');
            }

            try {
                const fetchPromise = Promise.all([
                    OwnersCounter.count(cardId, forceAccurate, false),
                    WantsCounter.count(cardId, forceAccurate, false)
                ]).then(([owners, wants]) => {
                    Cache.set(cardId, owners, wants, forceAccurate);
                    this.expiredCards.delete(cardId);
                    return { owners, wants };
                });

                Cache.pendingFetches.set(cardId, fetchPromise);
                const { owners, wants } = await fetchPromise;

                if (!document.body.contains(cardElem)) {
                    Logger.info(`Card ${cardId} removed from DOM during processing`);
                    return;
                }

                const cached = Cache.get(cardId);
                const isManuallyUpdated = cached ? Cache.isRecentlyManuallyUpdated(cached) : false;
                StatsBadge.update(cardElem, owners, wants, false, isManuallyUpdated);
                
                const progress = this.currentBatchProgress.total > 0 
                    ? `[${this.currentBatchProgress.current}/${this.currentBatchProgress.total}]`
                    : '';
                Logger.important(`${progress} Card ${cardId}: 👥${owners} ⭐${wants}`);
            } catch (err) {
                Logger.error('Error processing card', cardId, err);
                if (document.body.contains(cardElem)) {
                    StatsBadge.update(cardElem, -1, -1);
                }
                Cache.set(cardId, -1, -1);
            } finally {
                Cache.pendingFetches.delete(cardId);
            }
        }

        static async priorityUpdateCard(cardElem, cardId) {
            if (!ExtensionState.isEnabled()) {
                Logger.important('Extension is disabled');
                return;
            }

            Logger.important(`🎯 Manual update (PRIORITY - IGNORING RATE LIMIT): Card ${cardId}`);

            const badge = cardElem.querySelector('.mbuf_card_overlay');
            if (badge) {
                StatsBadge.render(badge, '⌛', '⌛', false, true);
            }

            try {
                const [owners, wants] = await Promise.all([
                    OwnersCounter.count(cardId, true, true),
                    WantsCounter.count(cardId, true, true)
                ]);

                Cache.set(cardId, owners, wants, true);
                this.expiredCards.delete(cardId);

                StatsBadge.update(cardElem, owners, wants, false, true);
                Logger.important(`✨ Card ${cardId} updated (PRIORITY): 👥${owners} ⭐${wants}`);
            } catch (err) {
                Logger.error('Priority update error', cardId, err);
                StatsBadge.update(cardElem, -1, -1);
                Cache.set(cardId, -1, -1, true);
            }
        }

        static async quickRefresh() {
            if (!ExtensionState.isEnabled()) return;

            const nodes = CONFIG.CARD_SELECTORS.flatMap(sel => {
                try {
                    return Array.from(document.querySelectorAll(sel));
                } catch (e) {
                    return [];
                }
            });

            for (const cardElem of nodes) {
                if (cardElem.classList.contains('mb_processed')) continue;

                const cardId = Utils.getCardId(cardElem);
                if (!cardId) continue;

                const cached = Cache.get(cardId);
                if (cached) {
                    const isExpired = Cache.isExpired(cached);
                    const isManuallyUpdated = Cache.isRecentlyManuallyUpdated(cached);
                    StatsBadge.update(cardElem, cached.owners, cached.wants, isExpired, isManuallyUpdated);
                    cardElem.classList.add('mb_processed');
                    cardElem.setAttribute('data-mb-processed', 'true');
                }
            }
        }
    }

    // -------------------------
    // DOM Observer
    // -------------------------
    class DOMObserver {
        static debounceTimer = null;

        static init() {
            if (location.pathname.includes('/market/requests')) {
                Logger.important('⛔ Skipping DOM observer on market/requests');
                return;
            }

            CardProcessor.processAll();

            const observer = new MutationObserver((mutations) => {
                if (!ExtensionState.isEnabled()) return;
                
                if (location.pathname.includes('/market/requests')) return;

                let foundNew = false;

                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType !== 1) continue;

                        if (node.classList?.contains('modal') ||
                            node.classList?.contains('popup') ||
                            node.classList?.contains('pack-opening') ||
                            node.classList?.contains('exchange') ||
                            node.classList?.contains('trade')) {
                            foundNew = true;
                            break;
                        }

                        for (const selector of CONFIG.CARD_SELECTORS) {
                            try {
                                const matched = node.matches?.(selector) ? [node] :
                                              Array.from(node.querySelectorAll?.(selector) || []);
                                if (matched.length > 0) {
                                    foundNew = true;
                                    break;
                                }
                            } catch (e) { /* ignore */ }
                        }
                    }
                }

                if (foundNew) {
                    CardProcessor.quickRefresh();

                    clearTimeout(this.debounceTimer);
                    this.debounceTimer = setTimeout(() => {
                        CardProcessor.processAll();
                    }, 500);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: false
            });
        }
    }

    // -------------------------
    // Page Change Detection
    // -------------------------
    let lastUrl = location.href;
    const checkUrlChange = () => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            Logger.important('🔄 Page changed to: ' + lastUrl);
            
            if (location.pathname.includes('/market/requests')) {
                Logger.important('⛔ Market requests page - stopping all processing');
                CardProcessor.cancelCurrentBatch();
                return;
            }
            
            CardProcessor.cancelCurrentBatch();
            
            document.querySelectorAll('.mb_processed').forEach(el => {
                el.classList.remove('mb_processed');
                el.removeAttribute('data-mb-processed');
            });
            
            setTimeout(() => CardProcessor.processAll(), 500);
        }
    };

    // -------------------------
    // Message listener
    // -------------------------
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getStats') {
            Cache.getStats().then(stats => {
                const rateLimitStats = RateLimitTracker.getStats();
                stats.rateLimitInfo = rateLimitStats;
                stats.enabled = ExtensionState.isEnabled();
                sendResponse(stats);
            });
            return true;
        }
        if (request.action === 'setEnabled') {
            ExtensionState.setEnabled(request.enabled).then(() => {
                sendResponse({ success: true, enabled: request.enabled });
            });
            return true;
        }
        if (request.action === 'clearCache') {
            Cache.clear().then(() => {
                document.querySelectorAll('.mb_processed').forEach(el => {
                    el.classList.remove('mb_processed');
                    el.removeAttribute('data-mb-processed');
                    const b = el.querySelector('.mbuf_card_overlay');
                    if (b) b.remove();
                });
                sendResponse({ success: true });
                CardProcessor.processAll();
            });
            return true;
        }
        if (request.action === 'clearRateLimit') {
            RateLimitTracker.forceReset().then(() => {
                sendResponse({ success: true });
            });
            return true;
        }
        if (request.action === 'refresh') {
            document.querySelectorAll('.mb_processed').forEach(el => {
                el.classList.remove('mb_processed');
                el.removeAttribute('data-mb-processed');
            });
            CardProcessor.processAll();
            sendResponse({ success: true });
            return true;
        }
        if (request.action === 'exportCache') {
            sendResponse({ data: Cache.data });
            return true;
        }
        if (request.action === 'importCache') {
            Cache.importFromObject(request.data).then(() => {
                sendResponse({ success: true });
                CardProcessor.processAll();
            });
            return true;
        }
    });

    // -------------------------
    // Initialization
    // -------------------------
    async function init() {
        if (location.pathname.includes('/market/requests')) {
            Logger.important('⛔ Skipping market/requests page');
            return;
        }

        Logger.important('🚀 Mangabuff Card Stats v2.4');
        Logger.important('⚙️ Fixed notifications with countdown and click-to-close');

        await ExtensionState.load();
        await RateLimitTracker.init();
        await Cache.load();

        Logger.important(`💾 Cache: ${Object.keys(Cache.data).length} cards in chrome.storage.local`);

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => DOMObserver.init());
        } else {
            DOMObserver.init();
        }

        setInterval(checkUrlChange, 1000);
        
        setInterval(() => {
            const stats = RateLimitTracker.getStats();
            Logger.important(`🛡️ Rate Limit: ${stats.current}/${stats.max}`);
        }, 5000);

        if (location.pathname.includes('/cards/pack')) {
            Logger.important('🎴 Pack opening page detected - enabling auto-refresh');
            setInterval(() => {
                if (!ExtensionState.isEnabled()) return;
                
                document.querySelectorAll('.mb_processed').forEach(el => {
                    el.classList.remove('mb_processed');
                    el.removeAttribute('data-mb-processed');
                });
                
                CardProcessor.processAll();
            }, 2000);
        }
    }

    if (document.readyState === 'complete') {
        setTimeout(init, 100);
    } else {
        window.addEventListener('load', () => setTimeout(init, 100));
    }

})();