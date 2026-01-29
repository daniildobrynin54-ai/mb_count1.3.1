// DOM Observer - watches for new cards
import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { CardProcessor } from './card-processor.js';
import { ExtensionState } from './extension-state.js';

export class DOMObserver {
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
