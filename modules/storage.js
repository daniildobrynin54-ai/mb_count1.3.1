// Storage helpers
import { Logger } from './logger.js';

export async function storageGet(key, defaultValue = null) {
    try {
        const result = await chrome.storage.local.get(key);
        return result[key] !== undefined ? result[key] : defaultValue;
    } catch (e) {
        Logger.warn('storageGet error', e);
        return defaultValue;
    }
}

export async function storageSet(key, value) {
    try {
        await chrome.storage.local.set({ [key]: value });
    } catch (e) {
        Logger.warn('storageSet error', e);
    }
}
