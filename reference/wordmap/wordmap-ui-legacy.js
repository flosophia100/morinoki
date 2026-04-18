/**
 * ワードマップエディター UIモジュール
 * 2025-06-20 作成: UI操作・プロパティパネル機能
 */

class WordMapUI {
    constructor(editor) {
        this.editor = editor;
        this.initialized = false;
    }

    /**
     * UI初期化
     */
    initialize() {
        if (this.initialized) return;
        
        console.log('UIモジュール初期化開始');
        
        // カラーパレットの初期化
        this.initializeColorPalette();
        this.initializeLinkColorPalette();
        this.initializeCategoryColorPalette();
        
        // セレクターの初期化
        this.initializeSizeSelector();
        this.initializeStyleSelector();
        
        // カテゴリ管理の初期化
        this.initializeCategoryManagement();
        
        // プロパティパネルのイベント設定
        this.setupPropertyEvents();
        
        // フォース設定の初期化
        this.setupForceSettings();
        
        // モーダルイベントの設定
        this.setupModalEvents();
        
        // ツールバーボタンの設定
        this.setupToolbarEvents();
        
        // テーマ切替の設定
        this.setupThemeToggle();
        
        this.initialized = true;
        console.log('UIモジュール初期化完了');
    }

    /**
     * ノード用カラーパレット初期化
     */
    initializeColorPalette() {
        const palette = document.getElementById('nodeColorPalette');
        if (!palette) return;
        
        // パレットクリア
        palette.innerHTML = '';
        
        // カラーアイテム生成
        CONFIG.COLORS.NODE_PALETTE.forEach(color => {
            const colorItem = document.createElement('div');
            colorItem.className = 'color-item';
            colorItem.style.backgroundColor = color;
            colorItem.setAttribute('data-color', color);
            colorItem.title = color;
            
            // クリックイベント
            colorItem.addEventListener('click', () => {
                // 選択状態更新
                palette.querySelectorAll('.color-item').forEach(item => 
                    item.classList.remove('selected'));
                colorItem.classList.add('selected');
                
                // 隠し入力値更新
                document.getElementById('nodeColor').value = color;
                
                // ノード更新
                this.updateSelectedNode();
            });
            
            palette.appendChild(colorItem);
        });
        
        console.log('ノード用カラーパレット初期化完了: 30色');
    }

    /**
     * リンク用カラーパレット初期化
     */
    initializeLinkColorPalette() {
        const palette = document.getElementById('linkColorPalette');
        if (!palette) return;
        
        // パレットクリア
        palette.innerHTML = '';
        
        // カラーアイテム生成
        CONFIG.COLORS.LINK_PALETTE.forEach(color => {
            const colorItem = document.createElement('div');
            colorItem.className = 'color-item';
            colorItem.style.backgroundColor = color;
            colorItem.setAttribute('data-color', color);
            colorItem.title = color;
            
            // クリックイベント
            colorItem.addEventListener('click', () => {
                // 選択状態更新
                palette.querySelectorAll('.color-item').forEach(item => 
                    item.classList.remove('selected'));
                colorItem.classList.add('selected');
                
                // 隠し入力値更新
                document.getElementById('linkColor').value = color;
                
                // リンク更新
                this.updateSelectedLink();
            });
            
            palette.appendChild(colorItem);
        });
        
        console.log('リンク用カラーパレット初期化完了: 12色');
    }

    /**
     * サイズセレクター初期化
     */
    initializeSizeSelector() {
        const selector = document.getElementById('nodeSizeSelector');
        if (!selector) return;
        
        // 既存のボタンにイベント追加
        selector.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = parseInt(btn.getAttribute('data-size'));
                
                // 選択状態更新
                selector.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 隠し入力値更新
                document.getElementById('nodeSize').value = size;
                
                // 2025-06-21 修正: 複数選択時の一括更新に対応
                const multiSelected = this.editor.state.multiSelectedElements;
                if (multiSelected.length > 0) {
                    this.updateMultiSelectedElements('size', size);
                } else {
                    this.updateSelectedNode();
                }
            });
        });
        
        console.log('サイズセレクター初期化完了');
    }


    /**
     * 線スタイルセレクター初期化
     */
    initializeStyleSelector() {
        const selector = document.getElementById('linkStyleSelector');
        if (!selector) return;
        
        // 既存のボタンにイベント追加
        selector.querySelectorAll('.style-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const style = btn.getAttribute('data-style');
                
                // 選択状態更新
                selector.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 2025-06-21 修正: 複数選択時の一括更新に対応
                const multiSelected = this.editor.state.multiSelectedElements;
                if (multiSelected.length > 0) {
                    this.updateMultiSelectedElements('lineStyle', style);
                } else {
                    this.updateSelectedLinkStyle(style);
                }
            });
        });
        
        console.log('線スタイルセレクター初期化完了');
    }

    /**
     * プロパティパネルイベント設定
     */
    setupPropertyEvents() {
        // ノードプロパティ - 2025-06-22 修正: blur/enterで確定するよう変更
        const nodeTextInput = document.getElementById('nodeText');
        if (nodeTextInput) {
            const updateNodeText = (e) => {
                const multiSelected = this.editor.state.multiSelectedElements;
                const hasSelectedElement = this.editor.state.selectedElements.length > 0;
                if (multiSelected.length > 0 && hasSelectedElement) {
                    this.updateMultiSelectedElements('label', e.target.value);
                } else if (hasSelectedElement) {
                    this.updateSelectedNode();
                }
            };
            
            nodeTextInput.addEventListener('blur', updateNodeText);
            nodeTextInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur(); // blurイベントで更新処理実行
                }
            });
        }
        // ノード説明 - 2025-06-22 修正: blur/enterで確定
        const nodeDescInput = document.getElementById('nodeDescription');
        if (nodeDescInput) {
            const updateNodeDesc = (e) => {
                const multiSelected = this.editor.state.multiSelectedElements;
                const hasSelectedElement = this.editor.state.selectedElements.length > 0;
                if (multiSelected.length > 0 && hasSelectedElement) {
                    this.updateMultiSelectedElements('description', e.target.value);
                } else if (hasSelectedElement) {
                    this.updateSelectedNode();
                }
            };
            
            nodeDescInput.addEventListener('input', (e) => this.updateDescriptionCharCount());
            nodeDescInput.addEventListener('blur', updateNodeDesc);
            nodeDescInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) { // Shift+Enterは改行
                    e.target.blur();
                }
            });
        }
        document.getElementById('nodePinned')?.addEventListener('change', (e) => {
            // 2025-06-22 修正: 複数選択時も対応（pinnedプロパティ）
            const multiSelected = this.editor.state.multiSelectedElements;
            const hasSelectedElement = this.editor.state.selectedElements.length > 0;
            if (multiSelected.length > 0 && hasSelectedElement) {
                this.updateMultiSelectedElements('pinned', e.target.checked);
            } else {
                this.updateSelectedNode();
            }
        });
        
        // 2025-06-22 修正: カテゴリ選択はselectCategoryOption関数で処理（div要素のため）
        
        // リンクプロパティ
        document.getElementById('linkWidth')?.addEventListener('input', (e) => {
            const multiSelected = this.editor.state.multiSelectedElements;
            const hasSelectedElement = this.editor.state.selectedElements.length > 0;
            if (multiSelected.length > 0 && hasSelectedElement) {
                this.updateMultiSelectedElements('width', parseInt(e.target.value));
            } else {
                this.updateSelectedLink();
            }
        });
        // リンク名 - 2025-06-22 修正: blur/enterで確定
        const linkNameInput = document.getElementById('linkName');
        if (linkNameInput) {
            const updateLinkName = (e) => {
                const multiSelected = this.editor.state.multiSelectedElements;
                const hasSelectedElement = this.editor.state.selectedElements.length > 0;
                if (multiSelected.length > 0 && hasSelectedElement) {
                    this.updateMultiSelectedElements('name', e.target.value);
                } else if (hasSelectedElement) {
                    this.updateSelectedLink();
                }
            };
            
            linkNameInput.addEventListener('blur', updateLinkName);
            linkNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            });
        }
        
        // 2025-06-22 修正: リンクカテゴリ選択もselectCategoryOption関数で処理（div要素のため）
        
        console.log('プロパティパネルイベント設定完了（複数選択対応）');
    }

    /**
     * フォース設定の初期化
     */
    setupForceSettings() {
        // フォースパラメータ調整
        document.getElementById('centerForce')?.addEventListener('input', (e) => {
            this.editor.updateForceCenter?.(parseFloat(e.target.value));
            document.getElementById('centerForceValue').textContent = e.target.value;
        });
        
        document.getElementById('chargeForce')?.addEventListener('input', (e) => {
            this.editor.updateForceCharge?.(parseInt(e.target.value));
            document.getElementById('chargeForceValue').textContent = e.target.value;
        });
        
        document.getElementById('linkDistance')?.addEventListener('input', (e) => {
            this.editor.updateLinkDistance?.(parseInt(e.target.value));
            document.getElementById('linkDistanceValue').textContent = e.target.value;
        });
        
        document.getElementById('linkStrength')?.addEventListener('input', (e) => {
            this.editor.updateLinkStrength?.(parseFloat(e.target.value));
            document.getElementById('linkStrengthValue').textContent = e.target.value;
        });
        
        console.log('フォース設定初期化完了');
    }

    /**
     * モーダルイベント設定
     */
    setupModalEvents() {
        // ヘルプモーダル
        document.getElementById('helpModalClose')?.addEventListener('click', () => {
            document.getElementById('helpModal')?.classList.add('hidden');
        });
        
        document.getElementById('helpCloseBtn')?.addEventListener('click', () => {
            document.getElementById('helpModal')?.classList.add('hidden');
        });
        
        // モーダル背景クリックで閉じる
        document.getElementById('helpModal')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.classList.add('hidden');
            }
        });
        
        console.log('モーダルイベント設定完了');
    }

    /**
     * ツールバーイベント設定
     */
    setupToolbarEvents() {
        // ヘッダーボタン
        document.getElementById('saveBtn')?.addEventListener('click', () => {
            if (typeof this.editor.saveData === 'function') {
                this.editor.saveData();
            }
        });
        
        document.getElementById('loadBtn')?.addEventListener('click', () => {
            if (typeof this.editor.loadData === 'function') {
                this.editor.loadData();
            }
        });
        
        document.getElementById('resetLayoutBtn')?.addEventListener('click', () => {
            if (typeof this.editor.resetLayout === 'function') {
                this.editor.saveToHistory('layout_reset');
                this.editor.resetLayout();
            }
        });
        
        document.getElementById('debugToggle')?.addEventListener('click', () => {
            console.log('[UI] デバッグボタンがクリックされました（UIモジュール）');
            if (typeof this.editor.toggleDebug === 'function') {
                console.log('[UI] toggleDebug関数を呼び出します');
                this.editor.toggleDebug();
            } else {
                console.error('[UI] toggleDebug関数が見つかりません');
            }
        });
        
        // ツールボタン
        document.getElementById('selectTool')?.addEventListener('click', () => {
            this.editor.setMode('select');
        });
        
        document.getElementById('createTool')?.addEventListener('click', () => {
            this.editor.setMode('create');
        });
        
        document.getElementById('linkTool')?.addEventListener('click', () => {
            this.editor.setMode('link');
        });
        
        // ズーム・表示ボタン
        document.getElementById('zoomInBtn')?.addEventListener('click', () => {
            this.editor.zoomIn();
        });
        
        document.getElementById('zoomOutBtn')?.addEventListener('click', () => {
            this.editor.zoomOut();
        });
        
        document.getElementById('centerBtn')?.addEventListener('click', () => {
            if (typeof this.editor.centerView === 'function') {
                this.editor.centerView();
            }
        });
        
        document.getElementById('fitBtn')?.addEventListener('click', () => {
            if (typeof this.editor.fitToContent === 'function') {
                this.editor.fitToContent();
            }
        });
        
        // 履歴ボタン
        document.getElementById('undoBtn')?.addEventListener('click', () => {
            if (typeof this.editor.undo === 'function') {
                this.editor.undo();
            }
        });
        
        document.getElementById('redoBtn')?.addEventListener('click', () => {
            if (typeof this.editor.redo === 'function') {
                this.editor.redo();
            }
        });
        
        // ヘルプボタン
        
        document.getElementById('helpBtn')?.addEventListener('click', () => {
            if (typeof this.editor.showKeyboardHelp === 'function') {
                this.editor.showKeyboardHelp();
            }
        });
        
        console.log('ツールバーイベント設定完了');
    }

    /**
     * プロパティパネル更新
     */
    updatePropertiesPanel() {
        const selectedElements = this.editor.state.selectedElements;
        const noSelection = document.getElementById('noSelectionMessage');
        const nodeProps = document.getElementById('nodeProperties');
        const linkProps = document.getElementById('linkProperties');
        
        // 全て非表示にする
        noSelection?.classList.add('hidden');
        nodeProps?.classList.add('hidden');
        linkProps?.classList.add('hidden');
        
        if (selectedElements.length === 0) {
            // 選択なし
            noSelection?.classList.remove('hidden');
            return;
        }
        
        const element = selectedElements[0];
        
        if (element.type === 'node') {
            // ノード選択時
            this.updateNodeProperties(element.id);
            nodeProps?.classList.remove('hidden');
        } else if (element.type === 'link') {
            // リンク選択時
            this.updateLinkProperties(element.id);
            linkProps?.classList.remove('hidden');
        }
    }

    /**
     * ノードプロパティ更新
     */
    updateNodeProperties(nodeId) {
        const node = this.editor.data.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        // フォーム値を設定
        const nodeText = document.getElementById('nodeText');
        const nodeDescription = document.getElementById('nodeDescription');
        const nodeColor = document.getElementById('nodeColor');
        const nodeSize = document.getElementById('nodeSize');
        const nodePinned = document.getElementById('nodePinned');
        const nodeCategory = document.getElementById('nodeCategory');
        
        if (nodeText) nodeText.value = node.label || '';
        if (nodeDescription) nodeDescription.value = node.description || '';
        if (nodeColor) nodeColor.value = node.style.color;
        if (nodeSize) nodeSize.value = node.style.radius;
        if (nodePinned) nodePinned.checked = node.pinned || false;
        if (nodeCategory) nodeCategory.value = node.category || '';
        
        // パレット・セレクターの選択状態更新
        this.updateColorPaletteSelection(node.style.color);
        this.updateSizeSelectorSelection(node.style.radius);
        this.updateDescriptionCharCount();
    }

    /**
     * リンクプロパティ更新
     */
    updateLinkProperties(linkId) {
        const link = this.editor.data.links.find(l => l.id === linkId);
        if (!link) return;
        
        // フォーム値を設定
        const linkColor = document.getElementById('linkColor');
        const linkWidth = document.getElementById('linkWidth');
        const linkName = document.getElementById('linkName');
        const linkCategory = document.getElementById('linkCategory');
        
        if (linkColor) linkColor.value = link.style.color;
        if (linkWidth) linkWidth.value = link.style.width;
        // 2025-06-22 修正: linkLabelを削除、nameのみ使用
        if (linkName) linkName.value = link.name || '';
        if (linkCategory) linkCategory.value = link.category || '';
        
        // パレット・セレクターの選択状態更新
        this.updateLinkColorPaletteSelection(link.style.color);
        this.updateDirectionSelectorSelection(link.direction);
        this.updateStyleSelectorSelection(link.style.lineStyle);
    }

    /**
     * カラーパレット選択状態更新
     */
    updateColorPaletteSelection(color) {
        const palette = document.getElementById('nodeColorPalette');
        if (!palette) return;
        
        // 全ての選択解除
        palette.querySelectorAll('.color-item').forEach(item => 
            item.classList.remove('selected'));
        
        // 該当色を選択状態に
        const targetItem = palette.querySelector(`[data-color="${color}"]`);
        if (targetItem) {
            targetItem.classList.add('selected');
        }
    }

    /**
     * リンクカラーパレット選択状態更新
     */
    updateLinkColorPaletteSelection(color) {
        const palette = document.getElementById('linkColorPalette');
        if (!palette) return;
        
        // 全ての選択解除
        palette.querySelectorAll('.color-item').forEach(item => 
            item.classList.remove('selected'));
        
        // 該当色を選択状態に
        const targetItem = palette.querySelector(`[data-color="${color}"]`);
        if (targetItem) {
            targetItem.classList.add('selected');
        }
    }

    /**
     * サイズセレクター選択状態更新
     */
    updateSizeSelectorSelection(size) {
        const selector = document.getElementById('nodeSizeSelector');
        if (!selector) return;
        
        // 全ての選択解除
        selector.querySelectorAll('.size-btn').forEach(btn => 
            btn.classList.remove('active'));
        
        // 該当サイズを選択状態に
        const targetBtn = selector.querySelector(`[data-size="${size}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
    }

    /**
     * 矢印方向セレクター選択状態更新
     */
    updateDirectionSelectorSelection(direction) {
        const selector = document.getElementById('linkDirectionSelector');
        if (!selector) return;
        
        // 全ての選択解除
        selector.querySelectorAll('.direction-btn').forEach(btn => 
            btn.classList.remove('active'));
        
        // 該当方向を選択状態に
        const targetBtn = selector.querySelector(`[data-direction="${direction || 'none'}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
    }

    /**
     * 線スタイルセレクター選択状態更新
     */
    updateStyleSelectorSelection(lineStyle) {
        const selector = document.getElementById('linkStyleSelector');
        if (!selector) return;
        
        // 全ての選択解除
        selector.querySelectorAll('.style-btn').forEach(btn => 
            btn.classList.remove('active'));
        
        // 該当スタイルを選択状態に
        const targetBtn = selector.querySelector(`[data-style="${lineStyle || 'solid'}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
    }

    /**
     * 説明文字数カウント更新
     */
    updateDescriptionCharCount() {
        const textarea = document.getElementById('nodeDescription');
        const counter = document.getElementById('descCharCount');
        
        if (textarea && counter) {
            const count = textarea.value.length;
            counter.textContent = count;
            
            // 文字数に応じて色を変更
            if (count > 250) {
                counter.style.color = '#e63946';
            } else if (count > 200) {
                counter.style.color = '#f9ca24';
            } else {
                counter.style.color = '#666';
            }
        }
    }

    /**
     * 複数選択中の要素を一括更新
     */
    updateMultiSelectedElements(attributeName, value) {
        // 2025-06-21 修正: 複数選択時の編集反映
        const multiSelected = this.editor.state.multiSelectedElements;
        if (multiSelected.length === 0) return;
        
        // 2025-06-22 修正: 最初の選択要素（selectedElements[0]）も含めて処理
        const allSelectedKeys = [];
        
        // 最初の選択要素を追加
        if (this.editor.state.selectedElements.length > 0) {
            const firstElement = this.editor.state.selectedElements[0];
            allSelectedKeys.push(`${firstElement.type}:${firstElement.id}`);
        }
        
        // 複数選択要素を追加（重複は除外）
        multiSelected.forEach(key => {
            if (!allSelectedKeys.includes(key)) {
                allSelectedKeys.push(key);
            }
        });
        
        console.log(`[DEBUG] 一括更新対象: ${allSelectedKeys.length}個の要素`);
        
        allSelectedKeys.forEach(key => {
            const [type, id] = key.split(':');
            
            if (type === 'node') {
                const node = this.editor.data.nodes.find(n => n.id === id);
                if (node) {
                    if (attributeName === 'color') {
                        node.style.color = value;
                    } else if (attributeName === 'size') {
                        node.style.radius = value;
                    } else if (attributeName === 'category') {
                        node.category = value;
                        // カテゴリから色を自動適用
                        if (value) {
                            const category = this.editor.data.categories.find(cat => cat.id === value);
                            if (category) {
                                node.style.color = category.color;
                            }
                        }
                    } else if (attributeName === 'label') {
                        // 2025-06-22 修正: ノードのラベル更新（最初の選択ノードのみ）
                        const firstSelectedKey = allSelectedKeys[0];
                        if (key === firstSelectedKey) {
                            node.label = value;
                            console.log(`[DEBUG] ラベル更新: 最初の選択ノード ${id} のみに適用`);
                        }
                    } else if (attributeName === 'description') {
                        // 2025-06-22 修正: ノードの説明更新（最初の選択ノードのみ）
                        const firstSelectedKey = allSelectedKeys[0];
                        if (key === firstSelectedKey) {
                            node.description = value;
                            console.log(`[DEBUG] 説明更新: 最初の選択ノード ${id} のみに適用`);
                        }
                    } else if (attributeName === 'pinned') {
                        // 2025-06-22 修正: ノードのピン留め更新
                        node.pinned = value;
                        if (value) {
                            node.fx = node.x;
                            node.fy = node.y;
                        } else {
                            node.fx = null;
                            node.fy = null;
                        }
                    }
                    node.updatedAt = Date.now();
                }
            } else if (type === 'link') {
                const link = this.editor.data.links.find(l => l.id === id);
                if (link) {
                    if (attributeName === 'color') {
                        link.style.color = value;
                    } else if (attributeName === 'width') {
                        link.style.width = value;
                    } else if (attributeName === 'lineStyle') {
                        link.style.lineStyle = value;
                    } else if (attributeName === 'category') {
                        link.category = value;
                        // カテゴリから色を自動適用
                        if (value) {
                            const category = this.editor.data.categories.find(cat => cat.id === value);
                            if (category) {
                                link.style.color = category.color;
                            }
                        }
                    } else if (attributeName === 'name') {
                        // 2025-06-22 修正: リンク名の即座反映
                        link.name = value;
                    }
                    link.updatedAt = Date.now();
                }
            }
        });
        
        this.editor.render();
        this.editor.markAsChanged?.();
        console.log(`複数選択要素(${allSelectedKeys.length}個)を一括更新: ${attributeName} = ${value}`);
    }

    /**
     * 選択中のノード更新
     */
    updateSelectedNode() {
        console.log('[DEBUG] updateSelectedNode開始');
        
        // 2025-06-22 修正: 複数選択時はスキップ（イベントハンドラ側で処理済み）
        // ただし、プロパティパネルからの直接呼び出しの場合は処理を続行
        
        if (this.editor.state.selectedElements.length === 0) {
            console.log('[DEBUG] 選択要素なし');
            return;
        }
        
        if (this.editor.state.selectedElements[0].type !== 'node') {
            console.log('[DEBUG] 選択要素がノードではない');
            return;
        }
        
        const nodeId = this.editor.state.selectedElements[0].id;
        const node = this.editor.data.nodes.find(n => n.id === nodeId);
        
        if (node) {
            // プロパティの更新
            const newText = document.getElementById('nodeText')?.value || '';
            const newDescription = document.getElementById('nodeDescription')?.value || '';
            const newSize = parseInt(document.getElementById('nodeSize')?.value) || CONFIG.NODE.DEFAULT_RADIUS;
            const newPinned = document.getElementById('nodePinned')?.checked || false;
            
            // 2025-06-22 修正: nodeCategoryはdiv要素になったので選択されたオプションから取得
            const selectedCategoryOption = document.querySelector('#nodeCategory .category-option.selected');
            const newCategory = selectedCategoryOption?.getAttribute('data-category-id') || '';
            
            node.label = newText;
            node.description = newDescription;
            node.style.radius = newSize;
            node.pinned = newPinned;
            node.category = newCategory;
            node.updatedAt = Date.now();
            
            console.log(`[DEBUG] ノード ${nodeId} のラベルを更新: "${newText}"`);
            console.log(`[DEBUG] ノード更新前データ:`, {label: node.label, category: node.category});

            // カテゴリから色を自動適用
            if (newCategory) {
                const category = this.editor.data.categories.find(cat => cat.id === newCategory);
                if (category) {
                    node.style.color = category.color;
                    // 2025-06-22 修正: nodeColorパレット削除済みのためコメントアウト
                    // document.getElementById('nodeColor').value = category.color;
                    // this.updateColorPaletteSelection('nodeColorPalette', category.color);
                }
            }
            
            // ピン留め処理
            if (newPinned) {
                node.fx = node.x;
                node.fy = node.y;
            } else {
                node.fx = null;
                node.fy = null;
            }
            
            console.log(`[DEBUG] ノード ${nodeId} を更新:`, node);
            this.editor.render();
            this.editor.markAsChanged?.();
            
            // 履歴保存（最初の変更時のみ）
            if (!this.isUpdating) {
                this.isUpdating = true;
                setTimeout(() => {
                    this.editor.saveToHistory?.('node_update');
                    this.isUpdating = false;
                }, 1000);
            }
        }
    }

    /**
     * 選択中のリンク更新（updateLinkAttributes使用版）
     */
    updateSelectedLink() {
        console.log('[DEBUG] updateSelectedLink開始');
        
        // 2025-06-22 修正: 複数選択時はスキップ（イベントハンドラ側で処理済み）
        // ただし、プロパティパネルからの直接呼び出しの場合は処理を続行
        
        if (this.editor.state.selectedElements.length === 0) {
            console.log('[DEBUG] 選択要素なし');
            return;
        }
        
        if (this.editor.state.selectedElements[0].type !== 'link') {
            console.log('[DEBUG] 選択要素がリンクではない');
            return;
        }
        
        const linkId = this.editor.state.selectedElements[0].id;
        
        // 新しい属性を収集
        const attributes = {
            color: document.getElementById('linkColor')?.value || CONFIG.LINK.DEFAULT_COLOR,
            width: parseInt(document.getElementById('linkWidth')?.value) || CONFIG.LINK.DEFAULT_WIDTH,
            // 2025-06-22 修正: labelを削除、nameのみ使用
            name: document.getElementById('linkName')?.value || '',
            category: document.getElementById('linkCategory')?.value || ''
        };
        
        console.log(`[DEBUG] リンク ${linkId} を更新:`, attributes);
        
        // updateLinkAttributes関数を使用（利用可能な場合）
        if (typeof this.editor.updateLinkAttributes === 'function') {
            const success = this.editor.updateLinkAttributes(linkId, attributes);
            if (success) {
                // 選択状態を復元
                setTimeout(() => {
                    this.editor.selectElement(linkId, 'link');
                }, 10);
            }
        } else {
            // フォールバック: 従来の方法
            const link = this.editor.data.links.find(l => l.id === linkId);
            if (link) {
                link.style.color = attributes.color;
                link.style.width = attributes.width;
                // 2025-06-22 修正: labelを削除、nameのみ使用
                link.name = attributes.name;
                link.updatedAt = Date.now();
                
                // forceRecreateLink関数が利用可能な場合は使用
                if (typeof this.editor.forceRecreateLink === 'function') {
                    this.editor.forceRecreateLink(linkId);
                    
                    // 選択状態を復元
                    setTimeout(() => {
                        this.editor.selectElement(linkId, 'link');
                    }, 10);
                } else {
                    this.editor.render();
                }
                
                this.editor.markAsChanged?.();
            }
        }
    }


    /**
     * 選択中のリンクスタイル更新（updateLinkAttributes使用版）
     */
    updateSelectedLinkStyle(lineStyle) {
        console.log('[DEBUG] updateSelectedLinkStyle開始:', lineStyle);
        
        if (this.editor.state.selectedElements.length === 0 || 
            this.editor.state.selectedElements[0].type !== 'link') {
            console.log('[DEBUG] リンクが選択されていない');
            return;
        }
        
        const linkId = this.editor.state.selectedElements[0].id;
        
        console.log(`[DEBUG] リンク ${linkId} のスタイルを ${lineStyle} に変更`);
        
        // updateLinkAttributes関数を使用（利用可能な場合）
        if (typeof this.editor.updateLinkAttributes === 'function') {
            const success = this.editor.updateLinkAttributes(linkId, { lineStyle });
            if (success) {
                // 選択状態を復元
                setTimeout(() => {
                    this.editor.selectElement(linkId, 'link');
                }, 10);
            }
        } else {
            // フォールバック: 従来の方法
            const link = this.editor.data.links.find(l => l.id === linkId);
            if (link) {
                link.style.lineStyle = lineStyle;
                link.updatedAt = Date.now();
                
                // forceRecreateLink関数が利用可能な場合は使用
                if (typeof this.editor.forceRecreateLink === 'function') {
                    this.editor.forceRecreateLink(linkId);
                    
                    // 選択状態を復元
                    setTimeout(() => {
                        this.editor.selectElement(linkId, 'link');
                    }, 10);
                } else {
                    this.editor.render();
                }
                
                this.editor.markAsChanged?.();
            }
        }
    }

    /**
     * カラーパレット選択状態更新（汎用）
     */
    updateColorPaletteSelection(paletteId, color) {
        const palette = document.getElementById(paletteId);
        if (!palette) return;

        palette.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('selected');
            if (opt.dataset.color === color) {
                opt.classList.add('selected');
            }
        });
    }

    // ========================================
    // カテゴリ管理機能
    // ========================================

    /**
     * カテゴリ用カラーパレット初期化
     */
    initializeCategoryColorPalette() {
        // 2025-06-22 修正: パレット選択機能付きカラーパレット
        this.updateCategoryColorPalette();
        
        // パレット選択イベント
        const paletteSelector = document.getElementById('categoryPaletteSelector');
        if (paletteSelector) {
            paletteSelector.addEventListener('change', () => {
                this.updateCategoryColorPalette();
            });
        }
    }

    /**
     * 選択されたパレットに応じてカテゴリカラーパレットを更新
     */
    updateCategoryColorPalette() {
        const palette = document.getElementById('newCategoryColorPalette');
        const paletteSelector = document.getElementById('categoryPaletteSelector');
        if (!palette || !paletteSelector) return;

        const selectedPalette = paletteSelector.value;
        const colors = CONFIG.COLORS.CATEGORY_PALETTES[selectedPalette] || CONFIG.COLORS.CATEGORY_PALETTES['レインボー'];
        
        palette.innerHTML = '';

        colors.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'color-option';
            colorDiv.style.backgroundColor = color;
            colorDiv.style.border = '2px solid #333';
            colorDiv.style.boxShadow = '0 0 4px rgba(0,0,0,0.3)';
            colorDiv.dataset.color = color;
            colorDiv.title = `${selectedPalette}: ${color}`;
            colorDiv.addEventListener('click', () => {
                document.getElementById('newCategoryColor').value = color;
                palette.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
                colorDiv.classList.add('selected');
            });
            palette.appendChild(colorDiv);
        });
        
        // デフォルトで最初の色を選択
        if (colors.length > 0) {
            document.getElementById('newCategoryColor').value = colors[0];
            palette.querySelector('.color-option').classList.add('selected');
        }
        
        console.log(`カテゴリ配色パレット更新: ${selectedPalette} (${colors.length}色)`);
    }

    /**
     * カテゴリ管理機能の初期化
     */
    initializeCategoryManagement() {
        this.updateCategorySelectors();
        this.updateCategoryList();
        this.setupCategoryEvents();
    }

    /**
     * カテゴリ情報を完全に更新（データ読み込み時などに使用）
     */
    updateCategories() {
        console.log('カテゴリ情報更新開始');
        console.log('現在のカテゴリデータ:', this.editor.data.categories);
        this.updateCategoryList();
        this.updateCategorySelectors();
        console.log('カテゴリリストとセレクター更新完了');
    }

    /**
     * カテゴリセレクターの更新
     */
    updateCategorySelectors() {
        // 2025-06-22 修正: カテゴリ一覧と同じデザイン
        this.updateCategorySelector('nodeCategory', 'node');
        this.updateCategorySelector('linkCategory', 'link');
        console.log('カテゴリセレクター更新完了');
    }

    /**
     * 個別カテゴリセレクターの更新
     */
    updateCategorySelector(selectorId, type) {
        const selector = document.getElementById(selectorId);
        if (!selector) return;

        selector.innerHTML = '';
        
        // カテゴリなしオプション
        const noneOption = document.createElement('div');
        noneOption.className = 'category-option';
        noneOption.setAttribute('data-category-id', '');
        noneOption.innerHTML = `
            <div class="color-dot" style="background-color: #333333;"></div>
            <span>カテゴリなし</span>
        `;
        noneOption.addEventListener('click', () => {
            this.selectCategoryOption(selectorId, '', noneOption);
        });
        selector.appendChild(noneOption);

        // カテゴリオプション
        this.editor.getCategories(type).forEach(category => {
            const option = document.createElement('div');
            option.className = 'category-option';
            option.setAttribute('data-category-id', category.id);
            option.innerHTML = `
                <div class="color-dot" style="background-color: ${category.color};"></div>
                <span>${category.name}</span>
            `;
            option.addEventListener('click', () => {
                this.selectCategoryOption(selectorId, category.id, option);
            });
            selector.appendChild(option);
        });
    }

    /**
     * カテゴリオプション選択処理
     */
    selectCategoryOption(selectorId, categoryId, optionElement) {
        const selector = document.getElementById(selectorId);
        
        // 全オプションの選択状態をクリア
        selector.querySelectorAll('.category-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // 選択されたオプションを強調
        optionElement.classList.add('selected');
        
        // 対応する処理を実行
        if (selectorId === 'nodeCategory') {
            // 2025-06-22 修正: 複数選択対応
            const multiSelected = this.editor.state.multiSelectedElements;
            const hasSelectedElement = this.editor.state.selectedElements.length > 0;
            
            if (multiSelected.length > 0 && hasSelectedElement) {
                this.updateMultiSelectedElements('category', categoryId);
            } else if (hasSelectedElement && this.editor.state.selectedElements[0].type === 'node') {
                const node = this.editor.data.nodes.find(n => n.id === this.editor.state.selectedElements[0].id);
                if (node) {
                    node.category = categoryId;
                    
                    // カテゴリから色を自動適用
                    if (categoryId) {
                        const category = this.editor.data.categories.find(cat => cat.id === categoryId);
                        if (category) {
                            node.style.color = category.color;
                        }
                    } else {
                        node.style.color = '#333333'; // カテゴリなしは黒色
                    }
                    
                    this.editor.render();
                }
            }
        } else if (selectorId === 'linkCategory') {
            // 2025-06-22 修正: 複数選択対応
            const multiSelected = this.editor.state.multiSelectedElements;
            const hasSelectedElement = this.editor.state.selectedElements.length > 0;
            
            if (multiSelected.length > 0 && hasSelectedElement) {
                this.updateMultiSelectedElements('category', categoryId);
            } else if (hasSelectedElement && this.editor.state.selectedElements[0].type === 'link') {
                const link = this.editor.data.links.find(l => l.id === this.editor.state.selectedElements[0].id);
                if (link) {
                    link.category = categoryId;
                    
                    // カテゴリから色を自動適用
                    if (categoryId) {
                        const category = this.editor.data.categories.find(cat => cat.id === categoryId);
                        if (category) {
                            link.style.color = category.color;
                        }
                    } else {
                        link.style.color = '#999999'; // カテゴリなしはデフォルト色
                    }
                    
                    this.editor.render();
                }
            }
        }
    }

    /**
     * カテゴリリストの更新
     */
    updateCategoryList() {
        const listContainer = document.getElementById('categoryList');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        
        // 2025-06-22 修正: ノードとリンクで区分けして表示
        const nodeCategories = this.editor.getCategories('node');
        const linkCategories = this.editor.getCategories('link');
        
        // ノードカテゴリセクション
        if (nodeCategories.length > 0) {
            const nodeSection = document.createElement('div');
            nodeSection.className = 'category-section';
            nodeSection.innerHTML = '<h6 class="category-section-title">🔴 ノードカテゴリ</h6>';
            listContainer.appendChild(nodeSection);
            
            nodeCategories.forEach(category => {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'category-item';
                categoryDiv.innerHTML = `
                    <div class="category-color" style="background-color: ${category.color}; border: 2px solid #333; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>
                    <span class="category-name" style="font-weight: 500;">${category.name}</span>
                    <button class="category-delete" data-category-id="${category.id}">×</button>
                `;
                listContainer.appendChild(categoryDiv);
            });
        }
        
        // リンクカテゴリセクション  
        if (linkCategories.length > 0) {
            const linkSection = document.createElement('div');
            linkSection.className = 'category-section';
            linkSection.innerHTML = '<h6 class="category-section-title">🔗 リンクカテゴリ</h6>';
            linkSection.style.marginTop = '15px';
            listContainer.appendChild(linkSection);
            
            linkCategories.forEach(category => {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'category-item';
                categoryDiv.innerHTML = `
                    <div class="category-color" style="background-color: ${category.color}; border: 2px solid #333; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>
                    <span class="category-name" style="font-weight: 500;">${category.name}</span>
                    <button class="category-delete" data-category-id="${category.id}">×</button>
                `;
                listContainer.appendChild(categoryDiv);
            });
        }
        
        // カテゴリがない場合
        if (nodeCategories.length === 0 && linkCategories.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'category-empty';
            emptyDiv.innerHTML = '<span style="color: #666; font-style: italic;">カテゴリはまだ作成されていません</span>';
            listContainer.appendChild(emptyDiv);
        }
    }

    /**
     * カテゴリ関連イベントの設定
     */
    setupCategoryEvents() {
        // 2025-06-22 追加: カテゴリタイプ選択ボタン
        const typeButtons = document.querySelectorAll('.category-type-btn');
        typeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // 全ボタンのアクティブ状態をクリア
                typeButtons.forEach(b => b.classList.remove('active'));
                // クリックされたボタンをアクティブに
                btn.classList.add('active');
                // 隠しフィールドに値を設定
                document.getElementById('newCategoryType').value = btn.dataset.type;
            });
        });

        // カテゴリ追加ボタン
        const addBtn = document.getElementById('addCategoryBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const name = document.getElementById('newCategoryName').value.trim();
                const type = document.getElementById('newCategoryType').value;
                const color = document.getElementById('newCategoryColor').value;
                
                if (name) {
                    this.editor.createCategory(name, color, type);
                    this.updateCategorySelectors();
                    this.updateCategoryList();
                    document.getElementById('newCategoryName').value = '';
                }
            });
        }

        // カテゴリ削除イベント（委譲）
        const listContainer = document.getElementById('categoryList');
        if (listContainer) {
            listContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('category-delete')) {
                    const categoryId = e.target.dataset.categoryId;
                    if (confirm('このカテゴリを削除しますか？')) {
                        this.editor.deleteCategory(categoryId);
                        this.updateCategorySelectors();
                        this.updateCategoryList();
                    }
                }
            });
        }

        // 2025-06-22 修正: カテゴリ選択は新しいselectCategoryOption関数で処理
        
        // 2025-06-22 追加: カテゴリ管理ボタン
        const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
        if (manageCategoriesBtn) {
            manageCategoriesBtn.addEventListener('click', () => {
                this.openCategoryManageModal();
            });
        }
    }

    /**
     * カテゴリ管理モーダルを開く
     */
    openCategoryManageModal() {
        const modal = document.getElementById('categoryManageModal');
        if (!modal) return;
        
        this.updateCategoryManageList();
        modal.classList.remove('hidden');
        
        // モーダルクローズイベント
        const closeBtn = document.getElementById('categoryManageModalClose');
        const closeFooterBtn = document.getElementById('categoryManageCloseBtn');
        
        const closeModal = () => {
            modal.classList.add('hidden');
            // カテゴリ更新後にセレクターとリストを更新
            this.updateCategorySelectors();
            this.updateCategoryList();
        };
        
        closeBtn?.addEventListener('click', closeModal);
        closeFooterBtn?.addEventListener('click', closeModal);
        
        // ESCキーで閉じる
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * カテゴリ管理リストを更新
     */
    updateCategoryManageList() {
        const listContainer = document.getElementById('categoryManageList');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        
        const allCategories = this.editor.data.categories;
        
        if (allCategories.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">カテゴリが作成されていません</p>';
            return;
        }
        
        allCategories.forEach(category => {
            const item = document.createElement('div');
            item.className = 'category-manage-item';
            item.innerHTML = `
                <div class="color-preview" style="background-color: ${category.color};" 
                     title="色を変更" data-category-id="${category.id}"></div>
                <div class="category-info">
                    <div class="category-name">${category.name}</div>
                    <div class="category-type">${category.type === 'node' ? '🔴 ノード' : '🔗 リンク'}</div>
                </div>
                <div class="category-actions">
                    <button class="action-btn edit" data-category-id="${category.id}" title="名前を変更">✏️</button>
                    <button class="action-btn delete" data-category-id="${category.id}" title="削除">🗑️</button>
                </div>
            `;
            
            // イベントリスナーを追加
            const colorPreview = item.querySelector('.color-preview');
            const editBtn = item.querySelector('.action-btn.edit');
            const deleteBtn = item.querySelector('.action-btn.delete');
            
            colorPreview.addEventListener('click', () => this.changeCategoryColor(category.id));
            editBtn.addEventListener('click', () => this.editCategoryName(category.id));
            deleteBtn.addEventListener('click', () => this.deleteCategoryConfirm(category.id));
            
            listContainer.appendChild(item);
        });
    }

    /**
     * カテゴリ色変更
     */
    changeCategoryColor(categoryId) {
        const category = this.editor.data.categories.find(c => c.id === categoryId);
        if (!category) return;
        
        const newColor = prompt(`「${category.name}」の色を変更してください:`, category.color);
        if (newColor && /^#[0-9A-F]{6}$/i.test(newColor)) {
            category.color = newColor;
            
            // 該当カテゴリの全要素の色を更新
            this.editor.data.nodes.forEach(node => {
                if (node.category === categoryId) {
                    node.style.color = newColor;
                }
            });
            
            this.editor.data.links.forEach(link => {
                if (link.category === categoryId) {
                    link.style.color = newColor;
                }
            });
            
            this.editor.render();
            this.updateCategoryManageList();
        } else if (newColor) {
            alert('正しい色コード（例: #ff0000）を入力してください');
        }
    }

    /**
     * カテゴリ名変更
     */
    editCategoryName(categoryId) {
        const category = this.editor.data.categories.find(c => c.id === categoryId);
        if (!category) return;
        
        const newName = prompt(`カテゴリ名を変更してください:`, category.name);
        if (newName && newName.trim()) {
            category.name = newName.trim();
            this.updateCategoryManageList();
        }
    }

    /**
     * カテゴリ削除確認
     */
    deleteCategoryConfirm(categoryId) {
        const category = this.editor.data.categories.find(c => c.id === categoryId);
        if (!category) return;
        
        const elementsCount = this.editor.data.nodes.filter(n => n.category === categoryId).length +
                             this.editor.data.links.filter(l => l.category === categoryId).length;
        
        const message = elementsCount > 0 
            ? `「${category.name}」を削除しますか？\n使用中の要素（${elementsCount}個）はカテゴリなしになります。`
            : `「${category.name}」を削除しますか？`;
        
        if (confirm(message)) {
            // カテゴリを削除
            const index = this.editor.data.categories.findIndex(c => c.id === categoryId);
            if (index !== -1) {
                this.editor.data.categories.splice(index, 1);
            }
            
            // 該当カテゴリの要素をカテゴリなしに変更
            this.editor.data.nodes.forEach(node => {
                if (node.category === categoryId) {
                    node.category = '';
                    node.style.color = '#333333'; // カテゴリなしは黒色
                }
            });
            
            this.editor.data.links.forEach(link => {
                if (link.category === categoryId) {
                    link.category = '';
                    link.style.color = '#999999'; // カテゴリなしはデフォルト色
                }
            });
            
            this.editor.render();
            this.updateCategoryManageList();
        }
    }

    // ========================================
    // テーマ切替機能
    // ========================================

    /**
     * テーマ切替の設定
     */
    setupThemeToggle() {
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const currentTheme = this.editor.state.theme;
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                this.editor.setTheme(newTheme);
                this.updateThemeButton(newTheme);
            });
        }
    }

    /**
     * テーマボタンの表示更新
     */
    updateThemeButton(theme) {
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.textContent = theme === 'light' ? '🌙 ダーク' : '☀️ ライト';
        }
    }
}

// モジュールエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WordMapUI;
}

// グローバル公開
window.WordMapUI = WordMapUI;