// Utility functions
export const Utils = {
    // Получить ID карты из маркет-лота
    async getMarketCardId(lotId) {
        try {
            const response = await fetch(`https://mangabuff.ru/market/${lotId}`, {
                credentials: 'include',
                headers: {
                    'Accept': 'text/html',
                    'User-Agent': navigator.userAgent
                }
            });
            
            if (!response.ok) {
                console.error(`[MBUF] Failed to fetch lot ${lotId}: ${response.status}`);
                return null;
            }
            
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            
            // Ищем ссылку на карту: href="/cards/328881/users"
            const cardLink = doc.querySelector('a[href*="/cards/"][href*="/users"]');
            if (cardLink) {
                const match = cardLink.href.match(/\/cards\/(\d+)\/users/);
                if (match) {
                    console.log(`[MBUF] Lot ${lotId} -> Card ${match[1]}`);
                    return match[1];
                }
            }
            
            console.error(`[MBUF] Card ID not found in lot ${lotId}`);
            return null;
        } catch (error) {
            console.error(`[MBUF] Error fetching lot ${lotId}:`, error);
            return null;
        }
    },

    getCardId(cardElem) {
        if (!cardElem) return null;

        // Специальная обработка для личных лотов на маркете
        if (location.pathname === '/market') {
            const isMyLot = cardElem.closest('.market-list__cards--my');
            
            if (isMyLot) {
                // Это личный лот - используем data-id для получения ID через страницу лота
                const wrapper = cardElem.closest('.manga-cards__item-wrapper');
                if (wrapper) {
                    const lotId = wrapper.getAttribute('data-id');
                    if (lotId) {
                        console.log(`[MBUF] Detected my lot: ${lotId}`);
                        return `market:${lotId}`;
                    }
                }
            }
        }

        // Стандартная логика для остальных случаев
        if (cardElem.tagName === 'A' && cardElem.href) {
            const tradeMatch = cardElem.href.match(/\/cards\/(\d+)\/users/);
            if (tradeMatch) return tradeMatch[1];
        }

        const tradeLink = cardElem.querySelector('a[href*="/cards/"][href*="/users"]');
        if (tradeLink) {
            const tradeMatch = tradeLink.href.match(/\/cards\/(\d+)\/users/);
            if (tradeMatch) return tradeMatch[1];
        }

        const tryAttr = el => {
            if (!el) return null;
            return el.getAttribute?.('data-card-id') ||
                   el.getAttribute?.('data-id') ||
                   el.getAttribute?.('data-card') ||
                   el.getAttribute?.('data-item-id') ||
                   null;
        };

        let id = tryAttr(cardElem);
        if (id) return id;

        const parent = cardElem.closest?.('[data-card-id], [data-id], [data-card], [data-item-id]');
        id = tryAttr(parent);
        if (id) return id;

        const child = cardElem.querySelector?.('[data-card-id], [data-id], [data-card], [data-item-id]');
        id = tryAttr(child);
        if (id) return id;

        const link = cardElem.querySelector('a[href*="/cards/"]');
        if (link) {
            const match = link.href.match(/\/cards\/(\d+)(?:\/|$)/);
            if (match) return match[1];
        }

        if (cardElem.tagName === 'A' && cardElem.href) {
            const match = cardElem.href.match(/\/cards\/(\d+)(?:\/|$)/);
            if (match) return match[1];
        }

        return null;
    },

    parsePageNumbers(doc) {
        const pageElements = doc.querySelectorAll('.pagination__button, .pagination > li > a, .pagination > li, .paginator a');
        const pages = Array.from(pageElements)
            .map(el => parseInt(el.textContent.trim(), 10))
            .filter(num => !isNaN(num) && num > 0);
        return pages.length ? Math.max(...pages) : 1;
    },

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
    now() { return Date.now(); }
};