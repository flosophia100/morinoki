/**
 * ワードマップエディター 軽量デバッグモジュール
 * 2025-07-07 作成: 本番環境用軽量デバッグシステム
 * 
 * 機能:
 * - 基本的なエラー処理とログ記録
 * - 核心的な問題検出（D3バインディング、DOM同期）
 * - 基本的なパフォーマンス監視
 * - シンプルなコンソール出力
 */

class WordMapDebugLite {
    constructor(editor) {
        this.editor = editor;
        this.isEnabled = false;
        this.logs = [];
        this.maxLogs = 100; // 軽量版は100件まで
        this.performanceData = {
            renderTimes: [],
            eventCounts: {},
            lastRenderTime: 0
        };
        
        this.initializeDebugSystem();
    }

    /**
     * デバッグシステム初期化
     */
    initializeDebugSystem() {
        console.log('[DEBUG-LITE] 軽量デバッグシステム初期化');
        this.setupErrorHandling();
        this.setupBasicPerformanceMonitoring();
        this.setupIssueDetectors();
    }

    /**
     * エラーハンドリング設定
     */
    setupErrorHandling() {
        window.addEventListener('error', (e) => {
            this.logError('GlobalError', e.error, {
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno
            });
        });

        window.addEventListener('unhandledrejection', (e) => {
            this.logError('UnhandledPromiseRejection', e.reason);
        });
    }

    /**
     * 基本的なパフォーマンス監視設定
     */
    setupBasicPerformanceMonitoring() {
        // レンダリング時間の記録
        const originalRender = this.editor.render?.bind(this.editor);
        if (originalRender) {
            this.editor.render = (...args) => {
                const startTime = performance.now();
                const result = originalRender(...args);
                const renderTime = performance.now() - startTime;
                this.recordRenderTime(renderTime);
                return result;
            };
        }
    }

    /**
     * 基本的な問題検出器設定
     */
    setupIssueDetectors() {
        // 定期的な問題検出（軽量版は30秒間隔）
        setInterval(() => {
            if (this.isEnabled) {
                this.runBasicIssueDetection();
            }
        }, 30000);
    }

    /**
     * 基本的な問題検出実行
     */
    runBasicIssueDetection() {
        try {
            this.checkD3DataBinding();
            this.checkDOMSync();
            this.checkPerformanceDegradation();
            this.checkMemoryLeak();
        } catch (error) {
            this.logError('IssueDetectionError', error);
        }
    }

    /**
     * D3.jsデータバインディング問題検出
     */
    checkD3DataBinding() {
        if (!this.editor.data) return;

        const dataNodes = this.editor.data.nodes?.length || 0;
        const domNodes = document.querySelectorAll('#nodesGroup circle').length;
        const dataLinks = this.editor.data.links?.length || 0;
        const domLinks = document.querySelectorAll('#linksGroup line').length;

        if (dataNodes !== domNodes || dataLinks !== domLinks) {
            this.logError('D3DataBindingMismatch', null, {
                dataNodes,
                domNodes,
                dataLinks,
                domLinks,
                severity: 'high'
            });
        }
    }

    /**
     * DOM同期問題検出
     */
    checkDOMSync() {
        const selectedElements = this.editor.state?.selectedElements || [];
        const domSelectedElements = document.querySelectorAll('.selected').length;

        if (selectedElements.length !== domSelectedElements) {
            this.logError('DOMSyncMismatch', null, {
                stateSelected: selectedElements.length,
                domSelected: domSelectedElements,
                severity: 'medium'
            });
        }
    }

    /**
     * パフォーマンス劣化検出
     */
    checkPerformanceDegradation() {
        const recentRenderTimes = this.performanceData.renderTimes.slice(-10);
        if (recentRenderTimes.length < 10) return;

        const averageTime = recentRenderTimes.reduce((a, b) => a + b, 0) / recentRenderTimes.length;
        
        if (averageTime > 50) { // 50ms以上は警告
            this.logEvent('warn', 'パフォーマンス劣化検出', {
                averageRenderTime: averageTime.toFixed(2),
                threshold: 50
            });
        }
    }

    /**
     * メモリリーク検出
     */
    checkMemoryLeak() {
        if (performance.memory) {
            const memoryInfo = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };

            // メモリ使用量が90%を超えた場合
            if (memoryInfo.used / memoryInfo.limit > 0.9) {
                this.logEvent('warn', 'メモリ使用量高', memoryInfo);
            }
        }
    }

    /**
     * レンダリング時間記録
     */
    recordRenderTime(time) {
        this.performanceData.renderTimes.push(time);
        this.performanceData.lastRenderTime = time;
        
        // 最新20件のみ保持
        if (this.performanceData.renderTimes.length > 20) {
            this.performanceData.renderTimes = this.performanceData.renderTimes.slice(-20);
        }
    }

    /**
     * イベントログ記録
     */
    logEvent(level = 'info', message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data,
            type: 'event'
        };

        this.logs.push(logEntry);
        
        // 最大ログ数を超えた場合は古いものを削除
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // コンソール出力
        if (this.isEnabled) {
            const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
            console[consoleMethod](`[DEBUG-LITE] ${message}`, data);
        }
    }

    /**
     * エラーログ記録
     */
    logError(type, error, context = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: 'error',
            type,
            message: error?.message || String(error),
            stack: error?.stack,
            context,
            severity: context?.severity || 'medium'
        };

        this.logs.push(logEntry);
        
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // 重要なエラーは常にコンソール出力
        if (logEntry.severity === 'high' || this.isEnabled) {
            console.error(`[DEBUG-LITE] ${type}:`, error, context);
        }
    }

    /**
     * デバッグ有効化
     */
    enable() {
        this.isEnabled = true;
        console.log('[DEBUG-LITE] デバッグモード有効化');
        this.logEvent('info', 'デバッグモード有効化');
    }

    /**
     * デバッグ無効化
     */
    disable() {
        this.isEnabled = false;
        console.log('[DEBUG-LITE] デバッグモード無効化');
    }

    /**
     * デバッグトグル
     */
    toggle() {
        if (this.isEnabled) {
            this.disable();
        } else {
            this.enable();
        }
    }

    /**
     * デバッグデータクリア
     */
    clearDebugData() {
        this.logs = [];
        this.performanceData.renderTimes = [];
        this.performanceData.eventCounts = {};
        this.logEvent('info', 'デバッグデータクリア完了');
    }

    /**
     * 基本統計情報取得
     */
    getBasicStats() {
        const recentRenderTimes = this.performanceData.renderTimes.slice(-10);
        const averageRenderTime = recentRenderTimes.length > 0 
            ? recentRenderTimes.reduce((a, b) => a + b, 0) / recentRenderTimes.length 
            : 0;

        return {
            logsCount: this.logs.length,
            errorCount: this.logs.filter(log => log.level === 'error').length,
            warningCount: this.logs.filter(log => log.level === 'warn').length,
            averageRenderTime: averageRenderTime.toFixed(2),
            lastRenderTime: this.performanceData.lastRenderTime.toFixed(2),
            memoryUsage: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
            } : null
        };
    }

    /**
     * コンソールに基本統計を出力
     */
    showStats() {
        const stats = this.getBasicStats();
        console.group('[DEBUG-LITE] 基本統計');
        console.log('ログ数:', stats.logsCount);
        console.log('エラー数:', stats.errorCount);
        console.log('警告数:', stats.warningCount);
        console.log('平均レンダリング時間:', stats.averageRenderTime + 'ms');
        console.log('最新レンダリング時間:', stats.lastRenderTime + 'ms');
        if (stats.memoryUsage) {
            console.log('メモリ使用量:', `${stats.memoryUsage.used}MB / ${stats.memoryUsage.total}MB`);
        }
        console.groupEnd();
    }

    /**
     * デバッグデータエクスポート（基本情報のみ）
     */
    exportDebugData() {
        const data = {
            timestamp: new Date().toISOString(),
            version: 'lite',
            stats: this.getBasicStats(),
            recentLogs: this.logs.slice(-20), // 最新20件のみ
            performanceData: {
                recentRenderTimes: this.performanceData.renderTimes.slice(-10)
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug-lite-${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.logEvent('info', 'デバッグデータエクスポート完了');
    }
}

// 軽量版デバッグクラスをグローバルに公開
window.WordMapDebugLite = WordMapDebugLite;