/**
 * ワードマップエディター コアモジュール
 * 2025-06-20 作成: D3WordMapEditorクラスの基本機能
 */

class D3WordMapEditor {
    constructor(containerId, config = null) {
        console.log('D3WordMapEditor初期化開始');
        
        // D3.js利用可能性チェック
        if (typeof d3 === 'undefined') {
            console.error('D3.jsが利用できません');
            this.fallbackToNative();
            return;
        }
        
        // 設定の確認・注入
        this.config = config || (typeof CONFIG !== 'undefined' ? CONFIG : null);
        if (!this.config) {
            console.error('設定ファイル(config.js)が読み込まれていません');
            return;
        }
        
        // DOM要素の取得
        this.container = document.getElementById(containerId);
        this.svg = d3.select('#wordmapSvg');
        this.viewport = d3.select('#viewport');
        this.nodesGroup = d3.select('#nodesGroup');
        this.linksGroup = d3.select('#linksGroup');
        
        // データ構造の初期化
        this.data = {
            nodes: [],
            links: [],
            categories: [...this.config.CATEGORIES.DEFAULT_NODE_CATEGORIES, ...this.config.CATEGORIES.DEFAULT_LINK_CATEGORIES],
            nextNodeId: 1,
            nextLinkId: 1,
            nextCategoryId: 1
        };
        
        // 状態管理
        this.state = {
            // 2025-06-22 修正: モード統合により単一の統合モードに変更
            mode: 'unified', // 統合モード（選択・作成・接続を統合）
            selectedElements: [],
            multiSelectedElements: [], // 複数選択用
            zoom: 1.0,
            forceEnabled: true, // 常にON
            isDragging: false,
            theme: 'light', // デフォルトテーマ
            // 2025-07-06 追加: Shift+クリック機能の状態
            isShiftPressed: false
        };
        
        // ファイル読み込み状態フラグ
        this.isLoadingFile = false;
        
        // 変更フラグ
        this.hasUnsavedChanges = false;
        
        // 履歴管理
        this.history = [];
        this.redoStack = [];
        this.maxHistorySize = 50;
        
        // D3.jsコンポーネントの初期化
        this.initializeD3Components();
        this.setupEventListeners();
        
        // 2025-07-06 追加: 自動保存データの復元、なければサンプルデータ作成
        if (!this.loadAutoSave()) {
            this.createSampleData();
        }
        
        // 初期レンダリング（エラーハンドリング付き）
        try {
            this.render();
            console.log('D3WordMapEditor初期化完了');
        } catch (error) {
            console.error('初期レンダリングエラー:', error);
            throw new Error('D3WordMapEditorの初期化に失敗しました: ' + error.message);
        }
    }

    /**
     * D3.jsコンポーネント初期化
     */
    initializeD3Components() {
        console.log('D3.jsコンポーネント初期化開始');
        
        // ズーム動作の設定
        this.zoom = d3.zoom()
            .scaleExtent([CONFIG.CANVAS.MIN_ZOOM, CONFIG.CANVAS.MAX_ZOOM])
            .filter(event => {
                // ダブルクリックによるズームを無効化（ノード作成を優先）
                if (event.type === 'dblclick') return false;
                return (!event.ctrlKey || event.type === 'wheel') && !event.button;
            })
            .on('zoom', (event) => {
                this.viewport.attr('transform', event.transform);
                this.state.zoom = event.transform.k;
                this.updateZoomDisplay();
            });
        
        this.svg.call(this.zoom);
        
        // 2025-06-22 追加: 統合モード用の背景クリック処理
        this.setupUnifiedClickHandlers();
        
        // フォースシミュレーション設定
        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id)
                .distance(CONFIG.FORCE.LINK_DISTANCE)
                .strength(CONFIG.FORCE.LINK_STRENGTH))
            .force('charge', d3.forceManyBody()
                .strength(CONFIG.FORCE.CHARGE_STRENGTH))
            .force('center', d3.forceCenter(CONFIG.CANVAS.WIDTH / 2, CONFIG.CANVAS.HEIGHT / 2)
                .strength(CONFIG.FORCE.CENTER_STRENGTH))
            .force('collision', d3.forceCollide()
                .radius(CONFIG.FORCE.COLLISION_RADIUS))
            .alphaMin(CONFIG.FORCE.ALPHA_MIN)
            .alphaDecay(CONFIG.FORCE.ALPHA_DECAY)
            .velocityDecay(CONFIG.FORCE.VELOCITY_DECAY)
            .on('tick', () => this.onSimulationTick());
        
        // ドラッグ動作の設定
        this.drag = d3.drag()
            .on('start', (event, d) => this.onDragStart(event, d))
            .on('drag', (event, d) => this.onDragMove(event, d))
            .on('end', (event, d) => this.onDragEnd(event, d));
        
        console.log('D3.jsコンポーネント初期化完了');
    }

    /**
     * 統合モード用クリックハンドラ設定
     */
    setupUnifiedClickHandlers() {
        // 2025-06-22 修正: 統合モード用の背景クリック処理設定
        console.log('統合モード用クリックハンドラ設定');
    }

    /**
     * 基本イベントリスナー設定
     */
    setupEventListeners() {
        console.log('イベントリスナー設定開始');
        
        // ウィンドウリサイズ対応
        window.addEventListener('resize', () => {
            this.updateCanvasSize();
        });
        
        // SVGクリック・ダブルクリックイベント
        this.svg.on('click', (event) => this.handleCanvasClick(event));
        this.svg.on('dblclick', (event) => this.handleCanvasDoubleClick(event));
        
        // マウス位置追跡
        this.svg.on('mousemove', (event) => {
            const [x, y] = d3.pointer(event);
            this.updateMousePosition(Math.round(x), Math.round(y));
        });
        
        // ツールボタン
        document.getElementById('selectTool')?.addEventListener('click', () => this.setMode('select'));
        document.getElementById('createTool')?.addEventListener('click', () => this.setMode('create'));
        document.getElementById('linkTool')?.addEventListener('click', () => this.setMode('link'));
        
        // ヘッダーボタン
        document.getElementById('saveBtn')?.addEventListener('click', () => this.saveData());
        document.getElementById('loadBtn')?.addEventListener('click', () => this.loadData());
        document.getElementById('exportBtn')?.addEventListener('click', () => this.exportData());
        document.getElementById('resetLayoutBtn')?.addEventListener('click', () => this.resetLayout());
        
        // ズーム・ビューコントロール
        document.getElementById('zoomInBtn')?.addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn')?.addEventListener('click', () => this.zoomOut());
        document.getElementById('centerBtn')?.addEventListener('click', () => this.centerView());
        document.getElementById('fitBtn')?.addEventListener('click', () => this.fitToContent());
        
        
        // ヘルプ
        document.getElementById('helpBtn')?.addEventListener('click', () => this.showKeyboardHelp());
        
        // クリアボタン
        document.getElementById('clearBtn')?.addEventListener('click', () => this.showClearModal());
        
        // キーボードイベント
        this.setupKeyboardEvents();
        
        console.log('イベントリスナー設定完了');
    }

    /**
     * キーボードイベント設定
     */
    setupKeyboardEvents() {
        document.addEventListener('keydown', (event) => {
            // 2025-07-06 追加: Shiftキー状態の追跡
            if (event.key === 'Shift') {
                this.state.isShiftPressed = true;
                console.log('[DEBUG] Shiftキー押下');
            }
            
            // Ctrl/Cmdキーとの組み合わせ
            if (event.ctrlKey || event.metaKey) {
                switch (event.code) {
                    case CONFIG.SHORTCUTS.SAVE:
                        event.preventDefault();
                        this.saveData();
                        break;
                    case CONFIG.SHORTCUTS.LOAD:
                        event.preventDefault();
                        this.loadData();
                        break;
                    case CONFIG.SHORTCUTS.ZOOM_IN:
                        event.preventDefault();
                        this.zoomIn();
                        break;
                    case CONFIG.SHORTCUTS.ZOOM_OUT:
                        event.preventDefault();
                        this.zoomOut();
                        break;
                }
                return;
            }
            
            // 単独キー
            switch (event.code) {
                case CONFIG.SHORTCUTS.SELECT_MODE:
                    this.setMode('select');
                    break;
                case CONFIG.SHORTCUTS.CREATE_MODE:
                    this.setMode('create');
                    break;
                case CONFIG.SHORTCUTS.LINK_MODE:
                    this.setMode('link');
                    break;
                case CONFIG.SHORTCUTS.DELETE:
                    this.deleteSelected();
                    break;
                case CONFIG.SHORTCUTS.ESCAPE:
                    this.clearSelection();
                    this.setMode('select');
                    break;
                case CONFIG.SHORTCUTS.FIT_VIEW:
                    this.fitToContent();
                    break;
                case CONFIG.SHORTCUTS.RESET_LAYOUT:
                    this.resetLayout();
                    break;
                case CONFIG.SHORTCUTS.HELP:
                    this.showKeyboardHelp();
                    break;
            }
        });
        
        // 2025-07-06 追加: keyupイベント処理
        document.addEventListener('keyup', (event) => {
            if (event.key === 'Shift') {
                this.state.isShiftPressed = false;
                console.log('[DEBUG] Shiftキー離上');
            }
        });
        
    }

    /**
     * モード設定
     */
    setMode(mode) {
        this.state.mode = mode;
        
        // リンク作成状態をリセット
        this.resetLinkingState();
        
        // ツールボタンの状態更新
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(mode + 'Tool')?.classList.add('active');
        
        // ステータス更新
        const modeNames = {
            select: '選択モード',
            create: '作成モード',
            link: '接続モード'
        };
        const statusElement = document.getElementById('mode');
        if (statusElement) {
            statusElement.textContent = modeNames[mode] || mode;
        }
        
        // カーソル変更
        let cursor = 'grab';
        if (mode === 'create') cursor = 'crosshair';
        if (mode === 'link') cursor = 'pointer';
        this.svg.style('cursor', cursor);
        
        if (this.debugModule) {
            this.debugModule.logEvent('info', `モード変更: ${mode}`);
        }
    }

    /**
     * レンダリング
     */
    render() {
        const startTime = performance.now();
        
        // デバッグログ
        if (this.debugModule) {
            this.debugModule.logEvent('debug', 'レンダリング開始', {
                nodes: this.data.nodes.length,
                links: this.data.links.length
            });
        }
        
        this.renderLinks();
        this.renderNodes();
        this.updateSimulation();
        this.updateCounts();
        
        // 2025-06-22 修正: レンダリング後に選択状態でない要素のスタイルを確実に初期化
        this.resetNonSelectedElementStyles();
        
        // 2025-06-21 修正: レンダリング後に複数選択ハイライトを復元
        if (this.state.multiSelectedElements.length > 0) {
            // 少し遅延してハイライトを適用（DOMの更新後）
            setTimeout(() => {
                this.updateMultiSelectHighlight();
            }, 0);
        }
        
        const endTime = performance.now();
        console.log(`レンダリング完了 (${(endTime - startTime).toFixed(2)}ms)`);
        
        // デバッグログ
        if (this.debugModule) {
            this.debugModule.logEvent('debug', 'レンダリング完了', {
                duration: endTime - startTime
            });
        }
    }

    /**
     * ノードをレンダリング
     */
    renderNodes() {
        const nodeData = this.data.nodes;
        
        // D3.jsデータバインディング
        const nodes = this.nodesGroup.selectAll('.node')
            .data(nodeData, d => d.id);
        
        // 新規ノード作成
        const nodeEnter = nodes.enter()
            .append('g')
            .attr('class', 'node')
            .attr('data-node-id', d => d.id)
            .call(this.drag);
        
        // ノード円を追加
        nodeEnter.append('circle')
            .attr('class', 'node-circle')
            .attr('r', d => d.style.radius)
            .attr('fill', d => d.style.color)
            .attr('stroke', CONFIG.NODE.STROKE_COLOR)
            .attr('stroke-width', CONFIG.NODE.STROKE_WIDTH);
        
        // ノードテキストを追加
        nodeEnter.append('text')
            .attr('class', 'node-text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .text(d => d.label)
            .style('font-size', `${CONFIG.NODE.FONT_SIZE}px`)
            .style('fill', CONFIG.NODE.FONT_COLOR)
            .style('pointer-events', 'none');
        
        // 2025-06-22 修正: 統合モードのノードクリック処理
        nodeEnter.on('click', (event, d) => {
            event.stopPropagation();
            this.handleUnifiedNodeClick(event, d);
        });
        
        // 既存ノード更新
        const mergedNodes = nodes.merge(nodeEnter)
            .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);
        
        // 2025-06-22 修正: 既存ノードのcircle属性を更新
        mergedNodes.select('circle')
            .attr('r', d => d.style.radius)
            .attr('fill', d => d.style.color);
        
        // 2025-06-22 修正: 既存ノードのテキストも更新（ラベル変更の反映）
        mergedNodes.select('.node-text')
            .text(d => d.label);
        
        console.log(`[DEBUG] renderNodes完了: ${nodeData.length}個のノードを描画`);
        nodeData.forEach(node => {
            console.log(`[DEBUG] ノード ${node.id}: ラベル="${node.label}"`);
        });
        
        // 削除されたノード
        nodes.exit().remove();
        
        // ノード更新時にリンクも再計算（矢印位置調整のため）
        this.updateLinkPositions();
    }

    /**
     * リンク位置の更新のみ
     */
    updateLinkPositions() {
        this.linksGroup.selectAll('.link-group').selectAll('line')
            .attr('x1', d => d.source.x || 0)
            .attr('y1', d => d.source.y || 0)
            .attr('x2', d => d.target.x || 0)
            .attr('y2', d => d.target.y || 0);
    }

    /**
     * リンクをレンダリング
     */
    renderLinks() {
        const linkData = this.data.links;
        const self = this; // thisの参照を保存
        
        // D3.jsデータバインディング
        const links = this.linksGroup.selectAll('.link-group')
            .data(linkData, d => d.id);
        
        // 新規リンク作成
        const linkEnter = links.enter()
            .append('g')
            .attr('class', 'link-group')
            .attr('data-link-id', d => d.id);
        
        // ヒットエリア（クリック判定用）
        linkEnter.append('line')
            .attr('class', 'link-hitarea')
            .attr('stroke', 'transparent')
            .attr('stroke-width', CONFIG.LINK.HITAREA_WIDTH)
            .style('cursor', 'pointer');
        
        // 表示用リンク
        linkEnter.append('line')
            .attr('class', 'link')
            .attr('stroke', d => d.style.color)
            .attr('stroke-width', d => d.style.width)
            .attr('stroke-dasharray', d => self.getLinkStrokeDashArray(d))
            .style('pointer-events', 'none')
            .style('stroke', d => d.style.color) // CSSの上書きを防ぐため、styleでも色を設定
            .style('stroke-width', d => d.style.width + 'px'); // CSSの上書きを防ぐため、styleでも太さを設定

        // リンク名表示用テキスト
        linkEnter.append('text')
            .attr('class', 'link-name')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-family', CONFIG.NODE.FONT_FAMILY)
            .style('font-size', '10px')
            .style('fill', this.state.theme === 'dark' ? '#e2e8f0' : '#333') // 2025-06-22 修正: テーマに応じた色を統一
            .style('background', 'rgba(255,255,255,0.8)')
            .style('pointer-events', 'none')
            .text(d => d.name || '');
        
        // イベントリスナー追加
        // 2025-06-22 修正: 統合モードのリンククリック処理
        linkEnter.on('click', (event, d) => {
            event.preventDefault();
            event.stopPropagation();
            self.handleUnifiedLinkClick(event, d);
        });
        
        // 既存リンク更新
        const mergedLinks = links.merge(linkEnter);
        
        // 2025-06-22 修正: 既存リンクも統合モード処理に変更
        mergedLinks.on('click', (event, d) => {
            event.preventDefault();
            event.stopPropagation();
            self.handleUnifiedLinkClick(event, d);
        });
        
        // 位置更新
        mergedLinks.selectAll('line')
            .attr('x1', d => d.source.x || 0)
            .attr('y1', d => d.source.y || 0)
            .attr('x2', d => d.target.x || 0)
            .attr('y2', d => d.target.y || 0);

        // リンク名の位置更新（線の中央）
        mergedLinks.select('.link-name')
            .attr('x', d => ((d.source.x || 0) + (d.target.x || 0)) / 2)
            .attr('y', d => ((d.source.y || 0) + (d.target.y || 0)) / 2)
            .text(d => d.name || '')
            .style('fill', this.state.theme === 'dark' ? '#e2e8f0' : '#333'); // 2025-06-22 修正: 色を統一
        
        // スタイル更新（強化版）
        mergedLinks.select('.link')
            .attr('stroke', d => {
                const color = d.style.color;
                console.log(`リンク ${d.id} の色設定: ${color}`);
                return color;
            })
            .attr('stroke-width', d => {
                const width = d.style.width;
                console.log(`リンク ${d.id} の太さ設定: ${width}`);
                return width;
            })
            .attr('stroke-dasharray', d => self.getLinkStrokeDashArray(d))
            .style('stroke', d => d.style.color) // CSSの上書きを防ぐため、styleでも色を設定
            .style('stroke-width', d => d.style.width + 'px') // CSSの上書きを防ぐため、styleでも太さを設定
            .each(function(d) {
                // 実際に設定された値を確認
                const element = d3.select(this);
                const actualStroke = element.attr('stroke');
                const actualWidth = element.attr('stroke-width');
                const actualStyleStroke = element.style('stroke');
                const actualStyleWidth = element.style('stroke-width');
                console.log(`✓ リンク ${d.id} DOM更新確認:`, {
                    expectedColor: d.style.color,
                    attrColor: actualStroke,
                    styleColor: actualStyleStroke,
                    expectedWidth: d.style.width,
                    attrWidth: actualWidth,
                    styleWidth: actualStyleWidth,
                    element: this
                });
            });
        
        // 削除されたリンク
        links.exit().remove();
    }



    /**
     * リンク線スタイル取得
     */
    getLinkStrokeDashArray(linkData) {
        const lineStyle = linkData.style.lineStyle || CONFIG.LINK.DEFAULT_LINE_STYLE;
        switch (lineStyle) {
            case 'dashed':
                return '5,5';
            case 'dotted':
                return '1,3';
            case 'solid':
            default:
                return null;
        }
    }

    /**
     * 要素選択
     */
    selectElement(elementId, elementType) {
        console.log(`[DEBUG] selectElement開始: ${elementType} ${elementId}`);
        
        try {
            // 要素が存在するかチェック
            if (elementType === 'node') {
                const node = this.data.nodes.find(n => n.id === elementId);
                if (!node) {
                    console.error(`ノード ${elementId} が見つかりません`);
                    return;
                }
            } else if (elementType === 'link') {
                const link = this.data.links.find(l => l.id === elementId);
                if (!link) {
                    console.error(`リンク ${elementId} が見つかりません`);
                    return;
                }
            }
            
            // 選択解除
            this.clearSelection();
            
            // 新しい選択
            this.state.selectedElements = [{ id: elementId, type: elementType }];
            
            // 2025-06-22 修正: ハイライト表示も統一的に管理
            try {
                this.updateMultiSelectHighlight();
            } catch (error) {
                console.error('updateMultiSelectHighlightエラー:', error);
            }
            
            // プロパティパネル更新
            try {
                if (typeof this.updatePropertiesPanel === 'function') {
                    this.updatePropertiesPanel();
                } else {
                    console.warn('updatePropertiesPanelが未定義です');
                }
            } catch (error) {
                console.error('updatePropertiesPanelエラー:', error);
            }
            
            // デバッグログ
            if (this.debugModule) {
                try {
                    this.debugModule.logEvent('info', '要素選択', {
                        elementId,
                        elementType
                    });
                } catch (error) {
                    console.error('デバッグログエラー:', error);
                }
            }
            
            console.log(`[DEBUG] 要素選択完了: ${elementType} ${elementId}`);
        } catch (error) {
            console.error('selectElementエラー:', error);
        }
    }

    /**
     * 選択解除
     */
    clearSelection() {
        // 2025-06-22 修正: 選択解除前に編集中の入力フィールドをblurして変更を保存
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.id === 'nodeText' || 
            activeElement.id === 'nodeDescription' || 
            activeElement.id === 'linkName'
        )) {
            activeElement.blur();
        }
        
        this.state.selectedElements = [];
        this.state.multiSelectedElements = [];
        
        // DOM要素からクラス削除
        document.querySelectorAll('.selected').forEach(element => {
            element.classList.remove('selected');
        });
        
        // 2025-06-22 修正: リンクハイライトを確実にクリア
        this.linksGroup.selectAll('[data-link-id]')
            .classed('multi-selected', false)
            .style('stroke-width', null)
            .style('filter', null)
            .style('stroke', null);
        
        // ノードハイライトもクリア
        this.nodesGroup.selectAll('circle')
            .classed('multi-selected', false)
            .style('stroke', null)
            .style('stroke-width', null);
        
        // 複数選択ハイライトをクリア
        this.updateMultiSelectHighlight();
        
        // プロパティパネル更新
        if (typeof this.updatePropertiesPanel === 'function') {
            this.updatePropertiesPanel();
        }
    }

    /**
     * 選択要素削除（複数選択対応）
     */
    deleteSelected() {
        const elementsToDelete = [];
        
        // 通常の選択要素を追加
        elementsToDelete.push(...this.state.selectedElements);
        
        // 複数選択要素を追加
        this.state.multiSelectedElements.forEach(key => {
            const [type, id] = key.split(':');
            elementsToDelete.push({id, type});
        });
        
        if (elementsToDelete.length === 0) return;
        
        // 重複を除去
        const uniqueElements = elementsToDelete.filter((elem, index, self) => 
            index === self.findIndex(e => e.id === elem.id && e.type === elem.type)
        );
        
        uniqueElements.forEach(element => {
            if (element.type === 'node') {
                // ノード削除（関連リンクも削除）
                this.data.nodes = this.data.nodes.filter(n => n.id !== element.id);
                this.data.links = this.data.links.filter(l => 
                    l.source.id !== element.id && l.target.id !== element.id);
            } else if (element.type === 'link') {
                // リンク削除
                this.data.links = this.data.links.filter(l => l.id !== element.id);
            }
        });
        
        this.clearSelection();
        this.render();
        this.markAsChanged();
        
        console.log(`${uniqueElements.length}個の要素を削除しました`);
    }

    /**
     * サンプルデータ作成
     */
    createSampleData() {
        // 既にデータがある場合はスキップ
        if (this.data.nodes.length > 0) return;
        
        // サンプルノード作成
        const sampleNodes = [
            { 
                id: 'node1', 
                label: 'アイデア', 
                x: 200, 
                y: 150, 
                style: { color: '#333333', radius: 30 }, // 2025-06-22 修正: カテゴリなしは黒色
                description: '新しいアイデアを生み出す起点'
            },
            { 
                id: 'node2', 
                label: '計画', 
                x: 400, 
                y: 150, 
                style: { color: '#333333', radius: 30 }, // 2025-06-22 修正: カテゴリなしは黒色
                description: 'アイデアを具体的な計画に落とし込む'
            },
            { 
                id: 'node3', 
                label: '実行', 
                x: 600, 
                y: 150, 
                style: { color: '#333333', radius: 30 }, // 2025-06-22 修正: カテゴリなしは黒色
                description: '計画を実際に実行に移す'
            },
            { 
                id: 'node4', 
                label: '評価', 
                x: 400, 
                y: 300, 
                style: { color: '#333333', radius: 30 }, // 2025-06-22 修正: カテゴリなしは黒色
                description: '実行結果を評価し次に活かす'
            }
        ];
        
        // サンプルリンク作成
        const sampleLinks = [
            { 
                id: 'link1', 
                source: sampleNodes[0], 
                target: sampleNodes[1],
                style: { color: CONFIG.LINK.DEFAULT_COLOR, width: CONFIG.LINK.DEFAULT_WIDTH, lineStyle: CONFIG.LINK.DEFAULT_LINE_STYLE },
                label: ''
            },
            { 
                id: 'link2', 
                source: sampleNodes[1], 
                target: sampleNodes[2],
                style: { color: CONFIG.LINK.DEFAULT_COLOR, width: CONFIG.LINK.DEFAULT_WIDTH, lineStyle: CONFIG.LINK.DEFAULT_LINE_STYLE },
                label: ''
            },
            { 
                id: 'link3', 
                source: sampleNodes[2], 
                target: sampleNodes[3],
                style: { color: CONFIG.LINK.DEFAULT_COLOR, width: CONFIG.LINK.DEFAULT_WIDTH, lineStyle: CONFIG.LINK.DEFAULT_LINE_STYLE },
                label: ''
            }
        ];
        
        this.data.nodes = sampleNodes;
        this.data.links = sampleLinks;
        this.data.nextNodeId = 5;
        this.data.nextLinkId = 4;
        
        console.log('サンプルデータを作成しました');
    }

    /**
     * シミュレーションティック処理
     */
    onSimulationTick() {
        // ノード位置更新
        this.nodesGroup.selectAll('.node')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
        
        // リンク位置更新
        this.linksGroup.selectAll('.link-group')
            .selectAll('line')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        // 2025-06-21 修正: リンク名の位置を更新（ノード移動時に追従）
        this.linksGroup.selectAll('.link-group')
            .selectAll('.link-name')
            .attr('x', d => (d.source.x + d.target.x) / 2)
            .attr('y', d => (d.source.y + d.target.y) / 2);
    }

    /**
     * ドラッグ開始
     */
    onDragStart(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        
        if (this.debugModule) {
            this.debugModule.logEvent('debug', 'ドラッグ開始', { nodeId: d.id });
        }
    }

    /**
     * ドラッグ中
     */
    onDragMove(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    /**
     * ドラッグ終了
     */
    onDragEnd(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        if (!d.pinned) {
            d.fx = null;
            d.fy = null;
        }
        
        if (this.debugModule) {
            this.debugModule.logEvent('debug', 'ドラッグ終了', { nodeId: d.id });
        }
    }

    /**
     * キャンバスクリック処理
     */
    handleCanvasClick(event) {
        // 2025-06-22 修正: 統合モード - 空白クリックで全選択解除
        if (event.target === this.svg.node() || 
            event.target.tagName === 'rect' ||
            event.target.classList.contains('grid-background')) {
            
            console.log('空白部分をクリック - 全選択解除');
            this.clearSelection();
            this.state.multiSelectedElements = [];
            this.updateMultiSelectHighlight();
            this.updatePropertiesPanel?.();
        }
    }

    /**
     * キャンバスダブルクリック処理
     */
    handleCanvasDoubleClick(event) {
        // 2025-06-22 修正: 統合モード - 空白ダブルクリックでノード作成
        if (event.target === this.svg.node() || 
            event.target.tagName === 'rect' ||
            event.target.classList.contains('grid-background')) {
            
            const [x, y] = d3.pointer(event, this.viewport.node());
            console.log('空白部分をダブルクリック - ノード作成:', x, y);
            this.createNodeAtCoordinates(x, y);
        }
    }

    /**
     * 座標指定でノード作成
     */
    createNodeAtCoordinates(x, y) {
        // 2025-06-22 修正: 新規ノードはカテゴリなし（黒色）で作成
        const newNode = {
            id: `node${this.data.nextNodeId++}`,
            label: `ノード${this.data.nextNodeId - 1}`,
            description: '',
            x: x,
            y: y,
            fx: null,
            fy: null,
            style: {
                color: '#333333', // カテゴリなしノードは黒色
                radius: CONFIG.NODE.DEFAULT_RADIUS
            },
            pinned: false,
            category: '', // カテゴリを追加
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        this.data.nodes.push(newNode);
        
        // レンダリング（エラーハンドリング付き）
        try {
            this.render();
            this.markAsChanged?.();
            this.autoSave(); // 2025-07-06 追加: 自動保存
            
            // 2025-07-06 追加: 新規作成したノードを自動選択
            setTimeout(() => {
                this.selectElement(newNode.id, 'node');
            }, 100);
            
            console.log(`ノードを作成: ${newNode.label} (${x}, ${y})`);
        } catch (error) {
            console.error('ノード作成後のレンダリングエラー:', error);
            // ノードを削除してロールバック
            this.data.nodes.pop();
            throw error;
        }
        return newNode;
    }

    /**
     * 2つのノード間にリンクを直接作成（デバッグ用）
     */
    createLinkBetweenNodes(sourceId, targetId) {
        const sourceNode = this.data.nodes.find(n => n.id === sourceId);
        const targetNode = this.data.nodes.find(n => n.id === targetId);
        
        if (!sourceNode || !targetNode) {
            console.warn('ソースまたはターゲットノードが見つかりません');
            return null;
        }
        
        // 既存リンクチェック
        const existingLink = this.data.links.find(l => 
            (l.source.id === sourceId && l.target.id === targetId) ||
            (l.source.id === targetId && l.target.id === sourceId)
        );
        
        if (existingLink) {
            console.log('既にリンクが存在します');
            return existingLink;
        }
        
        // 新しいリンクを作成
        const newLink = {
            id: `link${this.data.nextLinkId++}`,
            source: sourceNode,
            target: targetNode,
            style: {
                color: CONFIG.LINK.DEFAULT_COLOR,
                width: CONFIG.LINK.DEFAULT_WIDTH,
                lineStyle: CONFIG.LINK.DEFAULT_LINE_STYLE
            },
            direction: CONFIG.LINK.DEFAULT_DIRECTION,
            name: '', // 2025-06-22 修正: labelを削除してnameのみ使用
            category: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        this.data.links.push(newLink);
        this.render();
        this.markAsChanged?.();
        this.autoSave(); // 2025-07-06 追加: 自動保存
        
        console.log(`リンクを作成: ${sourceNode.label} → ${targetNode.label}`);
        return newLink;
    }

    /**
     * ノード削除（デバッグ用）
     */
    removeNode(nodeId) {
        const nodeIndex = this.data.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex === -1) {
            console.warn(`ノード ${nodeId} が見つかりません`);
            return false;
        }
        
        // 関連リンクも削除
        this.data.links = this.data.links.filter(l => 
            l.source.id !== nodeId && l.target.id !== nodeId
        );
        
        // ノード削除
        this.data.nodes.splice(nodeIndex, 1);
        this.render();
        this.markAsChanged?.();
        
        console.log(`ノード ${nodeId} を削除しました`);
        return true;
    }

    /**
     * リンク削除（デバッグ用）
     */
    removeLink(linkId) {
        const linkIndex = this.data.links.findIndex(l => l.id === linkId);
        if (linkIndex === -1) {
            console.warn(`リンク ${linkId} が見つかりません`);
            return false;
        }
        
        this.data.links.splice(linkIndex, 1);
        this.render();
        this.markAsChanged?.();
        
        console.log(`リンク ${linkId} を削除しました`);
        return true;
    }

    /**
     * リンクモードでのノードクリック処理
     */
    handleNodeClickInLinkMode(node) {
        if (!this.state.linkingMode || !this.state.linkingSource) {
            // 最初のノードを選択
            this.state.linkingMode = true;
            this.state.linkingSource = node;
            
            // 視覚的フィードバック
            d3.select(`[data-node-id="${node.id}"]`)
                .classed('linking-source', true);
            
            console.log(`リンク作成開始: ${node.label}`);
        } else {
            // 2番目のノードを選択してリンク作成
            const sourceNode = this.state.linkingSource;
            const targetNode = node;
            
            // 自己リンクは作成しない
            if (sourceNode.id === targetNode.id) {
                console.log('自己リンクは作成できません');
                this.resetLinkingState();
                return;
            }
            
            // 既存リンクのチェック
            const existingLink = this.data.links.find(l => 
                (l.source.id === sourceNode.id && l.target.id === targetNode.id) ||
                (l.source.id === targetNode.id && l.target.id === sourceNode.id)
            );
            
            if (existingLink) {
                console.log('既にリンクが存在します');
                this.resetLinkingState();
                return;
            }
            
            // 新しいリンクを作成
            const newLink = {
                id: `link${this.data.nextLinkId++}`,
                source: sourceNode,
                target: targetNode,
                style: {
                    color: CONFIG.LINK.DEFAULT_COLOR,
                    width: CONFIG.LINK.DEFAULT_WIDTH,
                    lineStyle: CONFIG.LINK.DEFAULT_LINE_STYLE
                },
                direction: CONFIG.LINK.DEFAULT_DIRECTION,
                label: '',
                name: '', // リンク名を追加
                category: '', // カテゴリを追加
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            this.data.links.push(newLink);
            this.render();
            this.markAsChanged?.();
            
            console.log(`リンクを作成: ${sourceNode.label} → ${targetNode.label}`);
            
            // リンク作成状態をリセット
            this.resetLinkingState();
        }
    }
    
    /**
     * リンク作成状態のリセット
     */
    resetLinkingState() {
        this.state.linkingMode = false;
        this.state.linkingSource = null;
        
        // 視覚的フィードバックを削除
        d3.selectAll('.linking-source').classed('linking-source', false);
    }

    /**
     * シミュレーション更新
     */
    updateSimulation() {
        if (!this.state.forceEnabled) return;
        
        this.simulation
            .nodes(this.data.nodes)
            .force('link')
            .links(this.data.links);
    }

    /**
     * 表示制御
     */
    zoomIn() {
        this.svg.transition().call(
            this.zoom.scaleBy,
            1.5
        );
    }

    zoomOut() {
        this.svg.transition().call(
            this.zoom.scaleBy,
            1 / 1.5
        );
    }

    /**
     * 中央表示
     */
    centerView() {
        const svgRect = this.svg.node().getBoundingClientRect();
        const centerX = svgRect.width / 2;
        const centerY = svgRect.height / 2;
        
        this.svg.transition()
            .duration(500)
            .call(
                this.zoom.transform,
                d3.zoomIdentity.translate(centerX, centerY)
            );
    }

    /**
     * 全体表示
     */
    fitToContent() {
        // 全ノードの範囲を計算
        if (this.data.nodes.length === 0) {
            this.centerView();
            return;
        }
        
        const padding = 100; // パディング
        const svgRect = this.svg.node().getBoundingClientRect();
        
        const bounds = this.data.nodes.reduce((acc, node) => {
            const nodeX = node.x || 0;
            const nodeY = node.y || 0;
            const radius = node.style?.radius || CONFIG.NODE.DEFAULT_RADIUS;
            
            return {
                minX: Math.min(acc.minX, nodeX - radius),
                maxX: Math.max(acc.maxX, nodeX + radius),
                minY: Math.min(acc.minY, nodeY - radius),
                maxY: Math.max(acc.maxY, nodeY + radius)
            };
        }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
        
        // 範囲が無効な場合は中央表示
        if (!isFinite(bounds.minX) || !isFinite(bounds.maxX) || 
            !isFinite(bounds.minY) || !isFinite(bounds.maxY)) {
            this.centerView();
            return;
        }
        
        const contentWidth = bounds.maxX - bounds.minX + 2 * padding;
        const contentHeight = bounds.maxY - bounds.minY + 2 * padding;
        const contentCenterX = (bounds.minX + bounds.maxX) / 2;
        const contentCenterY = (bounds.minY + bounds.maxY) / 2;
        
        // スケール計算（最小値と最大値を制限）
        const scaleX = svgRect.width / contentWidth;
        const scaleY = svgRect.height / contentHeight;
        const scale = Math.min(scaleX, scaleY, CONFIG.CANVAS.MAX_ZOOM);
        const finalScale = Math.max(scale, CONFIG.CANVAS.MIN_ZOOM);
        
        // 中央配置計算
        const translateX = svgRect.width / 2 - contentCenterX * finalScale;
        const translateY = svgRect.height / 2 - contentCenterY * finalScale;
        
        this.svg.transition()
            .duration(750)
            .call(
                this.zoom.transform,
                d3.zoomIdentity.translate(translateX, translateY).scale(finalScale)
            );
            
        if (this.debugModule) {
            this.debugModule.logEvent('info', '全体表示実行', {
                bounds,
                scale: finalScale,
                translate: [translateX, translateY]
            });
        }
    }


    /**
     * 履歴に状態を保存
     */
    saveToHistory(actionType = 'unknown') {
        const currentState = {
            timestamp: Date.now(),
            actionType: actionType,
            data: {
                nodes: JSON.parse(JSON.stringify(this.data.nodes)),
                links: JSON.parse(JSON.stringify(this.data.links)),
                nextNodeId: this.data.nextNodeId,
                nextLinkId: this.data.nextLinkId
            }
        };
        
        this.history.push(currentState);
        
        // 履歴サイズ制限
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
        
        // Redo履歴をクリア（新しいアクションがあったため）
        this.redoStack = [];
        
        // ボタン状態更新
        this.updateHistoryButtons();
        
        if (this.debugModule) {
            this.debugModule.logEvent('debug', '履歴保存', {
                actionType,
                historyLength: this.history.length
            });
        }
    }

    /**
     * 戻す操作
     */
    undo() {
        if (this.history.length === 0) {
            console.log('戻す操作がありません');
            return false;
        }
        
        // 現在の状態をRedoスタックに保存
        const currentState = {
            timestamp: Date.now(),
            actionType: 'redo_point',
            data: {
                nodes: JSON.parse(JSON.stringify(this.data.nodes)),
                links: JSON.parse(JSON.stringify(this.data.links)),
                nextNodeId: this.data.nextNodeId,
                nextLinkId: this.data.nextLinkId
            }
        };
        this.redoStack.push(currentState);
        
        // 履歴から前の状態を復元
        const previousState = this.history.pop();
        this.restoreState(previousState);
        
        // ボタン状態更新
        this.updateHistoryButtons();
        
        if (this.debugModule) {
            this.debugModule.logEvent('info', '戻す操作実行', {
                actionType: previousState.actionType,
                historyLength: this.history.length,
                redoLength: this.redoStack.length
            });
        }
        
        console.log(`戻す操作完了: ${previousState.actionType}`);
        return true;
    }

    /**
     * 進む操作
     */
    redo() {
        if (this.redoStack.length === 0) {
            console.log('やり直す操作がありません');
            return false;
        }
        
        // 現在の状態を履歴に保存
        this.saveToHistory('redo_restore');
        
        // Redoスタックから状態を復元
        const redoState = this.redoStack.pop();
        this.restoreState(redoState);
        
        // ボタン状態更新
        this.updateHistoryButtons();
        
        if (this.debugModule) {
            this.debugModule.logEvent('info', 'やり直し操作実行', {
                actionType: redoState.actionType,
                historyLength: this.history.length,
                redoLength: this.redoStack.length
            });
        }
        
        console.log(`やり直し操作完了: ${redoState.actionType}`);
        return true;
    }

    /**
     * 状態復元
     */
    restoreState(state) {
        if (!state || !state.data) {
            console.error('無効な状態データ');
            return;
        }
        
        // データ復元
        this.data.nodes = state.data.nodes.map(node => ({
            ...node,
            // D3フォースシミュレーションで使用されるプロパティを再設定
            vx: 0,
            vy: 0
        }));
        
        this.data.links = state.data.links.map(link => ({
            ...link,
            source: this.data.nodes.find(n => n.id === link.source.id || n.id === link.source),
            target: this.data.nodes.find(n => n.id === link.target.id || n.id === link.target)
        }));
        
        this.data.nextNodeId = state.data.nextNodeId;
        this.data.nextLinkId = state.data.nextLinkId;
        
        // 選択状態をクリア
        this.clearSelection();
        
        // 再レンダリング
        this.render();
        this.updateSimulation();
    }

    /**
     * 履歴ボタンの状態更新
     */
    updateHistoryButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        if (undoBtn) {
            if (this.history.length > 0) {
                undoBtn.classList.remove('disabled');
                undoBtn.style.opacity = '1';
                undoBtn.disabled = false;
            } else {
                undoBtn.classList.add('disabled');
                undoBtn.style.opacity = '0.5';
                undoBtn.disabled = true;
            }
        }
        
        if (redoBtn) {
            if (this.redoStack.length > 0) {
                redoBtn.classList.remove('disabled');
                redoBtn.style.opacity = '1';
                redoBtn.disabled = false;
            } else {
                redoBtn.classList.add('disabled');
                redoBtn.style.opacity = '0.5';
                redoBtn.disabled = true;
            }
        }
    }

    resetLayout() {
        this.data.nodes.forEach(node => {
            node.x = Math.random() * CONFIG.CANVAS.WIDTH;
            node.y = Math.random() * CONFIG.CANVAS.HEIGHT;
            node.fx = null;
            node.fy = null;
        });
        
        this.simulation.alpha(1).restart();
        this.render();
    }

    showKeyboardHelp() {
        const helpModal = document.getElementById('helpModal');
        if (helpModal) {
            helpModal.classList.remove('hidden');
        }
    }

    /**
     * カウンター更新
     */
    updateCounts() {
        const nodeCountElement = document.getElementById('nodeCount');
        const linkCountElement = document.getElementById('linkCount');
        
        if (nodeCountElement) {
            nodeCountElement.textContent = `ノード: ${this.data.nodes.length}`;
        }
        if (linkCountElement) {
            linkCountElement.textContent = `リンク: ${this.data.links.length}`;
        }
    }

    /**
     * ズーム表示更新
     */
    updateZoomDisplay() {
        const zoomPercent = Math.round(this.state.zoom * 100);
        const zoomElement = document.getElementById('zoomLevel');
        if (zoomElement) {
            zoomElement.textContent = `${zoomPercent}%`;
        }
    }

    /**
     * マウス位置表示更新
     */
    updateMousePosition(x, y) {
        const mousePosElement = document.getElementById('mousePos');
        if (mousePosElement) {
            mousePosElement.textContent = `座標: (${x}, ${y})`;
        }
    }

    /**
     * キャンバスサイズ更新
     */
    updateCanvasSize() {
        if (this.container) {
            const rect = this.container.getBoundingClientRect();
            this.svg
                .attr('width', rect.width)
                .attr('height', rect.height);
        }
    }

    /**
     * デバッグトグル（デバッグモジュールが利用可能な場合）
     */
    toggleDebug() {
        if (this.debugModule) {
            this.debugModule.toggle();
        } else {
            console.warn('デバッグモジュールが利用できません');
        }
    }

    /**
     * リンクの強制再作成（リンク編集反映問題の解決用）
     */
    forceRecreateLink(linkId) {
        const link = this.data.links.find(l => l.id === linkId);
        if (!link) {
            console.warn(`リンク ${linkId} がデータ内に見つかりません`);
            return;
        }

        // DOM要素の存在確認
        const linkGroupElement = d3.select(`[data-link-id="${linkId}"]`);
        
        if (!linkGroupElement.empty()) {
            // リンクの表示部分を更新
            const linkLine = linkGroupElement.select('.link');
            
            if (!linkLine.empty()) {
                linkLine
                    .attr('stroke', link.style.color)
                    .attr('stroke-width', link.style.width)
                    .attr('stroke-dasharray', this.getLinkStrokeDashArray(link))
                    .style('stroke', link.style.color) // CSSの上書きを防ぐため、styleでも色を設定
                    .style('stroke-width', link.style.width + 'px'); // CSSの上書きを防ぐため、styleでも太さを設定
                
                // 更新後の実際の値を確認
                const actualStroke = linkLine.attr('stroke');
                const actualWidth = linkLine.attr('stroke-width');
                const actualStyleStroke = linkLine.style('stroke');
                const actualStyleWidth = linkLine.style('stroke-width');
                
                console.log(`✓ リンク ${linkId} 視覚更新完了:`, {
                    expectedColor: link.style.color,
                    attrColor: actualStroke,
                    styleColor: actualStyleStroke,
                    expectedWidth: link.style.width,
                    attrWidth: actualWidth,
                    styleWidth: actualStyleWidth,
                    colorMatch: actualStroke === link.style.color,
                    widthMatch: actualWidth == link.style.width
                });
                
                // 強制的に再描画を促す
                linkLine.node().style.display = 'none';
                setTimeout(() => {
                    linkLine.node().style.display = '';
                }, 1);
                
            } else {
                console.warn(`リンク ${linkId} の .link 要素が見つかりません`);
                console.log('DOM構造確認:', linkGroupElement.node());
            }
        } else {
            // 要素が見つからない場合は全体を再レンダリング
            console.warn(`リンク ${linkId} のDOM要素が見つからないため、全体を再レンダリング`);
            this.renderLinks();
        }
        
        if (this.debugModule) {
            this.debugModule.logEvent('debug', 'リンク強制再作成', { 
                linkId, 
                updatedAttributes: link.style,
                timestamp: Date.now()
            });
        }
    }

    /**
     * フォース設定更新メソッド群
     */
    updateForceCenter(strength) {
        this.simulation.force('center').strength(strength);
        this.simulation.alpha(0.1).restart();
    }

    updateForceCharge(strength) {
        this.simulation.force('charge').strength(strength);
        this.simulation.alpha(0.1).restart();
    }

    updateLinkDistance(distance) {
        this.simulation.force('link').distance(distance);
        this.simulation.alpha(0.1).restart();
    }

    updateLinkStrength(strength) {
        this.simulation.force('link').strength(strength);
        this.simulation.alpha(0.1).restart();
    }

    /**
     * リンク属性の更新（包括的な属性更新関数）
     */
    updateLinkAttributes(linkId, attributes) {
        const link = this.data.links.find(l => l.id === linkId);
        if (!link) {
            console.warn(`リンク ${linkId} が見つかりません`);
            return false;
        }

        try {
            // 属性の更新
            if (attributes.color !== undefined) {
                link.style.color = attributes.color;
            }
            if (attributes.width !== undefined) {
                link.style.width = attributes.width;
            }
            if (attributes.lineStyle !== undefined) {
                link.style.lineStyle = attributes.lineStyle;
            }
            if (attributes.direction !== undefined) {
                link.direction = attributes.direction;
            }
            if (attributes.label !== undefined) {
                link.label = attributes.label;
            }
            if (attributes.name !== undefined) {
                link.name = attributes.name;
            }
            if (attributes.category !== undefined) {
                link.category = attributes.category;
                // カテゴリから色を自動適用
                const category = this.data.categories.find(cat => cat.id === attributes.category);
                if (category) {
                    link.style.color = category.color;
                }
            }

            // 更新日時の記録
            link.updatedAt = Date.now();

            // 視覚的更新の実行
            this.forceRecreateLink(linkId);
            
            // 変更フラグの設定
            if (typeof this.markAsChanged === 'function') {
                this.markAsChanged();
            }

            // デバッグログ
            if (this.debugModule) {
                this.debugModule.logEvent('info', 'リンク属性更新', {
                    linkId,
                    attributes,
                    updatedLink: link
                });
            }

            console.log(`リンク属性更新完了: ${linkId}`, attributes);
            return true;

        } catch (error) {
            console.error('リンク属性更新エラー:', error);
            if (this.debugModule) {
                this.debugModule.logError('LinkAttributeUpdateError', error, { linkId, attributes });
            }
            return false;
        }
    }

    // ========================================
    // カテゴリ管理機能
    // ========================================

    /**
     * カテゴリの作成
     */
    createCategory(name, color, type = 'node') {
        const categoryId = `cat${this.data.nextCategoryId}`;
        const category = {
            id: categoryId,
            name: name.substring(0, CONFIG.CATEGORIES.MAX_NAME_LENGTH),
            color: color,
            type: type // 'node' or 'link'
        };
        
        this.data.categories.push(category);
        this.data.nextCategoryId++;
        
        console.log('カテゴリ作成:', category);
        return category;
    }

    /**
     * カテゴリの取得
     */
    getCategories(type = null) {
        if (type) {
            return this.data.categories.filter(cat => cat.type === type);
        }
        return this.data.categories;
    }

    /**
     * カテゴリの削除
     */
    deleteCategory(categoryId) {
        const index = this.data.categories.findIndex(cat => cat.id === categoryId);
        if (index === -1) return false;

        // カテゴリを使用している要素から削除
        this.data.nodes.forEach(node => {
            if (node.category === categoryId) {
                delete node.category;
            }
        });
        this.data.links.forEach(link => {
            if (link.category === categoryId) {
                delete link.category;
            }
        });

        this.data.categories.splice(index, 1);
        this.render(); // 再描画
        return true;
    }

    // ========================================
    // テーマ管理機能
    // ========================================

    /**
     * テーマの切り替え
     */
    setTheme(themeName) {
        this.state.theme = themeName;
        const theme = CONFIG.THEMES[themeName.toUpperCase()];
        
        if (!theme) {
            console.warn('未知のテーマ:', themeName);
            return false;
        }

        // 2025-06-21 修正: テーマ切替時の視覚的変化を改善
        // 背景色の変更
        document.body.style.backgroundColor = theme.background;
        
        // キャンバスコンテナの背景色も変更
        const canvasContainer = document.querySelector('.canvas-container');
        if (canvasContainer) {
            canvasContainer.style.backgroundColor = theme.background;
        }
        
        // SVG自体の背景色を設定
        this.svg.style('background-color', theme.background);
        
        // SVGの背景とグリッドの更新
        this.svg.select('rect').attr('fill', `url(#grid-${themeName})`);
        
        // グリッドパターンの更新
        let gridPattern = this.svg.select(`#grid-${themeName}`);
        if (gridPattern.empty()) {
            gridPattern = this.svg.select('defs').append('pattern')
                .attr('id', `grid-${themeName}`)
                .attr('width', 20)
                .attr('height', 20)
                .attr('patternUnits', 'userSpaceOnUse');
            
            gridPattern.append('path')
                .attr('d', 'M 20 0 L 0 0 0 20')
                .attr('fill', 'none')
                .attr('stroke', theme.gridColor)
                .attr('stroke-width', 1)
                .attr('opacity', 0.5);
        }

        // 既存ノードのストロークとテキスト色を更新
        this.nodesGroup.selectAll('.node circle')
            .attr('stroke', theme.nodeStroke)
            .attr('stroke-width', 2);
            
        this.nodesGroup.selectAll('.node text')
            .attr('fill', theme.nodeFontColor);
            
        // リンク名のテキスト色も更新
        this.linksGroup.selectAll('.link-name')
            .attr('fill', themeName === 'dark' ? '#e2e8f0' : '#333');

        // パネル背景色の変更
        const sidePanel = document.querySelector('.side-panel');
        if (sidePanel) {
            sidePanel.style.backgroundColor = themeName === 'dark' ? '#4a5568' : '#ffffff';
            sidePanel.style.color = themeName === 'dark' ? '#e2e8f0' : '#333333';
        }
        
        // ツールバー背景色の変更
        const toolbar = document.querySelector('.toolbar');
        if (toolbar) {
            toolbar.style.backgroundColor = themeName === 'dark' ? '#4a5568' : '#f5f5f5';
            toolbar.style.color = themeName === 'dark' ? '#e2e8f0' : '#333333';
        }
        
        // 2025-06-22 追加: リンク名の色をテーマに応じて更新
        this.updateLinkNamesColor(theme);
        
        console.log('テーマ変更:', themeName);
        return true;
    }

    /**
     * クリア確認モーダルを表示
     */
    showClearModal() {
        const modal = document.getElementById('clearModal');
        if (modal) {
            modal.classList.remove('hidden');
            
            // モーダルイベントの設定
            document.getElementById('clearModalClose')?.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
            
            document.getElementById('clearCancelBtn')?.addEventListener('click', () => {
                modal.classList.add('hidden');
            });
            
            document.getElementById('clearSaveBtn')?.addEventListener('click', () => {
                this.saveData();
                setTimeout(() => {
                    this.clearAllData();
                    modal.classList.add('hidden');
                }, 500);
            });
            
            document.getElementById('clearConfirmBtn')?.addEventListener('click', () => {
                this.clearAllData();
                modal.classList.add('hidden');
            });
        }
    }

    /**
     * 全データクリア実行
     */
    clearAllData() {
        // データをクリア
        this.data.nodes = [];
        this.data.links = [];
        
        // 自動保存データもクリア
        localStorage.removeItem('wordmap_autosave');
        
        // 画面を再描画
        this.render();
        
        // プロパティパネルをリセット
        if (this.updatePropertiesPanel) {
            this.updatePropertiesPanel(null, null);
        }
        
        console.log('全データがクリアされました');
    }

    /**
     * リンク名の色をテーマに応じて更新
     */
    updateLinkNamesColor(theme) {
        this.linksGroup.selectAll('.link-name')
            .style('fill', theme.nodeStroke);
        console.log(`リンク名の色を更新: ${theme.nodeStroke}`);
    }

    // ========================================
    // 統合モード処理
    // ========================================

    /**
     * 統合モード用背景クリック処理設定
     */
    setupUnifiedClickHandlers() {
        const self = this;
        
        // SVG背景のクリック処理
        this.svg.on('click', function(event) {
            // event.target を確認してSVG背景かどうか判定
            if (event.target === this || event.target.tagName === 'rect') {
                self.handleUnifiedBackgroundClick(event);
            }
        });
        
        // SVG背景のダブルクリック処理
        this.svg.on('dblclick', function(event) {
            if (event.target === this || event.target.tagName === 'rect') {
                self.handleUnifiedBackgroundDoubleClick(event);
            }
        });
    }

    /**
     * 統合モード：背景クリック処理（選択解除）
     */
    handleUnifiedBackgroundClick(event) {
        console.log('[DEBUG] 背景クリック: 全選択解除');
        this.clearSelection();
    }

    /**
     * 統合モード：背景ダブルクリック処理（ノード作成）
     */
    handleUnifiedBackgroundDoubleClick(event) {
        // ズーム変換を考慮した座標計算
        const [x, y] = d3.pointer(event, this.viewport.node());
        console.log(`[DEBUG] 背景ダブルクリック: ノード作成 (${x}, ${y})`);
        
        this.createNodeAtCoordinates(x, y);
    }

    /**
     * 統合モード：ノードクリック処理
     */
    handleUnifiedNodeClick(event, clickedNode) {
        console.log(`[DEBUG] ノードクリック: ${clickedNode.id}`);
        
        if (event.ctrlKey || event.metaKey) {
            // Ctrl+クリック：複数選択
            this.toggleMultiSelect(clickedNode.id, 'node');
        } else if (this.state.isShiftPressed) {
            // 2025-07-06 修正: Shift+クリック：選択ノードから複数リンク生成
            const selectedElements = this.state.selectedElements;
            
            if (selectedElements.length === 1 && selectedElements[0].type === 'node') {
                const selectedNode = selectedElements[0];
                if (selectedNode.id !== clickedNode.id) {
                    // 選択ノードから新しいノードへリンク作成
                    this.createLinkBetweenNodes(selectedNode.id, clickedNode.id);
                    console.log(`[DEBUG] Shift+クリックリンク作成: ${selectedNode.id} → ${clickedNode.id}`);
                    return;
                }
            }
            
            // 基点ノードとして選択
            this.selectElement(clickedNode.id, 'node');
        } else {
            // 通常クリック：ノード選択（基点移動）
            this.selectElement(clickedNode.id, 'node');
            console.log(`[DEBUG] 通常クリック：ノード選択 ${clickedNode.id}`);
        }
    }

    /**
     * 統合モード：リンククリック処理
     */
    handleUnifiedLinkClick(event, clickedLink) {
        console.log(`[DEBUG] リンククリック: ${clickedLink.id}`);
        
        if (event.ctrlKey || event.metaKey) {
            // Ctrl+クリック：複数選択
            this.toggleMultiSelect(clickedLink.id, 'link');
        } else {
            // 通常クリック：リンク選択
            this.selectElement(clickedLink.id, 'link');
        }
    }

    // ========================================
    // 複数選択機能
    // ========================================

    /**
     * 複数選択の追加/削除（型混在防止）
     */
    toggleMultiSelect(elementId, elementType) {
        const key = `${elementType}:${elementId}`;
        const index = this.state.multiSelectedElements.indexOf(key);
        
        // 2025-06-22 修正: ノードとリンクの混在選択を防止
        if (index === -1) {
            // 追加時：型の混在チェック
            if (this.state.multiSelectedElements.length > 0) {
                const existingType = this.state.multiSelectedElements[0].split(':')[0];
                if (existingType !== elementType) {
                    console.log(`[DEBUG] 型混在防止: ${existingType}選択中に${elementType}選択を無視`);
                    return this.state.multiSelectedElements.length; // 無視
                }
            }
            this.state.multiSelectedElements.push(key);
            console.log(`[DEBUG] 複数選択追加: ${key}`);
        } else {
            // 削除
            this.state.multiSelectedElements.splice(index, 1);
            console.log(`[DEBUG] 複数選択削除: ${key}`);
        }
        
        this.updateMultiSelectHighlight();
        return this.state.multiSelectedElements.length;
    }

    /**
     * 複数選択のハイライト表示
     */
    updateMultiSelectHighlight() {
        // 2025-06-22 修正: selectedElementsとmultiSelectedElementsを統一管理
        const allSelectedElements = [];
        
        // 最初の選択要素を追加
        this.state.selectedElements.forEach(el => {
            allSelectedElements.push(`${el.type}:${el.id}`);
        });
        
        // 複数選択要素を追加
        this.state.multiSelectedElements.forEach(key => {
            if (!allSelectedElements.includes(key)) {
                allSelectedElements.push(key);
            }
        });
        
        console.log(`[DEBUG] updateMultiSelectHighlight: ${allSelectedElements.length}個の要素をハイライト`);
        
        // 全ての要素からハイライトをクリア
        this.nodesGroup.selectAll('circle')
            .classed('multi-selected', false)
            .style('stroke', null)
            .style('stroke-width', null);
            
        // 2025-06-22 修正: 正しいリンクセレクタでハイライトをクリア
        this.linksGroup.selectAll('[data-link-id]')
            .classed('multi-selected', false)
            .style('stroke-width', null)
            .style('filter', null)
            .style('stroke', null); // strokeもクリア
        
        // 全ての選択された要素にハイライトを適用
        allSelectedElements.forEach(key => {
            try {
                const [type, id] = key.split(':');
                
                if (type === 'node') {
                    const nodeElement = this.nodesGroup.select(`[data-node-id="${id}"]`);
                    if (!nodeElement.empty()) {
                        nodeElement.select('circle')
                            .classed('multi-selected', true)
                        .style('stroke', CONFIG.MULTI_SELECT.HIGHLIGHT_COLOR)
                        .style('stroke-width', CONFIG.MULTI_SELECT.HIGHLIGHT_WIDTH);
                    console.log(`[DEBUG] ノード ${id} をハイライト`);
                } else {
                    console.log(`[DEBUG] ノード ${id} のDOM要素が見つかりません`);
                }
            } else if (type === 'link') {
                // 2025-06-22 修正: リンクの正しいセレクタを使用
                const linkElement = this.linksGroup.select(`[data-link-id="${id}"]`);
                if (!linkElement.empty()) {
                    const link = this.data.links.find(l => l.id === id);
                    if (link) {
                        // リンクライン自体にハイライト効果を適用
                        linkElement
                            .classed('multi-selected', true)
                            .style('stroke', link.style.color) // 元の色を維持
                            .style('stroke-width', Math.max(CONFIG.MULTI_SELECT.HIGHLIGHT_WIDTH, link.style.width))
                            .style('filter', 'drop-shadow(0 0 3px rgba(255, 107, 107, 0.8))'); // 影効果追加
                    }
                    console.log(`[DEBUG] リンク ${id} をハイライト`);
                } else {
                    console.log(`[DEBUG] リンク ${id} のDOM要素が見つかりません`);
                }
            }
            } catch (error) {
                console.error(`[DEBUG] ハイライト処理エラー (${key}):`, error);
            }
        });
    }

    /**
     * 複数選択をクリア
     */
    clearMultiSelect() {
        this.state.multiSelectedElements = [];
        this.updateMultiSelectHighlight();
        this.render(); // ハイライトをクリア
    }

    /**
     * 選択状態でない要素のスタイルを初期化
     */
    resetNonSelectedElementStyles() {
        // 選択中の要素IDを収集
        const selectedIds = new Set();
        
        this.state.selectedElements.forEach(el => {
            selectedIds.add(`${el.type}:${el.id}`);
        });
        
        this.state.multiSelectedElements.forEach(key => {
            selectedIds.add(key);
        });
        
        // 選択されていないリンクのスタイルを初期化
        this.linksGroup.selectAll('[data-link-id]').each(function(d) {
            const linkKey = `link:${d.id}`;
            if (!selectedIds.has(linkKey)) {
                d3.select(this)
                    .classed('multi-selected', false)
                    .style('filter', null)
                    .style('stroke', d.style.color) // 元の色に戻す
                    .style('stroke-width', d.style.width); // 元の太さに戻す
            }
        });
        
        // 選択されていないノードのスタイルを初期化
        this.nodesGroup.selectAll('circle').each(function(d) {
            const nodeKey = `node:${d.id}`;
            if (!selectedIds.has(nodeKey)) {
                d3.select(this)
                    .classed('multi-selected', false)
                    .style('stroke', CONFIG.NODE.STROKE_COLOR)
                    .style('stroke-width', CONFIG.NODE.STROKE_WIDTH);
            }
        });
    }

    // ========================================
    // 2025-07-06 追加: 複数リンク生成機能（シンプル版）
    // ========================================
    

    // ========================================
    // 2025-07-06 追加: 自動保存機能（シンプル版）
    // ========================================
    
    /**
     * 自動保存を実行
     */
    autoSave() {
        try {
            // 2025-07-06 修正: リンクのsource/targetをIDとして保存
            const linksForSave = this.data.links.map(link => ({
                ...link,
                source: link.source.id || link.source,
                target: link.target.id || link.target
            }));
            
            const saveData = {
                nodes: this.data.nodes,
                links: linksForSave,
                categories: this.data.categories,
                meta: {
                    version: '3.2.0',
                    savedAt: new Date().toISOString(),
                    nextNodeId: this.data.nextNodeId,
                    nextLinkId: this.data.nextLinkId,
                    nextCategoryId: this.data.nextCategoryId
                }
            };
            
            localStorage.setItem('wordmap_autosave', JSON.stringify(saveData));
            console.log('[AUTO_SAVE] データを自動保存しました');
        } catch (error) {
            console.error('[AUTO_SAVE] 自動保存エラー:', error);
        }
    }
    
    /**
     * 自動保存データを復元
     */
    loadAutoSave() {
        try {
            const savedData = localStorage.getItem('wordmap_autosave');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                if (parsed.nodes && parsed.links) {
                    this.data.nodes = parsed.nodes;
                    this.data.categories = parsed.categories || [];
                    
                    // 2025-07-06 修正: リンクのsource/target参照を正しく設定
                    this.data.links = parsed.links.map(link => {
                        const sourceNode = this.data.nodes.find(n => n.id === (link.source.id || link.source));
                        const targetNode = this.data.nodes.find(n => n.id === (link.target.id || link.target));
                        
                        if (sourceNode && targetNode) {
                            return {
                                ...link,
                                source: sourceNode,
                                target: targetNode
                            };
                        } else {
                            console.warn('リンクの参照ノードが見つかりません:', link.id);
                            return null;
                        }
                    }).filter(link => link !== null);
                    
                    // IDカウンターも復元
                    if (parsed.meta) {
                        this.data.nextNodeId = parsed.meta.nextNodeId || this.data.nextNodeId;
                        this.data.nextLinkId = parsed.meta.nextLinkId || this.data.nextLinkId;
                        this.data.nextCategoryId = parsed.meta.nextCategoryId || this.data.nextCategoryId;
                    } else {
                        // フォールバック：既存データから最大IDを計算
                        this.data.nextNodeId = Math.max(...this.data.nodes.map(n => parseInt(n.id.replace('node', '')) || 0)) + 1;
                        this.data.nextLinkId = Math.max(...this.data.links.map(l => parseInt(l.id.replace('link', '')) || 0)) + 1;
                    }
                    
                    console.log('[AUTO_SAVE] 自動保存データを復元しました');
                    console.log(`[AUTO_SAVE] ノード数: ${this.data.nodes.length}, リンク数: ${this.data.links.length}`);
                    return true;
                }
            }
        } catch (error) {
            console.error('[AUTO_SAVE] 自動保存データの復元エラー:', error);
        }
        return false;
    }

    /**
     * D3.js未対応時のフォールバック
     */
    fallbackToNative() {
        console.warn('D3.js未対応のため、ネイティブ実装にフォールバック');
        alert('D3.jsの読み込みに失敗しました。ページを再読み込みしてください。');
    }
}

// モジュールエクスポート（ES6対応）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = D3WordMapEditor;
}

// グローバル公開
window.D3WordMapEditor = D3WordMapEditor;