// Main content script - Optimized v3.0
(async function() {
    'use strict';

    // Dynamic module imports
    const { Logger } = await import(chrome.runtime.getURL('modules/logger.js'));
    const { NotificationManager } = await import(chrome.runtime.getURL('modules/notification.js'));
    const { ExtensionState } = await import(chrome.runtime.getURL('modules/extension-state.js'));
    const { PageFilter } = await import(chrome.runtime.getURL('modules/page-filter.js'));
    const { RateLimitTracker } = await import(chrome.runtime.getURL('modules/rate-limit.js'));
    const { Cache } = await import(chrome.runtime.getURL('modules/cache.js'));
    const { DOMObserver } = await import(chrome.runtime.getURL('modules/dom-observer.js'));
    const { MessageHandler } = await import(chrome.runtime.getURL('modules/message-handler.js'));
    const { CardProcessor } = await import(chrome.runtime.getURL('modules/card-processor.js'));

    Logger.important('🚀 Mangabuff Card Stats v3.0 (Optimized)');
    Logger.important('⚡ Refactored with improved performance and memory management');

    // Initialize notification styles
    NotificationManager.initStyles();

    // Load extension state, page filters, rate limit, and cache
    await ExtensionState.load();
    await PageFilter.load();
    await RateLimitTracker.init();
    await Cache.load();

    Logger.important(`💾 Cache: ${Cache.data.size} cards loaded`);
    Logger.important(`🎯 Page: ${PageFilter.getCurrentPageType()} - ${PageFilter.isCurrentPageEnabled() ? 'ENABLED' : 'DISABLED'}`);

    // Initialize message handler
    MessageHandler.init();

    // Initialize DOM observer when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            DOMObserver.init();
        });
    } else {
        DOMObserver.init();
    }

    // Page change detection
    let lastUrl = location.href;
    const checkUrlChange = () => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            Logger.important('🔄 Page changed to: ' + lastUrl);
            
            // Cancel current batch
            CardProcessor.cancelCurrentBatch();
            
            // Clear processed marks
            CardProcessor.clearProcessedMarks();
            
            // Process new page after short delay
            setTimeout(() => {
                if (ExtensionState.isEnabled() && PageFilter.isCurrentPageEnabled()) {
                    CardProcessor.processAll();
                }
            }, 500);
        }
    };

    setInterval(checkUrlChange, 1000);
    
    // Rate limit logging
    setInterval(() => {
        if (ExtensionState.isEnabled()) {
            const stats = RateLimitTracker.getStats();
            Logger.debug(`🛡️ Rate Limit: ${stats.current}/${stats.max} (${stats.remaining} remaining)`);
        }
    }, 10000); // Log every 10 seconds instead of 5

    // Auto-refresh for pack opening pages
    if (location.pathname.includes('/cards/pack')) {
        Logger.important('🎴 Pack opening page - enabling auto-refresh');
        
        setInterval(() => {
            if (!ExtensionState.isEnabled()) return;
            if (!PageFilter.isCurrentPageEnabled()) return;
            
            // Quick refresh from cache
            CardProcessor.quickRefresh();
            
            // Full processing for new cards
            CardProcessor.processAll();
        }, 2000);
    }

    // Memory management - periodic cleanup
    setInterval(async () => {
        if (Cache.data.size > 8000) {
            Logger.important('🧹 Cache cleanup triggered');
            await Cache.pruneToMaxSize(7000);
        }
    }, 300000); // Every 5 minutes

    Logger.important('✅ Extension fully initialized');
})();