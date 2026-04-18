/**
 * ワードマップエディター IOモジュール
 * 2025-07-07 TypeScript変換: ファイル入出力・保存機能の型安全化
 */

import { WordMapEditor, WordMapData, WordMapNode, WordMapLink, WordMapCategory, FileFormat, SaveOptions, LoadOptions, WordMapConfig } from '../types/wordmap';
import { ErrorHandler, ValidationHelper } from './wordmap-utils';

declare global {
  interface Window {
    showSaveFilePicker?: (options?: any) => Promise<any>;
    showOpenFilePicker?: (options?: any) => Promise<any>;
  }
}

interface CSVData {
  nodes: string;
  links: string;
  categories: string;
}

interface ParsedCSVRow {
  [key: string]: string;
}

interface SavedFileInfo {
  key: string;
  name: string;
  date: string;
  nodeCount: number;
  linkCount: number;
}

interface AutoBackupData {
  timestamp: number;
  data: {
    nodes: WordMapNode[];
    links: WordMapLink[];
  };
}

export class WordMapIO {
  private editor: WordMapEditor;

  constructor(editor: WordMapEditor) {
    this.editor = editor;
  }

  /**
   * 静的初期化メソッド
   */
  static initialize(editor: WordMapEditor): WordMapIO {
    const io = new WordMapIO(editor);
    io.setupFileInput();
    
    // IOメソッドをエディターに統合
    editor.saveData = io.saveData.bind(io);
    editor.loadData = io.loadData.bind(io);
    (editor as any).exportData = io.exportData.bind(io);
    (editor as any).importWordMapData = io.importWordMapData.bind(io);
    (editor as any).markAsChanged = io.markAsChanged.bind(io);
    
    console.log('IOモジュール初期化完了');
    return io;
  }

  /**
   * ファイル入力の設定
   */
  private setupFileInput(): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (!fileInput) return;

    fileInput.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file && (file.type === 'application/json' || file.name.endsWith('.json') || file.name.endsWith('.csv'))) {
        this.loadFromFile(file);
      } else {
        alert('JSONまたはCSVファイルを選択してください。');
      }
      // ファイル選択をクリア
      target.value = '';
    });

    console.log('ファイル入力設定完了');
  }

  /**
   * データ保存（ローカルファイルダウンロード）
   */
  public saveData(): void {
    try {
      // 重複実行防止
      if (this.editor.isLoadingFile) {
        console.log('ファイル処理中のため保存をスキップ');
        return;
      }

      // 保存ダイアログを表示
      this.showSaveDialog();

    } catch (error) {
      ErrorHandler.logError('WordMapIO', 'save', error as Error, undefined, (this.editor as any).debugModule);
      alert('保存に失敗しました: ' + (error as Error).message);
    }
  }

  /**
   * 保存ダイアログ表示
   */
  private showSaveDialog(): void {
    // 既存のモーダルを削除
    const existingModal = document.getElementById('saveModal');
    if (existingModal) {
      existingModal.remove();
    }

    // デフォルトファイル名生成
    const now = new Date();
    const timestamp = now.getFullYear() + 
                    String(now.getMonth() + 1).padStart(2, '0') + 
                    String(now.getDate()).padStart(2, '0') + '_' +
                    String(now.getHours()).padStart(2, '0') + 
                    String(now.getMinutes()).padStart(2, '0');
    const defaultFilename = `wordmap_${timestamp}`;

    // モーダルHTML作成
    const modalHTML = `
        <div class="modal-overlay" id="saveModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>ファイル保存</h3>
                    <button class="modal-close" id="saveModalClose">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="save-options">
                        <label for="saveFilename">ファイル名:</label>
                        <input type="text" id="saveFilename" value="${defaultFilename}" placeholder="ファイル名を入力">
                        
                        <label for="saveFormat">ファイル形式:</label>
                        <select id="saveFormat">
                            <option value="json">JSON形式 (.json)</option>
                            <option value="csv">CSV形式 (.csv)</option>
                        </select>
                        
                        <div id="formatInfo" style="font-size: 12px; color: #666; margin-top: 5px;">
                            JSON: 全データを保持した完全な形式<br>
                            CSV: ノードとリンクの情報を表形式で保存
                        </div>
                        
                        <div style="margin: 15px 0;">
                            <label for="saveLocation">保存場所:</label>
                            <select id="saveLocation">
                                <option value="localStorage" selected>アプリに保存</option>
                                <option value="download">ローカルに保存</option>
                            </select>
                        </div>
                        
                        <div class="save-info">
                            <div style="background: #e3f2fd; border: 1px solid #bbdefb; border-radius: 4px; padding: 12px; margin: 15px 0;">
                                <strong>データ情報:</strong><br>
                                ノード: ${this.editor.data.nodes.length}個<br>
                                リンク: ${this.editor.data.links.length}個<br>
                                作成日時: ${new Date().toLocaleString()}
                            </div>
                            <div style="font-size: 12px; color: #666; margin-top: 10px;">
                                <strong>保存先について:</strong><br>
                                • <strong>アプリに保存</strong>: ブラウザ内に保存（次回自動で読み込まれます）<br>
                                • <strong>ローカルに保存</strong>: ファイルとしてPCに保存（保存場所を選択できます）
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="saveCancelBtn">キャンセル</button>
                    <button class="btn btn-primary" id="saveConfirmBtn">💾 保存</button>
                </div>
            </div>
        </div>
    `;

    // モーダルをDOMに追加
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // イベントリスナー設定
    this.setupSaveDialogEvents();
    
    // 初期状態で「アプリに保存」を選択
    const saveLocationSelect = document.getElementById('saveLocation') as HTMLSelectElement;
    if (saveLocationSelect) {
      saveLocationSelect.value = 'localStorage';
    }
  }

  /**
   * 保存ダイアログのイベント設定
   */
  private setupSaveDialogEvents(): void {
    const modal = document.getElementById('saveModal');
    const closeBtn = document.getElementById('saveModalClose');
    const cancelBtn = document.getElementById('saveCancelBtn');
    const confirmBtn = document.getElementById('saveConfirmBtn');
    const filenameInput = document.getElementById('saveFilename') as HTMLInputElement;

    // モーダルを閉じる
    const closeModal = () => {
      modal?.remove();
    };

    // イベントリスナー
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    
    // Escapeキーでモーダルを閉じる
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    // 保存実行
    confirmBtn?.addEventListener('click', () => {
      const filename = filenameInput?.value?.trim() || 'wordmap';
      const saveLocationSelect = document.getElementById('saveLocation') as HTMLSelectElement;
      const saveFormatSelect = document.getElementById('saveFormat') as HTMLSelectElement;
      const saveLocation = saveLocationSelect?.value || 'download';
      const saveFormat = (saveFormatSelect?.value || 'json') as FileFormat;
      
      this.executeSave(filename, saveLocation, saveFormat);
      closeModal();
    });

    // フォーマット切替時の情報更新
    const formatSelect = document.getElementById('saveFormat') as HTMLSelectElement;
    const formatInfo = document.getElementById('formatInfo');
    formatSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      if (formatInfo) {
        if (target.value === 'csv') {
          formatInfo.innerHTML = 'CSV: ノードとリンクの情報を表形式で保存（位置情報などは保持されません）';
        } else {
          formatInfo.innerHTML = 'JSON: 全データを保持した完全な形式';
        }
      }
    });

    // Enterキーで保存実行
    filenameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        confirmBtn?.click();
      }
    });

    // ファイル名入力欄にフォーカス
    filenameInput?.focus();
    filenameInput?.select();
  }

  /**
   * 保存実行（JSON/CSV対応）
   */
  private async executeSave(filename: string, saveLocation: string, format: FileFormat = 'json'): Promise<void> {
    try {
      const data = {
        metadata: {
          version: this.editor.config.DATA.VERSION,
          format: this.editor.config.DATA.FORMAT,
          createdAt: this.editor.config.DATA.CREATED_AT,
          savedAt: new Date().toISOString(),
          nodeCount: this.editor.data.nodes.length,
          linkCount: this.editor.data.links.length
        },
        nodes: this.editor.data.nodes.map(node => ({
          id: node.id,
          label: node.label,
          description: (node as any).description || '',
          x: node.x,
          y: node.y,
          style: {
            color: node.style.color,
            radius: node.style.radius
          },
          pinned: (node as any).pinned || false,
          category: (node as any).category || '',
          createdAt: node.createdAt || Date.now(),
          updatedAt: (node as any).updatedAt || Date.now()
        })),
        links: this.editor.data.links.map(link => ({
          id: link.id,
          source: typeof link.source === 'object' ? link.source.id : link.source,
          target: typeof link.target === 'object' ? link.target.id : link.target,
          name: (link as any).name || '',
          style: {
            color: link.style.color,
            width: link.style.width,
            lineStyle: (link.style as any).lineStyle || this.editor.config.LINK.DEFAULT_LINE_STYLE
          },
          category: (link as any).category || '',
          createdAt: link.createdAt || Date.now(),
          updatedAt: (link as any).updatedAt || Date.now()
        })),
        categories: this.editor.data.categories || []
      };

      // 保存場所と形式に応じて処理
      if (saveLocation === 'localStorage') {
        // ローカルストレージはJSONのみ
        this.saveToLocalStorage(data, filename);
      } else {
        if (format === 'csv') {
          const csvData = this.convertToCSV(data);
          const finalFilename = filename.endsWith('.csv') ? filename : filename + '.csv';
          await this.downloadCSVFile(csvData, finalFilename);
        } else {
          // JSON形式
          const finalFilename = filename.endsWith('.json') ? filename : filename + '.json';
          await this.downloadFile(data, finalFilename);
        }
      }

      // 変更フラグをクリア
      this.editor.hasUnsavedChanges = false;

      console.log(`データを保存しました: ${filename} (${format.toUpperCase()})`);
      
      if ((this.editor as any).debugModule) {
        (this.editor as any).debugModule.logEvent('info', 'データ保存完了', {
          filename,
          saveLocation,
          format,
          nodes: data.nodes.length,
          links: data.links.length
        });
      }

    } catch (error) {
      ErrorHandler.logError('WordMapIO', 'executeSave', error as Error, { filename, saveLocation, format }, (this.editor as any).debugModule);
      alert('保存に失敗しました: ' + (error as Error).message);
    }
  }

  /**
   * ローカルストレージに保存
   */
  private saveToLocalStorage(data: any, filename: string): void {
    try {
      const key = `wordmap_${ValidationHelper.sanitizeFileName(filename)}`;
      localStorage.setItem(key, JSON.stringify(data));
      alert(`アプリに保存しました: ${filename}`);
    } catch (error) {
      if ((error as Error).name === 'QuotaExceededError') {
        alert('ローカルストレージの容量が不足しています。');
      } else {
        throw error;
      }
    }
  }

  /**
   * データ読み込み（ローカルファイル選択）
   */
  public loadData(): void {
    try {
      // 重複実行防止
      if (this.editor.isLoadingFile) {
        console.log('既にファイル読み込み中です');
        return;
      }

      // 読込ダイアログを表示
      this.showLoadDialog();

    } catch (error) {
      ErrorHandler.logError('WordMapIO', 'load', error as Error, undefined, (this.editor as any).debugModule);
      alert('読み込みに失敗しました: ' + (error as Error).message);
    }
  }

  /**
   * 読込ダイアログ表示
   */
  private showLoadDialog(): void {
    // 既存のモーダルを削除
    const existingModal = document.getElementById('loadModal');
    if (existingModal) {
      existingModal.remove();
    }

    // ローカルストレージの保存ファイル一覧を取得
    const savedFiles = this.getSavedFilesList();

    // モーダルHTML作成
    const modalHTML = `
        <div class="modal-overlay" id="loadModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>ファイル読み込み</h3>
                    <button class="modal-close" id="loadModalClose">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="load-options">
                        <div style="margin-bottom: 20px;">
                            <label for="loadSource">読み込み元:</label>
                            <select id="loadSource">
                                <option value="localStorage">アプリから読み込み</option>
                                <option value="file">ローカルから読み込み</option>
                            </select>
                        </div>
                        
                        <div id="fileLoadSection" style="display: none;">
                            <label>ファイル選択:</label>
                            <input type="file" id="loadFileInput" accept=".json,.csv" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <div style="font-size: 12px; color: #666; margin-top: 5px;">
                                ※ JSONおよびCSVファイルに対応しています
                            </div>
                        </div>
                        
                        <div id="localStorageLoadSection">
                            <label>保存されたファイル:</label>
                            ${savedFiles.length > 0 ? `
                                <div class="saves-list">
                                    ${savedFiles.map(file => `
                                        <div class="save-item" data-key="${file.key}">
                                            <div>
                                                <strong>${file.name}</strong><br>
                                                <small>${file.date} | ノード:${file.nodeCount} リンク:${file.linkCount}</small>
                                            </div>
                                            <div class="save-item-actions">
                                                <button class="btn-small btn-select" onclick="this.closest('.save-item').classList.toggle('selected')">選択</button>
                                                <button class="btn-small btn-delete" data-key="${file.key}" onclick="window.wordMapEditor.ioModule.deleteFromLocalStorage('${file.key}')">🗑️</button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : `
                                <div class="no-saves">
                                    保存されたファイルがありません
                                </div>
                            `}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="loadCancelBtn">キャンセル</button>
                    <button class="btn btn-primary" id="loadConfirmBtn">📁 読み込み</button>
                </div>
            </div>
        </div>
    `;

    // モーダルをDOMに追加
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // イベントリスナー設定
    this.setupLoadDialogEvents();
  }

  /**
   * 保存ファイル一覧取得
   */
  private getSavedFilesList(): SavedFileInfo[] {
    const files: SavedFileInfo[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('wordmap_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data && data.metadata) {
            files.push({
              key: key,
              name: key.replace('wordmap_', ''),
              date: data.metadata.savedAt ? new Date(data.metadata.savedAt).toLocaleString() : '不明',
              nodeCount: data.metadata.nodeCount || 0,
              linkCount: data.metadata.linkCount || 0
            });
          }
        } catch (e) {
          // 無効なデータは無視
        }
      }
    }
    return files.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * 読込ダイアログのイベント設定
   */
  private setupLoadDialogEvents(): void {
    const modal = document.getElementById('loadModal');
    const closeBtn = document.getElementById('loadModalClose');
    const cancelBtn = document.getElementById('loadCancelBtn');
    const confirmBtn = document.getElementById('loadConfirmBtn');
    const loadSource = document.getElementById('loadSource') as HTMLSelectElement;
    const fileSection = document.getElementById('fileLoadSection') as HTMLElement;
    const localStorageSection = document.getElementById('localStorageLoadSection') as HTMLElement;

    // モーダルを閉じる
    const closeModal = () => {
      modal?.remove();
    };

    // 読み込み元の切り替え
    loadSource?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      if (target.value === 'file') {
        fileSection.style.display = 'block';
        localStorageSection.style.display = 'none';
      } else {
        fileSection.style.display = 'none';
        localStorageSection.style.display = 'block';
      }
    });

    // 初期状態でlocalStorageセクションを表示
    if (localStorageSection && fileSection) {
      localStorageSection.style.display = 'block';
      fileSection.style.display = 'none';
    }

    // イベントリスナー
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    
    // Escapeキーでモーダルを閉じる
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    // 読み込み実行
    confirmBtn?.addEventListener('click', () => {
      const source = loadSource?.value || 'file';
      
      if (source === 'file') {
        const fileInput = document.getElementById('loadFileInput') as HTMLInputElement;
        const file = fileInput?.files?.[0];
        if (file) {
          this.loadFromFile(file);
          closeModal();
        } else {
          alert('ファイルを選択してください。');
        }
      } else {
        const selectedItem = document.querySelector('.save-item.selected');
        if (selectedItem) {
          const key = selectedItem.getAttribute('data-key');
          if (key) {
            this.loadFromLocalStorage(key);
            closeModal();
          }
        } else {
          alert('読み込むファイルを選択してください。');
        }
      }
    });
  }

  /**
   * ローカルストレージから読み込み
   */
  public loadFromLocalStorage(key: string): void {
    try {
      this.editor.isLoadingFile = true;
      
      const dataStr = localStorage.getItem(key);
      if (!dataStr) {
        throw new Error('指定されたファイルが見つかりません');
      }
      
      const jsonData = JSON.parse(dataStr);
      this.importWordMapData(jsonData);
      
      console.log(`ローカルストレージからデータを読み込みました: ${key}`);
      
      if ((this.editor as any).debugModule) {
        (this.editor as any).debugModule.logEvent('info', 'ローカルストレージ読み込み完了', {
          key,
          nodes: jsonData.nodes?.length || 0,
          links: jsonData.links?.length || 0
        });
      }
      
    } catch (error) {
      ErrorHandler.logError('WordMapIO', 'loadFromLocalStorage', error as Error, { key }, (this.editor as any).debugModule);
      alert('読み込みに失敗しました: ' + (error as Error).message);
    } finally {
      this.editor.isLoadingFile = false;
    }
  }

  /**
   * ローカルストレージから削除
   */
  public deleteFromLocalStorage(key: string): void {
    try {
      // 確認ダイアログを表示
      const filename = key.replace('wordmap_', '');
      const confirmMessage = `「${filename}」を削除しますか？\n\nこの操作は取り消すことができません。`;
      
      if (confirm(confirmMessage)) {
        localStorage.removeItem(key);
        alert(`「${filename}」を削除しました。`);
        
        // 読み込みダイアログを更新
        this.refreshLoadDialog();
        
        console.log(`ローカルストレージからファイルを削除しました: ${key}`);
        
        if ((this.editor as any).debugModule) {
          (this.editor as any).debugModule.logEvent('info', 'ファイル削除完了', {
            key,
            filename
          });
        }
      }
    } catch (error) {
      ErrorHandler.logError('WordMapIO', 'deleteFromLocalStorage', error as Error, { key }, (this.editor as any).debugModule);
      alert('削除に失敗しました: ' + (error as Error).message);
    }
  }

  /**
   * 読み込みダイアログを更新
   */
  private refreshLoadDialog(): void {
    const loadModal = document.getElementById('loadModal');
    if (loadModal) {
      loadModal.remove();
      this.showLoadDialog();
    }
  }

  /**
   * ファイルから読み込み
   */
  private loadFromFile(file: File): void {
    // 重複実行防止
    if (this.editor.isLoadingFile) {
      console.log('既にファイル読み込み中です');
      return;
    }

    this.editor.isLoadingFile = true;

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result as string;
        
        if (file.name.endsWith('.csv')) {
          // CSVファイルの処理
          const jsonData = this.convertCSVToJSON(fileContent);
          this.importWordMapData(jsonData);
          console.log(`CSVファイルからデータを読み込みました: ${file.name}`);
        } else {
          // JSONファイルの処理
          const jsonData = JSON.parse(fileContent);
          this.importWordMapData(jsonData);
          console.log(`JSONファイルからデータを読み込みました: ${file.name}`);
        }
        
        if ((this.editor as any).debugModule) {
          (this.editor as any).debugModule.logEvent('info', 'ファイル読み込み完了', {
            filename: file.name,
            format: file.name.endsWith('.csv') ? 'CSV' : 'JSON',
            nodes: this.editor.data.nodes.length,
            links: this.editor.data.links.length
          });
        }
        
      } catch (error) {
        ErrorHandler.logError('WordMapIO', 'loadFromFile', error as Error, { filename: file.name }, (this.editor as any).debugModule);
        alert('ファイルの形式が正しくありません: ' + (error as Error).message);
      } finally {
        this.editor.isLoadingFile = false;
      }
    };

    reader.onerror = (error) => {
      ErrorHandler.logError('WordMapIO', 'fileRead', new Error('ファイル読み込みエラー'), { filename: file.name }, (this.editor as any).debugModule);
      alert('ファイルの読み込みに失敗しました');
      this.editor.isLoadingFile = false;
    };

    reader.readAsText(file);
  }

  /**
   * ワードマップデータのインポート
   */
  public importWordMapData(jsonData: any): void {
    try {
      console.log('ワードマップデータインポート開始');
      
      // データ検証
      const validation = ValidationHelper.validateDataStructure(jsonData);
      if (!validation.valid) {
        throw new Error('データ検証エラー: ' + validation.errors.join(', '));
      }

      // 現在のデータをクリア
      this.editor.data.nodes = [];
      this.editor.data.links = [];
      
      // カテゴリのインポート（存在する場合）
      if (jsonData.categories && Array.isArray(jsonData.categories)) {
        console.log(`カテゴリデータ発見: ${jsonData.categories.length}個`);
        
        // D3WordMap形式の場合はカテゴリを上書き
        if ((jsonData as any).meta?.format === 'D3WordMap') {
          this.editor.data.categories = jsonData.categories;
          console.log(`D3WordMap形式: カテゴリを上書き: ${jsonData.categories.length}個`);
        } else {
          // それ以外はデフォルトカテゴリと統合
          const existingCategoryIds = this.editor.data.categories.map(cat => cat.id);
          jsonData.categories.forEach((category: WordMapCategory) => {
            if (!existingCategoryIds.includes(category.id)) {
              this.editor.data.categories.push(category);
            }
          });
          console.log(`通常形式: カテゴリを統合: 最終的に${this.editor.data.categories.length}個`);
        }
      }

      // ノードのインポート
      jsonData.nodes.forEach((nodeData: any) => {
        let nodeColor = nodeData.style?.color;
        
        // カテゴリが設定されていない場合はデフォルト色を使用
        if (!nodeColor) {
          if (nodeData.category) {
            const category = this.editor.data.categories.find(cat => cat.id === nodeData.category);
            nodeColor = category ? category.color : '#333333';
          } else {
            nodeColor = '#333333';
          }
        }
        
        const node: WordMapNode = {
          id: nodeData.id,
          label: nodeData.text || nodeData.label || '',
          x: nodeData.position?.x || nodeData.x || Math.random() * this.editor.config.CANVAS.WIDTH,
          y: nodeData.position?.y || nodeData.y || Math.random() * this.editor.config.CANVAS.HEIGHT,
          style: {
            color: nodeColor,
            radius: nodeData.style?.size || nodeData.style?.radius || this.editor.config.NODE.DEFAULT_RADIUS
          },
          createdAt: nodeData.createdAt || Date.now()
        };
        
        // 追加プロパティ
        Object.assign(node, {
          description: nodeData.description || '',
          pinned: nodeData.fixed !== undefined ? !nodeData.fixed : (nodeData.pinned || false),
          category: nodeData.category || '',
          updatedAt: nodeData.updatedAt || Date.now()
        });
        
        this.editor.data.nodes.push(node);
      });

      // リンクのインポート
      jsonData.links.forEach((linkData: any) => {
        const sourceNode = this.editor.data.nodes.find(n => n.id === linkData.source);
        const targetNode = this.editor.data.nodes.find(n => n.id === linkData.target);

        if (sourceNode && targetNode) {
          const link: WordMapLink = {
            id: linkData.id,
            source: linkData.source,
            target: linkData.target,
            style: {
              color: linkData.style?.color || this.editor.config.LINK.DEFAULT_COLOR,
              width: linkData.style?.width || this.editor.config.LINK.DEFAULT_WIDTH
            },
            createdAt: linkData.createdAt || Date.now()
          };
          
          // 追加プロパティ
          Object.assign(link, {
            name: linkData.name || linkData.label || '',
            category: linkData.category || '',
            updatedAt: linkData.updatedAt || Date.now()
          });
          
          this.editor.data.links.push(link);
        } else {
          console.warn(`リンク ${linkData.id} の参照先ノードが見つかりません`);
        }
      });

      // IDカウンターの更新
      this.editor.data.nextNodeId = Math.max(...this.editor.data.nodes.map(n => 
        parseInt(String(n.id).replace('node', '')) || 0)) + 1;
      this.editor.data.nextLinkId = Math.max(...this.editor.data.links.map(l => 
        parseInt(String(l.id).replace('link', '')) || 0)) + 1;

      // 選択状態をクリア
      this.editor.state.selectedElements = [];
      this.editor.state.multiSelectedElements = [];

      // レンダリング
      this.editor.render();
      
      // UIモジュールのカテゴリリストを更新
      if ((this.editor as any).uiModule && typeof (this.editor as any).uiModule.updateCategories === 'function') {
        (this.editor as any).uiModule.updateCategories();
      }

      // 変更フラグをクリア
      this.editor.hasUnsavedChanges = false;

      console.log(`データインポート完了: ノード${this.editor.data.nodes.length}個, リンク${this.editor.data.links.length}個`);

    } catch (error) {
      ErrorHandler.logError('WordMapIO', 'import', error as Error, undefined, (this.editor as any).debugModule);
      alert('データのインポートに失敗しました: ' + (error as Error).message);
    }
  }

  /**
   * データエクスポート（保存と同じ）
   */
  public exportData(): void {
    this.saveData();
  }

  /**
   * ファイルダウンロード（保存場所選択可能）
   */
  private async downloadFile(data: any, filename: string): Promise<void> {
    const jsonString = JSON.stringify(data, null, 2);
    
    // File System Access API対応ブラウザでは保存ダイアログを表示
    if (window.showSaveFilePicker) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'JSON files',
            accept: { 'application/json': ['.json'] }
          }]
        });
        
        const writable = await fileHandle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        
        console.log('ファイルが正常に保存されました:', filename);
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          console.log('ファイル保存がキャンセルされました');
          return;
        }
        console.warn('File System Access API エラー:', error);
        // フォールバック処理に進む
      }
    }
    
    // フォールバック: 従来のダウンロード方式
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  /**
   * 変更フラグ設定
   */
  public markAsChanged(): void {
    this.editor.hasUnsavedChanges = true;
    
    // デバッグログ
    if ((this.editor as any).debugModule) {
      (this.editor as any).debugModule.logEvent('debug', 'データ変更マーク');
    }
  }

  /**
   * 未保存変更の確認
   */
  public hasUnsavedChanges(): boolean {
    return this.editor.hasUnsavedChanges;
  }

  /**
   * ページ離脱時の警告設定
   */
  public setupBeforeUnloadWarning(): void {
    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges()) {
        const message = '未保存の変更があります。ページを離れますか？';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    });
  }

  /**
   * データの自動バックアップ作成
   */
  public createAutoBackup(): void {
    try {
      const backupData: AutoBackupData = {
        timestamp: Date.now(),
        data: {
          nodes: this.editor.data.nodes,
          links: this.editor.data.links
        }
      };
      
      localStorage.setItem('wordmap_auto_backup', JSON.stringify(backupData));
      console.log('自動バックアップを作成しました');
      
    } catch (error) {
      console.warn('自動バックアップの作成に失敗:', error);
    }
  }

  /**
   * 自動バックアップからの復元
   */
  public restoreFromAutoBackup(): boolean {
    try {
      const backupString = localStorage.getItem('wordmap_auto_backup');
      if (!backupString) {
        console.log('自動バックアップが見つかりません');
        return false;
      }
      
      const backupData: AutoBackupData = JSON.parse(backupString);
      const backupAge = Date.now() - backupData.timestamp;
      
      // 24時間以内のバックアップのみ有効
      if (backupAge > 24 * 60 * 60 * 1000) {
        console.log('自動バックアップが古すぎます');
        localStorage.removeItem('wordmap_auto_backup');
        return false;
      }
      
      // データ復元の確認
      if (confirm('自動バックアップが見つかりました。復元しますか？')) {
        this.editor.data.nodes = backupData.data.nodes;
        this.editor.data.links = backupData.data.links;
        this.editor.render();
        console.log('自動バックアップから復元しました');
        return true;
      }
      
    } catch (error) {
      ErrorHandler.logError('WordMapIO', 'restoreAutoBackup', error as Error, undefined, (this.editor as any).debugModule);
      localStorage.removeItem('wordmap_auto_backup');
    }
    
    return false;
  }

  // ========================================
  // CSV変換機能
  // ========================================

  /**
   * データをCSV形式に変換
   */
  private convertToCSV(data: any): CSVData {
    return {
      nodes: this.convertNodesToCSV(data.nodes),
      links: this.convertLinksToCSV(data.links),
      categories: this.convertCategoriesToCSV(data.categories || this.editor.data.categories)
    };
  }

  /**
   * ノードデータをCSV形式に変換
   */
  private convertNodesToCSV(nodes: any[]): string {
    const headers = ['id', 'label', 'description', 'color', 'radius', 'x', 'y', 'pinned', 'category', 'createdAt', 'updatedAt'];
    const rows = [headers.join(',')];

    nodes.forEach(node => {
      const row = [
        this.escapeCSV(node.id),
        this.escapeCSV(node.label || ''),
        this.escapeCSV(node.description || ''),
        this.escapeCSV(node.style.color),
        node.style.radius,
        Math.round(node.x || 0),
        Math.round(node.y || 0),
        node.pinned ? 'true' : 'false',
        this.escapeCSV(node.category || ''),
        node.createdAt || '',
        node.updatedAt || ''
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  /**
   * リンクデータをCSV形式に変換
   */
  private convertLinksToCSV(links: any[]): string {
    const headers = ['id', 'source', 'target', 'name', 'color', 'width', 'lineStyle', 'category', 'createdAt', 'updatedAt'];
    const rows = [headers.join(',')];

    links.forEach(link => {
      const row = [
        this.escapeCSV(link.id),
        this.escapeCSV(link.source.id || link.source),
        this.escapeCSV(link.target.id || link.target),
        this.escapeCSV(link.name || ''),
        this.escapeCSV(link.style.color),
        link.style.width,
        this.escapeCSV(link.style.lineStyle || 'solid'),
        this.escapeCSV(link.category || ''),
        link.createdAt || '',
        link.updatedAt || ''
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  /**
   * カテゴリデータをCSV形式に変換
   */
  private convertCategoriesToCSV(categories: WordMapCategory[]): string {
    const headers = ['id', 'name', 'color', 'type'];
    const rows = [headers.join(',')];

    categories.forEach(category => {
      const row = [
        this.escapeCSV(category.id),
        this.escapeCSV(category.name),
        this.escapeCSV(category.color),
        this.escapeCSV(category.type || 'node')
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  /**
   * CSV値のエスケープ処理
   */
  private escapeCSV(value: any): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * CSVファイルのダウンロード
   */
  private async downloadCSVFile(csvData: CSVData, filename: string): Promise<void> {
    const fullCSV = [
      '# WordMap CSV Export',
      '# Generated on: ' + new Date().toISOString(),
      '',
      '# Nodes',
      csvData.nodes,
      '',
      '# Links', 
      csvData.links,
      '',
      '# Categories',
      csvData.categories
    ].join('\n');

    // File System Access API対応ブラウザでは保存ダイアログを表示
    if (window.showSaveFilePicker) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'CSV files',
            accept: { 'text/csv': ['.csv'] }
          }]
        });
        
        const writable = await fileHandle.createWritable();
        await writable.write(fullCSV);
        await writable.close();
        
        console.log('CSVファイルが正常に保存されました:', filename);
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          console.log('CSVファイル保存がキャンセルされました');
          return;
        }
        console.warn('File System Access API エラー:', error);
        // フォールバック処理に進む
      }
    }

    // フォールバック: 従来のダウンロード方式
    const blob = new Blob([fullCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  /**
   * CSVデータをJSONに変換
   */
  private convertCSVToJSON(csvContent: string): any {
    const lines = csvContent.split('\n').filter(line => 
      line.trim() && !line.startsWith('#')
    );

    const result = {
      metadata: {
        version: this.editor.config.DATA.VERSION,
        format: 'CSV_IMPORT',
        importedAt: new Date().toISOString()
      },
      nodes: [],
      links: [],
      categories: []
    };

    let currentSection = '';
    let headers: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // セクション判定
      if (line.includes('id,label,description') || (i === 0 && !currentSection)) {
        currentSection = 'nodes';
        headers = this.parseCSVLine(line);
        continue;
      } else if (line.includes('id,source,target')) {
        currentSection = 'links';
        headers = this.parseCSVLine(line);
        continue;
      } else if (line.includes('id,name,color,type')) {
        currentSection = 'categories';
        headers = this.parseCSVLine(line);
        continue;
      }

      // データ行の処理
      if (headers.length > 0) {
        const values = this.parseCSVLine(line);
        if (values.length >= headers.length) {
          const obj: ParsedCSVRow = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });

          if (currentSection === 'nodes') {
            (result.nodes as any[]).push(this.convertCSVNodeToJSON(obj));
          } else if (currentSection === 'links') {
            (result.links as any[]).push(this.convertCSVLinkToJSON(obj));
          } else if (currentSection === 'categories') {
            (result.categories as any[]).push(this.convertCSVCategoryToJSON(obj));
          }
        }
      }
    }

    return result;
  }

  /**
   * CSV行のパース
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"';
        i++; // 次の文字をスキップ
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  /**
   * CSVノードデータをJSON形式に変換
   */
  private convertCSVNodeToJSON(csvNode: ParsedCSVRow): any {
    let nodeColor = csvNode.color;
    if (!nodeColor || nodeColor === '') {
      nodeColor = csvNode.category ? this.editor.config.COLORS.NODE_PALETTE[0] : '#333333';
    }
    
    return {
      id: csvNode.id,
      label: csvNode.label || '',
      description: csvNode.description || '',
      x: parseFloat(csvNode.x) || Math.random() * this.editor.config.CANVAS.WIDTH,
      y: parseFloat(csvNode.y) || Math.random() * this.editor.config.CANVAS.HEIGHT,
      style: {
        color: nodeColor,
        radius: parseInt(csvNode.radius) || this.editor.config.NODE.DEFAULT_RADIUS
      },
      pinned: csvNode.pinned === 'true',
      category: csvNode.category || '',
      createdAt: parseInt(csvNode.createdAt) || Date.now(),
      updatedAt: parseInt(csvNode.updatedAt) || Date.now()
    };
  }

  /**
   * CSVリンクデータをJSON形式に変換
   */
  private convertCSVLinkToJSON(csvLink: ParsedCSVRow): any {
    return {
      id: csvLink.id,
      source: csvLink.source,
      target: csvLink.target,
      name: csvLink.name || '',
      style: {
        color: csvLink.color || this.editor.config.LINK.DEFAULT_COLOR,
        width: parseInt(csvLink.width) || this.editor.config.LINK.DEFAULT_WIDTH,
        lineStyle: csvLink.lineStyle || 'solid'
      },
      category: csvLink.category || '',
      createdAt: parseInt(csvLink.createdAt) || Date.now(),
      updatedAt: parseInt(csvLink.updatedAt) || Date.now()
    };
  }

  /**
   * CSVカテゴリデータをJSON形式に変換
   */
  private convertCSVCategoryToJSON(csvCategory: ParsedCSVRow): WordMapCategory {
    return {
      id: csvCategory.id as any,
      name: csvCategory.name,
      color: csvCategory.color,
      type: (csvCategory.type || 'node') as 'node' | 'link'
    };
  }
}

// グローバルに公開（レガシー互換性のため）
if (typeof window !== 'undefined') {
  (window as any).WordMapIO = WordMapIO;
}

export default WordMapIO;