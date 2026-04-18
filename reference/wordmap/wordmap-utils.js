/**
 * ワードマップエディター 共通ユーティリティ
 * 2025-07-07 作成: モジュール間で共有される汎用機能
 */

/**
 * エラーハンドリングユーティリティ
 */
class ErrorHandler {
    static logError(source, type, error, context = null, debugModule = null) {
        const errorInfo = {
            source,
            type,
            message: error?.message || String(error),
            stack: error?.stack,
            context,
            timestamp: new Date().toISOString()
        };

        // コンソール出力
        console.error(`[${source}] ${type}:`, error, context);

        // デバッグモジュールへの記録
        if (debugModule) {
            try {
                debugModule.logError(type, error, context);
            } catch (debugError) {
                console.warn('[ErrorHandler] デバッグモジュールへの記録に失敗:', debugError);
            }
        }

        return errorInfo;
    }

    static logEvent(source, level, message, data = null, debugModule = null) {
        const eventInfo = {
            source,
            level,
            message,
            data,
            timestamp: new Date().toISOString()
        };

        // コンソール出力
        const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
        console[consoleMethod](`[${source}] ${message}`, data);

        // デバッグモジュールへの記録
        if (debugModule) {
            try {
                debugModule.logEvent(level, message, data);
            } catch (debugError) {
                console.warn('[ErrorHandler] デバッグモジュールへの記録に失敗:', debugError);
            }
        }

        return eventInfo;
    }

    static wrapAsyncFunction(fn, source, debugModule = null) {
        return async function(...args) {
            try {
                return await fn.apply(this, args);
            } catch (error) {
                ErrorHandler.logError(source, 'AsyncFunctionError', error, {
                    functionName: fn.name,
                    arguments: args.length
                }, debugModule);
                throw error;
            }
        };
    }
}

/**
 * DOM操作ユーティリティ
 */
class DOMHelper {
    static getElementById(id, required = false) {
        const element = document.getElementById(id);
        if (required && !element) {
            throw new Error(`必須要素が見つかりません: ${id}`);
        }
        return element;
    }

    static querySelector(selector, required = false) {
        const element = document.querySelector(selector);
        if (required && !element) {
            throw new Error(`必須要素が見つかりません: ${selector}`);
        }
        return element;
    }

    static querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    }

    static addEventListenerSafe(element, event, handler, options = {}) {
        if (!element) {
            console.warn('[DOMHelper] イベントリスナー追加対象の要素が存在しません');
            return false;
        }

        try {
            element.addEventListener(event, handler, options);
            return true;
        } catch (error) {
            console.error('[DOMHelper] イベントリスナー追加エラー:', error);
            return false;
        }
    }

    static removeEventListenerSafe(element, event, handler, options = {}) {
        if (!element) {
            return false;
        }

        try {
            element.removeEventListener(event, handler, options);
            return true;
        } catch (error) {
            console.error('[DOMHelper] イベントリスナー削除エラー:', error);
            return false;
        }
    }

    static createElementWithClass(tag, className, textContent = '') {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (textContent) {
            element.textContent = textContent;
        }
        return element;
    }

    static toggleClass(element, className, force = null) {
        if (!element) return false;
        
        if (force !== null) {
            element.classList.toggle(className, force);
        } else {
            element.classList.toggle(className);
        }
        return true;
    }

    static setAttributes(element, attributes) {
        if (!element || !attributes) return false;

        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        return true;
    }
}

/**
 * カラーパレット構築ユーティリティ
 */
class PaletteBuilder {
    static createColorPalette(colors, selectedColor = null, onColorSelect = null) {
        const container = document.createElement('div');
        container.className = 'color-palette';

        colors.forEach(color => {
            const colorItem = DOMHelper.createElementWithClass('div', 'color-item');
            colorItem.style.backgroundColor = color;
            colorItem.setAttribute('data-color', color);

            if (selectedColor === color) {
                colorItem.classList.add('selected');
            }

            if (onColorSelect) {
                DOMHelper.addEventListenerSafe(colorItem, 'click', () => {
                    // 他の選択を解除
                    container.querySelectorAll('.color-item').forEach(item => {
                        item.classList.remove('selected');
                    });
                    
                    // 新しい選択を追加
                    colorItem.classList.add('selected');
                    onColorSelect(color);
                });
            }

            container.appendChild(colorItem);
        });

        return container;
    }

    static createSizeSelector(sizes, selectedSize = null, onSizeSelect = null) {
        const container = document.createElement('div');
        container.className = 'size-selector';

        sizes.forEach(size => {
            const sizeBtn = DOMHelper.createElementWithClass('button', 'size-btn', size.label);
            sizeBtn.setAttribute('data-size', size.value);
            sizeBtn.setAttribute('title', size.title);

            if (selectedSize === size.value) {
                sizeBtn.classList.add('active');
            }

            if (onSizeSelect) {
                DOMHelper.addEventListenerSafe(sizeBtn, 'click', () => {
                    // 他の選択を解除
                    container.querySelectorAll('.size-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    
                    // 新しい選択を追加
                    sizeBtn.classList.add('active');
                    onSizeSelect(size.value);
                });
            }

            container.appendChild(sizeBtn);
        });

        return container;
    }
}

/**
 * データ検証ユーティリティ
 */
class ValidationHelper {
    static isValidNode(node) {
        return node && 
               typeof node.id !== 'undefined' &&
               typeof node.label === 'string' &&
               node.style &&
               typeof node.style.color === 'string' &&
               typeof node.style.radius === 'number';
    }

    static isValidLink(link) {
        return link &&
               typeof link.id !== 'undefined' &&
               link.source &&
               link.target &&
               link.style &&
               typeof link.style.color === 'string' &&
               typeof link.style.width === 'number';
    }

    static validateDataStructure(data) {
        const errors = [];

        if (!data) {
            errors.push('データが存在しません');
            return { valid: false, errors };
        }

        if (!Array.isArray(data.nodes)) {
            errors.push('nodes配列が存在しません');
        } else {
            data.nodes.forEach((node, index) => {
                if (!this.isValidNode(node)) {
                    errors.push(`ノード[${index}]が無効です: ${node?.id || 'unknown'}`);
                }
            });
        }

        if (!Array.isArray(data.links)) {
            errors.push('links配列が存在しません');
        } else {
            data.links.forEach((link, index) => {
                if (!this.isValidLink(link)) {
                    errors.push(`リンク[${index}]が無効です: ${link?.id || 'unknown'}`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            stats: {
                nodeCount: data.nodes?.length || 0,
                linkCount: data.links?.length || 0
            }
        };
    }

    static sanitizeFileName(filename) {
        if (!filename || typeof filename !== 'string') {
            return 'untitled';
        }

        // 危険な文字を除去
        return filename
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
            .replace(/^\.+/, '')
            .trim()
            .substring(0, 100) || 'untitled';
    }

    static normalizeColor(color) {
        if (!color || typeof color !== 'string') {
            return '#333333'; // デフォルト色
        }

        // 16進数色の正規化
        if (color.startsWith('#')) {
            const hex = color.substring(1);
            if (/^[0-9a-f]{3}$/i.test(hex)) {
                return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
            }
            if (/^[0-9a-f]{6}$/i.test(hex)) {
                return color.toLowerCase();
            }
        }

        // RGB色の処理
        if (color.startsWith('rgb')) {
            return color;
        }

        // その他の場合はデフォルト色
        return '#333333';
    }
}

/**
 * パフォーマンスユーティリティ
 */
class PerformanceHelper {
    static measureFunction(fn, name = 'function') {
        return function(...args) {
            const startTime = performance.now();
            const result = fn.apply(this, args);
            const endTime = performance.now();
            
            console.log(`[Performance] ${name}: ${(endTime - startTime).toFixed(2)}ms`);
            return result;
        };
    }

    static measureAsyncFunction(fn, name = 'asyncFunction') {
        return async function(...args) {
            const startTime = performance.now();
            const result = await fn.apply(this, args);
            const endTime = performance.now();
            
            console.log(`[Performance] ${name}: ${(endTime - startTime).toFixed(2)}ms`);
            return result;
        };
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// ユーティリティクラスをグローバルに公開
window.WordMapUtils = {
    ErrorHandler,
    DOMHelper,
    PaletteBuilder,
    ValidationHelper,
    PerformanceHelper
};