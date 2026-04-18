/**
 * ワードマップエディター コントロール管理モジュール
 * 2025-07-07 作成: イベントハンドラー、モーダル、ツールバー、テーマ管理
 */

class WordMapControls {
    constructor(editor) {
        this.editor = editor;
        this.config = editor.config || CONFIG;
    }

    /**
     * コントロール初期化
     */
    initialize() {
        console.log('[WordMapControls] コントロール初期化開始');
        this.setupForceSettings();
        this.setupModalEvents();
        this.setupToolbarEvents();
        this.setupThemeToggle();
        console.log('[WordMapControls] コントロール初期化完了');
    }

    /**
     * フォース設定
     */
    setupForceSettings() {
        // フォースパラメータ調整
        const { DOMHelper, ErrorHandler } = window.WordMapUtils || {};
        
        // 中心引力設定
        DOMHelper?.addEventListenerSafe(
            document.getElementById('centerForce'), 
            'input', 
            (e) => {
                try {
                    this.editor.updateForceCenter?.(parseFloat(e.target.value));
                    const valueElement = document.getElementById('centerForceValue');
                    if (valueElement) valueElement.textContent = e.target.value;
                } catch (error) {
                    ErrorHandler?.logError('WordMapControls', 'CenterForceUpdateError', error, null, this.editor.debugModule);
                }
            }
        );
        
        // 反発力設定
        DOMHelper?.addEventListenerSafe(
            document.getElementById('chargeForce'), 
            'input', 
            (e) => {
                try {
                    this.editor.updateForceCharge?.(parseInt(e.target.value));
                    const valueElement = document.getElementById('chargeForceValue');
                    if (valueElement) valueElement.textContent = e.target.value;
                } catch (error) {
                    ErrorHandler?.logError('WordMapControls', 'ChargeForceUpdateError', error, null, this.editor.debugModule);
                }
            }
        );
        
        // リンク距離設定
        DOMHelper?.addEventListenerSafe(
            document.getElementById('linkDistance'), 
            'input', 
            (e) => {
                try {
                    this.editor.updateLinkDistance?.(parseInt(e.target.value));
                    const valueElement = document.getElementById('linkDistanceValue');
                    if (valueElement) valueElement.textContent = e.target.value;
                } catch (error) {
                    ErrorHandler?.logError('WordMapControls', 'LinkDistanceUpdateError', error, null, this.editor.debugModule);
                }
            }
        );
        
        // リンク強度設定
        DOMHelper?.addEventListenerSafe(
            document.getElementById('linkStrength'), 
            'input', 
            (e) => {
                try {
                    this.editor.updateLinkStrength?.(parseFloat(e.target.value));
                    const valueElement = document.getElementById('linkStrengthValue');
                    if (valueElement) valueElement.textContent = e.target.value;
                } catch (error) {
                    ErrorHandler?.logError('WordMapControls', 'LinkStrengthUpdateError', error, null, this.editor.debugModule);
                }
            }
        );
        
        console.log('[WordMapControls] フォース設定初期化完了');
    }

    /**
     * モーダルイベント設定
     */
    setupModalEvents() {
        const { DOMHelper } = window.WordMapUtils || {};

        // ヘルプモーダル
        DOMHelper?.addEventListenerSafe(
            document.getElementById('helpModalClose'), 
            'click', 
            () => {
                const helpModal = document.getElementById('helpModal');
                if (helpModal) helpModal.classList.add('hidden');
            }
        );
        
        DOMHelper?.addEventListenerSafe(
            document.getElementById('helpCloseBtn'), 
            'click', 
            () => {
                const helpModal = document.getElementById('helpModal');
                if (helpModal) helpModal.classList.add('hidden');
            }
        );
        
        // モーダル背景クリックで閉じる
        DOMHelper?.addEventListenerSafe(
            document.getElementById('helpModal'), 
            'click', 
            (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    e.target.classList.add('hidden');
                }
            }
        );

        // カテゴリ管理モーダル
        DOMHelper?.addEventListenerSafe(
            document.getElementById('categoryManageModalClose'), 
            'click', 
            () => {
                const modal = document.getElementById('categoryManageModal');
                if (modal) modal.classList.add('hidden');
            }
        );

        DOMHelper?.addEventListenerSafe(
            document.getElementById('categoryManageCloseBtn'), 
            'click', 
            () => {
                const modal = document.getElementById('categoryManageModal');
                if (modal) modal.classList.add('hidden');
            }
        );

        // クリアモーダル
        DOMHelper?.addEventListenerSafe(
            document.getElementById('clearModalClose'), 
            'click', 
            () => {
                const modal = document.getElementById('clearModal');
                if (modal) modal.classList.add('hidden');
            }
        );

        DOMHelper?.addEventListenerSafe(
            document.getElementById('clearCancelBtn'), 
            'click', 
            () => {
                const modal = document.getElementById('clearModal');
                if (modal) modal.classList.add('hidden');
            }
        );

        DOMHelper?.addEventListenerSafe(
            document.getElementById('clearSaveBtn'), 
            'click', 
            () => {
                if (this.editor.saveData) {
                    this.editor.saveData();
                }
                if (this.editor.clearAllData) {
                    this.editor.clearAllData();
                }
                const modal = document.getElementById('clearModal');
                if (modal) modal.classList.add('hidden');
            }
        );

        DOMHelper?.addEventListenerSafe(
            document.getElementById('clearConfirmBtn'), 
            'click', 
            () => {
                if (this.editor.clearAllData) {
                    this.editor.clearAllData();
                }
                const modal = document.getElementById('clearModal');
                if (modal) modal.classList.add('hidden');
            }
        );
        
        console.log('[WordMapControls] モーダルイベント設定完了');
    }

    /**
     * ツールバーイベント設定
     */
    setupToolbarEvents() {
        const { DOMHelper, ErrorHandler } = window.WordMapUtils || {};

        // 保存ボタン
        DOMHelper?.addEventListenerSafe(
            document.getElementById('saveBtn'), 
            'click', 
            () => {
                try {
                    this.editor.saveData?.();
                } catch (error) {
                    ErrorHandler?.logError('WordMapControls', 'SaveError', error, null, this.editor.debugModule);
                }
            }
        );

        // 読込ボタン
        DOMHelper?.addEventListenerSafe(
            document.getElementById('loadBtn'), 
            'click', 
            () => {
                try {
                    this.editor.loadData?.();
                } catch (error) {
                    ErrorHandler?.logError('WordMapControls', 'LoadError', error, null, this.editor.debugModule);
                }
            }
        );

        // 全体表示ボタン
        DOMHelper?.addEventListenerSafe(
            document.getElementById('fitBtn'), 
            'click', 
            () => {
                try {
                    this.editor.fitToView?.();
                } catch (error) {
                    ErrorHandler?.logError('WordMapControls', 'FitToViewError', error, null, this.editor.debugModule);
                }
            }
        );

        // レイアウトリセットボタン
        DOMHelper?.addEventListenerSafe(
            document.getElementById('resetLayoutBtn'), 
            'click', 
            () => {
                try {
                    this.editor.resetLayout?.();
                } catch (error) {
                    ErrorHandler?.logError('WordMapControls', 'ResetLayoutError', error, null, this.editor.debugModule);
                }
            }
        );

        // ヘルプボタン
        DOMHelper?.addEventListenerSafe(
            document.getElementById('helpBtn'), 
            'click', 
            () => {
                const helpModal = document.getElementById('helpModal');
                if (helpModal) helpModal.classList.remove('hidden');
            }
        );

        // デバッグボタン
        DOMHelper?.addEventListenerSafe(
            document.getElementById('debugToggle'), 
            'click', 
            () => {
                try {
                    this.editor.toggleDebug?.();
                } catch (error) {
                    ErrorHandler?.logError('WordMapControls', 'DebugToggleError', error, null, this.editor.debugModule);
                }
            }
        );

        // クリアボタン
        DOMHelper?.addEventListenerSafe(
            document.getElementById('clearBtn'), 
            'click', 
            () => {
                const clearModal = document.getElementById('clearModal');
                if (clearModal) clearModal.classList.remove('hidden');
            }
        );

        // テーマトグルボタン
        DOMHelper?.addEventListenerSafe(
            document.getElementById('themeToggle'), 
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
    setupThemeToggle() {
        // 初期テーマ状態の確認
        this.updateThemeButton();
        console.log('[WordMapControls] テーマトグル設定完了');
    }

    /**
     * テーマ切り替え
     */
    toggleTheme() {
        const { ErrorHandler } = window.WordMapUtils || {};
        
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
            ErrorHandler?.logError('WordMapControls', 'ThemeToggleError', error, null, this.editor.debugModule);
        }
    }

    /**
     * テーマボタン更新
     */
    updateThemeButton() {
        const themeBtn = document.getElementById('themeToggle');
        if (!themeBtn) return;
        
        const isDark = document.body.classList.contains('dark-theme');
        themeBtn.textContent = isDark ? '☀️ ライト' : '🌙 ダーク';
        themeBtn.title = isDark ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え';
    }

    /**
     * キーボードショートカット設定
     */
    setupKeyboardShortcuts() {
        const { DOMHelper, ErrorHandler } = window.WordMapUtils || {};
        
        DOMHelper?.addEventListenerSafe(document, 'keydown', (e) => {
            try {
                // Ctrl+Sで保存
                if (e.ctrlKey && e.code === this.config.SHORTCUTS?.SAVE) {
                    e.preventDefault();
                    this.editor.saveData?.();
                }
                
                // Ctrl+Oで読み込み
                if (e.ctrlKey && e.code === this.config.SHORTCUTS?.LOAD) {
                    e.preventDefault();
                    this.editor.loadData?.();
                }
                
                // Fで全体表示
                if (e.code === this.config.SHORTCUTS?.FIT_VIEW) {
                    e.preventDefault();
                    this.editor.fitToView?.();
                }
                
                // Rでレイアウトリセット
                if (e.code === this.config.SHORTCUTS?.RESET_LAYOUT) {
                    e.preventDefault();
                    this.editor.resetLayout?.();
                }
                
                // Hでヘルプ
                if (e.code === this.config.SHORTCUTS?.HELP) {
                    e.preventDefault();
                    const helpModal = document.getElementById('helpModal');
                    if (helpModal) helpModal.classList.remove('hidden');
                }
                
                // Tでテーマ切り替え
                if (e.code === 'KeyT') {
                    e.preventDefault();
                    this.toggleTheme();
                }
                
            } catch (error) {
                ErrorHandler?.logError('WordMapControls', 'KeyboardShortcutError', error, null, this.editor.debugModule);
            }
        });
        
        console.log('[WordMapControls] キーボードショートカット設定完了');
    }

    /**
     * フォース設定値の取得
     */
    getForceSettings() {
        return {
            centerForce: parseFloat(document.getElementById('centerForce')?.value || 0.3),
            chargeForce: parseInt(document.getElementById('chargeForce')?.value || -300),
            linkDistance: parseInt(document.getElementById('linkDistance')?.value || 100),
            linkStrength: parseFloat(document.getElementById('linkStrength')?.value || 1)
        };
    }

    /**
     * フォース設定値の設定
     */
    setForceSettings(settings) {
        if (settings.centerForce !== undefined) {
            const element = document.getElementById('centerForce');
            if (element) {
                element.value = settings.centerForce;
                document.getElementById('centerForceValue').textContent = settings.centerForce;
            }
        }
        
        if (settings.chargeForce !== undefined) {
            const element = document.getElementById('chargeForce');
            if (element) {
                element.value = settings.chargeForce;
                document.getElementById('chargeForceValue').textContent = settings.chargeForce;
            }
        }
        
        if (settings.linkDistance !== undefined) {
            const element = document.getElementById('linkDistance');
            if (element) {
                element.value = settings.linkDistance;
                document.getElementById('linkDistanceValue').textContent = settings.linkDistance;
            }
        }
        
        if (settings.linkStrength !== undefined) {
            const element = document.getElementById('linkStrength');
            if (element) {
                element.value = settings.linkStrength;
                document.getElementById('linkStrengthValue').textContent = settings.linkStrength;
            }
        }
    }

    /**
     * コントロール状態のリセット
     */
    resetControls() {
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
}

// モジュールをグローバルに公開
window.WordMapControls = WordMapControls;