/**
 * ワードマップエディター UIファサード
 * 2025-07-07 作成: モジュール化されたUI管理システムのファサード
 */

class WordMapUI {
    constructor(editor) {
        this.editor = editor;
        this.config = editor.config || CONFIG;
        
        // UIモジュールの初期化
        this.palettes = null;
        this.properties = null;
        this.categories = null;
        this.controls = null;
        
        console.log('[WordMapUI] UIファサード初期化');
    }

    /**
     * UI初期化
     */
    initialize() {
        console.log('[WordMapUI] UI初期化開始');
        
        try {
            // モジュールの初期化
            this.initializeModules();
            
            // 従来のメソッドをファサードとして維持
            this.setupLegacyMethods();
            
            // プロパティパネルのイベント設定
            this.setupPropertyEvents();
            
            // カテゴリセレクターの初期化
            this.initializeCategorySelectors();
            
            console.log('[WordMapUI] UI初期化完了');
            
        } catch (error) {
            console.error('[WordMapUI] UI初期化エラー:', error);
            // フォールバック: 旧システムで初期化
            this.initializeFallback();
        }
    }

    /**
     * UIモジュール初期化
     */
    initializeModules() {
        // パレットモジュール
        if (window.WordMapPalettes) {
            this.palettes = new window.WordMapPalettes(this.editor);
            this.editor.palettes = this.palettes;
            this.palettes.initialize();
        }
        
        // コントロールモジュール
        if (window.WordMapControls) {
            this.controls = new window.WordMapControls(this.editor);
            this.editor.controls = this.controls;
            this.controls.initialize();
            this.controls.setupKeyboardShortcuts();
        }
        
        // プロパティモジュール（将来実装）
        // this.properties = new window.WordMapProperties(this.editor);
        
        // カテゴリモジュール（将来実装）
        // this.categories = new window.WordMapCategories(this.editor);
        
        console.log('[WordMapUI] モジュール初期化完了');
    }

    /**
     * 旧メソッドとの互換性を保つファサードメソッド
     */
    setupLegacyMethods() {
        // パレット関連メソッド
        this.initializeColorPalette = () => this.palettes?.initializeColorPalette();
        this.initializeLinkColorPalette = () => this.palettes?.initializeLinkColorPalette();
        this.initializeSizeSelector = () => this.palettes?.initializeSizeSelector();
        this.initializeStyleSelector = () => this.palettes?.initializeStyleSelector();
        this.updateColorPaletteSelection = (color) => this.palettes?.updateColorPaletteSelection(color);
        this.updateLinkColorPaletteSelection = (color) => this.palettes?.updateLinkColorPaletteSelection(color);
        this.updateSizeSelectorSelection = (size) => this.palettes?.updateSizeSelectorSelection(size);
        this.updateStyleSelectorSelection = (style) => this.palettes?.updateStyleSelectorSelection(style);
        
        // コントロール関連メソッド
        this.setupForceSettings = () => this.controls?.setupForceSettings();
        this.setupModalEvents = () => this.controls?.setupModalEvents();
        this.setupToolbarEvents = () => this.controls?.setupToolbarEvents();
        this.setupThemeToggle = () => this.controls?.setupThemeToggle();
        this.updateThemeButton = () => this.controls?.updateThemeButton();
        
        console.log('[WordMapUI] レガシーメソッド設定完了');
    }

    /**
     * フォールバック初期化（旧システム）
     */
    initializeFallback() {
        console.warn('[WordMapUI] フォールバックモードで初期化');
        
        // 基本的なイベント設定のみ実行
        this.setupBasicEvents();
    }

    /**
     * 基本イベント設定
     */
    setupBasicEvents() {
        const { DOMHelper } = window.WordMapUtils || {};
        
        // 最小限のイベント設定
        DOMHelper?.addEventListenerSafe(
            document.getElementById('themeToggle'),
            'click',
            () => {
                const body = document.body;
                body.classList.toggle('dark-theme');
                const isDark = body.classList.contains('dark-theme');
                document.getElementById('themeToggle').textContent = isDark ? '☀️ ライト' : '🌙 ダーク';
            }
        );
        
        console.log('[WordMapUI] 基本イベント設定完了');
    }

    /**
     * プロパティパネルイベント設定
     */
    setupPropertyEvents() {
        // ノードプロパティ
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
                    e.target.blur();
                }
            });
        }
        
        // ノード説明
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
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.target.blur();
                }
            });
        }
        
        document.getElementById('nodePinned')?.addEventListener('change', (e) => {
            const multiSelected = this.editor.state.multiSelectedElements;
            const hasSelectedElement = this.editor.state.selectedElements.length > 0;
            if (multiSelected.length > 0 && hasSelectedElement) {
                this.updateMultiSelectedElements('pinned', e.target.checked);
            } else {
                this.updateSelectedNode();
            }
        });
        
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
        
        // リンク名
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
        
        console.log('[WordMapUI] プロパティパネルイベント設定完了');
    }

    /**
     * カテゴリセレクター初期化
     */
    initializeCategorySelectors() {
        // ノードカテゴリセレクター
        this.initializeCategorySelector('node');
        // リンクカテゴリセレクター
        this.initializeCategorySelector('link');
    }

    /**
     * カテゴリセレクター初期化（個別）
     */
    initializeCategorySelector(type) {
        const selector = document.getElementById(`${type}Category`);
        if (!selector) return;
        
        // セレクターをクリア
        selector.innerHTML = '';
        
        // カテゴリをフィルタリング
        const categories = this.editor.data.categories.filter(cat => cat.type === type);
        
        // "なし"オプションを追加
        const noneOption = document.createElement('div');
        noneOption.className = 'category-option';
        noneOption.setAttribute('data-value', '');
        noneOption.innerHTML = '<span class="category-color-indicator" style="background-color: #ddd;"></span>なし';
        noneOption.addEventListener('click', () => this.selectCategoryOption(type, ''));
        selector.appendChild(noneOption);
        
        // カテゴリオプションを追加
        categories.forEach(category => {
            const option = document.createElement('div');
            option.className = 'category-option';
            option.setAttribute('data-value', category.id);
            option.innerHTML = `<span class="category-color-indicator" style="background-color: ${category.color};"></span>${category.name}`;
            option.addEventListener('click', () => this.selectCategoryOption(type, category.id));
            selector.appendChild(option);
        });
    }

    /**
     * カテゴリオプション選択
     */
    selectCategoryOption(type, categoryId) {
        const selector = document.getElementById(`${type}Category`);
        if (!selector) return;
        
        // 選択状態を更新
        selector.querySelectorAll('.category-option').forEach(opt => 
            opt.classList.remove('selected'));
        const selectedOption = selector.querySelector(`[data-value="${categoryId}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
        
        // 値を更新
        if (type === 'node') {
            this.updateSelectedNode();
        } else if (type === 'link') {
            this.updateSelectedLink();
        }
    }

    // 以下、旧システムとの互換性を保つためのプレースホルダーメソッド
    
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
        this.palettes?.updateColorPaletteSelection(node.style.color);
        this.palettes?.updateSizeSelectorSelection(node.style.radius);
        this.updateDescriptionCharCount();
        
        // カテゴリセレクターの選択状態更新
        this.updateCategorySelection('node', node.category || '');
    }

    /**
     * 選択ノード更新
     */
    updateSelectedNode() {
        const selectedElements = this.editor.state.selectedElements;
        const nodeElement = selectedElements.find(el => el.type === 'node');
        if (!nodeElement) return;
        
        const node = this.editor.data.nodes.find(n => n.id === nodeElement.id);
        if (!node) return;
        
        // フォームから値を取得
        const nodeText = document.getElementById('nodeText');
        const nodeDescription = document.getElementById('nodeDescription');
        const nodeColor = document.getElementById('nodeColor');
        const nodeSize = document.getElementById('nodeSize');
        const nodePinned = document.getElementById('nodePinned');
        const nodeCategory = document.getElementById('nodeCategory');
        
        if (nodeText) node.label = nodeText.value;
        if (nodeDescription) node.description = nodeDescription.value;
        if (nodeColor) node.style.color = nodeColor.value;
        if (nodeSize) node.style.radius = parseInt(nodeSize.value);
        if (nodePinned) {
            node.pinned = nodePinned.checked;
            if (node.pinned) {
                node.fx = node.x;
                node.fy = node.y;
            } else {
                node.fx = null;
                node.fy = null;
            }
        }
        // カテゴリの更新（セレクターから選択された値を取得）
        const nodeCategorySelector = document.getElementById('nodeCategory');
        if (nodeCategorySelector) {
            const selectedOption = nodeCategorySelector.querySelector('.category-option.selected');
            if (selectedOption) {
                node.category = selectedOption.getAttribute('data-value') || '';
            }
        }
        
        node.updatedAt = Date.now();
        
        // レンダリング更新
        this.editor.render();
        this.editor.hasUnsavedChanges = true;
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
        if (linkName) linkName.value = link.name || '';
        if (linkCategory) linkCategory.value = link.category || '';
        
        // パレット・セレクターの選択状態更新
        this.palettes?.updateLinkColorPaletteSelection(link.style.color);
        this.palettes?.updateStyleSelectorSelection(link.style.lineStyle);
        
        // カテゴリセレクターの選択状態更新
        this.updateCategorySelection('link', link.category || '');
    }

    /**
     * カテゴリ選択状態更新
     */
    updateCategorySelection(type, categoryId) {
        const selector = document.getElementById(`${type}Category`);
        if (!selector) return;
        
        // 全ての選択解除
        selector.querySelectorAll('.category-option').forEach(opt => 
            opt.classList.remove('selected'));
        
        // 該当カテゴリを選択状態に
        const targetOption = selector.querySelector(`[data-value="${categoryId}"]`);
        if (targetOption) {
            targetOption.classList.add('selected');
        }
    }

    /**
     * 選択リンク更新
     */
    updateSelectedLink() {
        const selectedElements = this.editor.state.selectedElements;
        const linkElement = selectedElements.find(el => el.type === 'link');
        if (!linkElement) return;
        
        const link = this.editor.data.links.find(l => l.id === linkElement.id);
        if (!link) return;
        
        // フォームから値を取得
        const linkColor = document.getElementById('linkColor');
        const linkWidth = document.getElementById('linkWidth');
        const linkName = document.getElementById('linkName');
        const linkCategory = document.getElementById('linkCategory');
        
        if (linkColor) link.style.color = linkColor.value;
        if (linkWidth) link.style.width = parseInt(linkWidth.value);
        if (linkName) link.name = linkName.value;
        // カテゴリの更新（セレクターから選択された値を取得）
        const linkCategorySelector = document.getElementById('linkCategory');
        if (linkCategorySelector) {
            const selectedOption = linkCategorySelector.querySelector('.category-option.selected');
            if (selectedOption) {
                link.category = selectedOption.getAttribute('data-value') || '';
            }
        }
        
        link.updatedAt = Date.now();
        
        // レンダリング更新
        this.editor.render();
        this.editor.hasUnsavedChanges = true;
    }

    /**
     * 選択リンクスタイル更新
     */
    updateSelectedLinkStyle(style) {
        const selectedElements = this.editor.state.selectedElements;
        const linkElement = selectedElements.find(el => el.type === 'link');
        if (!linkElement) return;
        
        const link = this.editor.data.links.find(l => l.id === linkElement.id);
        if (!link) return;
        
        link.style.lineStyle = style;
        link.updatedAt = Date.now();
        
        // レンダリング更新
        this.editor.render();
        this.editor.hasUnsavedChanges = true;
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
     * 複数選択要素更新（プレースホルダー）
     */
    updateMultiSelectedElements() {
        if (this.properties) {
            return this.properties.updateMultiSelectedElements();
        }
        // フォールバック処理
        console.log('[WordMapUI] 複数選択要素更新（フォールバック）');
    }

    /**
     * カテゴリ更新（プレースホルダー）
     */
    updateCategories() {
        if (this.categories) {
            return this.categories.updateCategories();
        }
        // フォールバック処理
        console.log('[WordMapUI] カテゴリ更新（フォールバック）');
    }

    /**
     * UI状態のリセット
     */
    resetUI() {
        this.palettes?.resetPaletteSelections();
        this.controls?.resetControls();
        console.log('[WordMapUI] UI状態リセット完了');
    }

    /**
     * UI状態の取得
     */
    getUIState() {
        return {
            palettes: this.palettes?.getPaletteStates(),
            controls: this.controls?.getForceSettings(),
            theme: this.editor.state?.theme || 'light'
        };
    }

    /**
     * モジュールの動的読み込みと初期化
     */
    async loadModule(moduleName) {
        try {
            const script = document.createElement('script');
            script.src = `ui/${moduleName}.js`;
            script.onload = () => {
                console.log(`[WordMapUI] ${moduleName}読み込み完了`);
                // 必要に応じて初期化処理
                this.initializeLoadedModule(moduleName);
            };
            script.onerror = () => {
                console.error(`[WordMapUI] ${moduleName}読み込み失敗`);
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error(`[WordMapUI] ${moduleName}動的読み込みエラー:`, error);
        }
    }

    /**
     * 読み込み済みモジュールの初期化
     */
    initializeLoadedModule(moduleName) {
        switch (moduleName) {
            case 'WordMapProperties':
                if (window.WordMapProperties && !this.properties) {
                    this.properties = new window.WordMapProperties(this.editor);
                    this.editor.properties = this.properties;
                    this.properties.initialize();
                }
                break;
            case 'WordMapCategories':
                if (window.WordMapCategories && !this.categories) {
                    this.categories = new window.WordMapCategories(this.editor);
                    this.editor.categories = this.categories;
                    this.categories.initialize();
                }
                break;
        }
    }

    /**
     * デバッグ情報の取得
     */
    getDebugInfo() {
        return {
            modules: {
                palettes: !!this.palettes,
                properties: !!this.properties,
                categories: !!this.categories,
                controls: !!this.controls
            },
            uiState: this.getUIState(),
            editor: !!this.editor
        };
    }
}

// UIクラスをグローバルに公開
window.WordMapUI = WordMapUI;