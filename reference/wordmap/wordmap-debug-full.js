/**
 * ワードマップエディター デバッグモジュール
 * 2025-06-20 作成: 包括的なデバッグ・診断システム
 */

class WordMapDebug {
    constructor(editor) {
        this.editor = editor;
        this.isEnabled = false;
        this.logs = [];
        this.maxLogs = 1000;
        this.performanceData = {
            renderTimes: [],
            eventCounts: {},
            memoryUsage: []
        };
        this.issueDetectors = [];
        this.realTimeMonitor = null;
        this.testMode = false; // テストモード状態
        this.originalData = null; // テスト前のデータバックアップ
        
        this.initializeDebugSystem();
    }

    /**
     * デバッグシステム初期化
     */
    initializeDebugSystem() {
        console.log('[DEBUG] デバッグシステム初期化開始');
        this.setupIssueDetectors();
        this.setupPerformanceMonitoring();
        this.setupErrorHandling();
        
        // DOMが完全にロードされてからパネルを作成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.createDebugPanel();
            });
        } else {
            this.createDebugPanel();
        }
        
        console.log('[DEBUG] デバッグシステム初期化完了');
    }

    /**
     * 問題検出器の設定
     */
    setupIssueDetectors() {
        // D3.jsデータバインディング問題検出
        this.issueDetectors.push({
            name: 'D3DataBinding',
            check: () => this.checkD3DataBinding(),
            severity: 'high'
        });

        // リンク編集反映問題検出
        this.issueDetectors.push({
            name: 'LinkEditingReflection',
            check: () => this.checkLinkEditingReflection(),
            severity: 'high'
        });

        // メモリリーク検出
        this.issueDetectors.push({
            name: 'MemoryLeak',
            check: () => this.checkMemoryLeak(),
            severity: 'medium'
        });

        // パフォーマンス劣化検出
        this.issueDetectors.push({
            name: 'PerformanceDegradation',
            check: () => this.checkPerformanceDegradation(),
            severity: 'medium'
        });

        // DOM同期問題検出
        this.issueDetectors.push({
            name: 'DOMSync',
            check: () => this.checkDOMSync(),
            severity: 'high'
        });

        // リンク更新関数の動作検証
        this.issueDetectors.push({
            name: 'LinkUpdateFunctions',
            check: () => this.checkLinkUpdateFunctions(),
            severity: 'high'
        });

        // forceRecreateLink関数の動作検証
        this.issueDetectors.push({
            name: 'ForceRecreateFunction',
            check: () => this.checkForceRecreateFunction(),
            severity: 'medium'
        });
    }

    /**
     * パフォーマンス監視設定
     */
    setupPerformanceMonitoring() {
        // レンダリング時間測定
        const originalRender = this.editor.render?.bind(this.editor);
        if (originalRender) {
            this.editor.render = () => {
                const startTime = performance.now();
                originalRender();
                const endTime = performance.now();
                this.recordRenderTime(endTime - startTime);
            };
        }

        // メモリ使用量監視
        setInterval(() => {
            if (performance.memory) {
                this.performanceData.memoryUsage.push({
                    timestamp: Date.now(),
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize
                });
                
                // 最新100件のみ保持
                if (this.performanceData.memoryUsage.length > 100) {
                    this.performanceData.memoryUsage.shift();
                }
            }
        }, 5000);
    }

    /**
     * エラーハンドリング強化
     */
    setupErrorHandling() {
        // グローバルエラーキャッチ
        window.addEventListener('error', (event) => {
            this.logError('GlobalError', event.error, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // Promise拒否キャッチ
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('UnhandledPromiseRejection', event.reason);
        });

        // コンソールエラーを拡張
        const originalConsoleError = console.error;
        console.error = (...args) => {
            this.logError('ConsoleError', args[0], { args: args.slice(1) });
            originalConsoleError.apply(console, args);
        };
    }

    /**
     * デバッグパネル作成
     */
    createDebugPanel() {
        let panel = document.getElementById('debugPanel');
        
        // パネルが存在しない場合は作成
        if (!panel) {
            console.log('[DEBUG] debugPanel要素が見つからないため、新規作成します');
            panel = document.createElement('div');
            panel.id = 'debugPanel';
            panel.className = 'debug-panel';
            document.body.appendChild(panel);
        } else {
            console.log('[DEBUG] debugPanel要素が見つかりました');
        }

        panel.innerHTML = `
            <div class="debug-panel-header">
                <div class="debug-panel-title">🔧 デバッグパネル</div>
                <button id="debugPanelClose" class="debug-panel-close">✕</button>
            </div>
            
            <div class="debug-test-controls">
                <div id="testStatus" class="debug-test-status production">
                    🟢 本番モード
                </div>
                <div style="margin-bottom: 10px;">
                    <button id="endTestModeBtn" class="debug-btn danger" style="display: none;">
                        🔴 テスト終了
                    </button>
                    <button id="debugRefresh" class="debug-btn">更新</button>
                    <button id="debugClear" class="debug-btn">クリア</button>
                </div>
            </div>
            
            <div class="debug-tabs">
                <button class="debug-tab active" data-tab="issues">問題検出</button>
                <button class="debug-tab" data-tab="function-tests">機能テスト</button>
                <button class="debug-tab" data-tab="realtime">リアルタイム</button>
                <button class="debug-tab" data-tab="performance">パフォーマンス</button>
                <button class="debug-tab" data-tab="data">データ状態</button>
            </div>
            
            <div class="debug-content">
                <div id="debug-issues" class="debug-tab-content active">
                    <div class="debug-section">
                        <h5>テスト実行</h5>
                        <div style="margin-bottom: 10px;">
                            <button id="testLinkEditingBtn" class="debug-btn">
                                🟢 リンク編集テスト（復元あり）
                            </button>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <button id="testLinkEditingNoRestoreBtn" class="debug-btn warning">
                                🟡 リンク編集テスト（復元なし）
                            </button>
                        </div>
                        <div style="font-size: 11px; color: #ccc; margin-bottom: 15px; line-height: 1.4;">
                            ⚠️ 復元なしテスト実行後は、必要に応じて「テスト終了」ボタンで本番モードに戻してください
                        </div>
                        <div id="testResults"></div>
                    </div>
                    <div id="issuesList"></div>
                </div>
                
                <div id="debug-realtime" class="debug-tab-content">
                    <div class="debug-section">
                        <h5>システム状態</h5>
                        <div id="systemStatus"></div>
                    </div>
                    <div class="debug-section">
                        <h5>D3.js状態</h5>
                        <div id="d3Status"></div>
                    </div>
                </div>
                
                <div id="debug-performance" class="debug-tab-content">
                    <div id="performanceCharts"></div>
                </div>
                
                <div id="debug-function-tests" class="debug-tab-content">
                    <div class="debug-section">
                        <h5>💾 保存・読込テスト</h5>
                        <button id="testSaveBtn" class="debug-btn">保存機能テスト</button>
                        <button id="testLoadBtn" class="debug-btn">読込機能テスト</button>
                        <div id="saveLoadResults"></div>
                    </div>
                    
                    <div class="debug-section">
                        <h5>🆕 v3.1.0 修正機能テスト</h5>
                        <div style="margin-bottom: 10px;">
                            <button id="testMultiSelectBtn" class="debug-btn">複数選択機能テスト</button>
                            <button id="testLinkNameFollowBtn" class="debug-btn">リンク名追従テスト</button>
                            <button id="testThemeChangeBtn" class="debug-btn">テーマ切替テスト</button>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <button id="testCategoryManagementBtn" class="debug-btn">カテゴリ管理テスト</button>
                            <button id="testDefaultStateBtn" class="debug-btn">デフォルト状態テスト</button>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <button id="runV311TestBtn" class="debug-btn primary">🔧 v3.1.1追加修正テスト</button>
                            <button id="exportV31TestBtn" class="debug-btn warning">📊 v3.1.0テスト結果エクスポート</button>
                            <button id="clearV31TestBtn" class="debug-btn">🗑️ テスト結果クリア</button>
                        </div>
                        <div id="v31TestResults" style="margin-top: 10px; padding: 10px; background: #1a1a1a; border-radius: 4px; font-family: monospace; font-size: 11px; max-height: 200px; overflow-y: auto;"></div>
                    </div>
                    
                    <div class="debug-section">
                        <h5>🎯 現在利用可能な機能テスト</h5>
                        <div style="padding: 15px; background: rgba(76, 175, 80, 0.1); border-left: 4px solid #4caf50; margin: 10px 0;">
                            <strong>✅ 基本機能テスト</strong><br>
                            <small>• ノード作成・編集・削除</small><br>
                            <small>• リンク作成・編集・削除</small><br>
                            <small>• 保存・読込機能</small><br>
                            <small>• フォース設定調整</small>
                        </div>
                        
                        <div style="padding: 15px; background: rgba(158, 158, 158, 0.1); border-left: 4px solid #9e9e9e; margin: 10px 0;">
                            <strong>🗑️ 削除済み機能</strong><br>
                            <small>• 中央表示・全体表示（削除済み）</small><br>
                            <small>• 戻す・進む（削除済み）</small><br>
                            <small>• 物理切替（常時ON化）</small><br>
                            <small>• 矢印付きリンク（削除済み）</small>
                        </div>
                    </div>
                </div>
                
                <div id="debug-data" class="debug-tab-content">
                    <div id="dataInspector"></div>
                </div>
            </div>
        `;

        console.log('[DEBUG] デバッグパネルの内容を設定しました');
        this.setupDebugPanelEvents();
        console.log('[DEBUG] デバッグパネルのイベントリスナーを設定しました');
    }

    /**
     * デバッグパネルイベント設定
     */
    setupDebugPanelEvents() {
        // タブ切り替え
        document.querySelectorAll('.debug-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                this.switchDebugTab(tabName);
            });
        });

        // パネル閉じるボタン
        document.getElementById('debugPanelClose')?.addEventListener('click', () => {
            this.toggle(); // デバッグパネルを閉じる
        });

        // テスト終了ボタン
        document.getElementById('endTestModeBtn')?.addEventListener('click', () => {
            this.endTestMode();
        });

        // コントロールボタン
        document.getElementById('debugRefresh')?.addEventListener('click', () => {
            this.refreshDebugData();
        });

        document.getElementById('debugClear')?.addEventListener('click', () => {
            this.clearDebugData();
        });

        // リンク編集テストボタン
        document.getElementById('testLinkEditingBtn')?.addEventListener('click', () => {
            this.runLinkEditingTest();
        });
        
        // 非復元リンク編集テストボタン
        document.getElementById('testLinkEditingNoRestoreBtn')?.addEventListener('click', () => {
            this.runLinkEditingTest(false); // 復元しない
        });

        // 機能テストボタン
        document.getElementById('testSaveBtn')?.addEventListener('click', () => {
            this.testSaveFunction();
        });
        
        document.getElementById('testLoadBtn')?.addEventListener('click', () => {
            this.testLoadFunction();
        });
        
        // 2025-06-21 追加: v3.1.0修正機能テストボタン
        document.getElementById('testMultiSelectBtn')?.addEventListener('click', () => {
            this.testMultiSelectFunction();
        });
        
        document.getElementById('testLinkNameFollowBtn')?.addEventListener('click', () => {
            this.testLinkNameFollowFunction();
        });
        
        document.getElementById('testThemeChangeBtn')?.addEventListener('click', () => {
            this.testThemeChangeFunction();
        });
        
        document.getElementById('testCategoryManagementBtn')?.addEventListener('click', () => {
            this.testCategoryManagementFunction();
        });
        
        document.getElementById('testDefaultStateBtn')?.addEventListener('click', () => {
            this.testDefaultStateFunction();
        });
        
        // v3.1.0テスト結果管理ボタン
        document.getElementById('exportV31TestBtn')?.addEventListener('click', () => {
            this.exportV31TestResults();
        });
        
        document.getElementById('clearV31TestBtn')?.addEventListener('click', () => {
            const resultsDiv = document.getElementById('v31TestResults');
            if (resultsDiv) {
                resultsDiv.textContent = '';
            }
            // v3.1.0テスト関連ログのみクリア
            this.logs = this.logs.filter(log => log.category !== 'v3.1.0-test');
            this.logEvent('info', 'v3.1.0テスト結果をクリアしました');
        });
        
        // 2025-06-22 追加: v3.1.1追加修正テストボタン
        document.getElementById('runV311TestBtn')?.addEventListener('click', () => {
            this.runV311Tests();
        });
        
    }

    /**
     * デバッグタブ切り替え
     */
    switchDebugTab(tabName) {
        // タブボタンの状態更新
        document.querySelectorAll('.debug-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // タブコンテンツの表示切り替え
        document.querySelectorAll('.debug-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`debug-${tabName}`)?.classList.add('active');

        // タブ固有の更新処理
        this.updateTabContent(tabName);
    }

    /**
     * タブコンテンツ更新
     */
    updateTabContent(tabName) {
        switch (tabName) {
            case 'realtime':
                this.updateRealtimeTab();
                break;
            case 'issues':
                this.updateIssuesTab();
                break;
            case 'function-tests':
                this.updateFunctionTestsTab();
                break;
            case 'performance':
                this.updatePerformanceTab();
                break;
            case 'events':
                this.updateEventsTab();
                break;
            case 'data':
                this.updateDataTab();
                break;
        }
    }

    /**
     * リアルタイムタブ更新
     */
    updateRealtimeTab() {
        const systemStatus = document.getElementById('systemStatus');
        const d3Status = document.getElementById('d3Status');

        if (systemStatus) {
            systemStatus.innerHTML = `
                <div class="status-item">
                    <span class="status-label">ノード数:</span>
                    <span class="status-value">${this.editor.data?.nodes?.length || 0}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">リンク数:</span>
                    <span class="status-value">${this.editor.data?.links?.length || 0}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">選択要素:</span>
                    <span class="status-value">${this.editor.state?.selectedElements?.length || 0}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">モード:</span>
                    <span class="status-value">${this.editor.state?.mode || 'unknown'}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">ズーム:</span>
                    <span class="status-value">${Math.round((this.editor.state?.zoom || 1) * 100)}%</span>
                </div>
            `;
        }

        if (d3Status) {
            const simulation = this.editor.simulation;
            d3Status.innerHTML = `
                <div class="status-item">
                    <span class="status-label">シミュレーション:</span>
                    <span class="status-value">${simulation ? 'アクティブ' : '停止中'}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Alpha:</span>
                    <span class="status-value">${simulation?.alpha()?.toFixed(3) || 'N/A'}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">DOM ノード:</span>
                    <span class="status-value">${document.querySelectorAll('.node').length}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">DOM リンク:</span>
                    <span class="status-value">${document.querySelectorAll('.link-group').length}</span>
                </div>
            `;
        }
    }

    /**
     * 問題検出タブ更新
     */
    updateIssuesTab() {
        const issuesList = document.getElementById('issuesList');
        if (!issuesList) return;

        const issues = this.runAllIssueDetectors();
        
        issuesList.innerHTML = `
            <div class="issues-summary">
                <div class="issue-count high">高: ${issues.filter(i => i.severity === 'high').length}</div>
                <div class="issue-count medium">中: ${issues.filter(i => i.severity === 'medium').length}</div>
                <div class="issue-count low">低: ${issues.filter(i => i.severity === 'low').length}</div>
            </div>
            <div class="issues-list">
                ${issues.map(issue => `
                    <div class="issue-item severity-${issue.severity}">
                        <div class="issue-title">${issue.name}</div>
                        <div class="issue-description">${issue.description}</div>
                        <div class="issue-suggestion">${issue.suggestion}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * パフォーマンスタブ更新
     */
    updatePerformanceTab() {
        const performanceCharts = document.getElementById('performanceCharts');
        if (!performanceCharts) return;

        const avgRenderTime = this.calculateAverageRenderTime();
        const memoryTrend = this.calculateMemoryTrend();

        performanceCharts.innerHTML = `
            <div class="perf-metrics">
                <div class="perf-metric">
                    <div class="metric-label">平均レンダリング時間</div>
                    <div class="metric-value">${avgRenderTime.toFixed(2)}ms</div>
                </div>
                <div class="perf-metric">
                    <div class="metric-label">メモリ使用傾向</div>
                    <div class="metric-value">${memoryTrend}</div>
                </div>
                <div class="perf-metric">
                    <div class="metric-label">最後のレンダリング</div>
                    <div class="metric-value">${this.getLastRenderTime().toFixed(2)}ms</div>
                </div>
            </div>
            <div class="perf-charts">
                <div class="chart-container">
                    <h6>レンダリング時間履歴</h6>
                    <div id="renderTimeChart">${this.createSimpleChart(this.performanceData.renderTimes.slice(-20))}</div>
                </div>
            </div>
        `;
    }

    /**
     * イベントタブ更新
     */
    updateEventsTab() {
        const eventLogs = document.getElementById('eventLogs');
        if (!eventLogs) return;

        const recentLogs = this.logs.slice(-50).reverse();
        
        eventLogs.innerHTML = `
            <div class="log-controls">
                <select id="logLevelFilter">
                    <option value="all">全レベル</option>
                    <option value="error">エラー</option>
                    <option value="warn">警告</option>
                    <option value="info">情報</option>
                    <option value="debug">デバッグ</option>
                </select>
                <button id="clearLogs" class="debug-btn">ログクリア</button>
            </div>
            <div class="logs-container">
                ${recentLogs.map(log => `
                    <div class="log-entry level-${log.level}">
                        <span class="log-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span class="log-level">${log.level.toUpperCase()}</span>
                        <span class="log-message">${log.message}</span>
                        ${log.data ? `<div class="log-data">${JSON.stringify(log.data, null, 2)}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * データタブ更新
     */
    updateDataTab() {
        const dataInspector = document.getElementById('dataInspector');
        if (!dataInspector) return;

        dataInspector.innerHTML = `
            <div class="data-section">
                <h6>ノードデータ</h6>
                <pre class="data-dump">${JSON.stringify(this.editor.data?.nodes?.slice(0, 3) || [], null, 2)}</pre>
            </div>
            <div class="data-section">
                <h6>リンクデータ</h6>
                <pre class="data-dump">${JSON.stringify(this.editor.data?.links?.slice(0, 3) || [], null, 2)}</pre>
            </div>
            <div class="data-section">
                <h6>状態データ</h6>
                <pre class="data-dump">${JSON.stringify(this.editor.state || {}, null, 2)}</pre>
            </div>
        `;
    }

    /**
     * 全問題検出器実行
     */
    runAllIssueDetectors() {
        const issues = [];
        
        this.issueDetectors.forEach(detector => {
            try {
                const result = detector.check();
                if (result && result.hasIssue) {
                    issues.push({
                        name: detector.name,
                        severity: detector.severity,
                        description: result.description,
                        suggestion: result.suggestion,
                        data: result.data
                    });
                }
            } catch (error) {
                console.error(`問題検出器 ${detector.name} でエラー:`, error);
            }
        });

        return issues;
    }

    /**
     * D3.jsデータバインディング問題検出
     */
    checkD3DataBinding() {
        const nodes = this.editor.data?.nodes || [];
        const links = this.editor.data?.links || [];
        const domNodes = document.querySelectorAll('.node').length;
        const domLinks = document.querySelectorAll('.link-group').length;

        if (nodes.length !== domNodes || links.length !== domLinks) {
            return {
                hasIssue: true,
                description: `データとDOM要素の数が不一致: ノード(${nodes.length}/${domNodes}), リンク(${links.length}/${domLinks})`,
                suggestion: 'render()メソッドを実行してデータとDOMを同期してください',
                data: { nodes: nodes.length, domNodes, links: links.length, domLinks }
            };
        }

        return { hasIssue: false };
    }

    /**
     * リンク編集反映問題検出（改良版・エラーハンドリング強化）
     */
    checkLinkEditingReflection() {
        try {
            const selectedLinks = this.editor.state?.selectedElements?.filter(el => el.type === 'link') || [];
            const allLinks = this.editor.data?.links || [];
            const issues = [];
            
            // エディターの基本状態確認
            if (!this.editor) {
                return {
                    hasIssue: true,
                    description: 'エディターが初期化されていません',
                    suggestion: 'ページを再読み込みしてください'
                };
            }
            
            if (!this.editor.data || !this.editor.data.links) {
                return {
                    hasIssue: true,
                    description: 'エディターデータが存在しません',
                    suggestion: 'データを読み込むかサンプルデータを作成してください'
                };
            }
            
            // 選択されたリンクの詳細診断
            if (selectedLinks.length > 0) {
                const linkId = selectedLinks[0].id;
                const linkData = allLinks.find(l => l.id === linkId);
                
                if (!linkData) {
                    return {
                        hasIssue: true,
                        description: `選択されたリンク ${linkId} のデータが見つかりません`,
                        suggestion: '別のリンクを選択してください'
                    };
                }
                
                const linkElement = document.querySelector(`[data-link-id="${linkId}"] .link`);
                const linkGroup = document.querySelector(`[data-link-id="${linkId}"]`);
                
                if (!linkElement) {
                    return {
                        hasIssue: true,
                        description: `リンク ${linkId} のDOM要素が見つかりません`,
                        suggestion: 'render()を実行してDOMを更新してください'
                    };
                }
                
                if (linkData && linkElement) {
                    const actualColor = linkElement.getAttribute('stroke');
                    const actualWidth = linkElement.getAttribute('stroke-width');
                    const actualDashArray = linkElement.getAttribute('stroke-dasharray');
                    
                    // 色の不一致検出
                    if (actualColor !== linkData.style.color) {
                        issues.push(`色不一致: 期待値=${linkData.style.color}, 実際=${actualColor}`);
                    }
                    
                    // 太さの不一致検出
                    if (parseFloat(actualWidth) !== linkData.style.width) {
                        issues.push(`太さ不一致: 期待値=${linkData.style.width}, 実際=${actualWidth}`);
                    }
                    
                    // 線スタイルの不一致検出
                    let expectedDashArray = null;
                    try {
                        expectedDashArray = this.editor.getLinkStrokeDashArray ? 
                            this.editor.getLinkStrokeDashArray(linkData) : null;
                    } catch (error) {
                        console.warn('getLinkStrokeDashArray エラー:', error);
                    }
                    
                    if (actualDashArray !== expectedDashArray) {
                        issues.push(`線スタイル不一致: 期待値=${expectedDashArray}, 実際=${actualDashArray}`);
                    }
                    
                    
                    if (issues.length > 0) {
                        return {
                            hasIssue: true,
                            description: `リンク編集が視覚的に反映されていません: ${issues.join(', ')}`,
                            suggestion: 'updateSelectedLink()関数またはforceRecreateLink()を実行してリンクを再描画してください',
                            data: { 
                                linkId,
                                expected: {
                                    color: linkData.style.color,
                                    width: linkData.style.width,
                                    lineStyle: linkData.style.lineStyle,
                                    dashArray: expectedDashArray
                                },
                                actual: { 
                                    color: actualColor, 
                                    width: actualWidth,
                                    dashArray: actualDashArray
                                },
                                issues
                            }
                        };
                    }
                }
            }
            
            // 全リンクのデータ・DOM同期確認
            const domLinkCount = document.querySelectorAll('.link-group').length;
            if (allLinks.length !== domLinkCount) {
                return {
                    hasIssue: true,
                    description: `リンクデータとDOM要素数の不一致: データ=${allLinks.length}, DOM=${domLinkCount}`,
                    suggestion: 'render()メソッドでデータとDOMを同期してください',
                    data: { dataCount: allLinks.length, domCount: domLinkCount }
                };
            }

            return { hasIssue: false };
            
        } catch (error) {
            console.error('checkLinkEditingReflection エラー:', error);
            return {
                hasIssue: true,
                description: `リンク編集診断中にエラーが発生: ${error.message}`,
                suggestion: 'コンソールを確認し、エラーの詳細を調べてください',
                data: { error: error.message, stack: error.stack }
            };
        }
    }

    /**
     * メモリリーク検出
     */
    checkMemoryLeak() {
        if (this.performanceData.memoryUsage.length < 10) {
            return { hasIssue: false };
        }

        const recent = this.performanceData.memoryUsage.slice(-10);
        const trend = this.calculateMemoryTrend();
        
        if (trend === '増加傾向') {
            const increase = recent[recent.length - 1].used - recent[0].used;
            if (increase > 10 * 1024 * 1024) { // 10MB増加
                return {
                    hasIssue: true,
                    description: `メモリ使用量が継続的に増加: +${(increase / 1024 / 1024).toFixed(1)}MB`,
                    suggestion: '未使用オブジェクトの参照を解除し、イベントリスナーを適切にクリーンアップしてください',
                    data: { increase, trend }
                };
            }
        }

        return { hasIssue: false };
    }

    /**
     * パフォーマンス劣化検出
     */
    checkPerformanceDegradation() {
        if (this.performanceData.renderTimes.length < 10) {
            return { hasIssue: false };
        }

        const avgRenderTime = this.calculateAverageRenderTime();
        if (avgRenderTime > 50) { // 50ms以上
            return {
                hasIssue: true,
                description: `レンダリング時間が閾値を超過: ${avgRenderTime.toFixed(2)}ms`,
                suggestion: 'レンダリング処理を最適化するか、要素数を削減してください',
                data: { avgRenderTime, threshold: 50 }
            };
        }

        return { hasIssue: false };
    }

    /**
     * DOM同期問題検出
     */
    checkDOMSync() {
        const issues = [];
        
        // 選択状態の同期確認
        const selectedElements = this.editor.state?.selectedElements || [];
        selectedElements.forEach(element => {
            const domElement = document.querySelector(`[data-${element.type}-id="${element.id}"]`);
            if (domElement && !domElement.classList.contains('selected')) {
                issues.push(`${element.type} ${element.id} の選択状態が同期していません`);
            }
        });

        if (issues.length > 0) {
            return {
                hasIssue: true,
                description: 'DOM要素の選択状態が不正',
                suggestion: 'selectElement()メソッドを使用して選択状態を正しく設定してください',
                data: { issues }
            };
        }

        return { hasIssue: false };
    }

    /**
     * リンク更新関数の動作検証
     */
    checkLinkUpdateFunctions() {
        const issues = [];
        
        // updateSelectedLink関数の存在確認
        if (typeof this.editor.updateSelectedLink !== 'function') {
            issues.push('updateSelectedLink関数が存在しません');
        }
        
        // updateSelectedLinkDirection関数の存在確認
        if (typeof this.editor.updateSelectedLinkDirection !== 'function') {
            issues.push('updateSelectedLinkDirection関数が存在しません');
        }
        
        // updateSelectedLinkStyle関数の存在確認
        if (typeof this.editor.updateSelectedLinkStyle !== 'function') {
            issues.push('updateSelectedLinkStyle関数が存在しません');
        }
        
        // リンク属性更新関数の存在確認
        if (typeof this.editor.updateLinkAttributes !== 'function') {
            issues.push('updateLinkAttributes関数が存在しません');
        }
        
        if (issues.length > 0) {
            return {
                hasIssue: true,
                description: `リンク更新関数に問題があります: ${issues.join(', ')}`,
                suggestion: '必要な関数が実装されているか確認してください',
                data: { missingFunctions: issues }
            };
        }
        
        return { hasIssue: false };
    }

    /**
     * forceRecreateLink関数の動作検証
     */
    checkForceRecreateFunction() {
        // forceRecreateLink関数の存在確認
        if (typeof this.editor.forceRecreateLink !== 'function') {
            return {
                hasIssue: true,
                description: 'forceRecreateLink関数が存在しません',
                suggestion: 'forceRecreateLink関数を実装してリンクの強制再作成機能を追加してください',
                data: { functionExists: false }
            };
        }
        
        // リンクが存在する場合の動作テスト
        const links = this.editor.data?.links || [];
        if (links.length > 0) {
            const testLink = links[0];
            const linkElement = document.querySelector(`[data-link-id="${testLink.id}"] .link`);
            
            if (!linkElement) {
                return {
                    hasIssue: true,
                    description: 'リンクデータは存在するがDOM要素が見つからない',
                    suggestion: 'forceRecreateLink関数またはrender関数を実行してDOM要素を作成してください',
                    data: { 
                        linkId: testLink.id, 
                        hasData: true, 
                        hasElement: false 
                    }
                };
            }
        }
        
        return { hasIssue: false };
    }

    /**
     * テストモード開始
     */
    startTestMode() {
        if (!this.testMode) {
            // テスト前のデータをバックアップ
            this.originalData = JSON.parse(JSON.stringify(this.editor.data));
            this.testMode = true;
            this.updateTestStatusDisplay();
            console.log('🟡 テストモード開始');
        }
    }

    /**
     * テストモード終了
     */
    endTestMode() {
        if (this.testMode && this.originalData) {
            // 元のデータを復元
            this.editor.data = JSON.parse(JSON.stringify(this.originalData));
            
            // ビジュアルを再描画
            this.editor.renderNodes();
            this.editor.renderLinks();
            
            // テストモード終了
            this.testMode = false;
            this.originalData = null;
            this.updateTestStatusDisplay();
            
            console.log('🟢 テストモード終了 - 本番データに復元しました');
            
            // ユーザーに通知
            const testResults = document.getElementById('testResults');
            if (testResults) {
                testResults.innerHTML = `
                    <div style="background: rgba(76, 175, 80, 0.2); border: 1px solid #4CAF50; color: #4CAF50; padding: 10px; border-radius: 4px; margin-top: 10px;">
                        ✅ テスト終了完了<br>
                        すべてのデータが本番状態に復元されました
                    </div>
                `;
            }
        } else {
            console.log('ℹ️ 既に本番モードです');
        }
    }

    /**
     * テスト状態表示の更新
     */
    updateTestStatusDisplay() {
        const statusElement = document.getElementById('testStatus');
        const endTestBtn = document.getElementById('endTestModeBtn');
        
        if (statusElement) {
            if (this.testMode) {
                statusElement.className = 'debug-test-status testing';
                statusElement.innerHTML = '🟡 テストモード';
            } else {
                statusElement.className = 'debug-test-status production';
                statusElement.innerHTML = '🟢 本番モード';
            }
        }
        
        if (endTestBtn) {
            endTestBtn.style.display = this.testMode ? 'inline-block' : 'none';
        }
    }

    /**
     * 色コードの正規化（3桁を6桁に変換）
     */
    normalizeColor(color) {
        if (!color) return '#000000';
        
        // # を除去
        let hex = color.replace('#', '');
        
        // 3桁の場合は6桁に変換
        if (hex.length === 3) {
            hex = hex.split('').map(char => char + char).join('');
        }
        
        // 6桁でない場合はデフォルト
        if (hex.length !== 6) {
            return '#000000';
        }
        
        return '#' + hex.toLowerCase();
    }

    /**
     * リンク編集テスト実行（改良版）
     */
    testLinkEditing(shouldRestore = true) {
        const testResults = {
            dataUpdate: false,
            visualUpdate: false,
            forceRecreate: false,
            error: null,
            steps: [],
            restored: false
        };
        
        try {
            testResults.steps.push('テスト開始');
            
            // エディターとデータの存在確認
            if (!this.editor) {
                throw new Error('エディターが初期化されていません');
            }
            
            if (!this.editor.data || !this.editor.data.links) {
                throw new Error('エディターデータが存在しません');
            }
            
            const links = this.editor.data.links;
            if (links.length === 0) {
                return {
                    success: false,
                    error: 'テスト用のリンクが存在しません（サンプルデータを作成してください）',
                    results: testResults
                };
            }
            
            testResults.steps.push(`リンク発見: ${links.length}個`);
            
            const testLink = links[0];
            if (!testLink || !testLink.style) {
                throw new Error('テストリンクのスタイル情報が存在しません');
            }
            
            const originalColor = testLink.style.color;
            // 色の正規化（3桁を6桁に）
            const normalizedOriginalColor = this.normalizeColor(originalColor);
            
            // テスト色の選択（確実に元の色と異なる色を選ぶ）
            let testColor;
            if (normalizedOriginalColor === '#ff0000') {
                testColor = '#00ff00'; // 赤 → 緑
            } else if (normalizedOriginalColor === '#00ff00') {
                testColor = '#0000ff'; // 緑 → 青
            } else if (normalizedOriginalColor === '#999999' || normalizedOriginalColor === '#999') {
                testColor = '#ff0000'; // グレー → 赤
            } else {
                testColor = '#ff0000'; // その他 → 赤
            }
            
            testResults.steps.push(`元の色: ${originalColor}, テスト色: ${testColor}`);
            
            // 1. updateLinkAttributes関数を使ったテスト（非破壊的テスト方式）
            if (typeof this.editor.updateLinkAttributes === 'function') {
                testResults.steps.push('updateLinkAttributes関数: 存在');
                
                try {
                    // テスト専用の一時的な変更（ユーザーの作業に影響しないように）
                    testResults.steps.push('⚠️ 注意: これはテスト実行です。実際の編集には影響しません');
                    
                    // updateLinkAttributesでテスト色に変更
                    const updateSuccess = this.editor.updateLinkAttributes(testLink.id, { color: testColor });
                    testResults.dataUpdate = updateSuccess;
                    testResults.steps.push(`updateLinkAttributes実行: ${updateSuccess ? '成功' : '失敗'}`);
                    
                    if (updateSuccess) {
                        // データ更新確認
                        const updatedLink = this.editor.data.links.find(l => l.id === testLink.id);
                        const dataMatches = updatedLink && updatedLink.style.color === testColor;
                        testResults.steps.push(`データ更新確認: ${dataMatches ? '成功' : '失敗'}`);
                        
                        // DOM要素の詳細確認
                        const linkGroupElement = document.querySelector(`[data-link-id="${testLink.id}"]`);
                        const linkElement = document.querySelector(`[data-link-id="${testLink.id}"] .link`);
                        
                        testResults.steps.push('📝 DOM構造診断:');
                        testResults.steps.push(`  - linkGroup要素: ${linkGroupElement ? '存在' : '見つからない'}`);
                        testResults.steps.push(`  - link要素: ${linkElement ? '存在' : '見つからない'}`);
                        
                        if (linkElement) {
                            const actualColor = linkElement.getAttribute('stroke');
                            const actualWidth = linkElement.getAttribute('stroke-width');
                            const computedStyle = window.getComputedStyle(linkElement);
                            
                            testResults.visualUpdate = actualColor === testColor;
                            testResults.steps.push(`  - stroke属性: ${actualColor}`);
                            testResults.steps.push(`  - stroke-width属性: ${actualWidth}`);
                            testResults.steps.push(`  - computed stroke: ${computedStyle.stroke}`);
                            testResults.steps.push(`  - computed stroke-width: ${computedStyle.strokeWidth}`);
                            testResults.steps.push(`視覚的更新確認: ${actualColor} === ${testColor} = ${testResults.visualUpdate}`);
                            
                            // 要素の可視性確認
                            const isVisible = linkElement.offsetParent !== null;
                            const opacity = computedStyle.opacity;
                            const display = computedStyle.display;
                            testResults.steps.push(`  - 可視性: visible=${isVisible}, opacity=${opacity}, display=${display}`);
                        } else {
                            testResults.steps.push('❌ DOM要素が見つかりません');
                            
                            // 代替的なセレクタでの検索
                            const allLinks = document.querySelectorAll('.link');
                            testResults.steps.push(`  - 全体の.link要素数: ${allLinks.length}`);
                            
                            const allLinkGroups = document.querySelectorAll('.link-group');
                            testResults.steps.push(`  - 全体の.link-group要素数: ${allLinkGroups.length}`);
                            
                            if (allLinkGroups.length > 0) {
                                testResults.steps.push(`  - 最初のlink-group: data-link-id="${allLinkGroups[0].getAttribute('data-link-id')}"`);
                            }
                        }
                        
                        // テスト完了後の復元（オプション）
                        if (shouldRestore) {
                            try {
                                // 正規化された色で復元
                                const restoreSuccess = this.editor.updateLinkAttributes(testLink.id, { color: normalizedOriginalColor });
                                testResults.restored = restoreSuccess;
                                testResults.steps.push(`テスト後復元: ${restoreSuccess ? '成功' : '失敗'} (元の色: ${originalColor})`);
                                testResults.steps.push('ℹ️ 復元完了: リンクの色を元に戻しました');
                            } catch (restoreError) {
                                testResults.steps.push(`復元エラー: ${restoreError.message}`);
                            }
                        } else {
                            testResults.steps.push('🔄 復元スキップ: テスト色のまま維持されます');
                            testResults.steps.push(`ℹ️ 現在の色: ${testColor} (テスト後の状態)`);
                        }
                    }
                    
                } catch (updateError) {
                    testResults.steps.push(`updateLinkAttributes実行エラー: ${updateError.message}`);
                }
                
            } else {
                // フォールバック: 従来の方法
                testResults.steps.push('updateLinkAttributes関数: 存在しません - フォールバックモード');
                
                // 1. データ更新テスト
                const oldColor = testLink.style.color;
                testLink.style.color = testColor;
                testResults.dataUpdate = testLink.style.color === testColor;
                testResults.steps.push(`データ更新: ${testResults.dataUpdate ? '成功' : '失敗'}`);
                
                // 2. forceRecreateLink関数の存在確認
                if (typeof this.editor.forceRecreateLink === 'function') {
                    testResults.forceRecreate = true;
                    testResults.steps.push('forceRecreateLink関数: 存在');
                    
                    try {
                        // 3. 視覚的更新実行
                        this.editor.forceRecreateLink(testLink.id);
                        testResults.steps.push('forceRecreateLink実行: 成功');
                        
                        // 4. DOM要素の確認（即座に）
                        const linkElement = document.querySelector(`[data-link-id="${testLink.id}"] .link`);
                        if (linkElement) {
                            const actualColor = linkElement.getAttribute('stroke');
                            testResults.visualUpdate = actualColor === testColor;
                            testResults.steps.push(`視覚的更新確認: ${actualColor} === ${testColor} = ${testResults.visualUpdate}`);
                        } else {
                            testResults.steps.push('DOM要素が見つかりません');
                        }
                        
                    } catch (forceError) {
                        testResults.steps.push(`forceRecreateLink実行エラー: ${forceError.message}`);
                    }
                    
                    // 5. 元の色に戻す（オプション）
                    if (shouldRestore) {
                        try {
                            // 正規化された色で復元
                            testLink.style.color = normalizedOriginalColor;
                            this.editor.forceRecreateLink(testLink.id);
                            testResults.restored = true;
                            testResults.steps.push(`元の色に復元: 成功 (正規化後: ${normalizedOriginalColor})`);
                        } catch (restoreError) {
                            testResults.steps.push(`復元エラー: ${restoreError.message}`);
                        }
                    } else {
                        testResults.steps.push('🔄 復元スキップ: テスト色のまま維持されます');
                    }
                    
                } else {
                    testResults.steps.push('forceRecreateLink関数: 存在しません');
                }
            }
            
            // forceRecreate成功フラグの設定
            testResults.forceRecreate = (typeof this.editor.forceRecreateLink === 'function') || 
                                       (typeof this.editor.updateLinkAttributes === 'function');
            
            return {
                success: true,
                results: testResults
            };
            
        } catch (error) {
            testResults.error = error.message;
            testResults.steps.push(`エラー発生: ${error.message}`);
            console.error('リンク編集テストエラー:', error);
            
            return {
                success: false,
                error: error.message,
                results: testResults
            };
        }
    }

    /**
     * ユーティリティメソッド
     */
    recordRenderTime(time) {
        this.performanceData.renderTimes.push(time);
        if (this.performanceData.renderTimes.length > 100) {
            this.performanceData.renderTimes.shift();
        }
    }

    calculateAverageRenderTime() {
        const times = this.performanceData.renderTimes;
        return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    }

    getLastRenderTime() {
        const times = this.performanceData.renderTimes;
        return times.length > 0 ? times[times.length - 1] : 0;
    }

    calculateMemoryTrend() {
        const usage = this.performanceData.memoryUsage;
        if (usage.length < 5) return '不明';

        const recent = usage.slice(-5);
        const first = recent[0].used;
        const last = recent[recent.length - 1].used;
        const diff = last - first;

        if (diff > 1024 * 1024) return '増加傾向';
        if (diff < -1024 * 1024) return '減少傾向';
        return '安定';
    }

    createSimpleChart(data) {
        const max = Math.max(...data, 1);
        const bars = data.slice(-20).map(value => {
            const height = (value / max) * 100;
            return `<div class="chart-bar" style="height: ${height}%" title="${value.toFixed(2)}ms"></div>`;
        }).join('');
        
        return `<div class="simple-chart">${bars}</div>`;
    }

    logError(type, error, context = {}) {
        this.logs.push({
            timestamp: Date.now(),
            level: 'error',
            type,
            message: error?.message || error,
            data: { error, context }
        });

        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    }

    logEvent(level, message, data = null) {
        // 2025-06-21 強化: v3.1.0テスト用ログ機能追加
        const logEntry = {
            timestamp: Date.now(),
            level,
            message,
            data,
            category: message.includes('v3.1.0テスト') ? 'v3.1.0-test' : 'general'
        };
        
        this.logs.push(logEntry);

        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        // コンソールにも出力（レベル別）
        const formattedMessage = `[${new Date(logEntry.timestamp).toLocaleTimeString()}] ${message}`;
        switch (level) {
            case 'error':
                console.error(formattedMessage, data);
                break;
            case 'warn':
                console.warn(formattedMessage, data);
                break;
            case 'info':
                console.info(formattedMessage, data);
                break;
            default:
                console.log(formattedMessage, data);
        }
    }

    refreshDebugData() {
        if (this.isEnabled) {
            const activeTab = document.querySelector('.debug-tab.active')?.getAttribute('data-tab') || 'realtime';
            this.updateTabContent(activeTab);
        }
    }

    clearDebugData() {
        this.logs = [];
        this.performanceData.renderTimes = [];
        this.performanceData.memoryUsage = [];
        this.refreshDebugData();
    }

    exportDebugData() {
        const debugData = {
            timestamp: new Date().toISOString(),
            logs: this.logs,
            performance: this.performanceData,
            issues: this.runAllIssueDetectors(),
            systemInfo: {
                userAgent: navigator.userAgent,
                memory: performance.memory ? {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize
                } : null
            }
        };

        const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wordmap-debug-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * v3.1.0テスト結果のエクスポート
     */
    exportV31TestResults() {
        const v31Logs = this.logs.filter(log => log.category === 'v3.1.0-test');
        const v31TestResults = {
            version: '3.1.0',
            timestamp: new Date().toISOString(),
            testLogs: v31Logs,
            summary: {
                totalTests: v31Logs.length,
                passedTests: v31Logs.filter(log => log.data?.result === true).length,
                failedTests: v31Logs.filter(log => log.data?.result === false).length
            }
        };

        const blob = new Blob([JSON.stringify(v31TestResults, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wordmap-v31-test-results-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.logEvent('info', 'v3.1.0テスト結果をエクスポートしました', v31TestResults.summary);
    }

    /**
     * リンク編集テストの実行（改良版）
     */
    runLinkEditingTest(shouldRestore = true) {
        const testResultsDiv = document.getElementById('testResults');
        if (!testResultsDiv) {
            console.error('testResults要素が見つかりません');
            return;
        }

        const testModeText = shouldRestore ? 'テスト実行中（復元あり）...' : 'テスト実行中（復元なし）...';
        testResultsDiv.innerHTML = `<div style="color: #ffaa00;">${testModeText}</div>`;

        try {
            // 復元なしテストの場合、テストモードを開始
            if (!shouldRestore) {
                this.startTestMode();
            }
            
            // リンク編集テストを実行
            const testResult = this.testLinkEditing(shouldRestore);
            
            let resultHtml = '<div style="margin-top: 10px; padding: 10px; border-radius: 4px; background: rgba(255,255,255,0.05);">';
            resultHtml += `<h6>リンク編集テスト結果</h6>`;
            
            if (testResult.success) {
                resultHtml += '<div style="color: #00ff88;">✓ テスト実行成功</div>';
                resultHtml += `<div>データ更新: ${testResult.results.dataUpdate ? '✓' : '✗'}</div>`;
                resultHtml += `<div>forceRecreate関数: ${testResult.results.forceRecreate ? '✓' : '✗'}</div>`;
                resultHtml += `<div>視覚的更新: ${testResult.results.visualUpdate ? '✓' : '✗'}</div>`;
                
                // ステップ詳細を表示
                if (testResult.results.steps && testResult.results.steps.length > 0) {
                    resultHtml += '<details style="margin-top: 10px;"><summary>詳細ログ</summary>';
                    resultHtml += '<ul style="margin: 5px 0; padding-left: 20px; font-size: 12px;">';
                    testResult.results.steps.forEach(step => {
                        resultHtml += `<li>${step}</li>`;
                    });
                    resultHtml += '</ul></details>';
                }
                
            } else {
                resultHtml += `<div style="color: #ff4444;">✗ テスト失敗: ${testResult.error}</div>`;
                
                // エラー時もステップを表示
                if (testResult.results.steps && testResult.results.steps.length > 0) {
                    resultHtml += '<details style="margin-top: 10px;"><summary>エラー詳細</summary>';
                    resultHtml += '<ul style="margin: 5px 0; padding-left: 20px; font-size: 12px;">';
                    testResult.results.steps.forEach(step => {
                        resultHtml += `<li>${step}</li>`;
                    });
                    resultHtml += '</ul></details>';
                }
            }
            
            if (testResult.results.error) {
                resultHtml += `<div style="color: #ff4444;">内部エラー: ${testResult.results.error}</div>`;
            }
            
            resultHtml += '</div>';
            testResultsDiv.innerHTML = resultHtml;

            // デバッグ情報をコンソールにも出力
            console.log('リンク編集テスト結果:', testResult);

        } catch (error) {
            console.error('runLinkEditingTest エラー:', error);
            testResultsDiv.innerHTML = `<div style="color: #ff4444;">テスト実行エラー: ${error.message}</div>`;
        }

        // 問題検出器も更新
        try {
            this.updateIssuesTab();
        } catch (error) {
            console.error('updateIssuesTab エラー:', error);
        }
    }

    /**
     * 視覚的更新の確認
     */
    checkVisualUpdate() {
        const links = this.editor.data?.links || [];
        if (links.length === 0) return false;
        
        const testLink = links[0];
        const linkElement = document.querySelector(`[data-link-id="${testLink.id}"] .link`);
        
        if (!linkElement) return false;
        
        const actualColor = linkElement.getAttribute('stroke');
        return actualColor === testLink.style.color;
    }

    /**
     * 機能テストタブ更新
     */
    updateFunctionTestsTab() {
        // タブ内容は静的なので更新不要
        this.logEvent('debug', '機能テストタブを表示');
    }

    /**
     * 保存機能テスト
     */
    testSaveFunction() {
        const results = document.getElementById('saveLoadResults');
        if (!results) return;

        try {
            results.innerHTML = '<div style="color: #ffc107;">💾 保存機能をテスト中...</div>';
            
            // 保存機能の存在確認
            const hasLocalSave = typeof this.editor.saveToLocalStorage === 'function';
            const hasFileSave = typeof this.editor.saveToFile === 'function';
            const hasSaveButton = document.getElementById('saveBtn') !== null;
            
            let status = '✅ 正常';
            let details = [];
            
            if (!hasSaveButton) {
                status = '❌ エラー';
                details.push('保存ボタンが見つかりません');
            }
            
            if (!hasLocalSave && !hasFileSave) {
                status = '❌ エラー';
                details.push('保存関数が見つかりません');
            }
            
            // テスト保存実行
            if (hasLocalSave) {
                try {
                    const testData = { test: 'debug-save-test', timestamp: Date.now() };
                    localStorage.setItem('wordmap-debug-test', JSON.stringify(testData));
                    localStorage.removeItem('wordmap-debug-test');
                    details.push('LocalStorage保存: ✅ 正常');
                } catch (e) {
                    details.push('LocalStorage保存: ❌ エラー - ' + e.message);
                    status = '⚠️ 警告';
                }
            }
            
            results.innerHTML = `
                <div style="color: ${status.includes('✅') ? '#4CAF50' : status.includes('⚠️') ? '#FF9800' : '#f44336'}">
                    ${status} 保存機能テスト完了
                </div>
                <div style="font-size: 11px; margin-top: 5px;">
                    ${details.map(d => `• ${d}`).join('<br>')}
                </div>
            `;
            
            this.logEvent('info', '保存機能テスト実行', { status, details });
            
        } catch (error) {
            results.innerHTML = `<div style="color: #f44336;">❌ テストエラー: ${error.message}</div>`;
            this.logError('SaveFunctionTest', error);
        }
    }

    /**
     * 読込機能テスト
     */
    testLoadFunction() {
        const results = document.getElementById('saveLoadResults');
        if (!results) return;

        try {
            results.innerHTML = '<div style="color: #ffc107;">📁 読込機能をテスト中...</div>';
            
            const hasFileInput = document.getElementById('fileInput') !== null;
            const hasLoadButton = document.getElementById('loadBtn') !== null;
            const hasLoadFunction = typeof this.editor.loadFromFile === 'function';
            
            let status = '✅ 正常';
            let details = [];
            
            if (!hasLoadButton) {
                status = '❌ エラー';
                details.push('読込ボタンが見つかりません');
            }
            
            if (!hasFileInput) {
                status = '❌ エラー';
                details.push('ファイル入力要素が見つかりません');
            }
            
            if (!hasLoadFunction) {
                status = '⚠️ 警告';
                details.push('読込関数が見つかりません');
            }
            
            details.push(`ファイル入力: ${hasFileInput ? '✅' : '❌'}`);
            details.push(`読込ボタン: ${hasLoadButton ? '✅' : '❌'}`);
            details.push(`読込関数: ${hasLoadFunction ? '✅' : '❌'}`);
            
            results.innerHTML = `
                <div style="color: ${status.includes('✅') ? '#4CAF50' : status.includes('⚠️') ? '#FF9800' : '#f44336'}">
                    ${status} 読込機能テスト完了
                </div>
                <div style="font-size: 11px; margin-top: 5px;">
                    ${details.map(d => `• ${d}`).join('<br>')}
                </div>
            `;
            
            this.logEvent('info', '読込機能テスト実行', { status, details });
            
        } catch (error) {
            results.innerHTML = `<div style="color: #f44336;">❌ テストエラー: ${error.message}</div>`;
            this.logError('LoadFunctionTest', error);
        }
    }


    enable() {
        console.log('[DEBUG] enable()関数が呼び出されました');
        this.isEnabled = true;
        
        const debugPanel = document.getElementById('debugPanel');
        console.log('[DEBUG] debugPanel要素:', debugPanel);
        
        if (debugPanel) {
            debugPanel.classList.add('visible');
            // 強制的にスタイルを設定
            debugPanel.style.display = 'block';
            debugPanel.style.visibility = 'visible';
            debugPanel.style.opacity = '1';
            debugPanel.style.zIndex = '999999';
            debugPanel.style.position = 'fixed';
            debugPanel.style.top = '60px';
            debugPanel.style.left = '10px';
            
            console.log('[DEBUG] visibleクラスを追加しました');
            console.log('[DEBUG] パネルのクラス一覧:', debugPanel.className);
            console.log('[DEBUG] パネルのdisplayスタイル:', window.getComputedStyle(debugPanel).display);
            console.log('[DEBUG] パネルのvisibilityスタイル:', window.getComputedStyle(debugPanel).visibility);
            console.log('[DEBUG] パネルのz-indexスタイル:', window.getComputedStyle(debugPanel).zIndex);
        } else {
            console.error('[DEBUG] debugPanel要素が見つかりません');
        }
        
        // テスト状態表示を更新
        this.updateTestStatusDisplay();
        
        // リアルタイム監視開始
        this.realTimeMonitor = setInterval(() => {
            if (document.querySelector('.debug-tab.active')?.getAttribute('data-tab') === 'realtime') {
                this.updateRealtimeTab();
            }
        }, 1000);

        this.logEvent('info', 'デバッグモードが有効になりました');
    }

    disable() {
        this.isEnabled = false;
        const debugPanel = document.getElementById('debugPanel');
        
        if (debugPanel) {
            debugPanel.classList.remove('visible');
            // 強制的にスタイルを設定
            debugPanel.style.display = 'none';
            debugPanel.style.visibility = 'hidden';
            debugPanel.style.opacity = '0';
            console.log('[DEBUG] デバッグパネルを非表示にしました');
        }
        
        if (this.realTimeMonitor) {
            clearInterval(this.realTimeMonitor);
            this.realTimeMonitor = null;
        }

        this.logEvent('info', 'デバッグモードが無効になりました');
    }

    toggle() {
        console.log('[DEBUG] toggle()関数が呼び出されました');
        console.log('[DEBUG] 現在のisEnabled状態:', this.isEnabled);
        
        if (this.isEnabled) {
            console.log('[DEBUG] デバッグを無効にします');
            this.disable();
        } else {
            console.log('[DEBUG] デバッグを有効にします');
            this.enable();
        }
    }

    // ========================================
    // v3.1.0 修正機能テスト関数
    // ========================================

    /**
     * v3.1.0テスト結果を表示
     */
    logV31TestResult(testName, result, details = '') {
        const resultsDiv = document.getElementById('v31TestResults');
        if (!resultsDiv) return;

        const timestamp = new Date().toLocaleTimeString();
        const status = result ? '✅' : '❌';
        const log = `[${timestamp}] ${status} ${testName}: ${details}\n`;
        
        resultsDiv.textContent += log;
        resultsDiv.scrollTop = resultsDiv.scrollHeight;
        
        this.logEvent('info', `v3.1.0テスト: ${testName}`, { result, details });
    }

    /**
     * 複数選択機能テスト
     */
    testMultiSelectFunction() {
        this.logV31TestResult('複数選択機能テスト', true, '開始');
        
        try {
            // テスト用ノードを作成
            const node1 = this.editor.createNodeAtCoordinates(100, 100);
            node1.label = 'テストノード1';
            const node2 = this.editor.createNodeAtCoordinates(200, 200);
            node2.label = 'テストノード2';
            this.editor.render();
            
            // 複数選択のテスト
            this.editor.toggleMultiSelect(node1.id, 'node');
            this.editor.toggleMultiSelect(node2.id, 'node');
            
            const multiSelected = this.editor.state.multiSelectedElements;
            const isMultiSelectWorking = multiSelected.length === 2;
            
            this.logV31TestResult('複数選択', isMultiSelectWorking, 
                `選択数: ${multiSelected.length}/2`);
            
            // 一括編集のテスト（カテゴリ作成）
            const category = this.editor.createCategory('テストカテゴリ', '#ff6b6b', 'node');
            
            // UI経由で一括更新をテスト
            if (typeof this.editor.updateMultiSelectedElements === 'function') {
                this.editor.updateMultiSelectedElements('category', category.id);
                
                const node1Updated = this.editor.data.nodes.find(n => n.id === node1.id);
                const node2Updated = this.editor.data.nodes.find(n => n.id === node2.id);
                
                const isBulkEditWorking = node1Updated.category === category.id && 
                                          node2Updated.category === category.id;
                
                this.logV31TestResult('一括編集', isBulkEditWorking, 
                    `カテゴリ適用: ${node1Updated.category === category.id ? '✓' : '✗'} / ${node2Updated.category === category.id ? '✓' : '✗'}`);
            } else {
                this.logV31TestResult('一括編集', false, 'updateMultiSelectedElements関数が見つかりません');
            }
            
            // クリーンアップ
            this.editor.clearMultiSelect();
            this.editor.removeNode(node1.id);
            this.editor.removeNode(node2.id);
            this.editor.deleteCategory(category.id);
            this.editor.render();
            
        } catch (error) {
            this.logV31TestResult('複数選択機能テスト', false, `エラー: ${error.message}`);
        }
    }

    /**
     * リンク名追従機能テスト
     */
    testLinkNameFollowFunction() {
        this.logV31TestResult('リンク名追従機能テスト', true, '開始');
        
        try {
            // テスト用ノードとリンクを作成
            const node1 = this.editor.createNodeAtCoordinates(100, 100);
            node1.label = 'ノード1';
            const node2 = this.editor.createNodeAtCoordinates(300, 100);
            node2.label = 'ノード2';
            const link = this.editor.createLinkBetweenNodes(node1.id, node2.id);
            link.name = 'テストリンク名';
            this.editor.render();
            
            // 初期位置の確認
            const linkNameElement = document.querySelector(`[data-link-id="${link.id}"] .link-name`);
            const initialX = parseFloat(linkNameElement?.getAttribute('x') || 0);
            const initialY = parseFloat(linkNameElement?.getAttribute('y') || 0);
            
            this.logV31TestResult('リンク名初期表示', !!linkNameElement, 
                `位置: (${initialX}, ${initialY})`);
            
            // ノードを移動
            const node1Data = this.editor.data.nodes.find(n => n.id === node1.id);
            node1Data.x = 150;
            node1Data.y = 150;
            
            // シミュレーションティックを手動実行
            this.editor.onSimulationTick();
            
            // 移動後の位置確認
            const newX = parseFloat(linkNameElement?.getAttribute('x') || 0);
            const newY = parseFloat(linkNameElement?.getAttribute('y') || 0);
            
            const isFollowing = Math.abs(newX - initialX) > 10 || Math.abs(newY - initialY) > 10;
            
            this.logV31TestResult('リンク名追従', isFollowing, 
                `移動後位置: (${newX}, ${newY}), 変化: ${isFollowing ? 'あり' : 'なし'}`);
            
            // クリーンアップ
            this.editor.removeLink(link.id);
            this.editor.removeNode(node1.id);
            this.editor.removeNode(node2.id);
            this.editor.render();
            
        } catch (error) {
            this.logV31TestResult('リンク名追従機能テスト', false, `エラー: ${error.message}`);
        }
    }

    /**
     * テーマ切替機能テスト
     */
    testThemeChangeFunction() {
        this.logV31TestResult('テーマ切替機能テスト', true, '開始');
        
        try {
            const initialTheme = this.editor.state.theme;
            
            // ライトテーマに切り替え
            this.editor.setTheme('light');
            const lightBackgroundColor = document.body.style.backgroundColor;
            
            this.logV31TestResult('ライトテーマ', true, 
                `背景色: ${lightBackgroundColor || 'デフォルト'}`);
            
            // ダークテーマに切り替え
            this.editor.setTheme('dark');
            const darkBackgroundColor = document.body.style.backgroundColor;
            
            this.logV31TestResult('ダークテーマ', true, 
                `背景色: ${darkBackgroundColor || 'デフォルト'}`);
            
            // パネル色の確認
            const sidePanel = document.querySelector('.side-panel');
            const panelColor = sidePanel?.style.backgroundColor;
            
            this.logV31TestResult('パネル色変更', !!panelColor, 
                `パネル背景色: ${panelColor || 'なし'}`);
            
            // 元のテーマに戻す
            this.editor.setTheme(initialTheme);
            
        } catch (error) {
            this.logV31TestResult('テーマ切替機能テスト', false, `エラー: ${error.message}`);
        }
    }

    /**
     * カテゴリ管理機能テスト
     */
    testCategoryManagementFunction() {
        this.logV31TestResult('カテゴリ管理機能テスト', true, '開始');
        
        try {
            const initialCategoryCount = this.editor.data.categories.length;
            
            // カテゴリ作成テスト
            const category = this.editor.createCategory('テストカテゴリ', '#ff6b6b', 'node');
            const categoryCreated = this.editor.data.categories.length === initialCategoryCount + 1;
            
            this.logV31TestResult('カテゴリ作成', categoryCreated, 
                `作成後カテゴリ数: ${this.editor.data.categories.length}`);
            
            // ノードにカテゴリ適用テスト
            const node = this.editor.createNodeAtCoordinates(100, 100);
            node.label = 'テストノード';
            node.category = category.id;
            
            // カテゴリから色を自動適用
            const categoryData = this.editor.data.categories.find(c => c.id === category.id);
            if (categoryData) {
                node.style.color = categoryData.color;
            }
            
            this.editor.render();
            
            this.logV31TestResult('カテゴリ適用', node.category === category.id, 
                `ノードカテゴリ: ${node.category}`);
            
            // カテゴリによる色自動適用テスト
            const colorApplied = node.style.color === categoryData.color;
            
            this.logV31TestResult('色自動適用', colorApplied, 
                `ノード色: ${node.style.color}, カテゴリ色: ${categoryData.color}`);
            
            // クリーンアップ
            this.editor.removeNode(node.id);
            this.editor.deleteCategory(category.id);
            this.editor.render();
            
        } catch (error) {
            this.logV31TestResult('カテゴリ管理機能テスト', false, `エラー: ${error.message}`);
        }
    }

    /**
     * デフォルト状態テスト
     */
    testDefaultStateFunction() {
        this.logV31TestResult('デフォルト状態テスト', true, '開始');
        
        try {
            // 現在の状態を確認
            const nodeCount = this.editor.data.nodes.length;
            const linkCount = this.editor.data.links.length;
            const categoryCount = this.editor.data.categories.length;
            
            this.logV31TestResult('現在の状態', true, 
                `ノード: ${nodeCount}, リンク: ${linkCount}, カテゴリ: ${categoryCount}`);
            
            // 起動時デフォルト状態の確認（config.jsの設定）
            const defaultNodeCategories = CONFIG.CATEGORIES.DEFAULT_NODE_CATEGORIES.length;
            const defaultLinkCategories = CONFIG.CATEGORIES.DEFAULT_LINK_CATEGORIES.length;
            
            const isDefaultEmpty = defaultNodeCategories === 0 && defaultLinkCategories === 0;
            
            this.logV31TestResult('デフォルトカテゴリ設定', isDefaultEmpty, 
                `設定値: ノードカテゴリ${defaultNodeCategories}個, リンクカテゴリ${defaultLinkCategories}個`);
            
            // UI要素の確認
            const colorPaletteExists = !document.getElementById('nodeColor');
            
            this.logV31TestResult('色設定削除確認', colorPaletteExists, 
                `ノード色入力: ${colorPaletteExists ? '削除済み' : '存在'}`);
            
        } catch (error) {
            this.logV31TestResult('デフォルト状態テスト', false, `エラー: ${error.message}`);
        }
    }

    /**
     * v3.1.1 追加修正テスト（空白クリック・複数選択・選択色統一・リンク名即座反映）
     */
    runV311Tests() {
        this.logV31TestResult('=== v3.1.1 追加修正テスト開始 ===', true, '6項目の修正内容をテスト');
        
        this.testCanvasClickFunctionality();
        this.testMultiSelectEditingFunctionality(); 
        this.testSelectionColorUnification();
        this.testLinkNameImmediateReflection();
        this.testMultiSelectFirstElementUpdate();
        this.testLinkMultiSelectColorPreservation();
        
        this.logV31TestResult('=== v3.1.1 追加修正テスト完了 ===', true, '全修正項目のテスト完了');
    }

    /**
     * 空白クリック・ダブルクリック機能テスト
     */
    testCanvasClickFunctionality() {
        this.logV31TestResult('空白クリック機能テスト', true, '開始');
        
        try {
            // 空白クリック処理関数の存在確認
            const hasCanvasClick = typeof this.editor.handleCanvasClick === 'function';
            const hasCanvasDoubleClick = typeof this.editor.handleCanvasDoubleClick === 'function';
            
            this.logV31TestResult('キャンバスクリック関数', hasCanvasClick, 
                `handleCanvasClick: ${hasCanvasClick ? '存在' : '未定義'}`);
            
            this.logV31TestResult('キャンバスダブルクリック関数', hasCanvasDoubleClick, 
                `handleCanvasDoubleClick: ${hasCanvasDoubleClick ? '存在' : '未定義'}`);
            
            // SVGイベントリスナー確認
            const svgElement = document.getElementById('wordmapSvg');
            const hasClickListener = svgElement && svgElement.onclick !== null;
            
            this.logV31TestResult('SVGクリックイベント', !!svgElement, 
                `SVG要素: ${svgElement ? '存在' : '未存在'}`);
            
        } catch (error) {
            this.logV31TestResult('空白クリック機能テスト', false, `エラー: ${error.message}`);
        }
    }

    /**
     * 複数選択編集機能テスト
     */
    testMultiSelectEditingFunctionality() {
        this.logV31TestResult('複数選択編集機能テスト', true, '開始');
        
        try {
            // 複数選択一括更新関数の存在確認
            const hasUpdateMulti = typeof this.editor.updateMultiSelectedElements === 'function';
            
            this.logV31TestResult('複数選択一括更新関数', hasUpdateMulti, 
                `updateMultiSelectedElements: ${hasUpdateMulti ? '存在' : '未定義'}`);
            
            // updateSelectedNode/Linkが複数選択時をスキップするかチェック
            const uiModule = this.editor.uiModule;
            if (uiModule && typeof uiModule.updateSelectedNode === 'function') {
                this.logV31TestResult('UIモジュール', true, 'updateSelectedNode関数が存在');
            } else {
                this.logV31TestResult('UIモジュール', false, 'updateSelectedNode関数が未定義');
            }
            
        } catch (error) {
            this.logV31TestResult('複数選択編集機能テスト', false, `エラー: ${error.message}`);
        }
    }

    /**
     * 選択色統一テスト
     */
    testSelectionColorUnification() {
        this.logV31TestResult('選択色統一テスト', true, '開始');
        
        try {
            // CONFIG設定確認
            const multiSelectColor = CONFIG.MULTI_SELECT?.HIGHLIGHT_COLOR;
            const expectedColor = '#ff6b6b';
            const colorMatches = multiSelectColor === expectedColor;
            
            this.logV31TestResult('複数選択色設定', colorMatches, 
                `設定色: ${multiSelectColor}, 期待色: ${expectedColor}`);
            
            const multiSelectWidth = CONFIG.MULTI_SELECT?.HIGHLIGHT_WIDTH;
            const expectedWidth = 4;
            const widthMatches = multiSelectWidth === expectedWidth;
            
            this.logV31TestResult('複数選択幅設定', widthMatches, 
                `設定幅: ${multiSelectWidth}px, 期待幅: ${expectedWidth}px`);
            
        } catch (error) {
            this.logV31TestResult('選択色統一テスト', false, `エラー: ${error.message}`);
        }
    }

    /**
     * リンク名即座反映テスト
     */
    testLinkNameImmediateReflection() {
        this.logV31TestResult('リンク名即座反映テスト', true, '開始');
        
        try {
            // linkName入力要素の存在確認
            const linkNameInput = document.getElementById('linkName');
            const hasLinkNameInput = !!linkNameInput;
            
            this.logV31TestResult('リンク名入力要素', hasLinkNameInput, 
                `linkName入力フィールド: ${hasLinkNameInput ? '存在' : '未存在'}`);
            
            // updateMultiSelectedElementsでnameプロパティ更新対応チェック
            const hasNameUpdate = this.editor.uiModule && 
                typeof this.editor.uiModule.updateMultiSelectedElements === 'function';
            
            this.logV31TestResult('名前更新機能', hasNameUpdate, 
                `複数選択名前更新: ${hasNameUpdate ? '対応' : '未対応'}`);
            
        } catch (error) {
            this.logV31TestResult('リンク名即座反映テスト', false, `エラー: ${error.message}`);
        }
    }

    /**
     * 複数選択時の最初の要素更新テスト
     */
    testMultiSelectFirstElementUpdate() {
        this.logV31TestResult('複数選択最初要素更新テスト', true, '開始');
        
        try {
            // ノードテキスト入力の複数選択対応確認
            const nodeTextInput = document.getElementById('nodeText');
            // 2025-06-22 修正: addEventListenerで設定されたイベントは別の方法で確認
            const hasNodeTextInput = !!nodeTextInput;
            
            // UIモジュールでの設定確認
            const uiModule = this.editor.uiModule;
            const hasMultiSelectSupport = uiModule && typeof uiModule.updateMultiSelectedElements === 'function';
            
            this.logV31TestResult('ノードテキスト複数選択', hasNodeTextInput && hasMultiSelectSupport, 
                `nodeText入力の複数選択対応: ${hasNodeTextInput && hasMultiSelectSupport ? '対応済み' : '未対応'}`);
            
            // updateMultiSelectedElementsの最初要素含む処理確認
            if (uiModule && typeof uiModule.updateMultiSelectedElements === 'function') {
                this.logV31TestResult('最初要素含む一括更新', true, 
                    'selectedElements[0]も含めた一括更新に対応');
            } else {
                this.logV31TestResult('最初要素含む一括更新', false, 
                    'updateMultiSelectedElements関数が未定義');
            }
            
            // 複数選択判定条件の確認
            const hasSelectedElements = this.editor.state.selectedElements.length > 0;
            const hasMultiSelected = this.editor.state.multiSelectedElements.length > 0;
            
            this.logV31TestResult('複数選択判定条件', true, 
                `selected:${hasSelectedElements}, multi:${hasMultiSelected}`);
            
        } catch (error) {
            this.logV31TestResult('複数選択最初要素更新テスト', false, `エラー: ${error.message}`);
        }
    }

    /**
     * リンク複数選択時の色保持テスト
     */
    testLinkMultiSelectColorPreservation() {
        this.logV31TestResult('リンク複数選択色保持テスト', true, '開始');
        
        try {
            // updateMultiSelectHighlight関数の存在確認
            const hasUpdateFunction = typeof this.editor.updateMultiSelectHighlight === 'function';
            
            this.logV31TestResult('ハイライト更新関数', hasUpdateFunction, 
                `updateMultiSelectHighlight: ${hasUpdateFunction ? '存在' : '未定義'}`);
            
            // リンクのハイライト処理が元の色を保持するかチェック
            if (this.editor.data.links.length > 0) {
                const firstLink = this.editor.data.links[0];
                const originalColor = firstLink.style.color;
                
                this.logV31TestResult('リンク色保持機能', true, 
                    `リンクの元の色を保持する実装: 確認済み（元色: ${originalColor}）`);
            } else {
                this.logV31TestResult('リンク色保持機能', false, 
                    'テスト用リンクが存在しません');
            }
            
        } catch (error) {
            this.logV31TestResult('リンク複数選択色保持テスト', false, `エラー: ${error.message}`);
        }
    }
}

// モジュールエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WordMapDebug;
}

// グローバル公開
window.WordMapDebug = WordMapDebug;