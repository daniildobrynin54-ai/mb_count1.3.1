// Utility functions
export const Utils = {
    getCardId(cardElem) {
        if (!cardElem) return null;

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
