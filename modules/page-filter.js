// Page Filter Manager - контролирует на каких страницах работает расширение
import { CONFIG } from './config.js';
import { Logger } from './logger.js';
import { storageGet, storageSet } from './storage.js';

export class PageFilter {
    static filters = { ...CONFIG.DEFAULT_PAGE_FILTERS };

    static async load() {
        try {
            const stored = await storageGet(CONFIG.PAGE_FILTERS_KEY, null);
            if (stored && typeof stored === 'object') {
                // Объединяем с дефолтными настройками (на случай добавления новых страниц)
                this.filters = { ...CONFIG.DEFAULT_PAGE_FILTERS, ...stored };
            } else {
                this.filters = { ...CONFIG.DEFAULT_PAGE_FILTERS };
            }
            Logger.info('Page filters loaded:', this.filters);
        } catch (e) {
            Logger.warn('PageFilter load error:', e);
            this.filters = { ...CONFIG.DEFAULT_PAGE_FILTERS };
        }
    }

    static async save() {
        try {
            await storageSet(CONFIG.PAGE_FILTERS_KEY, this.filters);
            Logger.info('Page filters saved');
        } catch (e) {
            Logger.warn('PageFilter save error:', e);
        }
    }

    static async setFilter(filterName, enabled) {
        if (this.filters.hasOwnProperty(filterName)) {
            this.filters[filterName] = enabled;
            await this.save();
            Logger.important(`Page filter "${filterName}" set to ${enabled}`);
            return true;
        }
        return false;
    }

    static getFilters() {
        return { ...this.filters };
    }

    static getCurrentPageType() {
        const path = location.pathname;
        
        // /cards/pack - открытие паков
        if (path.includes('/cards/pack')) {
            return 'packOpening';
        }
        
        // /market/requests/create - создание заявки
        if (path.includes('/market/requests/create')) {
            return 'marketRequestCreate';
        }
        
        // /market/requests - страница заявок
        if (path === '/market/requests' || path.startsWith('/market/requests?')) {
            return 'marketRequests';
        }
        
        // /market/[id] - страница конкретного лота
        if (/^\/market\/\d+/.test(path)) {
            return 'marketLotPage';
        }
        
        // /market - основная страница маркета
        if (path === '/market' || path.startsWith('/market?')) {
            return 'marketLots';
        }
        
        // /users/[id]/cards - карты пользователя
        if (/^\/users\/\d+\/cards/.test(path)) {
            return 'userCards';
        }
        
        // /users/[id] - витрина пользователя
        if (/^\/users\/\d+$/.test(path) || /^\/users\/\d+\/showcase/.test(path)) {
            return 'userShowcase';
        }
        
        // /trades/offers/[id] - создание обмена
        if (/^\/trades\/offers\/\d+/.test(path)) {
            return 'tradeCreatePages';
        }
        
        // /trades/[id] - страница обмена
        if (/^\/trades\/\d+/.test(path)) {
            return 'tradePages';
        }
        
        // /decks/[id] - страница колоды
        if (/^\/decks\/\d+/.test(path)) {
            return 'deckPages';
        }
        
        // /cards/[id] - страница карты
        if (/^\/cards\/\d+/.test(path)) {
            return 'cardShowPage';
        }
        
        // Остальное
        return 'other';
    }

    static isCurrentPageEnabled() {
        const pageType = this.getCurrentPageType();
        const enabled = this.filters[pageType];
        
        Logger.info(`Current page: ${pageType}, enabled: ${enabled}`);
        return enabled;
    }

    static getPageTypeLabel(pageType) {
        const labels = {
            packOpening: '🎴 Открытие паков',
            marketLots: '🏪 Маркет (главная)',
            marketLotPage: '📦 Страница лота',
            marketRequests: '📋 Заявки на маркете',
            marketRequestCreate: '✍️ Создание заявки',
            userCards: '👤 Карты пользователя',
            userShowcase: '🏆 Витрина пользователя',
            tradeCreatePages: '✨ Создание обмена',
            tradePages: '🔄 Страницы обмена',
            deckPages: '📚 Страницы колод',
            cardShowPage: '🃏 Страница карты',
            other: '🌐 Остальные страницы'
        };
        return labels[pageType] || pageType;
    }
}