/**
 * WordMap ユーティリティ関数集 (JavaScript互換版)
 * 2025-07-07 作成: TypeScript版からの互換バージョン
 */

/**
 * エラーハンドリング関連のユーティリティ
 */
class ErrorHandler {
    /**
     * エラー情報をログに記録
     */
    static logError(source, type, error, context, debugModule) {
        const errorInfo = {
            source,
            type,
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        };

        console.error(`[${source}] ${type}:`, error.message, context || '');

        if (debugModule?.logError) {
            debugModule.logError(errorInfo);
        }

        return errorInfo;
    }

    /**
     * イベント情報をログに記録
     */
    static logEvent(source, level, message, data, debugModule) {
        const eventInfo = {
            source,
            level,
            message,
            data,
            timestamp: new Date().toISOString()
        };

        if (level === 'error') {
            console.error(`[${source}]`, message, data || '');
        } else if (level === 'warn') {
            console.warn(`[${source}]`, message, data || '');
        } else {
            console.log(`[${source}]`, message, data || '');
        }

        if (debugModule?.logEvent) {
            debugModule.logEvent(eventInfo);
        }

        return eventInfo;
    }

    /**
     * 非同期関数をエラーハンドリングでラップ
     */
    static wrapAsyncFunction(fn, source, debugModule) {
        return async function(...args) {
            try {
                return await fn.apply(this, args);
            } catch (error) {
                ErrorHandler.logError(source, 'async', error, { args }, debugModule);
                throw error;
            }
        };
    }
}

/**
 * DOM操作関連のユーティリティ
 */
class DOMHelper {
    /**
     * IDで要素を取得
     */
    static getElementById(id, required = false) {
        const element = document.getElementById(id);
        
        if (required && !element) {
            throw new Error(`Required element with id '${id}' not found`);
        }
        
        return element;
    }

    /**
     * セレクタで要素を取得
     */
    static querySelector(selector, required = false) {
        const element = document.querySelector(selector);
        
        if (required && !element) {
            throw new Error(`Required element with selector '${selector}' not found`);
        }
        
        return element;
    }

    /**
     * セレクタで複数要素を取得
     */
    static querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    }

    /**
     * 安全にイベントリスナーを追加
     */
    static addEventListenerSafe(element, event, handler, options) {
        if (!element || typeof handler !== 'function') {
            return false;
        }

        try {
            element.addEventListener(event, handler, options);
            return true;
        } catch (error) {
            console.warn(`Failed to add event listener: ${error}`);
            return false;
        }
    }

    /**
     * 安全にイベントリスナーを削除
     */
    static removeEventListenerSafe(element, event, handler, options) {
        if (!element || typeof handler !== 'function') {
            return false;
        }

        try {
            element.removeEventListener(event, handler, options);
            return true;
        } catch (error) {
            console.warn(`Failed to remove event listener: ${error}`);
            return false;
        }
    }

    /**
     * クラス付きで要素を作成
     */
    static createElementWithClass(tag, className, textContent) {
        const element = document.createElement(tag);
        
        if (className) {
            element.className = className;
        }
        
        if (textContent) {
            element.textContent = textContent;
        }
        
        return element;
    }

    /**
     * クラスを安全に切り替え
     */
    static toggleClass(element, className, force) {
        if (!element) {
            return false;
        }

        try {
            return element.classList.toggle(className, force);
        } catch (error) {
            console.warn(`Failed to toggle class: ${error}`);
            return false;
        }
    }

    /**
     * 複数の属性を設定
     */
    static setAttributes(element, attributes) {
        if (!element) {
            return false;
        }

        try {
            Object.entries(attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
            return true;
        } catch (error) {
            console.warn(`Failed to set attributes: ${error}`);
            return false;
        }
    }
}

/**
 * パレット構築関連のユーティリティ
 */
class PaletteBuilder {
    /**
     * カラーパレットを作成
     */
    static createColorPalette(colors, selectedColor, onColorSelect) {
        const palette = DOMHelper.createElementWithClass('div', 'color-palette');

        colors.forEach(color => {
            const colorBtn = DOMHelper.createElementWithClass('button', 'color-btn');
            
            if (selectedColor === color) {
                colorBtn.classList.add('active');
            }
            
            colorBtn.style.backgroundColor = color;
            colorBtn.setAttribute('data-color', color);
            colorBtn.title = color;

            if (onColorSelect) {
                DOMHelper.addEventListenerSafe(colorBtn, 'click', () => onColorSelect(color));
            }

            palette.appendChild(colorBtn);
        });

        return palette;
    }

    /**
     * サイズセレクターを作成
     */
    static createSizeSelector(sizes, selectedSize, onSizeSelect) {
        const selector = DOMHelper.createElementWithClass('div', 'size-selector');

        sizes.forEach(size => {
            const sizeBtn = DOMHelper.createElementWithClass(
                'button',
                'size-btn',
                size.label
            );
            
            if (selectedSize === size.value) {
                sizeBtn.classList.add('active');
            }
            
            sizeBtn.setAttribute('data-size', size.value.toString());
            sizeBtn.title = size.title;

            if (onSizeSelect) {
                DOMHelper.addEventListenerSafe(sizeBtn, 'click', () => onSizeSelect(size.value));
            }

            selector.appendChild(sizeBtn);
        });

        return selector;
    }
}

/**
 * データ検証関連のユーティリティ
 */
class ValidationHelper {
    /**
     * ノードデータの検証
     */
    static isValidNode(node) {
        if (!node || typeof node !== 'object') {
            return false;
        }

        const requiredFields = ['id', 'label', 'x', 'y', 'style'];
        const hasRequiredFields = requiredFields.every(field => field in node);

        if (!hasRequiredFields) {
            return false;
        }

        if (!node.style || typeof node.style !== 'object') {
            return false;
        }

        const requiredStyleFields = ['color', 'radius'];
        const hasRequiredStyleFields = requiredStyleFields.every(
            field => field in node.style
        );

        return hasRequiredStyleFields;
    }

    /**
     * リンクデータの検証
     */
    static isValidLink(link) {
        if (!link || typeof link !== 'object') {
            return false;
        }

        const requiredFields = ['id', 'source', 'target', 'style'];
        const hasRequiredFields = requiredFields.every(field => field in link);

        if (!hasRequiredFields) {
            return false;
        }

        if (!link.style || typeof link.style !== 'object') {
            return false;
        }

        const requiredStyleFields = ['color', 'width'];
        const hasRequiredStyleFields = requiredStyleFields.every(
            field => field in link.style
        );

        return hasRequiredStyleFields;
    }

    /**
     * データ構造の包括的検証
     */
    static validateDataStructure(data) {
        const errors = [];
        let nodeCount = 0;
        let linkCount = 0;

        if (!data || typeof data !== 'object') {
            errors.push('Data must be an object');
            return { valid: false, errors, stats: { nodeCount, linkCount } };
        }

        // ノード検証
        if (!Array.isArray(data.nodes)) {
            errors.push('Data must have a nodes array');
        } else {
            nodeCount = data.nodes.length;
            data.nodes.forEach((node, index) => {
                if (!ValidationHelper.isValidNode(node)) {
                    errors.push(`Invalid node at index ${index}`);
                }
            });
        }

        // リンク検証
        if (!Array.isArray(data.links)) {
            errors.push('Data must have a links array');
        } else {
            linkCount = data.links.length;
            data.links.forEach((link, index) => {
                if (!ValidationHelper.isValidLink(link)) {
                    errors.push(`Invalid link at index ${index}`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            stats: { nodeCount, linkCount }
        };
    }

    /**
     * ファイル名のサニタイズ
     */
    static sanitizeFileName(filename) {
        // ファイル名に使用できない文字を除去
        return filename.replace(/[<>:"/\\|?*]/g, '').trim();
    }

    /**
     * 色の正規化
     */
    static normalizeColor(color) {
        // hex色を小文字に統一
        if (color.startsWith('#')) {
            return color.toLowerCase();
        }
        return color;
    }
}

/**
 * パフォーマンス関連のユーティリティ
 */
class PerformanceHelper {
    /**
     * 関数の実行時間を計測
     */
    static measureFunction(fn, name) {
        return function(...args) {
            const start = performance.now();
            const result = fn.apply(this, args);
            const end = performance.now();

            if (name) {
                console.log(`${name} execution time: ${end - start}ms`);
            }

            return result;
        };
    }

    /**
     * 非同期関数の実行時間を計測
     */
    static measureAsyncFunction(fn, name) {
        return async function(...args) {
            const start = performance.now();
            const result = await fn.apply(this, args);
            const end = performance.now();

            if (name) {
                console.log(`${name} execution time: ${end - start}ms`);
            }

            return result;
        };
    }

    /**
     * デバウンス（連続呼び出しを制限）
     */
    static debounce(func, wait) {
        let timeout = null;

        return function(...args) {
            const later = () => {
                timeout = null;
                func.apply(this, args);
            };

            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * スロットル（実行頻度を制限）
     */
    static throttle(func, limit) {
        let inThrottle = false;

        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    }
}

/**
 * WordMapUtils名前空間
 */
const WordMapUtils = {
    ErrorHandler,
    DOMHelper,
    PaletteBuilder,
    ValidationHelper,
    PerformanceHelper
};

// グローバルに公開
if (typeof window !== 'undefined') {
    window.WordMapUtils = WordMapUtils;
}

// モジュールエクスポート対応
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WordMapUtils;
}