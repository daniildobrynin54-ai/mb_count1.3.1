// Background service worker для расширения
// Минимальный фоновый скрипт для Manifest V3

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Mangabuff Card Stats установлен');
        
        // Открываем приветственную страницу при первой установке
        chrome.tabs.create({
            url: 'https://mangabuff.ru'
        });
    } else if (details.reason === 'update') {
        console.log('Mangabuff Card Stats обновлён до версии', chrome.runtime.getManifest().version);
    }
});

// Слушаем клики по иконке расширения (опционально)
chrome.action.onClicked.addListener((tab) => {
    // Если нужно, можно добавить дополнительную логику при клике на иконку
    console.log('Extension icon clicked on tab:', tab.id);
});

// Логирование для отладки
console.log('Mangabuff Card Stats background service worker запущен');
