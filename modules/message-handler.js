// Message Handler - handles chrome extension messages
import { Cache } from './cache.js';
import { RateLimitTracker } from './rate-limit.js';
import { ExtensionState } from './extension-state.js';
import { PageFilter } from './page-filter.js';
import { CardProcessor } from './card-processor.js';

export class MessageHandler {
    static init() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'getStats') {
                Cache.getStats().then(stats => {
                    const rateLimitStats = RateLimitTracker.getStats();
                    stats.rateLimitInfo = rateLimitStats;
                    stats.enabled = ExtensionState.isEnabled();
                    stats.pageFilters = PageFilter.getFilters();
                    stats.currentPageType = PageFilter.getCurrentPageType();
                    stats.currentPageEnabled = PageFilter.isCurrentPageEnabled();
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
            
            if (request.action === 'setPageFilter') {
                PageFilter.setFilter(request.filterName, request.enabled).then((success) => {
                    if (success) {
                        // Если изменили фильтр текущей страницы, обновляем или очищаем
                        if (PageFilter.getCurrentPageType() === request.filterName) {
                            if (request.enabled) {
                                // Включили - запускаем обработку
                                CardProcessor.processAll();
                            } else {
                                // Выключили - сразу удаляем все бейджи без перезагрузки
                                document.querySelectorAll('.mbuf_card_overlay').forEach(badge => {
                                    badge.remove();
                                });
                                document.querySelectorAll('.mb_processed').forEach(el => {
                                    el.classList.remove('mb_processed');
                                    el.removeAttribute('data-mb-processed');
                                });
                                // Также отменяем текущую обработку если она идет
                                CardProcessor.cancelCurrentBatch();
                            }
                        }
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'Invalid filter name' });
                    }
                });
                return true;
            }
            
            if (request.action === 'getPageFilters') {
                sendResponse({ 
                    filters: PageFilter.getFilters(),
                    currentPageType: PageFilter.getCurrentPageType(),
                    currentPageEnabled: PageFilter.isCurrentPageEnabled()
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
    }
}