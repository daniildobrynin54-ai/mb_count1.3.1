// Popup script для управления расширением
document.addEventListener('DOMContentLoaded', async () => {
    const statsDiv = document.getElementById('stats');
    const rateLimitBox = document.getElementById('rateLimitBox');
    const rateLimitFill = document.getElementById('rateLimitFill');
    const rateLimitText = document.getElementById('rateLimitText');
    const rateLimitRemaining = document.getElementById('rateLimitRemaining');
    const rateLimitReset = document.getElementById('rateLimitReset');
    const toggleSwitch = document.getElementById('toggleSwitch');
    const toggleIcon = document.getElementById('toggleIcon');
    const statusBadge = document.getElementById('statusBadge');
    const pageFiltersContainer = document.getElementById('pageFiltersContainer');
    const refreshBtn = document.getElementById('refreshBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const clearBtn = document.getElementById('clearBtn');
    const clearRateLimitBtn = document.getElementById('clearRateLimitBtn');
    const fileInput = document.getElementById('fileInput');
    const messageDiv = document.getElementById('message');

    let currentEnabled = true;
    let currentPageType = null;

    // Получаем активную вкладку
    async function getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    // Отправляем сообщение на страницу
    async function sendMessage(action, data = {}) {
        const tab = await getCurrentTab();
        if (!tab || !tab.id) return null;
        
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { action, ...data }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Message error:', chrome.runtime.lastError);
                    resolve(null);
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Показываем сообщение
    function showMessage(text, type = 'success') {
        const className = type === 'success' ? 'success-message' : 'info-message';
        messageDiv.innerHTML = `<div class="${className}">${text}</div>`;
        setTimeout(() => {
            messageDiv.innerHTML = '';
        }, 3000);
    }

    // Обновляем UI toggle переключателя
    function updateToggleUI(enabled) {
        currentEnabled = enabled;
        
        if (enabled) {
            toggleSwitch.classList.add('active');
            toggleIcon.textContent = '🎴';
            statusBadge.textContent = 'ВКЛ';
            statusBadge.className = 'status-badge enabled';
        } else {
            toggleSwitch.classList.remove('active');
            toggleIcon.textContent = '⸻';
            statusBadge.textContent = 'ВЫКЛ';
            statusBadge.className = 'status-badge disabled';
        }
    }

    // Рендерим фильтры страниц
    function renderPageFilters(filters, currentPageType) {
        if (!filters) {
            pageFiltersContainer.innerHTML = '<div style="text-align: center; padding: 10px; opacity: 0.7;">Недоступно</div>';
            return;
        }

        const pageTypeLabels = {
            packOpening: '🎴 Открытие паков',
            marketLots: '🏪 Маркет (главная)',
            marketLotPage: '📦 Страница лота',
            marketRequests: '📋 Заявки',
            marketRequestCreate: '✍️ Создание заявки',
            userCards: '👤 Карты пользователя',
            userShowcase: '🏆 Витрина',
            tradeCreatePages: '✨ Создание обмена',
            tradePages: '🔄 Обмены',
            deckPages: '📚 Колоды',
            cardShowPage: '🃏 Страница карты',
            other: '🌐 Остальное'
        };

        pageFiltersContainer.innerHTML = '';

        for (const [key, label] of Object.entries(pageTypeLabels)) {
            const isActive = filters[key];
            const isCurrent = key === currentPageType;

            const filterItem = document.createElement('div');
            filterItem.className = 'filter-item';
            
            const labelDiv = document.createElement('div');
            labelDiv.className = 'filter-label';
            labelDiv.innerHTML = `
                <span>${label}</span>
                ${isCurrent ? '<span class="current-page-badge">текущая</span>' : ''}
            `;

            const toggleDiv = document.createElement('div');
            toggleDiv.className = `filter-toggle ${isActive ? 'active' : ''}`;
            toggleDiv.innerHTML = '<div class="filter-slider"></div>';
            
            toggleDiv.addEventListener('click', async () => {
                const newState = !isActive;
                
                // Обновляем UI сразу для отзывчивости
                if (newState) {
                    toggleDiv.classList.add('active');
                } else {
                    toggleDiv.classList.remove('active');
                }

                // Отправляем изменение
                const response = await sendMessage('setPageFilter', { 
                    filterName: key, 
                    enabled: newState 
                });

                if (response && response.success) {
                    filters[key] = newState;
                    showMessage(
                        `${label}: ${newState ? 'включено' : 'выключено'}`,
                        'info'
                    );
                    
                    // Если изменили фильтр текущей страницы, обновляем статистику
                    if (isCurrent) {
                        setTimeout(loadStats, 500);
                    }
                } else {
                    // Откатываем изменения при ошибке
                    if (newState) {
                        toggleDiv.classList.remove('active');
                    } else {
                        toggleDiv.classList.add('active');
                    }
                    showMessage('Ошибка изменения фильтра', 'info');
                }
            });

            filterItem.appendChild(labelDiv);
            filterItem.appendChild(toggleDiv);
            pageFiltersContainer.appendChild(filterItem);
        }
    }

    // Toggle Switch Handler
    toggleSwitch.addEventListener('click', async () => {
        const newState = !currentEnabled;
        updateToggleUI(newState);
        
        const response = await sendMessage('setEnabled', { enabled: newState });
        if (response && response.success) {
            showMessage(newState ? '✅ Расширение включено' : '⸻ Расширение выключено', 'info');
            await loadStats();
        } else {
            // Откатываем изменения если не удалось
            updateToggleUI(!newState);
            showMessage('❌ Ошибка изменения состояния', 'info');
        }
    });

    // Загружаем статистику
    async function loadStats() {
        const tab = await getCurrentTab();
        if (!tab || !tab.url?.includes('mangabuff.ru')) {
            statsDiv.innerHTML = `
                <div style="text-align: center; padding: 20px; opacity: 0.8;">
                    ℹ️ Откройте сайт mangabuff.ru
                </div>
            `;
            rateLimitBox.style.display = 'none';
            pageFiltersContainer.innerHTML = '<div style="text-align: center; padding: 10px; opacity: 0.7;">Недоступно</div>';
            return;
        }

        const stats = await sendMessage('getStats');
        
        if (stats) {
            // Обновляем состояние toggle
            updateToggleUI(stats.enabled);
            currentPageType = stats.currentPageType;

            // Обновляем статистику
            const pageStatusText = stats.currentPageEnabled 
                ? '<span style="color: #4CAF50;">✓ Активна</span>' 
                : '<span style="color: #FF6B6B;">✗ Отключена</span>';

            statsDiv.innerHTML = `
                <div class="stat-item">
                    <span class="stat-label">Карт в кэше</span>
                    <span class="stat-value">${stats.total}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Устаревших</span>
                    <span class="stat-value">${stats.expired}</span>
                </div>
                <div class="stat-item" style="font-size: 12px;">
                    <span class="stat-label">Текущая страница</span>
                    <span>${pageStatusText}</span>
                </div>
            `;

            // Обновляем фильтры страниц
            if (stats.pageFilters) {
                renderPageFilters(stats.pageFilters, stats.currentPageType);
            }

            // Обновляем Rate Limit информацию
            if (stats.rateLimitInfo) {
                const { current, max, remaining, resetIn } = stats.rateLimitInfo;
                const percentage = (current / max) * 100;
                
                rateLimitBox.style.display = 'block';
                rateLimitFill.style.width = `${percentage}%`;
                rateLimitText.textContent = `${current}/${max}`;
                rateLimitRemaining.textContent = `Осталось: ${remaining}`;
                rateLimitReset.textContent = `Сброс через: ${resetIn}с`;

                // Цветовая индикация
                rateLimitFill.classList.remove('warning', 'danger');
                if (percentage >= 90) {
                    rateLimitFill.classList.add('danger');
                } else if (percentage >= 70) {
                    rateLimitFill.classList.add('warning');
                }
            }
        } else {
            statsDiv.innerHTML = `
                <div style="text-align: center; padding: 20px; opacity: 0.8;">
                    ⚠️ Не удалось загрузить данные
                </div>
            `;
            rateLimitBox.style.display = 'none';
            pageFiltersContainer.innerHTML = '<div style="text-align: center; padding: 10px; opacity: 0.7;">Недоступно</div>';
        }
    }

    // Обновить карты
    refreshBtn.addEventListener('click', async () => {
        if (!currentEnabled) {
            showMessage('⚠️ Включите расширение для обновления', 'info');
            return;
        }

        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<span class="icon">⳿</span><span>Обновление...</span>';
        
        await sendMessage('refresh');
        showMessage('✅ Карты обновляются');
        
        setTimeout(() => {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<span class="icon">🔄</span><span>Обновить карты</span>';
            loadStats();
        }, 1000);
    });

    // Экспорт кэша
    exportBtn.addEventListener('click', async () => {
        const response = await sendMessage('exportCache');
        if (response && response.data) {
            const dataStr = JSON.stringify(response.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mbuf_cache_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showMessage('✅ Кэш экспортирован');
        } else {
            showMessage('❌ Ошибка экспорта');
        }
    });

    // Импорт кэша
    importBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            await sendMessage('importCache', { data });
            showMessage('✅ Кэш импортирован');
            loadStats();
        } catch (err) {
            showMessage('❌ Ошибка импорта: ' + err.message);
        }
        
        fileInput.value = '';
    });

    // Очистить кэш
    clearBtn.addEventListener('click', async () => {
        if (!confirm('Очистить весь кэш?')) return;
        
        clearBtn.disabled = true;
        clearBtn.innerHTML = '<span class="icon">⳿</span><span>Очистка...</span>';
        
        await sendMessage('clearCache');
        showMessage('✅ Кэш очищен');
        
        setTimeout(() => {
            clearBtn.disabled = false;
            clearBtn.innerHTML = '<span class="icon">🗑️</span><span>Очистить кэш</span>';
            loadStats();
        }, 1000);
    });

    // Сбросить Rate Limit
    clearRateLimitBtn.addEventListener('click', async () => {
        if (!confirm('Сбросить счётчик rate limit? Используйте только в экстренных случаях!')) return;
        
        clearRateLimitBtn.disabled = true;
        clearRateLimitBtn.innerHTML = '<span class="icon">⳿</span><span>Сброс...</span>';
        
        await sendMessage('clearRateLimit');
        showMessage('✅ Rate limit сброшен');
        
        setTimeout(() => {
            clearRateLimitBtn.disabled = false;
            clearRateLimitBtn.innerHTML = '<span class="icon">🔄</span><span>Сбросить Rate Limit</span>';
            loadStats();
        }, 1000);
    });

    // Загружаем статистику при открытии
    await loadStats();
    
    // Обновляем статистику каждые 2 секунды
    setInterval(loadStats, 2000);
});