// Owners and Wants Counters
import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { Utils } from './utils.js';
import { HttpClient } from './http-client.js';

export class OwnersCounter {
    static async count(cardId, forceAccurate = false, skipRateLimit = false) {
        try {
            const url = `https://mangabuff.ru/cards/${cardId}/users`;
            const response = await HttpClient.makeRequest(url, 0, 0, skipRateLimit);
            const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
            const maxPage = Utils.parsePageNumbers(doc);
            
            if (maxPage === 1) {
                const count = doc.querySelectorAll('.card-show__owner').length;
                Logger.info(`Card ${cardId}: ${count} owners (1 page)`);
                return count;
            }

            if (maxPage >= CONFIG.OWNERS_APPROXIMATE_THRESHOLD && !forceAccurate) {
                const approximateCount = (maxPage - 1) * CONFIG.OWNERS_PER_PAGE + CONFIG.OWNERS_LAST_PAGE_ESTIMATE;
                Logger.info(`Card ${cardId}: ~${approximateCount} owners (${maxPage} pages, approximate)`);
                return approximateCount;
            }

            await Utils.sleep(800);

            const lastPageUrl = `${url}${url.includes('?') ? '&' : '?'}page=${maxPage}`;
            const lastPageResponse = await HttpClient.makeRequest(lastPageUrl, 0, 0, skipRateLimit);
            const lastPageDoc = new DOMParser().parseFromString(lastPageResponse.responseText, 'text/html');
            const lastPageCount = lastPageDoc.querySelectorAll('.card-show__owner').length;
            const exactCount = (maxPage - 1) * CONFIG.OWNERS_PER_PAGE + lastPageCount;
            
            Logger.info(`Card ${cardId}: ${exactCount} owners (${maxPage} pages, exact)`);
            return exactCount;
            
        } catch (error) {
            Logger.error('OwnersCounter error', cardId, error);
            return -1;
        }
    }
}

export class WantsCounter {
    static async count(cardId, forceAccurate = false, skipRateLimit = false) {
        try {
            const url = `https://mangabuff.ru/cards/${cardId}/offers/want`;
            const response = await HttpClient.makeRequest(url, 0, 0, skipRateLimit);
            const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
            const maxPage = Utils.parsePageNumbers(doc);
            const selectors = '.profile__friends-item, .users-list__item, .user-card';
            
            if (maxPage === 1) {
                const count = doc.querySelectorAll(selectors).length;
                Logger.info(`Card ${cardId}: ${count} wants (1 page)`);
                return count;
            }

            if (maxPage >= CONFIG.WANTS_APPROXIMATE_THRESHOLD && !forceAccurate) {
                const approximateCount = (maxPage - 1) * CONFIG.WANTS_PER_PAGE + CONFIG.WANTS_LAST_PAGE_ESTIMATE;
                Logger.info(`Card ${cardId}: ~${approximateCount} wants (${maxPage} pages, approximate)`);
                return approximateCount;
            }

            await Utils.sleep(800);

            const lastPageUrl = `${url}${url.includes('?') ? '&' : '?'}page=${maxPage}`;
            const lastPageResponse = await HttpClient.makeRequest(lastPageUrl, 0, 0, skipRateLimit);
            const lastPageDoc = new DOMParser().parseFromString(lastPageResponse.responseText, 'text/html');
            const lastPageCount = lastPageDoc.querySelectorAll(selectors).length;
            const exactCount = (maxPage - 1) * CONFIG.WANTS_PER_PAGE + lastPageCount;
            
            Logger.info(`Card ${cardId}: ${exactCount} wants (${maxPage} pages, exact)`);
            return exactCount;
            
        } catch (error) {
            Logger.error('WantsCounter error', cardId, error);
            return -1;
        }
    }
}
