/**
 * ワードマップエディター パレット管理モジュール
 * 2025-07-07 TypeScript変換: カラーパレット、サイズセレクター、スタイル制御の型安全化
 */

import { WordMapEditor, WordMapConfig, PaletteStates, CategoryType } from '../../types/wordmap';
import { DOMHelper } from '../wordmap-utils';

export interface PaletteSelection extends PaletteStates {}

export class WordMapPalettes {
  private editor: WordMapEditor;
  private config: WordMapConfig;

  constructor(editor: WordMapEditor) {
    this.editor = editor;
    this.config = editor.config;
  }

  /**
   * パレット初期化
   */
  public initialize(): void {
    console.log('[WordMapPalettes] パレット初期化開始');
    
    try {
      this.initializeColorPalette();
      this.initializeLinkColorPalette();
      this.initializeSizeSelector();
      this.initializeStyleSelector();
      this.initializeCategoryColorPalette();
      console.log('[WordMapPalettes] パレット初期化完了');
    } catch (error) {
      console.error('[WordMapPalettes] パレット初期化エラー:', error);
      throw error;
    }
  }

  /**
   * ノード用カラーパレット初期化
   */
  private initializeColorPalette(): void {
    const palette = DOMHelper.getElementById('nodeColorPalette');
    if (!palette) {
      console.warn('[WordMapPalettes] nodeColorPalette要素が見つかりません');
      return;
    }
    
    // パレットクリア
    palette.innerHTML = '';
    
    // カラーアイテム生成
    this.config.COLORS.NODE_PALETTE.forEach(color => {
      const colorItem = DOMHelper.createElementWithClass('div', 'color-item');
      colorItem.style.backgroundColor = color;
      colorItem.setAttribute('data-color', color);
      colorItem.title = color;
      
      // クリックイベント
      DOMHelper.addEventListenerSafe(colorItem, 'click', () => {
        this.selectNodeColor(color, palette);
      });
      
      palette.appendChild(colorItem);
    });
    
    console.log(`ノード用カラーパレット初期化完了: ${this.config.COLORS.NODE_PALETTE.length}色`);
  }

  /**
   * ノード色選択処理
   */
  private selectNodeColor(color: string, palette: HTMLElement): void {
    // 選択状態更新
    palette.querySelectorAll('.color-item').forEach(item => 
      item.classList.remove('selected'));
    const selectedItem = palette.querySelector(`[data-color="${color}"]`);
    if (selectedItem) {
      selectedItem.classList.add('selected');
    }
    
    // 隠し入力値更新
    const nodeColorInput = DOMHelper.getElementById('nodeColor') as HTMLInputElement;
    if (nodeColorInput) {
      nodeColorInput.value = color;
    }
    
    // ノード更新（プロパティモジュール経由）
    if ((this.editor as any).properties) {
      (this.editor as any).properties.updateSelectedNode();
    } else {
      // フォールバック：旧メソッド呼び出し
      (this.editor as any).updateSelectedNode?.();
    }
  }

  /**
   * リンク用カラーパレット初期化
   */
  private initializeLinkColorPalette(): void {
    const palette = DOMHelper.getElementById('linkColorPalette');
    if (!palette) {
      console.warn('[WordMapPalettes] linkColorPalette要素が見つかりません');
      return;
    }
    
    // パレットクリア
    palette.innerHTML = '';
    
    // カラーアイテム生成
    this.config.COLORS.LINK_PALETTE.forEach(color => {
      const colorItem = DOMHelper.createElementWithClass('div', 'color-item');
      colorItem.style.backgroundColor = color;
      colorItem.setAttribute('data-color', color);
      colorItem.title = color;
      
      // クリックイベント
      DOMHelper.addEventListenerSafe(colorItem, 'click', () => {
        this.selectLinkColor(color, palette);
      });
      
      palette.appendChild(colorItem);
    });
    
    console.log(`リンク用カラーパレット初期化完了: ${this.config.COLORS.LINK_PALETTE.length}色`);
  }

  /**
   * リンク色選択処理
   */
  private selectLinkColor(color: string, palette: HTMLElement): void {
    // 選択状態更新
    palette.querySelectorAll('.color-item').forEach(item => 
      item.classList.remove('selected'));
    const selectedItem = palette.querySelector(`[data-color="${color}"]`);
    if (selectedItem) {
      selectedItem.classList.add('selected');
    }
    
    // 隠し入力値更新
    const linkColorInput = DOMHelper.getElementById('linkColor') as HTMLInputElement;
    if (linkColorInput) {
      linkColorInput.value = color;
    }
    
    // リンク更新（プロパティモジュール経由）
    if ((this.editor as any).properties) {
      (this.editor as any).properties.updateSelectedLink();
    } else {
      // フォールバック：旧メソッド呼び出し
      (this.editor as any).updateSelectedLink?.();
    }
  }

  /**
   * サイズセレクター初期化
   */
  private initializeSizeSelector(): void {
    const selector = DOMHelper.getElementById('nodeSizeSelector');
    if (!selector) {
      console.warn('[WordMapPalettes] nodeSizeSelector要素が見つかりません');
      return;
    }
    
    // 各サイズボタンにイベント設定
    const sizeButtons = selector.querySelectorAll('.size-btn') as NodeListOf<HTMLElement>;
    sizeButtons.forEach(button => {
      DOMHelper.addEventListenerSafe(button, 'click', () => {
        this.selectNodeSize(button, sizeButtons);
      });
    });
    
    console.log('サイズセレクター初期化完了');
  }

  /**
   * ノードサイズ選択処理
   */
  private selectNodeSize(button: HTMLElement, allButtons: NodeListOf<HTMLElement>): void {
    // 他の選択解除
    allButtons.forEach(btn => btn.classList.remove('active'));
    // 新しい選択
    button.classList.add('active');
    
    // 隠し入力値更新
    const size = button.getAttribute('data-size');
    const nodeSizeInput = DOMHelper.getElementById('nodeSize') as HTMLInputElement;
    if (nodeSizeInput && size) {
      nodeSizeInput.value = size;
    }
    
    // ノード更新（プロパティモジュール経由）
    if ((this.editor as any).properties) {
      (this.editor as any).properties.updateSelectedNode();
    } else {
      // フォールバック：旧メソッド呼び出し
      (this.editor as any).updateSelectedNode?.();
    }
  }

  /**
   * スタイルセレクター初期化
   */
  private initializeStyleSelector(): void {
    const selector = DOMHelper.getElementById('linkStyleSelector');
    if (!selector) {
      console.warn('[WordMapPalettes] linkStyleSelector要素が見つかりません');
      return;
    }
    
    // 各スタイルボタンにイベント設定
    const styleButtons = selector.querySelectorAll('.style-btn') as NodeListOf<HTMLElement>;
    styleButtons.forEach(button => {
      DOMHelper.addEventListenerSafe(button, 'click', () => {
        this.selectLinkStyle(button, styleButtons);
      });
    });
    
    console.log('スタイルセレクター初期化完了');
  }

  /**
   * リンクスタイル選択処理
   */
  private selectLinkStyle(button: HTMLElement, allButtons: NodeListOf<HTMLElement>): void {
    // 他の選択解除
    allButtons.forEach(btn => btn.classList.remove('active'));
    // 新しい選択
    button.classList.add('active');
    
    // スタイル値取得と適用
    const style = button.getAttribute('data-style');
    if (style) {
      if ((this.editor as any).properties) {
        (this.editor as any).properties.updateSelectedLinkStyle(style);
      } else {
        // フォールバック：旧メソッド呼び出し
        (this.editor as any).updateSelectedLinkStyle?.(style);
      }
    }
  }

  /**
   * カテゴリカラーパレット初期化
   */
  private initializeCategoryColorPalette(): void {
    const paletteSelector = DOMHelper.getElementById('categoryPaletteSelector') as HTMLSelectElement;
    if (!paletteSelector) {
      console.warn('[WordMapPalettes] categoryPaletteSelector要素が見つかりません');
      return;
    }
    
    DOMHelper.addEventListenerSafe(paletteSelector, 'change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.updateCategoryColorPalette(target.value);
    });
    
    // 初期パレット設定
    this.updateCategoryColorPalette(paletteSelector.value || 'レインボー');
    
    console.log('カテゴリカラーパレット初期化完了');
  }

  /**
   * カテゴリカラーパレット更新
   */
  public updateCategoryColorPalette(paletteName: string): void {
    const container = DOMHelper.getElementById('newCategoryColorPalette');
    if (!container) {
      console.warn('[WordMapPalettes] newCategoryColorPalette要素が見つかりません');
      return;
    }
    
    const colors = this.config.COLORS.CATEGORY_PALETTES[paletteName] || 
                   this.config.COLORS.CATEGORY_PALETTES['レインボー'] || 
                   this.config.COLORS.NODE_PALETTE;
    
    // パレットクリア
    container.innerHTML = '';
    
    // カラーアイテム生成
    colors.forEach(color => {
      const colorItem = DOMHelper.createElementWithClass('div', 'color-palette-mini-item');
      colorItem.style.backgroundColor = color;
      colorItem.setAttribute('data-color', color);
      colorItem.title = color;
      
      // クリックイベント
      DOMHelper.addEventListenerSafe(colorItem, 'click', () => {
        this.selectCategoryColor(color, container);
      });
      
      container.appendChild(colorItem);
    });
    
    // デフォルト選択
    if (colors.length > 0) {
      const firstItem = container.querySelector('.color-palette-mini-item') as HTMLElement;
      if (firstItem) {
        firstItem.classList.add('selected');
        const newCategoryColorInput = DOMHelper.getElementById('newCategoryColor') as HTMLInputElement;
        if (newCategoryColorInput) {
          newCategoryColorInput.value = colors[0];
        }
      }
    }
    
    console.log(`カテゴリカラーパレット更新: ${paletteName} (${colors.length}色)`);
  }

  /**
   * カテゴリ色選択処理
   */
  private selectCategoryColor(color: string, container: HTMLElement): void {
    // 選択状態更新
    container.querySelectorAll('.color-palette-mini-item').forEach(item => 
      item.classList.remove('selected'));
    const selectedItem = container.querySelector(`[data-color="${color}"]`);
    if (selectedItem) {
      selectedItem.classList.add('selected');
    }
    
    // 隠し入力値更新
    const newCategoryColorInput = DOMHelper.getElementById('newCategoryColor') as HTMLInputElement;
    if (newCategoryColorInput) {
      newCategoryColorInput.value = color;
    }
  }

  /**
   * カラーパレット選択状態更新
   */
  public updateColorPaletteSelection(color: string, paletteId: string = 'nodeColorPalette'): void {
    const palette = DOMHelper.getElementById(paletteId);
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
  public updateLinkColorPaletteSelection(color: string): void {
    this.updateColorPaletteSelection(color, 'linkColorPalette');
  }

  /**
   * サイズセレクター選択状態更新
   */
  public updateSizeSelectorSelection(size: string | number): void {
    const selector = DOMHelper.getElementById('nodeSizeSelector');
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
  public updateStyleSelectorSelection(style: string): void {
    const selector = DOMHelper.getElementById('linkStyleSelector');
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
  public updateDirectionSelectorSelection(direction: string): void {
    // 将来的な拡張用のプレースホルダー
    console.log(`方向セレクター更新: ${direction}`);
  }

  /**
   * カテゴリ色の動的変更
   */
  public changeCategoryColor(categoryId: string | number, newColor: string): void {
    if ((this.editor as any).categories) {
      (this.editor as any).categories.changeCategoryColor(categoryId, newColor);
    } else {
      console.warn('[WordMapPalettes] カテゴリモジュールが利用できません');
    }
  }

  /**
   * パレット状態のリセット
   */
  public resetPaletteSelections(): void {
    // 全パレットの選択状態をクリア
    ['nodeColorPalette', 'linkColorPalette'].forEach(paletteId => {
      const palette = DOMHelper.getElementById(paletteId);
      if (palette) {
        palette.querySelectorAll('.color-item').forEach(item => 
          item.classList.remove('selected'));
      }
    });
    
    // サイズセレクターリセット
    const sizeSelector = DOMHelper.getElementById('nodeSizeSelector');
    if (sizeSelector) {
      sizeSelector.querySelectorAll('.size-btn').forEach(btn => 
        btn.classList.remove('active'));
    }
    
    // スタイルセレクターリセット
    const styleSelector = DOMHelper.getElementById('linkStyleSelector');
    if (styleSelector) {
      styleSelector.querySelectorAll('.style-btn').forEach(btn => 
        btn.classList.remove('active'));
    }
    
    console.log('[WordMapPalettes] パレット選択状態リセット完了');
  }

  /**
   * パレット状態の取得
   */
  public getPaletteStates(): PaletteSelection {
    const nodeColorInput = DOMHelper.getElementById('nodeColor') as HTMLInputElement;
    const linkColorInput = DOMHelper.getElementById('linkColor') as HTMLInputElement;
    const nodeSizeInput = DOMHelper.getElementById('nodeSize') as HTMLInputElement;
    
    return {
      selectedNodeColor: nodeColorInput?.value,
      selectedLinkColor: linkColorInput?.value,
      selectedNodeSize: nodeSizeInput?.value,
      availableColors: {
        nodes: this.config.COLORS.NODE_PALETTE,
        links: this.config.COLORS.LINK_PALETTE
      }
    };
  }

  /**
   * パレット設定の検証
   */
  public validatePaletteConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // NODE_PALETTEの検証
    if (!Array.isArray(this.config.COLORS.NODE_PALETTE) || this.config.COLORS.NODE_PALETTE.length === 0) {
      errors.push('NODE_PALETTEが無効または空です');
    }
    
    // LINK_PALETTEの検証
    if (!Array.isArray(this.config.COLORS.LINK_PALETTE) || this.config.COLORS.LINK_PALETTE.length === 0) {
      errors.push('LINK_PALETTEが無効または空です');
    }
    
    // CATEGORY_PALETTESの検証
    if (!this.config.COLORS.CATEGORY_PALETTES || typeof this.config.COLORS.CATEGORY_PALETTES !== 'object') {
      errors.push('CATEGORY_PALETTESが無効です');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 動的パレット追加
   */
  public addColorToPalette(color: string, paletteType: 'node' | 'link'): boolean {
    try {
      if (paletteType === 'node') {
        if (!this.config.COLORS.NODE_PALETTE.includes(color)) {
          this.config.COLORS.NODE_PALETTE.push(color);
          this.initializeColorPalette();
          return true;
        }
      } else if (paletteType === 'link') {
        if (!this.config.COLORS.LINK_PALETTE.includes(color)) {
          this.config.COLORS.LINK_PALETTE.push(color);
          this.initializeLinkColorPalette();
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('[WordMapPalettes] パレット色追加エラー:', error);
      return false;
    }
  }

  /**
   * パレットから色を削除
   */
  public removeColorFromPalette(color: string, paletteType: 'node' | 'link'): boolean {
    try {
      if (paletteType === 'node') {
        const index = this.config.COLORS.NODE_PALETTE.indexOf(color);
        if (index > -1) {
          this.config.COLORS.NODE_PALETTE.splice(index, 1);
          this.initializeColorPalette();
          return true;
        }
      } else if (paletteType === 'link') {
        const index = this.config.COLORS.LINK_PALETTE.indexOf(color);
        if (index > -1) {
          this.config.COLORS.LINK_PALETTE.splice(index, 1);
          this.initializeLinkColorPalette();
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('[WordMapPalettes] パレット色削除エラー:', error);
      return false;
    }
  }
}

// グローバルに公開（レガシー互換性のため）
if (typeof window !== 'undefined') {
  (window as any).WordMapPalettes = WordMapPalettes;
}

export default WordMapPalettes;