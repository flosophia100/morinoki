/**
 * ワードマップエディター 開発用デバッグモジュール
 * 2025-07-07 作成: 開発環境用中規模デバッグシステム
 * 
 * 機能:
 * - 軽量版の全機能
 * - シンプルなデバッグパネル
 * - 基本的なテスト機能
 * - パフォーマンス監視UI
 */

class WordMapDebugDev {
    constructor(editor) {
        this.editor = editor;
        this.isEnabled = false;
        this.logs = [];
        this.maxLogs = 500; // 開発版は500件まで
        this.performanceData = {
            renderTimes: [],
            eventCounts: {},
            lastRenderTime: 0,
            memoryUsage: []
        };
        this.panelVisible = false;
        
        this.initializeDebugSystem();
    }

    /**
     * デバッグシステム初期化
     */
    initializeDebugSystem() {
        console.log('[DEBUG-DEV] 開発用デバッグシステム初期化');
        this.setupErrorHandling();
        this.setupPerformanceMonitoring();
        this.setupIssueDetectors();
        this.createSimpleDebugPanel();
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
     * パフォーマンス監視設定
     */
    setupPerformanceMonitoring() {
        // レンダリング時間の記録
        const originalRender = this.editor.render?.bind(this.editor);
        if (originalRender) {
            this.editor.render = (...args) => {
                const startTime = performance.now();
                const result = originalRender(...args);
                const renderTime = performance.now() - startTime;
                this.recordRenderTime(renderTime);
                this.updatePerformanceDisplay();
                return result;
            };
        }

        // メモリ使用量の定期記録
        setInterval(() => {
            if (performance.memory) {
                this.performanceData.memoryUsage.push({
                    timestamp: Date.now(),
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize
                });
                
                // 最新50件のみ保持
                if (this.performanceData.memoryUsage.length > 50) {
                    this.performanceData.memoryUsage = this.performanceData.memoryUsage.slice(-50);
                }
            }
        }, 5000);
    }

    /**
     * 問題検出器設定
     */
    setupIssueDetectors() {
        // 定期的な問題検出（開発版は10秒間隔）
        setInterval(() => {
            if (this.isEnabled) {
                this.runIssueDetection();
            }
        }, 10000);
    }

    /**
     * 問題検出実行
     */
    runIssueDetection() {
        try {
            this.checkD3DataBinding();
            this.checkDOMSync();
            this.checkPerformanceDegradation();
            this.checkMemoryLeak();
            this.checkLinkEditingReflection();
            this.updateIssuesDisplay();
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
            return false;
        }
        return true;
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
            return false;
        }
        return true;
    }

    /**
     * リンク編集反映問題検出
     */
    checkLinkEditingReflection() {
        const links = this.editor.data?.links || [];
        let issues = [];

        links.forEach(link => {
            const linkElement = document.querySelector(`[data-link-id="${link.id}"]`);
            if (linkElement) {
                const domStyle = linkElement.style;
                const dataStyle = link.style;
                
                if (domStyle.strokeWidth !== String(dataStyle.width)) {
                    issues.push({
                        linkId: link.id,
                        issue: 'width mismatch',
                        expected: dataStyle.width,
                        actual: domStyle.strokeWidth
                    });
                }
            }
        });

        if (issues.length > 0) {
            this.logError('LinkEditingReflectionMismatch', null, {
                issues,
                severity: 'medium'
            });
            return false;
        }
        return true;
    }

    /**
     * パフォーマンス劣化検出
     */
    checkPerformanceDegradation() {
        const recentRenderTimes = this.performanceData.renderTimes.slice(-10);
        if (recentRenderTimes.length < 10) return true;

        const averageTime = recentRenderTimes.reduce((a, b) => a + b, 0) / recentRenderTimes.length;
        
        if (averageTime > 50) {
            this.logEvent('warn', 'パフォーマンス劣化検出', {
                averageRenderTime: averageTime.toFixed(2),
                threshold: 50
            });
            return false;
        }
        return true;
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

            if (memoryInfo.used / memoryInfo.limit > 0.9) {
                this.logEvent('warn', 'メモリ使用量高', memoryInfo);
                return false;
            }
        }
        return true;
    }

    /**
     * シンプルなデバッグパネル作成
     */
    createSimpleDebugPanel() {
        const panelHTML = `
            <div class="debug-panel-dev" id="debugPanelDev" style="display: none;">
                <div class="debug-header">
                    <h4>デバッグパネル (開発版)</h4>
                    <button id="debugPanelDevClose" style="background: none; border: none; color: white; cursor: pointer;">&times;</button>
                </div>
                <div class="debug-tabs">
                    <button class="debug-tab-dev active" data-tab="stats">統計</button>
                    <button class="debug-tab-dev" data-tab="issues">問題</button>
                    <button class="debug-tab-dev" data-tab="performance">性能</button>
                    <button class="debug-tab-dev" data-tab="logs">ログ</button>
                </div>
                <div class="debug-content">
                    <div id="debugStatsTab" class="debug-tab-content-dev">
                        <div id="debugStatsContent">統計情報を読み込み中...</div>
                    </div>
                    <div id="debugIssuesTab" class="debug-tab-content-dev" style="display: none;">
                        <div id="debugIssuesContent">問題検出結果を読み込み中...</div>
                    </div>
                    <div id="debugPerformanceTab" class="debug-tab-content-dev" style="display: none;">
                        <div id="debugPerformanceContent">パフォーマンス情報を読み込み中...</div>
                    </div>
                    <div id="debugLogsTab" class="debug-tab-content-dev" style="display: none;">
                        <div id="debugLogsContent">ログを読み込み中...</div>
                    </div>
                </div>
                <div class="debug-controls">
                    <button id="debugRefreshDev" class="debug-btn">更新</button>
                    <button id="debugClearDev" class="debug-btn">クリア</button>
                    <button id="debugExportDev" class="debug-btn">エクスポート</button>
                    <button id="debugTestBasicDev" class="debug-btn">基本テスト</button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', panelHTML);
        this.setupPanelEvents();
        this.updateDebugDisplay();
    }

    /**
     * パネルイベント設定
     */
    setupPanelEvents() {
        // タブ切り替え
        document.querySelectorAll('.debug-tab-dev').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.getAttribute('data-tab'));
            });
        });

        // パネル閉じる
        document.getElementById('debugPanelDevClose')?.addEventListener('click', () => {
            this.toggle();
        });

        // コントロールボタン
        document.getElementById('debugRefreshDev')?.addEventListener('click', () => {
            this.updateDebugDisplay();
        });

        document.getElementById('debugClearDev')?.addEventListener('click', () => {
            this.clearDebugData();
        });

        document.getElementById('debugExportDev')?.addEventListener('click', () => {
            this.exportDebugData();
        });

        document.getElementById('debugTestBasicDev')?.addEventListener('click', () => {
            this.runBasicTests();
        });
    }

    /**
     * タブ切り替え
     */
    switchTab(tabName) {
        // タブボタンの状態更新
        document.querySelectorAll('.debug-tab-dev').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

        // コンテンツの表示切り替え
        document.querySelectorAll('.debug-tab-content-dev').forEach(content => {
            content.style.display = 'none';
        });
        
        const targetTab = document.getElementById(`debug${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
        if (targetTab) {
            targetTab.style.display = 'block';
            this.updateTabContent(tabName);
        }
    }

    /**
     * タブコンテンツ更新
     */
    updateTabContent(tabName) {
        switch (tabName) {
            case 'stats':
                this.updateStatsDisplay();
                break;
            case 'issues':
                this.updateIssuesDisplay();
                break;
            case 'performance':
                this.updatePerformanceDisplay();
                break;
            case 'logs':
                this.updateLogsDisplay();
                break;
        }
    }

    /**
     * 統計表示更新
     */
    updateStatsDisplay() {
        const stats = this.getStats();
        const content = document.getElementById('debugStatsContent');
        if (content) {
            content.innerHTML = `
                <div><strong>ログ数:</strong> ${stats.logsCount}</div>
                <div><strong>エラー数:</strong> ${stats.errorCount}</div>
                <div><strong>警告数:</strong> ${stats.warningCount}</div>
                <div><strong>平均レンダリング時間:</strong> ${stats.averageRenderTime}ms</div>
                <div><strong>最新レンダリング時間:</strong> ${stats.lastRenderTime}ms</div>
                ${stats.memoryUsage ? `<div><strong>メモリ使用量:</strong> ${stats.memoryUsage.used}MB / ${stats.memoryUsage.total}MB</div>` : ''}
                <div><strong>ノード数:</strong> ${this.editor.data?.nodes?.length || 0}</div>
                <div><strong>リンク数:</strong> ${this.editor.data?.links?.length || 0}</div>
            `;
        }
    }

    /**
     * 問題表示更新
     */
    updateIssuesDisplay() {
        const issues = this.logs.filter(log => log.level === 'error').slice(-10);
        const content = document.getElementById('debugIssuesContent');
        if (content) {
            if (issues.length === 0) {
                content.innerHTML = '<div style="color: green;">✓ 問題は検出されていません</div>';
            } else {
                content.innerHTML = issues.map(issue => `
                    <div class="debug-issue" style="margin-bottom: 10px; padding: 5px; background: #ffe6e6; border-left: 3px solid #ff4444;">
                        <strong>${issue.type || 'Error'}:</strong> ${issue.message}<br>
                        <small>${new Date(issue.timestamp).toLocaleTimeString()}</small>
                    </div>
                `).join('');
            }
        }
    }

    /**
     * パフォーマンス表示更新
     */
    updatePerformanceDisplay() {
        const recentTimes = this.performanceData.renderTimes.slice(-10);
        const content = document.getElementById('debugPerformanceContent');
        if (content) {
            content.innerHTML = `
                <div><strong>レンダリング時間 (最新10回):</strong></div>
                <div style="font-family: monospace; font-size: 12px; background: #f5f5f5; padding: 5px; margin: 5px 0;">
                    ${recentTimes.map(time => time.toFixed(1) + 'ms').join(', ') || 'データなし'}
                </div>
                <div><strong>平均時間:</strong> ${recentTimes.length > 0 ? (recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length).toFixed(2) : 0}ms</div>
                ${performance.memory ? `
                    <div><strong>メモリ使用状況:</strong></div>
                    <div>使用中: ${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB</div>
                    <div>合計: ${Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)}MB</div>
                    <div>制限: ${Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)}MB</div>
                ` : ''}
            `;
        }
    }

    /**
     * ログ表示更新
     */
    updateLogsDisplay() {
        const recentLogs = this.logs.slice(-20);
        const content = document.getElementById('debugLogsContent');
        if (content) {
            content.innerHTML = recentLogs.map(log => `
                <div class="debug-log" style="margin-bottom: 5px; padding: 3px; font-size: 12px; font-family: monospace; background: ${log.level === 'error' ? '#ffe6e6' : log.level === 'warn' ? '#fff3cd' : '#f8f9fa'};">
                    <span style="color: ${log.level === 'error' ? '#d63384' : log.level === 'warn' ? '#f57c00' : '#666'};">[${log.level.toUpperCase()}]</span>
                    <span style="color: #666;">${new Date(log.timestamp).toLocaleTimeString()}</span>
                    ${log.message}
                </div>
            `).join('') || '<div>ログがありません</div>';
        }
    }

    /**
     * 基本テスト実行
     */
    runBasicTests() {
        this.logEvent('info', '基本テスト開始');
        
        const tests = [
            { name: 'D3データバインディング', fn: () => this.checkD3DataBinding() },
            { name: 'DOM同期', fn: () => this.checkDOMSync() },
            { name: 'リンク編集反映', fn: () => this.checkLinkEditingReflection() },
            { name: 'パフォーマンス', fn: () => this.checkPerformanceDegradation() },
            { name: 'メモリ使用量', fn: () => this.checkMemoryLeak() }
        ];

        let passed = 0;
        tests.forEach(test => {
            try {
                const result = test.fn();
                if (result) {
                    this.logEvent('info', `✓ ${test.name}: 正常`);
                    passed++;
                } else {
                    this.logEvent('warn', `⚠ ${test.name}: 問題あり`);
                }
            } catch (error) {
                this.logError('TestError', error, { testName: test.name });
            }
        });

        this.logEvent('info', `基本テスト完了: ${passed}/${tests.length} 合格`);
        this.updateDebugDisplay();
    }

    // 以下、軽量版から継承された基本機能
    recordRenderTime(time) {
        this.performanceData.renderTimes.push(time);
        this.performanceData.lastRenderTime = time;
        
        if (this.performanceData.renderTimes.length > 50) {
            this.performanceData.renderTimes = this.performanceData.renderTimes.slice(-50);
        }
    }

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
        
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        if (this.isEnabled) {
            const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
            console[consoleMethod](`[DEBUG-DEV] ${message}`, data);
        }
    }

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

        if (logEntry.severity === 'high' || this.isEnabled) {
            console.error(`[DEBUG-DEV] ${type}:`, error, context);
        }
    }

    enable() {
        this.isEnabled = true;
        this.panelVisible = true;
        const panel = document.getElementById('debugPanelDev');
        if (panel) {
            panel.style.display = 'block';
        }
        console.log('[DEBUG-DEV] デバッグモード有効化');
        this.logEvent('info', 'デバッグモード有効化');
        this.updateDebugDisplay();
    }

    disable() {
        this.isEnabled = false;
        this.panelVisible = false;
        const panel = document.getElementById('debugPanelDev');
        if (panel) {
            panel.style.display = 'none';
        }
        console.log('[DEBUG-DEV] デバッグモード無効化');
    }

    toggle() {
        if (this.isEnabled) {
            this.disable();
        } else {
            this.enable();
        }
    }

    clearDebugData() {
        this.logs = [];
        this.performanceData.renderTimes = [];
        this.performanceData.eventCounts = {};
        this.logEvent('info', 'デバッグデータクリア完了');
        this.updateDebugDisplay();
    }

    updateDebugDisplay() {
        if (this.panelVisible) {
            this.updateStatsDisplay();
            this.updateIssuesDisplay();
            this.updatePerformanceDisplay();
            this.updateLogsDisplay();
        }
    }

    getStats() {
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

    exportDebugData() {
        const data = {
            timestamp: new Date().toISOString(),
            version: 'dev',
            stats: this.getStats(),
            logs: this.logs.slice(-50),
            performanceData: {
                renderTimes: this.performanceData.renderTimes,
                memoryUsage: this.performanceData.memoryUsage.slice(-20)
            },
            editorState: {
                nodeCount: this.editor.data?.nodes?.length || 0,
                linkCount: this.editor.data?.links?.length || 0,
                selectedElements: this.editor.state?.selectedElements?.length || 0
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug-dev-${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.logEvent('info', 'デバッグデータエクスポート完了');
    }
}

// 開発版デバッグクラスをグローバルに公開
window.WordMapDebugDev = WordMapDebugDev;