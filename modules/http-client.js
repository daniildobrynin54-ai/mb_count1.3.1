// HTTP Client
import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { Utils } from './utils.js';
import { RateLimitTracker } from './rate-limit.js';
import { NotificationManager } from './notification.js';

export class HttpClient {
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
