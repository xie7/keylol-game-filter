// ==UserScript==
// @name         其乐 Keylol 游戏折扣筛选器
// @namespace    https://github.com/xie7/keylol-game-filter
// @version      1.0.0
// @description  为其乐 Keylol 论坛游戏折扣帖添加高级筛选功能，支持价格范围、游戏评价、语言支持筛选，带日夜模式和可调节大小悬浮窗
// @author       xie7
// @match        https://keylol.com/forum.php?mod=viewthread*
// @match        https://keylol.com/t*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/xie7/keylol-game-filter/main/keylol-game-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/xie7/keylol-game-filter/main/keylol-game-filter.user.js
// @homepage     https://github.com/xie7/keylol-game-filter
// @supportURL   https://github.com/xie7/keylol-game-filter/issues
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';
    
    const CONFIG = {
        panelPosition: { bottom: '20px', left: '20px' },
        minSize: { width: 280, height: 350 },
        maxSize: { width: 500, height: 600 },
        themes: {
            dark: {
                background: 'linear-gradient(135deg, rgba(30, 30, 46, 0.98) 0%, rgba(20, 20, 35, 0.95) 100%)',
                border: '1px solid #00adb5',
                color: '#e0e0e0',
                buttonBg: 'rgba(26, 26, 46, 0.8)',
                headerColor: '#00adb5',
                boxShadow: '0 8px 32px rgba(0, 173, 181, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            },
            light: {
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 245, 250, 0.95) 100%)',
                border: '1px solid #00adb5',
                color: '#2c3e50',
                buttonBg: 'rgba(240, 240, 245, 0.9)',
                headerColor: '#008b94',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
            }
        },
        priceRanges: [
            { label: '0~20', min: 0, max: 20, color: '#4ecdc4' },
            { label: '21~50', min: 21, max: 50, color: '#00adb5' },
            { label: '51 以上', min: 51, max: Infinity, color: '#ff6b6b' }
        ],
        ratings: [
            { label: '全部', value: 'all', color: '#4ecdc4' },
            { label: '好评如潮', value: '好评如潮', color: '#00adb5' },
            { label: '特别好评', value: '特别好评', color: '#ff6b6b' },
            { label: '多半好评', value: '多半好评', color: '#f39c12' },
            { label: '褒贬不一', value: '褒贬不一', color: '#95a5a6' }
        ]
    };
    
    let currentFilters = { priceRange: null, rating: 'all', languages: [] };
    const originalStyles = new Map();
    let isDarkMode = true;
    let isResizing = false;
    let resizeStartX, resizeStartY, resizeStartWidth, resizeStartHeight;
    
    function getGameTable() { return document.querySelector('table.t_table'); }
    
    function parsePrice(priceText) {
        const match = priceText.match(/¥(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : null;
    }
    
    function checkLanguageSupport(languageText, selectedLanguages) {
        if (selectedLanguages.length === 0) return true;
        for (const lang of selectedLanguages) {
            if (lang === '简体中文' && !languageText.includes('支持简中')) return false;
            if (lang === '繁体中文' && !languageText.includes('支持繁中') && !languageText.includes('支持简中繁中')) return false;
        }
        return true;
    }
    
    function checkRating(gameRating, selectedRating) {
        if (selectedRating === 'all') return true;
        return gameRating.includes(selectedRating);
    }
    
    function applyFilters() {
        const gameTable = getGameTable();
        if (!gameTable) { console.warn('未找到游戏表格'); return; }
        
        const rows = gameTable.querySelectorAll('tbody tr');
        let highlightedCount = 0;
        const highlightBg = '#ffcc00', highlightText = '#000000';
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td');
            if (cells.length >= 5) {
                const priceCell = cells[1], ratingCell = cells[3], languageCell = cells[4];
                const priceText = priceCell.textContent || priceCell.innerText;
                const ratingText = ratingCell.textContent || ratingCell.innerText;
                const languageText = languageCell.textContent || languageCell.innerText;
                const price = parsePrice(priceText);
                
                if (!originalStyles.has(row)) {
                    originalStyles.set(row, {
                        backgroundColor: row.style.backgroundColor,
                        color: row.style.color,
                        fontWeight: row.style.fontWeight
                    });
                }
                
                row.style.backgroundColor = ''; row.style.color = ''; row.style.fontWeight = '';
                
                if (price !== null) {
                    let priceMatch = false;
                    if (currentFilters.priceRange) {
                        const range = CONFIG.priceRanges.find(r => r.label === currentFilters.priceRange);
                        if (range) priceMatch = price >= range.min && price <= range.max;
                    } else { priceMatch = true; }
                    
                    const ratingMatch = checkRating(ratingText, currentFilters.rating);
                    const languageMatch = checkLanguageSupport(languageText, currentFilters.languages);
                    
                    if (priceMatch && ratingMatch && languageMatch) {
                        row.style.backgroundColor = highlightBg;
                        row.style.color = highlightText;
                        row.style.fontWeight = 'bold';
                        row.querySelectorAll('a').forEach(link => {
                            link.style.color = highlightText;
                            link.style.fontWeight = 'bold';
                        });
                        highlightedCount++;
                    }
                }
            }
        }
        showNotification(highlightedCount);
    }
    
    function showNotification(count) {
        const oldNotice = document.getElementById('filter-notice');
        if (oldNotice) oldNotice.remove();
        const notice = document.createElement('div');
        notice.id = 'filter-notice';
        const theme = isDarkMode ? CONFIG.themes.dark : CONFIG.themes.light;
        notice.style.cssText = `position: fixed; bottom: 100px; left: 20px; background: ${theme.background}; color: ${theme.color}; padding: 10px 20px; border-radius: 6px; z-index: 10000; font-size: 14px; box-shadow: ${theme.boxShadow}; border: ${theme.border};`;
        notice.innerHTML = `✅ 已筛选出 <strong>${count}</strong> 个符合条件的游戏`;
        document.body.appendChild(notice);
        setTimeout(() => {
            notice.style.transition = 'opacity 0.5s';
            notice.style.opacity = '0';
            setTimeout(() => notice.remove(), 500);
        }, 3000);
    }
    
    function resetFilters() {
        currentFilters = { priceRange: null, rating: 'all', languages: [] };
        const gameTable = getGameTable();
        if (!gameTable) return;
        gameTable.querySelectorAll('tbody tr').forEach((row, i) => {
            if (i === 0) return;
            if (originalStyles.has(row)) {
                const original = originalStyles.get(row);
                row.style.backgroundColor = original.backgroundColor;
                row.style.color = original.color;
                row.style.fontWeight = original.fontWeight;
            } else {
                row.style.backgroundColor = ''; row.style.color = ''; row.style.fontWeight = '';
            }
            row.querySelectorAll('a').forEach(link => { link.style.color = ''; link.style.fontWeight = ''; });
        });
        updateButtonStates();
    }
    
    function toggleTheme() {
        isDarkMode = !isDarkMode;
        applyTheme();
    }
    
    function applyTheme() {
        const panel = document.getElementById('game-filter-panel');
        if (!panel) return;
        const theme = isDarkMode ? CONFIG.themes.dark : CONFIG.themes.light;
        panel.style.background = theme.background;
        panel.style.border = theme.border;
        panel.style.color = theme.color;
        panel.style.boxShadow = theme.boxShadow;
        updateButtonStates();
    }
    
    function updateButtonStates() {
        const theme = isDarkMode ? CONFIG.themes.dark : CONFIG.themes.light;
        CONFIG.priceRanges.forEach(range => {
            const btn = document.getElementById(`price-btn-${range.label}`);
            if (btn) {
                if (currentFilters.priceRange === range.label) {
                    btn.style.background = range.color; btn.style.color = '#fff'; btn.style.borderColor = range.color;
                } else {
                    btn.style.background = theme.buttonBg; btn.style.color = range.color; btn.style.borderColor = range.color;
                }
            }
        });
        CONFIG.ratings.forEach(rating => {
            const btn = document.getElementById(`rating-btn-${rating.value}`);
            if (btn) {
                if (currentFilters.rating === rating.value) {
                    btn.style.background = rating.color; btn.style.color = '#fff'; btn.style.borderColor = rating.color;
                } else {
                    btn.style.background = theme.buttonBg; btn.style.color = rating.color; btn.style.borderColor = rating.color;
                }
            }
        });
        ['简体中文', '繁体中文'].forEach(lang => {
            const btn = document.getElementById(`lang-btn-${lang}`);
            if (btn) {
                if (currentFilters.languages.includes(lang)) {
                    btn.style.background = '#00adb5'; btn.style.color = '#fff'; btn.style.borderColor = '#00adb5';
                } else {
                    btn.style.background = theme.buttonBg; btn.style.color = '#00adb5'; btn.style.borderColor = '#00adb5';
                }
            }
        });
    }
    
    function setupResizeHandlers() {
        const panel = document.getElementById('game-filter-panel');
        const resizer = document.getElementById('panel-resizer');
        if (!panel || !resizer) return;
        
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizeStartX = e.clientX;
            resizeStartY = e.clientY;
            resizeStartWidth = panel.offsetWidth;
            resizeStartHeight = panel.offsetHeight;
            document.body.style.cursor = 'nwse-resize';
            resizer.style.background = 'rgba(0, 173, 181, 0.5)';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const deltaX = e.clientX - resizeStartX;
            const deltaY = e.clientY - resizeStartY;
            let newWidth = resizeStartWidth + deltaX;
            let newHeight = resizeStartHeight + deltaY;
            
            newWidth = Math.max(CONFIG.minSize.width, Math.min(newWidth, CONFIG.maxSize.width));
            newHeight = Math.max(CONFIG.minSize.height, Math.min(newHeight, CONFIG.maxSize.height));
            
            const tableRect = getGameTable()?.getBoundingClientRect();
            if (tableRect) {
                const maxRight = tableRect.left - 20;
                const panelLeft = panel.getBoundingClientRect().left;
                const maxWidthFromLeft = maxRight - panelLeft;
                if (newWidth > maxWidthFromLeft && maxWidthFromLeft > CONFIG.minSize.width) {
                    newWidth = maxWidthFromLeft;
                }
            }
            
            panel.style.width = newWidth + 'px';
            panel.style.height = newHeight + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                resizer.style.background = 'rgba(0, 173, 181, 0.3)';
            }
        });
    }
    
    function createPanel() {
        const oldPanel = document.getElementById('game-filter-panel');
        if (oldPanel) oldPanel.remove();
        
        const panel = document.createElement('div');
        panel.id = 'game-filter-panel';
        const theme = CONFIG.themes.dark;
        
        Object.assign(panel.style, {
            position: 'fixed',
            ...CONFIG.panelPosition,
            width: '320px',
            height: '420px',
            background: theme.background,
            border: theme.border,
            borderRadius: '12px',
            padding: '16px',
            fontFamily: "'Segoe UI', 'Microsoft YaHei', Arial, sans-serif",
            fontSize: '13px',
            color: theme.color,
            boxShadow: theme.boxShadow,
            backdropFilter: 'blur(10px)',
            zIndex: '9999',
            transition: 'all 0.3s ease',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        });
        
        let priceButtonsHtml = CONFIG.priceRanges.map(range => 
            `<button id="price-btn-${range.label}" data-range="${range.label}" 
            style="flex: 1; padding: 10px 5px; background: ${theme.buttonBg}; border: 2px solid ${range.color}; 
            color: ${range.color}; border-radius: 8px; cursor: pointer; font-size: 12px; 
            font-weight: 600; transition: all 0.25s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
            💰 ${range.label}</button>`
        ).join('');
        
        let ratingButtonsHtml = CONFIG.ratings.map(rating => 
            `<button id="rating-btn-${rating.value}" data-rating="${rating.value}" 
            style="flex: 1; padding: 8px 4px; background: ${theme.buttonBg}; border: 2px solid ${rating.color}; 
            color: ${rating.color}; border-radius: 8px; cursor: pointer; font-size: 11px; 
            font-weight: 600; transition: all 0.25s ease; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
            ${rating.label}</button>`
        ).join('');
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(0, 173, 181, 0.3);">
                <div style="font-weight: 700; color: ${theme.headerColor}; font-size: 15px; display: flex; align-items: center; gap: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                    <span>🎮 游戏筛选器</span>
                </div>
                <button id="theme-toggle" style="background: rgba(0, 173, 181, 0.2); border: 1px solid #00adb5; 
                    color: #00adb5; border-radius: 6px; cursor: pointer; font-size: 16px; 
                    padding: 6px 10px; transition: all 0.25s ease; box-shadow: 0 2px 8px rgba(0, 173, 181, 0.3);"
                    title="切换日间/夜间模式">🌙</button>
            </div>
            <div style="margin-bottom: 8px; font-size: 12px; color: ${theme.color}; font-weight: 600;">💰 价格范围:</div>
            <div style="display: flex; gap: 6px; margin-bottom: 14px;">${priceButtonsHtml}</div>
            <div style="margin-bottom: 8px; font-size: 12px; color: ${theme.color}; font-weight: 600;">⭐ 游戏评价:</div>
            <div style="display: flex; gap: 4px; margin-bottom: 14px; flex-wrap: wrap;">${ratingButtonsHtml}</div>
            <div style="margin-bottom: 8px; font-size: 12px; color: ${theme.color}; font-weight: 600;">🌐 语言支持:</div>
            <div style="display: flex; gap: 6px; margin-bottom: 14px;">
                <button id="lang-btn-简体中文" data-lang="简体中文" 
                    style="flex: 1; padding: 10px 0; background: ${theme.buttonBg}; border: 2px solid #00adb5; 
                    color: #00adb5; border-radius: 8px; cursor: pointer; font-size: 12px; 
                    font-weight: 600; transition: all 0.25s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">简体中文</button>
                <button id="lang-btn-繁体中文" data-lang="繁体中文" 
                    style="flex: 1; padding: 10px 0; background: ${theme.buttonBg}; border: 2px solid #00adb5; 
                    color: #00adb5; border-radius: 8px; cursor: pointer; font-size: 12px; 
                    font-weight: 600; transition: all 0.25s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">繁体中文</button>
            </div>
            <div style="display: flex; gap: 6px; margin-bottom: 12px; margin-top: auto;">
                <button id="filter-confirm" style="flex: 1; padding: 12px 0; background: linear-gradient(135deg, #00adb5 0%, #008b94 100%); 
                    border: none; color: #fff; border-radius: 8px; cursor: pointer; font-size: 13px; 
                    font-weight: 700; transition: all 0.25s ease; box-shadow: 0 4px 15px rgba(0, 173, 181, 0.4);">
                    ✅ 确定筛选</button>
                <button id="filter-reset" style="flex: 1; padding: 12px 0; background: ${theme.buttonBg}; 
                    border: 2px solid #ff6b6b; color: #ff6b6b; border-radius: 8px; cursor: pointer; 
                    font-size: 13px; font-weight: 700; transition: all 0.25s ease; box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);">
                    🔄 重置</button>
            </div>
            <div style="font-size: 11px; color: ${theme.color}; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 10px; margin-top: 8px;">
                仅筛选当前页面数据
            </div>
            <div id="panel-resizer" style="position: absolute; bottom: 0; right: 0; width: 20px; height: 20px; 
                cursor: nwse-resize; background: linear-gradient(135deg, transparent 50%, rgba(0, 173, 181, 0.3) 50%); 
                border-radius: 0 0 12px 0; transition: background 0.2s;"></div>
        `;
        
        document.body.appendChild(panel);
        setupEventListeners();
        setupResizeHandlers();
        updateButtonStates();
    }
    
    function setupEventListeners() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                toggleTheme();
                themeToggle.textContent = isDarkMode ? '🌙' : '☀️';
            });
        }
        
        CONFIG.priceRanges.forEach(range => {
            const btn = document.getElementById(`price-btn-${range.label}`);
            if (btn) btn.addEventListener('click', () => {
                currentFilters.priceRange = currentFilters.priceRange === range.label ? null : range.label;
                updateButtonStates();
            });
        });
        CONFIG.ratings.forEach(rating => {
            const btn = document.getElementById(`rating-btn-${rating.value}`);
            if (btn) btn.addEventListener('click', () => {
                currentFilters.rating = rating.value;
                updateButtonStates();
            });
        });
        ['简体中文', '繁体中文'].forEach(lang => {
            const btn = document.getElementById(`lang-btn-${lang}`);
            if (btn) btn.addEventListener('click', () => {
                const index = currentFilters.languages.indexOf(lang);
                if (index > -1) currentFilters.languages.splice(index, 1);
                else currentFilters.languages.push(lang);
                updateButtonStates();
            });
        });
        document.getElementById('filter-confirm').addEventListener('click', applyFilters);
        document.getElementById('filter-reset').addEventListener('click', resetFilters);
    }
    
    function init() {
        console.log('[游戏筛选器] 脚本初始化...');
        
        // 等待页面完全加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(setup, 1000);
            });
        } else {
            setTimeout(setup, 1000);
        }
        
        function setup() {
            // 检查是否在游戏折扣页面
            const gameTable = getGameTable();
            if (!gameTable) {
                console.log('[游戏筛选器] 未检测到游戏表格，跳过初始化');
                return;
            }
            
            // 创建控制面板
            createPanel();
            
            console.log('[游戏筛选器] 美化版控制面板已创建在左下角');
            
            // 监听页面变化（如翻页）
            const observer = new MutationObserver(function(mutations) {
                let hasNewContent = false;
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes.length > 0) {
                        hasNewContent = true;
                    }
                });
                
                if (hasNewContent) {
                    clearTimeout(window.filterUpdateTimer);
                    window.filterUpdateTimer = setTimeout(() => {
                        // 重新初始化面板
                        createPanel();
                    }, 500);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }
    
    // 启动脚本
    init();
})();
