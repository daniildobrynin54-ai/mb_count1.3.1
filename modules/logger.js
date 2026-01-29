// Logger utility
import { CONFIG } from './config.js';

export const Logger = {
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
