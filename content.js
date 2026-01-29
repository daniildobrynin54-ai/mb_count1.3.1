// Main content script - dynamic module loading
(async function() {
    'use strict';

    // Skip market/requests page
    if (location.pathname.includes('/market/requests')) {
        console.log('[MBUF] ⛔ Skipping market/requests page');
        return;
    }

    // Динамический импорт модулей
    const { Logger } = await import(chrome.runtime.getURL('modules/logger.js'));
    const { NotificationManager } = await import(chrome.runtime.getURL('modules/notification.js'));
    const { ExtensionState } = await import(chrome.runtime.getURL('modules/extension-state.js'));
    const { RateLimitTracker } = await import(chrome.runtime.getURL('modules/rate-limit.js'));
    const { Cache } = await import(chrome.runtime.getURL('modules/cache.js'));
    const { DOMObserver } = await import(chrome.runtime.getURL('modules/dom-observer.js'));
    const { MessageHandler } = await import(chrome.runtime.getURL('modules/message-handler.js'));
    const { CardProcessor } = await import(chrome.runtime.getURL('modules/card-processor.js'));

    Logger.important('🚀 Mangabuff Card Stats v2.5 (Modular)');
    Logger.important('⚙️ Refactored into separate modules');

    // Initialize notification styles
    NotificationManager.initStyles();

    // Load extension state and cache
    await ExtensionState.load();
    await RateLimitTracker.init();
    await Cache.load();

    Logger.important(`💾 Cache: ${Object.keys(Cache.data).length} cards in chrome.storage.local`);

    // Initialize message handler
    MessageHandler.init();

    // Initialize DOM observer
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => DOMObserver.init());
    } else {
        DOMObserver.init();
    }

    // Page change detection
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

    setInterval(checkUrlChange, 1000);
    
    // Rate limit logging
    setInterval(() => {
        const stats = RateLimitTracker.getStats();
        Logger.important(`🛡️ Rate Limit: ${stats.current}/${stats.max}`);
    }, 5000);

    // Auto-refresh for pack opening pages
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
})();