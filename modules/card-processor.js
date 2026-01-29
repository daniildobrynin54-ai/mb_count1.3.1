// Card Processor - Main processing logic
import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { Utils } from './utils.js';
import { Cache } from './cache.js';
import { StatsBadge } from './stats-badge.js';
import { OwnersCounter, WantsCounter } from './counters.js';
import { ExtensionState } from './extension-state.js';
import { PageFilter } from './page-filter.js';

export class CardProcessor {
    static expiredCards = new Set();
    static processedInSession = new Set();
    static currentBatchUrl = null;
    static cancelledBatch = false;
    static currentBatchProgress = { current: 0, total: 0 };
    static marketCardIdCache = new Map();

    static async processAll() {
        if (!ExtensionState.isEnabled()) {
            Logger.info('Extension is disabled, skipping processing');
            return;
        }

        // Проверяем, включена ли текущая страница
        if (!PageFilter.isCurrentPageEnabled()) {
            Logger.important(`⛔ Current page type (${PageFilter.getCurrentPageType()}) is disabled in filters`);
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

        const toFetch = [];      // Новые карты (не в кэше)
        const toRetry = [];      // Ошибки (приоритет)
        const toRefresh = [];    // Устаревшие карты

        for (const cardElem of uniqueNodes) {
            let cardId = Utils.getCardId(cardElem);
            if (!cardId) continue;

            // Обработка маркет-лотов
            if (cardId.startsWith('market:')) {
                const lotId = cardId.replace('market:', '');
                
                if (this.marketCardIdCache.has(lotId)) {
                    cardId = this.marketCardIdCache.get(lotId);
                } else {
                    const realCardId = await Utils.getMarketCardId(lotId);
                    if (!realCardId) {
                        Logger.warn(`Failed to get card ID for lot ${lotId}`);
                        continue;
                    }
                    this.marketCardIdCache.set(lotId, realCardId);
                    cardId = realCardId;
                }
            }

            // Обработка заявок (requests)
            if (cardId.startsWith('request:')) {
                const requestId = cardId.replace('request:', '');
                
                if (this.marketCardIdCache.has(requestId)) {
                    cardId = this.marketCardIdCache.get(requestId);
                } else {
                    const realCardId = await Utils.getRequestCardId(requestId);
                    if (!realCardId) {
                        Logger.warn(`Failed to get card ID for request ${requestId}`);
                        continue;
                    }
                    this.marketCardIdCache.set(requestId, realCardId);
                    cardId = realCardId;
                }
            }

            const cached = Cache.get(cardId);

            if (cached) {
                const isExpired = Cache.isExpired(cached);
                const isError = Cache.hasError(cached);
                const isManuallyUpdated = Cache.isRecentlyManuallyUpdated(cached);
                
                // Показываем кэшированные данные
                StatsBadge.update(cardElem, cached.owners, cached.wants, isExpired, isManuallyUpdated);

                if (isError) {
                    // Ошибки - высший приоритет
                    toRetry.push({ elem: cardElem, id: cardId });
                } else if (isExpired) {
                    // Устаревшие - низкий приоритет
                    toRefresh.push({ elem: cardElem, id: cardId });
                    this.expiredCards.add(cardId);
                }

                cardElem.classList.add('mb_processed');
                cardElem.setAttribute('data-mb-processed', 'true');
            } else {
                // Нет в кэше - средний приоритет
                if (!cardElem.classList.contains('mb_processed')) {
                    toFetch.push({ elem: cardElem, id: cardId });
                }
            }
        }

        Logger.important(`🎯 Priority queue: ERRORS: ${toRetry.length}, NEW: ${toFetch.length}, EXPIRED: ${toRefresh.length}`);

        // Обрабатываем в порядке приоритета
        
        // 1. Ошибки (высший приоритет)
        if (toRetry.length > 0) {
            Logger.important('🔴 Processing ERROR cards first (HIGHEST PRIORITY)...');
            this.currentBatchProgress = { current: 0, total: toRetry.length };
            await this.processBatch(toRetry, false, false);
        }

        // 2. Новые карты
        if (toFetch.length > 0 && !this.cancelledBatch) {
            Logger.important('🔥 Processing NEW cards...');
            this.currentBatchProgress = { current: 0, total: toFetch.length };
            await this.processBatch(toFetch, false, false);
        }

        // 3. Устаревшие карты (низший приоритет)
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

        // Обработка маркет-лотов при ручном обновлении
        if (cardId.startsWith('market:')) {
            const lotId = cardId.replace('market:', '');
            
            if (this.marketCardIdCache.has(lotId)) {
                cardId = this.marketCardIdCache.get(lotId);
            } else {
                const realCardId = await Utils.getMarketCardId(lotId);
                if (!realCardId) {
                    Logger.warn(`Failed to get card ID for lot ${lotId}`);
                    return;
                }
                this.marketCardIdCache.set(lotId, realCardId);
                cardId = realCardId;
            }
        }

        // Обработка заявок (requests) при ручном обновлении
        if (cardId.startsWith('request:')) {
            const requestId = cardId.replace('request:', '');
            
            if (this.marketCardIdCache.has(requestId)) {
                cardId = this.marketCardIdCache.get(requestId);
            } else {
                const realCardId = await Utils.getRequestCardId(requestId);
                if (!realCardId) {
                    Logger.warn(`Failed to get card ID for request ${requestId}`);
                    return;
                }
                this.marketCardIdCache.set(requestId, realCardId);
                cardId = realCardId;
            }
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
        
        // Проверяем фильтр страниц
        if (!PageFilter.isCurrentPageEnabled()) return;

        const nodes = CONFIG.CARD_SELECTORS.flatMap(sel => {
            try {
                return Array.from(document.querySelectorAll(sel));
            } catch (e) {
                return [];
            }
        });

        for (const cardElem of nodes) {
            if (cardElem.classList.contains('mb_processed')) continue;

            let cardId = Utils.getCardId(cardElem);
            if (!cardId) continue;

            // Обработка маркет-лотов
            if (cardId.startsWith('market:')) {
                const lotId = cardId.replace('market:', '');
                if (this.marketCardIdCache.has(lotId)) {
                    cardId = this.marketCardIdCache.get(lotId);
                } else {
                    continue;
                }
            }

            // Обработка заявок (requests)
            if (cardId.startsWith('request:')) {
                const requestId = cardId.replace('request:', '');
                if (this.marketCardIdCache.has(requestId)) {
                    cardId = this.marketCardIdCache.get(requestId);
                } else {
                    continue;
                }
            }

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