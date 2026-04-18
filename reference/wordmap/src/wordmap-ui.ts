/**
 * ワードマップエディター UIファサード
 * 2025-07-07 TypeScript変換: ファサードパターンによるUI統合管理の型安全化
 */

import { WordMapEditor, WordMapUI, UIState, WordMapConfig } from '../types/wordmap';
import { ErrorHandler } from './wordmap-utils';
import WordMapPalettes from './ui/WordMapPalettes';
import WordMapControls from './ui/WordMapControls';

export class WordMapUIFacade implements WordMapUI {
  public editor: WordMapEditor;
  public config: WordMapConfig;
  public palettes?: WordMapPalettes;
  public properties?: any;
  public categories?: any;
  public controls?: WordMapControls;

  constructor(editor: WordMapEditor) {
    this.editor = editor;
    this.config = editor.config;
  }

  /**
   * UI初期化
   */
  public initialize(): void {
    try {
      console.log('[WordMapUI] UI統合初期化開始');
      
      // モジュールの動的ロード
      this.loadCoreModules();
      
      console.log('[WordMapUI] UI統合初期化完了');
    } catch (error) {
      ErrorHandler.logError('WordMapUI', 'initialization', error as Error, undefined, (this.editor as any).debugModule);
      throw error;
    }
  }

  /**
   * コアモジュールの読み込み
   */
  private loadCoreModules(): void {
    try {
      // パレットモジュール初期化
      this.palettes = new WordMapPalettes(this.editor);
      this.palettes.initialize();
      
      // コントロールモジュール初期化
      this.controls = new WordMapControls(this.editor);
      this.controls.initialize();
      
      console.log('[WordMapUI] コアモジュール読み込み完了');
    } catch (error) {
      console.error('[WordMapUI] コアモジュール読み込みエラー:', error);
      throw error;
    }
  }

  /**
   * UI状態の取得
   */
  public getUIState(): UIState {
    return {
      palettes: this.palettes?.getPaletteStates(),
      controls: this.controls?.getForceSettings(),
      theme: this.editor.state.theme
    };
  }

  /**
   * UIリセット
   */
  public resetUI(): void {
    try {
      if (this.palettes) {
        this.palettes.resetPaletteSelections();
      }
      if (this.controls) {
        this.controls.resetControls();
      }
      
      console.log('[WordMapUI] UIリセット完了');
    } catch (error) {
      ErrorHandler.logError('WordMapUI', 'reset', error as Error, undefined, (this.editor as any).debugModule);
      throw error;
    }
  }

  /**
   * デバッグ情報の取得
   */
  public getDebugInfo(): any {
    return {
      initialized: {
        palettes: !!this.palettes,
        properties: !!this.properties,
        categories: !!this.categories,
        controls: !!this.controls
      },
      state: this.editor.state,
      dataStats: {
        nodeCount: this.editor.data.nodes.length,
        linkCount: this.editor.data.links.length,
        categoryCount: this.editor.data.categories.length
      },
      modules: {
        palettes: this.palettes ? 'loaded' : 'not loaded',
        properties: this.properties ? 'loaded' : 'not loaded',
        categories: this.categories ? 'loaded' : 'not loaded',
        controls: this.controls ? 'loaded' : 'not loaded'
      }
    };
  }

  /**
   * モジュール動的ロード
   */
  public async loadModule(moduleName: string): Promise<void> {
    try {
      console.log(`[WordMapUI] モジュールロード: ${moduleName}`);
      
      switch (moduleName) {
        case 'palettes':
          if (!this.palettes) {
            this.palettes = new WordMapPalettes(this.editor);
            this.palettes.initialize();
          }
          break;
        case 'controls':
          if (!this.controls) {
            this.controls = new WordMapControls(this.editor);
            this.controls.initialize();
          }
          break;
        default:
          console.warn(`[WordMapUI] 未知のモジュール: ${moduleName}`);
      }
      
      console.log(`[WordMapUI] モジュール ${moduleName} ロード完了`);
    } catch (error) {
      ErrorHandler.logError('WordMapUI', 'loadModule', error as Error, { moduleName }, (this.editor as any).debugModule);
      throw error;
    }
  }

  // =====================================
  // Facade methods for backward compatibility
  // =====================================

  /**
   * プロパティパネル更新
   */
  public updatePropertiesPanel(): void {
    if (this.properties) {
      this.properties.updatePropertiesPanel();
    }
  }

  /**
   * 選択ノード更新
   */
  public updateSelectedNode(): void {
    if (this.properties) {
      this.properties.updateSelectedNode();
    }
  }

  /**
   * 選択リンク更新
   */
  public updateSelectedLink(): void {
    if (this.properties) {
      this.properties.updateSelectedLink();
    }
  }

  /**
   * 選択リンクスタイル更新
   */
  public updateSelectedLinkStyle(style: string): void {
    if (this.properties) {
      this.properties.updateSelectedLink();
    }
  }

  /**
   * 複数選択要素更新
   */
  public updateMultiSelectedElements(): void {
    if (this.properties) {
      this.properties.updateMultiSelectedElements();
    }
  }

  /**
   * カテゴリ更新
   */
  public updateCategories(): void {
    if (this.categories) {
      this.categories.updateCategories();
    }
  }

  /**
   * カテゴリ色変更
   */
  public changeCategoryColor(categoryId: string | number, newColor: string): void {
    if (this.categories) {
      this.categories.changeCategoryColor(categoryId, newColor);
    }
  }

  /**
   * テーマ切り替え
   */
  public toggleTheme(): void {
    if (this.controls) {
      this.controls.toggleTheme();
    }
  }

  /**
   * パレット選択状態更新
   */
  public updateColorPaletteSelection(color: string, paletteId?: string): void {
    if (this.palettes) {
      this.palettes.updateColorPaletteSelection(color, paletteId);
    }
  }

  /**
   * サイズセレクター更新
   */
  public updateSizeSelectorSelection(size: string | number): void {
    if (this.palettes) {
      this.palettes.updateSizeSelectorSelection(size);
    }
  }

  /**
   * スタイルセレクター更新
   */
  public updateStyleSelectorSelection(style: string): void {
    if (this.palettes) {
      this.palettes.updateStyleSelectorSelection(style);
    }
  }

  /**
   * フォース設定更新
   */
  public updateForceSettings(settings: any): void {
    if (this.controls) {
      this.controls.setForceSettings(settings);
    }
  }

  /**
   * モーダル表示
   */
  public showModal(modalId: string): boolean {
    if (this.controls) {
      return this.controls.showModal(modalId);
    }
    return false;
  }

  /**
   * モーダル非表示
   */
  public hideModal(modalId: string): boolean {
    if (this.controls) {
      return this.controls.hideModal(modalId);
    }
    return false;
  }

  /**
   * 完全な状態リセット
   */
  public fullReset(): void {
    try {
      this.resetUI();
      
      // エディターの状態もリセット
      this.editor.state.selectedElements = [];
      this.editor.state.multiSelectedElements = [];
      this.editor.state.mode = 'unified';
      this.editor.state.zoom = 1;
      this.editor.state.theme = 'light';
      
      console.log('[WordMapUI] 完全リセット完了');
    } catch (error) {
      ErrorHandler.logError('WordMapUI', 'fullReset', error as Error, undefined, (this.editor as any).debugModule);
      throw error;
    }
  }

  /**
   * UI状態の検証
   */
  public validateUIState(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.palettes) {
      errors.push('パレットモジュールが初期化されていません');
    }
    
    if (!this.controls) {
      errors.push('コントロールモジュールが初期化されていません');
    }
    
    // コントロール状態の検証
    if (this.controls) {
      const controlValidation = this.controls.validateControlState();
      if (!controlValidation.valid) {
        errors.push(...controlValidation.errors);
      }
    }
    
    // パレット設定の検証
    if (this.palettes) {
      const paletteValidation = this.palettes.validatePaletteConfiguration();
      if (!paletteValidation.valid) {
        errors.push(...paletteValidation.errors);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 統計情報の取得
   */
  public getStatistics(): any {
    return {
      ui: this.getUIState(),
      validation: this.validateUIState(),
      modules: this.getDebugInfo().modules,
      performance: {
        initTime: Date.now(),
        modulesLoaded: Object.values(this.getDebugInfo().modules).filter(status => status === 'loaded').length
      }
    };
  }
}

// グローバルに公開（レガシー互換性のため）
if (typeof window !== 'undefined') {
  (window as any).WordMapUI = WordMapUIFacade;
}

export default WordMapUIFacade;