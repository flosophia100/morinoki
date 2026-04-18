/**
 * TypeScript/JavaScript ハイブリッドモジュールローダー
 * 2025-07-07 作成: TypeScript変換期間中のモジュール互換性保証
 */

(function() {
    'use strict';
    
    // モジュールローダー設定
    const MODULE_CONFIG = {
        useTypeScript: false, // 本番環境ではfalse
        fallbackToJS: true,   // JSファイルへのフォールバック
        basePath: './',
        srcPath: './src/',
        
        // モジュール優先順位 (JavaScript)
        modules: {
            'config': ['config.js'],
            'wordmap-utils': ['wordmap-utils.js'],
            'wordmap-core': ['wordmap-core.js'],
            'wordmap-io': ['wordmap-io.js'],
            'wordmap-ui': ['wordmap-ui.js'],
            'wordmap-debug-lite': ['wordmap-debug-lite.js'],
            'ui/WordMapPalettes': ['ui/WordMapPalettes.js'],
            'ui/WordMapControls': ['ui/WordMapControls.js']
        }
    };
    
    // モジュール読み込み状況
    const loadedModules = new Set();
    const failedModules = new Set();
    
    /**
     * スクリプト動的読み込み
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            // 既に読み込み済みかチェック
            if (loadedModules.has(src)) {
                resolve(src);
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                loadedModules.add(src);
                console.log(`[ModuleLoader] 読み込み成功: ${src}`);
                resolve(src);
            };
            script.onerror = (error) => {
                failedModules.add(src);
                console.warn(`[ModuleLoader] 読み込み失敗: ${src}`, error);
                reject(new Error(`Failed to load: ${src}`));
            };
            document.head.appendChild(script);
        });
    }
    
    /**
     * 利用可能なモジュールパスを検索
     */
    async function findAvailableModule(moduleName) {
        const paths = MODULE_CONFIG.modules[moduleName] || [];
        
        for (const path of paths) {
            try {
                // ファイル存在確認 (HEAD request simulation)
                const response = await fetch(path, { method: 'HEAD' });
                if (response.ok) {
                    return path;
                }
            } catch (error) {
                console.debug(`[ModuleLoader] パス確認失敗: ${path}`);
            }
        }
        
        throw new Error(`No available path found for module: ${moduleName}`);
    }
    
    /**
     * モジュールを読み込み
     */
    async function loadModule(moduleName) {
        try {
            const path = await findAvailableModule(moduleName);
            await loadScript(path);
            return true;
        } catch (error) {
            console.error(`[ModuleLoader] モジュール読み込みエラー: ${moduleName}`, error);
            return false;
        }
    }
    
    /**
     * 必須モジュールを順次読み込み
     */
    async function loadCoreModules() {
        const coreModules = [
            'config',
            'wordmap-utils',
            'wordmap-core',
            'ui/WordMapPalettes',
            'ui/WordMapControls',
            'wordmap-ui',
            'wordmap-io'
        ];
        
        console.log('[ModuleLoader] コアモジュール読み込み開始');
        
        const results = [];
        for (const moduleName of coreModules) {
            const success = await loadModule(moduleName);
            results.push({ module: moduleName, success });
            
            if (!success && !MODULE_CONFIG.fallbackToJS) {
                throw new Error(`Critical module failed to load: ${moduleName}`);
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        console.log(`[ModuleLoader] コアモジュール読み込み完了: ${successCount}/${results.length}`);
        
        return results;
    }
    
    /**
     * デバッグモジュールを動的読み込み
     */
    async function loadDebugModule(mode = 'lite') {
        const moduleName = mode === 'lite' ? 'wordmap-debug-lite' : 'wordmap-debug';
        return await loadModule(moduleName);
    }
    
    /**
     * モジュール読み込み状況の取得
     */
    function getLoadStatus() {
        return {
            loaded: Array.from(loadedModules),
            failed: Array.from(failedModules),
            total: loadedModules.size + failedModules.size
        };
    }
    
    /**
     * 初期化とグローバル公開
     */
    window.ModuleLoader = {
        loadCoreModules,
        loadDebugModule,
        loadModule,
        getLoadStatus,
        config: MODULE_CONFIG
    };
    
    // 自動初期化
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            console.log('[ModuleLoader] モジュール読み込み開始');
            await loadCoreModules();
            
            // モジュール読み込み完了を通知
            const event = new CustomEvent('modulesLoaded', {
                detail: {
                    loaded: loadedModules,
                    failed: failedModules,
                    status: getLoadStatus()
                }
            });
            window.dispatchEvent(event);
            console.log('[ModuleLoader] modulesLoadedイベント発火');
            
        } catch (error) {
            console.error('[ModuleLoader] 自動初期化エラー:', error);
            
            // エラーイベントも発火
            const errorEvent = new CustomEvent('modulesLoadError', {
                detail: { error: error.message }
            });
            window.dispatchEvent(errorEvent);
            
            // エラー表示
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed; top: 10px; right: 10px; 
                background: #f44336; color: white; 
                padding: 10px; border-radius: 4px; 
                z-index: 10000; max-width: 300px;
            `;
            errorDiv.innerHTML = `
                <strong>モジュール読み込みエラー</strong><br>
                ${error.message}<br>
                <small>詳細はコンソールを確認してください</small>
            `;
            document.body.appendChild(errorDiv);
            
            // 5秒後に自動削除
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 5000);
        }
    });
    
    console.log('[ModuleLoader] ハイブリッドモジュールローダー初期化完了');
})();