// Message Handler - handles chrome extension messages
import { Cache } from './cache.js';
import { RateLimitTracker } from './rate-limit.js';
import { ExtensionState } from './extension-state.js';
import { CardProcessor } from './card-processor.js';

export class MessageHandler {
    static init() {
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
    }
}
