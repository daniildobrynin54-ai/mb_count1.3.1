// Message Handler for chrome extension messages
import { Cache } from './cache.js';
import { RateLimitTracker } from './rate-limit.js';
import { ExtensionState } from './extension-state.js';
import { PageFilter } from './page-filter.js';
import { CardProcessor } from './card-processor.js';
import { Logger } from './logger.js';

export class MessageHandler {
    static init() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });
        
        Logger.info('Message handler initialized');
    }

    static async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'getStats':
                    await this.handleGetStats(sendResponse);
                    break;
                    
                case 'setEnabled':
                    await this.handleSetEnabled(request, sendResponse);
                    break;
                    
                case 'setPageFilter':
                    await this.handleSetPageFilter(request, sendResponse);
                    break;
                    
                case 'getPageFilters':
                    await this.handleGetPageFilters(sendResponse);
                    break;
                    
                case 'clearCache':
                    await this.handleClearCache(sendResponse);
                    break;
                    
                case 'clearRateLimit':
                    await this.handleClearRateLimit(sendResponse);
                    break;
                    
                case 'refresh':
                    await this.handleRefresh(sendResponse);
                    break;
                    
                case 'exportCache':
                    await this.handleExportCache(sendResponse);
                    break;
                    
                case 'importCache':
                    await this.handleImportCache(request, sendResponse);
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            Logger.error('Message handler error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    static async handleGetStats(sendResponse) {
        const stats = await Cache.getStats();
        const rateLimitStats = RateLimitTracker.getStats();
        
        sendResponse({
            ...stats,
            rateLimitInfo: rateLimitStats,
            enabled: ExtensionState.isEnabled(),
            pageFilters: PageFilter.getFilters(),
            currentPageType: PageFilter.getCurrentPageType(),
            currentPageEnabled: PageFilter.isCurrentPageEnabled()
        });
    }

    static async handleSetEnabled(request, sendResponse) {
        await ExtensionState.setEnabled(request.enabled);
        sendResponse({ success: true, enabled: request.enabled });
    }

    static async handleSetPageFilter(request, sendResponse) {
        const success = await PageFilter.setFilter(request.filterName, request.enabled);
        
        if (success) {
            if (PageFilter.getCurrentPageType() === request.filterName) {
                if (request.enabled) {
                    CardProcessor.processAll();
                } else {
                    document.querySelectorAll('.mbuf_card_overlay').forEach(badge => badge.remove());
                    CardProcessor.clearProcessedMarks();
                    CardProcessor.cancelCurrentBatch();
                }
            }
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Invalid filter name' });
        }
    }

    static async handleGetPageFilters(sendResponse) {
        sendResponse({
            filters: PageFilter.getFilters(),
            currentPageType: PageFilter.getCurrentPageType(),
            currentPageEnabled: PageFilter.isCurrentPageEnabled()
        });
    }

    static async handleClearCache(sendResponse) {
        await Cache.clear();
        CardProcessor.clearProcessedMarks();
        sendResponse({ success: true });
        CardProcessor.processAll();
    }

    static async handleClearRateLimit(sendResponse) {
        await RateLimitTracker.forceReset();
        sendResponse({ success: true });
    }

    static async handleRefresh(sendResponse) {
        CardProcessor.clearProcessedMarks();
        sendResponse({ success: true });
        CardProcessor.processAll();
    }

    static async handleExportCache(sendResponse) {
        const data = Cache.exportToObject();
        sendResponse({ data });
    }

    static async handleImportCache(request, sendResponse) {
        await Cache.importFromObject(request.data);
        sendResponse({ success: true });
        CardProcessor.processAll();
    }
}
