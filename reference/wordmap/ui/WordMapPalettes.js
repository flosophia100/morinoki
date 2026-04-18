/**
 * ワードマップエディター パレット管理モジュール
 * 2025-07-07 作成: カラーパレット、サイズセレクター、スタイル制御
 */

class WordMapPalettes {
    constructor(editor) {
        this.editor = editor;
        this.config = editor.config || CONFIG;
    }

    /**
     * パレット初期化
     */
    initialize() {
        console.log('[WordMapPalettes] パレット初期化開始');
        this.initializeColorPalette();
        this.initializeLinkColorPalette();
        this.initializeSizeSelector();
        this.initializeStyleSelector();
        this.initializeCategoryColorPalette();
        console.log('[WordMapPalettes] パレット初期化完了');
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
        this.config.COLORS.NODE_PALETTE.forEach(color => {
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
                
                // ノード更新（プロパティモジュール経由）
                if (this.editor.properties) {
                    this.editor.properties.updateSelectedNode();
                } else {
                    // フォールバック：旧メソッド呼び出し
                    this.editor.updateSelectedNode?.();
                }
            });
            
            palette.appendChild(colorItem);
        });
        
        console.log('ノード用カラーパレット初期化完了: ' + this.config.COLORS.NODE_PALETTE.length + '色');
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
        this.config.COLORS.LINK_PALETTE.forEach(color => {
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
                
                // リンク更新（プロパティモジュール経由）
                if (this.editor.properties) {
                    this.editor.properties.updateSelectedLink();
                } else {
                    // フォールバック：旧メソッド呼び出し
                    this.editor.updateSelectedLink?.();
                }
            });
            
            palette.appendChild(colorItem);
        });
        
        console.log('リンク用カラーパレット初期化完了: ' + this.config.COLORS.LINK_PALETTE.length + '色');
    }

    /**
     * サイズセレクター初期化
     */
    initializeSizeSelector() {
        const selector = document.getElementById('nodeSizeSelector');
        if (!selector) return;
        
        // 各サイズボタンにイベント設定
        const sizeButtons = selector.querySelectorAll('.size-btn');
        sizeButtons.forEach(button => {
            button.addEventListener('click', () => {
                // 他の選択解除
                sizeButtons.forEach(btn => btn.classList.remove('active'));
                // 新しい選択
                button.classList.add('active');
                
                // 隠し入力値更新
                const size = button.getAttribute('data-size');
                document.getElementById('nodeSize').value = size;
                
                // ノード更新（プロパティモジュール経由）
                if (this.editor.properties) {
                    this.editor.properties.updateSelectedNode();
                } else {
                    // フォールバック：旧メソッド呼び出し
                    this.editor.updateSelectedNode?.();
                }
            });
        });
        
        console.log('サイズセレクター初期化完了');
    }

    /**
     * スタイルセレクター初期化
     */
    initializeStyleSelector() {
        const selector = document.getElementById('linkStyleSelector');
        if (!selector) return;
        
        // 各スタイルボタンにイベント設定
        const styleButtons = selector.querySelectorAll('.style-btn');
        styleButtons.forEach(button => {
            button.addEventListener('click', () => {
                // 他の選択解除
                styleButtons.forEach(btn => btn.classList.remove('active'));
                // 新しい選択
                button.classList.add('active');
                
                // スタイル値取得と適用
                const style = button.getAttribute('data-style');
                if (this.editor.properties) {
                    this.editor.properties.updateSelectedLinkStyle(style);
                } else {
                    // フォールバック：旧メソッド呼び出し
                    this.editor.updateSelectedLinkStyle?.(style);
                }
            });
        });
        
        console.log('スタイルセレクター初期化完了');
    }

    /**
     * カテゴリカラーパレット初期化
     */
    initializeCategoryColorPalette() {
        const paletteSelector = document.getElementById('categoryPaletteSelector');
        if (!paletteSelector) return;
        
        paletteSelector.addEventListener('change', (e) => {
            this.updateCategoryColorPalette(e.target.value);
        });
        
        // 初期パレット設定
        this.updateCategoryColorPalette(paletteSelector.value || 'レインボー');
        
        console.log('カテゴリカラーパレット初期化完了');
    }

    /**
     * カテゴリカラーパレット更新
     */
    updateCategoryColorPalette(paletteName) {
        const container = document.getElementById('newCategoryColorPalette');
        if (!container) return;
        
        const colors = this.config.COLORS.CATEGORY_PALETTES[paletteName] || this.config.COLORS.CATEGORY_PALETTES['レインボー'];
        
        // パレットクリア
        container.innerHTML = '';
        
        // カラーアイテム生成
        colors.forEach(color => {
            const colorItem = document.createElement('div');
            colorItem.className = 'color-palette-mini-item';
            colorItem.style.backgroundColor = color;
            colorItem.setAttribute('data-color', color);
            colorItem.title = color;
            
            // クリックイベント
            colorItem.addEventListener('click', () => {
                // 選択状態更新
                container.querySelectorAll('.color-palette-mini-item').forEach(item => 
                    item.classList.remove('selected'));
                colorItem.classList.add('selected');
                
                // 隠し入力値更新
                document.getElementById('newCategoryColor').value = color;
            });
            
            container.appendChild(colorItem);
        });
        
        // デフォルト選択
        if (colors.length > 0) {
            const firstItem = container.querySelector('.color-palette-mini-item');
            if (firstItem) {
                firstItem.classList.add('selected');
                document.getElementById('newCategoryColor').value = colors[0];
            }
        }
        
        console.log(`カテゴリカラーパレット更新: ${paletteName} (${colors.length}色)`);
    }

    /**
     * カラーパレット選択状態更新
     */
    updateColorPaletteSelection(color, paletteId = 'nodeColorPalette') {
        const palette = document.getElementById(paletteId);
        if (!palette) return;
        
        // 全ての選択解除
        palette.querySelectorAll('.color-item').forEach(item => 
            item.classList.remove('selected'));
        
        // 指定色を選択
        const targetItem = palette.querySelector(`[data-color="${color}"]`);
        if (targetItem) {
            targetItem.classList.add('selected');
        }
    }

    /**
     * リンクカラーパレット選択状態更新
     */
    updateLinkColorPaletteSelection(color) {
        this.updateColorPaletteSelection(color, 'linkColorPalette');
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
        
        // 指定サイズを選択
        const targetBtn = selector.querySelector(`[data-size="${size}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
    }

    /**
     * スタイルセレクター選択状態更新
     */
    updateStyleSelectorSelection(style) {
        const selector = document.getElementById('linkStyleSelector');
        if (!selector) return;
        
        // 全ての選択解除
        selector.querySelectorAll('.style-btn').forEach(btn => 
            btn.classList.remove('active'));
        
        // 指定スタイルを選択
        const targetBtn = selector.querySelector(`[data-style="${style}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
    }

    /**
     * 方向セレクター選択状態更新（リンク用）
     */
    updateDirectionSelectorSelection(direction) {
        // 将来的な拡張用のプレースホルダー
        console.log(`方向セレクター更新: ${direction}`);
    }

    /**
     * カテゴリ色の動的変更
     */
    changeCategoryColor(categoryId, newColor) {
        if (this.editor.categories) {
            this.editor.categories.changeCategoryColor(categoryId, newColor);
        } else {
            console.warn('[WordMapPalettes] カテゴリモジュールが利用できません');
        }
    }

    /**
     * パレット状態のリセット
     */
    resetPaletteSelections() {
        // 全パレットの選択状態をクリア
        ['nodeColorPalette', 'linkColorPalette'].forEach(paletteId => {
            const palette = document.getElementById(paletteId);
            if (palette) {
                palette.querySelectorAll('.color-item').forEach(item => 
                    item.classList.remove('selected'));
            }
        });
        
        // サイズセレクターリセット
        const sizeSelector = document.getElementById('nodeSizeSelector');
        if (sizeSelector) {
            sizeSelector.querySelectorAll('.size-btn').forEach(btn => 
                btn.classList.remove('active'));
        }
        
        // スタイルセレクターリセット
        const styleSelector = document.getElementById('linkStyleSelector');
        if (styleSelector) {
            styleSelector.querySelectorAll('.style-btn').forEach(btn => 
                btn.classList.remove('active'));
        }
        
        console.log('[WordMapPalettes] パレット選択状態リセット完了');
    }

    /**
     * パレット状態の取得
     */
    getPaletteStates() {
        return {
            selectedNodeColor: document.getElementById('nodeColor')?.value,
            selectedLinkColor: document.getElementById('linkColor')?.value,
            selectedNodeSize: document.getElementById('nodeSize')?.value,
            availableColors: {
                nodes: this.config.COLORS.NODE_PALETTE,
                links: this.config.COLORS.LINK_PALETTE
            }
        };
    }
}

// モジュールをグローバルに公開
window.WordMapPalettes = WordMapPalettes;