/**
 * ワードマップエディター コントロール管理モジュール
 * 2025-07-07 TypeScript変換: イベントハンドラー、モーダル、ツールバー、テーマ管理の型安全化
 */

import { WordMapEditor, WordMapConfig, ForceSettings } from '../../types/wordmap';
import { DOMHelper, ErrorHandler } from '../wordmap-utils';

export interface ControlSettings {
  centerForce?: number;
  chargeForce?: number;
  linkDistance?: number;
  linkStrength?: number;
}

export class WordMapControls {
  private editor: WordMapEditor;
  private config: WordMapConfig;

  constructor(editor: WordMapEditor) {
    this.editor = editor;
    this.config = editor.config;
  }

  /**
   * コントロール初期化
   */
  public initialize(): void {
    console.log('[WordMapControls] コントロール初期化開始');
    
    try {
      this.setupForceSettings();
      this.setupModalEvents();
      this.setupToolbarEvents();
      this.setupThemeToggle();
      this.setupKeyboardShortcuts();
      console.log('[WordMapControls] コントロール初期化完了');
    } catch (error) {
      console.error('[WordMapControls] コントロール初期化エラー:', error);
      throw error;
    }
  }

  /**
   * フォース設定
   */
  private setupForceSettings(): void {
    // 中心引力設定
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('centerForce'), 
      'input', 
      (e) => {
        try {
          const target = e.target as HTMLInputElement;
          const value = parseFloat(target.value);
          (this.editor as any).updateForceCenter?.(value);
          
          const valueElement = DOMHelper.getElementById('centerForceValue');
          if (valueElement) valueElement.textContent = target.value;
        } catch (error) {
          ErrorHandler.logError('WordMapControls', 'CenterForceUpdateError', error as Error, null, (this.editor as any).debugModule);
        }
      }
    );
    
    // 反発力設定
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('chargeForce'), 
      'input', 
      (e) => {
        try {
          const target = e.target as HTMLInputElement;
          const value = parseInt(target.value);
          (this.editor as any).updateForceCharge?.(value);
          
          const valueElement = DOMHelper.getElementById('chargeForceValue');
          if (valueElement) valueElement.textContent = target.value;
        } catch (error) {
          ErrorHandler.logError('WordMapControls', 'ChargeForceUpdateError', error as Error, null, (this.editor as any).debugModule);
        }
      }
    );
    
    // リンク距離設定
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('linkDistance'), 
      'input', 
      (e) => {
        try {
          const target = e.target as HTMLInputElement;
          const value = parseInt(target.value);
          (this.editor as any).updateLinkDistance?.(value);
          
          const valueElement = DOMHelper.getElementById('linkDistanceValue');
          if (valueElement) valueElement.textContent = target.value;
        } catch (error) {
          ErrorHandler.logError('WordMapControls', 'LinkDistanceUpdateError', error as Error, null, (this.editor as any).debugModule);
        }
      }
    );
    
    // リンク強度設定
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('linkStrength'), 
      'input', 
      (e) => {
        try {
          const target = e.target as HTMLInputElement;
          const value = parseFloat(target.value);
          (this.editor as any).updateLinkStrength?.(value);
          
          const valueElement = DOMHelper.getElementById('linkStrengthValue');
          if (valueElement) valueElement.textContent = target.value;
        } catch (error) {
          ErrorHandler.logError('WordMapControls', 'LinkStrengthUpdateError', error as Error, null, (this.editor as any).debugModule);
        }
      }
    );
    
    console.log('[WordMapControls] フォース設定初期化完了');
  }

  /**
   * モーダルイベント設定
   */
  private setupModalEvents(): void {
    // ヘルプモーダル
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('helpModalClose'), 
      'click', 
      () => {
        const helpModal = DOMHelper.getElementById('helpModal');
        if (helpModal) helpModal.classList.add('hidden');
      }
    );
    
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('helpCloseBtn'), 
      'click', 
      () => {
        const helpModal = DOMHelper.getElementById('helpModal');
        if (helpModal) helpModal.classList.add('hidden');
      }
    );
    
    // モーダル背景クリックで閉じる
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('helpModal'), 
      'click', 
      (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('modal-overlay')) {
          target.classList.add('hidden');
        }
      }
    );

    // カテゴリ管理モーダル
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('categoryManageModalClose'), 
      'click', 
      () => {
        const modal = DOMHelper.getElementById('categoryManageModal');
        if (modal) modal.classList.add('hidden');
      }
    );

    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('categoryManageCloseBtn'), 
      'click', 
      () => {
        const modal = DOMHelper.getElementById('categoryManageModal');
        if (modal) modal.classList.add('hidden');
      }
    );

    // クリアモーダル
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('clearModalClose'), 
      'click', 
      () => {
        const modal = DOMHelper.getElementById('clearModal');
        if (modal) modal.classList.add('hidden');
      }
    );

    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('clearCancelBtn'), 
      'click', 
      () => {
        const modal = DOMHelper.getElementById('clearModal');
        if (modal) modal.classList.add('hidden');
      }
    );

    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('clearSaveBtn'), 
      'click', 
      () => {
        if (this.editor.saveData) {
          this.editor.saveData();
        }
        if (this.editor.clearAllData) {
          this.editor.clearAllData();
        }
        const modal = DOMHelper.getElementById('clearModal');
        if (modal) modal.classList.add('hidden');
      }
    );

    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('clearConfirmBtn'), 
      'click', 
      () => {
        if (this.editor.clearAllData) {
          this.editor.clearAllData();
        }
        const modal = DOMHelper.getElementById('clearModal');
        if (modal) modal.classList.add('hidden');
      }
    );
    
    console.log('[WordMapControls] モーダルイベント設定完了');
  }

  /**
   * ツールバーイベント設定
   */
  private setupToolbarEvents(): void {
    // 保存ボタン
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('saveBtn'), 
      'click', 
      () => {
        try {
          this.editor.saveData?.();
        } catch (error) {
          ErrorHandler.logError('WordMapControls', 'SaveError', error as Error, null, (this.editor as any).debugModule);
        }
      }
    );

    // 読込ボタン
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('loadBtn'), 
      'click', 
      () => {
        try {
          this.editor.loadData?.();
        } catch (error) {
          ErrorHandler.logError('WordMapControls', 'LoadError', error as Error, null, (this.editor as any).debugModule);
        }
      }
    );

    // 全体表示ボタン
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('fitBtn'), 
      'click', 
      () => {
        try {
          this.editor.fitToView?.();
        } catch (error) {
          ErrorHandler.logError('WordMapControls', 'FitToViewError', error as Error, null, (this.editor as any).debugModule);
        }
      }
    );

    // レイアウトリセットボタン
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('resetLayoutBtn'), 
      'click', 
      () => {
        try {
          this.editor.resetLayout?.();
        } catch (error) {
          ErrorHandler.logError('WordMapControls', 'ResetLayoutError', error as Error, null, (this.editor as any).debugModule);
        }
      }
    );

    // ヘルプボタン
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('helpBtn'), 
      'click', 
      () => {
        const helpModal = DOMHelper.getElementById('helpModal');
        if (helpModal) helpModal.classList.remove('hidden');
      }
    );

    // デバッグボタン
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('debugToggle'), 
      'click', 
      () => {
        try {
          this.editor.toggleDebug?.();
        } catch (error) {
          ErrorHandler.logError('WordMapControls', 'DebugToggleError', error as Error, null, (this.editor as any).debugModule);
        }
      }
    );

    // クリアボタン
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('clearBtn'), 
      'click', 
      () => {
        const clearModal = DOMHelper.getElementById('clearModal');
        if (clearModal) clearModal.classList.remove('hidden');
      }
    );

    // テーマトグルボタン
    DOMHelper.addEventListenerSafe(
      DOMHelper.getElementById('themeToggle'), 
      'click', 
      () => {
        this.toggleTheme();
      }
    );
    
    console.log('[WordMapControls] ツールバーイベント設定完了');
  }

  /**
   * テーマトグル設定
   */
  private setupThemeToggle(): void {
    // 初期テーマ状態の確認
    this.updateThemeButton();
    console.log('[WordMapControls] テーマトグル設定完了');
  }

  /**
   * テーマ切り替え
   */
  public toggleTheme(): void {
    try {
      const body = document.body;
      const isDark = body.classList.contains('dark-theme');
      
      if (isDark) {
        body.classList.remove('dark-theme');
        this.editor.state.theme = 'light';
      } else {
        body.classList.add('dark-theme');
        this.editor.state.theme = 'dark';
      }
      
      this.updateThemeButton();
      
      // エディターのテーマ更新
      if (this.editor.updateTheme) {
        this.editor.updateTheme(this.editor.state.theme);
      }
      
      console.log(`[WordMapControls] テーマ切り替え: ${this.editor.state.theme}`);
      
    } catch (error) {
      ErrorHandler.logError('WordMapControls', 'ThemeToggleError', error as Error, null, (this.editor as any).debugModule);
    }
  }

  /**
   * テーマボタン更新
   */
  private updateThemeButton(): void {
    const themeBtn = DOMHelper.getElementById('themeToggle');
    if (!themeBtn) return;
    
    const isDark = document.body.classList.contains('dark-theme');
    themeBtn.textContent = isDark ? '☀️ ライト' : '🌙 ダーク';
    themeBtn.title = isDark ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え';
  }

  /**
   * キーボードショートカット設定
   */
  public setupKeyboardShortcuts(): void {
    DOMHelper.addEventListenerSafe(document, 'keydown', (e) => {
      try {
        const keyEvent = e as KeyboardEvent;
        
        // Ctrl+Sで保存
        if (keyEvent.ctrlKey && keyEvent.code === this.config.SHORTCUTS?.SAVE) {
          keyEvent.preventDefault();
          this.editor.saveData?.();
        }
        
        // Ctrl+Oで読み込み
        if (keyEvent.ctrlKey && keyEvent.code === this.config.SHORTCUTS?.LOAD) {
          keyEvent.preventDefault();
          this.editor.loadData?.();
        }
        
        // Fで全体表示
        if (keyEvent.code === this.config.SHORTCUTS?.FIT_VIEW) {
          keyEvent.preventDefault();
          this.editor.fitToView?.();
        }
        
        // Rでレイアウトリセット
        if (keyEvent.code === this.config.SHORTCUTS?.RESET_LAYOUT) {
          keyEvent.preventDefault();
          this.editor.resetLayout?.();
        }
        
        // Hでヘルプ
        if (keyEvent.code === this.config.SHORTCUTS?.HELP) {
          keyEvent.preventDefault();
          const helpModal = DOMHelper.getElementById('helpModal');
          if (helpModal) helpModal.classList.remove('hidden');
        }
        
        // Tでテーマ切り替え
        if (keyEvent.code === 'KeyT') {
          keyEvent.preventDefault();
          this.toggleTheme();
        }
        
      } catch (error) {
        ErrorHandler.logError('WordMapControls', 'KeyboardShortcutError', error as Error, null, (this.editor as any).debugModule);
      }
    });
    
    console.log('[WordMapControls] キーボードショートカット設定完了');
  }

  /**
   * フォース設定値の取得
   */
  public getForceSettings(): ForceSettings {
    const centerForceElement = DOMHelper.getElementById('centerForce') as HTMLInputElement;
    const chargeForceElement = DOMHelper.getElementById('chargeForce') as HTMLInputElement;
    const linkDistanceElement = DOMHelper.getElementById('linkDistance') as HTMLInputElement;
    const linkStrengthElement = DOMHelper.getElementById('linkStrength') as HTMLInputElement;

    return {
      centerForce: parseFloat(centerForceElement?.value || '0.3'),
      chargeForce: parseInt(chargeForceElement?.value || '-300'),
      linkDistance: parseInt(linkDistanceElement?.value || '100'),
      linkStrength: parseFloat(linkStrengthElement?.value || '1')
    };
  }

  /**
   * フォース設定値の設定
   */
  public setForceSettings(settings: ControlSettings): void {
    if (settings.centerForce !== undefined) {
      const element = DOMHelper.getElementById('centerForce') as HTMLInputElement;
      const valueElement = DOMHelper.getElementById('centerForceValue');
      if (element) {
        element.value = settings.centerForce.toString();
        if (valueElement) valueElement.textContent = settings.centerForce.toString();
      }
    }
    
    if (settings.chargeForce !== undefined) {
      const element = DOMHelper.getElementById('chargeForce') as HTMLInputElement;
      const valueElement = DOMHelper.getElementById('chargeForceValue');
      if (element) {
        element.value = settings.chargeForce.toString();
        if (valueElement) valueElement.textContent = settings.chargeForce.toString();
      }
    }
    
    if (settings.linkDistance !== undefined) {
      const element = DOMHelper.getElementById('linkDistance') as HTMLInputElement;
      const valueElement = DOMHelper.getElementById('linkDistanceValue');
      if (element) {
        element.value = settings.linkDistance.toString();
        if (valueElement) valueElement.textContent = settings.linkDistance.toString();
      }
    }
    
    if (settings.linkStrength !== undefined) {
      const element = DOMHelper.getElementById('linkStrength') as HTMLInputElement;
      const valueElement = DOMHelper.getElementById('linkStrengthValue');
      if (element) {
        element.value = settings.linkStrength.toString();
        if (valueElement) valueElement.textContent = settings.linkStrength.toString();
      }
    }
  }

  /**
   * コントロール状態のリセット
   */
  public resetControls(): void {
    // フォース設定をデフォルトに戻す
    this.setForceSettings({
      centerForce: this.config.FORCE?.CENTER_STRENGTH || 0.3,
      chargeForce: this.config.FORCE?.CHARGE_STRENGTH || -300,
      linkDistance: this.config.FORCE?.LINK_DISTANCE || 100,
      linkStrength: this.config.FORCE?.LINK_STRENGTH || 1
    });
    
    // テーマをライトモードに戻す
    document.body.classList.remove('dark-theme');
    this.editor.state.theme = 'light';
    this.updateThemeButton();
    
    console.log('[WordMapControls] コントロール状態リセット完了');
  }

  /**
   * コントロール状態の検証
   */
  public validateControlState(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // フォース設定の検証
    const forceSettings = this.getForceSettings();
    
    if (isNaN(forceSettings.centerForce) || forceSettings.centerForce < 0 || forceSettings.centerForce > 1) {
      errors.push('centerForceが無効な範囲です (0-1)');
    }
    
    if (isNaN(forceSettings.chargeForce) || forceSettings.chargeForce > 0) {
      errors.push('chargeForceが無効です (負の値である必要があります)');
    }
    
    if (isNaN(forceSettings.linkDistance) || forceSettings.linkDistance <= 0) {
      errors.push('linkDistanceが無効です (正の値である必要があります)');
    }
    
    if (isNaN(forceSettings.linkStrength) || forceSettings.linkStrength < 0 || forceSettings.linkStrength > 1) {
      errors.push('linkStrengthが無効な範囲です (0-1)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * モーダル状態の管理
   */
  public showModal(modalId: string): boolean {
    const modal = DOMHelper.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      return true;
    }
    return false;
  }

  public hideModal(modalId: string): boolean {
    const modal = DOMHelper.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      return true;
    }
    return false;
  }

  public isModalVisible(modalId: string): boolean {
    const modal = DOMHelper.getElementById(modalId);
    return modal ? !modal.classList.contains('hidden') : false;
  }

  /**
   * テーマ状態の取得
   */
  public getThemeState(): 'light' | 'dark' {
    return this.editor.state.theme;
  }

  /**
   * テーマの強制設定
   */
  public setTheme(theme: 'light' | 'dark'): void {
    const body = document.body;
    
    if (theme === 'dark') {
      body.classList.add('dark-theme');
    } else {
      body.classList.remove('dark-theme');
    }
    
    this.editor.state.theme = theme;
    this.updateThemeButton();
    
    if (this.editor.updateTheme) {
      this.editor.updateTheme(theme);
    }
    
    console.log(`[WordMapControls] テーマ設定: ${theme}`);
  }

  /**
   * デバッグ情報の取得
   */
  public getDebugInfo(): any {
    return {
      forceSettings: this.getForceSettings(),
      theme: this.getThemeState(),
      modalStates: {
        help: this.isModalVisible('helpModal'),
        categoryManage: this.isModalVisible('categoryManageModal'),
        clear: this.isModalVisible('clearModal')
      },
      validation: this.validateControlState()
    };
  }
}

// グローバルに公開（レガシー互換性のため）
if (typeof window !== 'undefined') {
  (window as any).WordMapControls = WordMapControls;
}

export default WordMapControls;