// UI Badge for cards with correct imports
import { DOMUtils } from './utils.js';

export class StatsBadge {
    static update(cardElem, owners, wants, isExpired = false, isManuallyUpdated = false) {
        if (!cardElem) return;
        
        const badgeClass = 'mbuf_card_overlay';
        let badge = cardElem.querySelector(`.${badgeClass}`);
        if (!badge) badge = this.create(cardElem, badgeClass);
        this.render(badge, owners, wants, isExpired, isManuallyUpdated);
    }

    static create(cardElem, badgeClass) {
        const badge = document.createElement('div');
        badge.className = badgeClass;

        const isTradeCard = cardElem.classList.contains('trade__main-item');
        const isMobile = window.innerWidth <= 768;

        Object.assign(badge.style, {
            position: 'absolute',
            right: isTradeCard ? '4px' : '6px',
            top: isTradeCard ? '36px' : '38px', // Смещение вниз на 32 пикселя (было 4px и 6px)
            zIndex: '10',
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            fontSize: isMobile ? '10px' : (isTradeCard ? '11px' : '12px'),
            padding: isMobile ? '2px 5px' : (isTradeCard ? '3px 6px' : '4px 8px'),
            borderRadius: '12px',
            display: 'flex',
            gap: isMobile ? '4px' : (isTradeCard ? '6px' : '8px'),
            alignItems: 'center',
            pointerEvents: 'auto',
            border: '1px solid rgba(255,255,255,0.06)',
            transition: 'background 0.3s ease',
            cursor: 'pointer',
            touchAction: 'manipulation'
        });

        badge.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const cardId = DOMUtils.getCardId(cardElem);
            if (cardId) {
                try {
                    const { CardProcessor } = await import('./card-processor.js');
                    await CardProcessor.priorityUpdateCard(cardElem, cardId);
                } catch (error) {
                    console.error('[MBUF] Error updating card:', error);
                }
            }
        });

        if (getComputedStyle(cardElem).position === 'static') {
            cardElem.style.position = 'relative';
        }
        cardElem.appendChild(badge);
        return badge;
    }

    static render(badge, owners, wants, isExpired = false, isManuallyUpdated = false) {
        if (!badge) return;

        if (owners === '⌛' && isManuallyUpdated) {
            badge.style.background = 'linear-gradient(135deg, rgba(255,215,0,0.95), rgba(255,165,0,0.95))';
            badge.style.border = '2px solid rgba(255,223,0,0.8)';
            badge.style.boxShadow = '0 0 20px rgba(255,215,0,0.6)';
        } else if (isManuallyUpdated) {
            badge.style.background = 'linear-gradient(135deg, rgba(255,215,0,0.9), rgba(218,165,32,0.9))';
            badge.style.border = '1px solid rgba(255,223,0,0.5)';
            badge.style.boxShadow = 'none';
        } else if (isExpired && owners !== '⌛' && owners !== -1) {
            badge.style.background = 'rgba(200, 50, 50, 0.9)';
            badge.style.border = '1px solid rgba(255, 100, 100, 0.3)';
            badge.style.boxShadow = 'none';
        } else {
            badge.style.background = 'rgba(0,0,0,0.85)';
            badge.style.border = '1px solid rgba(255,255,255,0.06)';
            badge.style.boxShadow = 'none';
        }

        const fmt = c => {
            if (c === -1) return '<span style="color:#ff6b6b">err</span>';
            if (c === '⌛') return '<span style="color:#ffd93d">⌛</span>';
            return String(c);
        };

        const expiredIndicator = isExpired ? ' 🔄' : '';
        const manualIndicator = isManuallyUpdated ? ' ✨' : '';
        
        const ownersTooltip = isManuallyUpdated 
            ? `Владельцев: ${owners === -1 ? 'ошибка' : owners} (ТОЧНОЕ, обновлено вручную)`
            : `Владельцев: ${owners === -1 ? 'ошибка' : owners}${isExpired ? ' (устарело)' : ''} - Клик для ТОЧНОГО обновления`;
        
        const wantsTooltip = isManuallyUpdated
            ? `Желающих: ${wants === -1 ? 'ошибка' : wants} (ТОЧНОЕ, обновлено вручную)`
            : `Желающих: ${wants === -1 ? 'ошибка' : wants}${isExpired ? ' (устарело)' : ''} - Клик для ТОЧНОГО обновления`;

        badge.innerHTML = `
            <span title="${ownersTooltip}">
                👥${fmt(owners)}${expiredIndicator}${manualIndicator}
            </span>
            <span title="${wantsTooltip}">
                ⭐${fmt(wants)}
            </span>
        `;
    }
}