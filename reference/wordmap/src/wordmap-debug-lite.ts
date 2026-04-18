/**
 * ワードマップエディター 軽量デバッグモジュール
 * 2025-07-07 TypeScript変換: 本番環境用軽量デバッグシステムの型安全化
 * 
 * 機能:
 * - 基本的なエラー処理とログ記録
 * - 核心的な問題検出（D3バインディング、DOM同期）
 * - 基本的なパフォーマンス監視
 * - シンプルなコンソール出力
 */

import { WordMapEditor, DebugLogEntry, PerformanceData, DebugStats } from '../types/wordmap';
import { ErrorHandler } from './wordmap-utils';

export interface DebugLogEntryLite extends DebugLogEntry {
  severity?: 'low' | 'medium' | 'high';
}

export interface PerformanceDataLite {
  renderTimes: number[];
  eventCounts: Record<string, number>;
  lastRenderTime: number;
}

export interface DebugStatsLite extends DebugStats {
  memoryUsage?: {
    used: number;
    total: number;
  } | null;
}

export interface IssueDetectionContext {
  severity: 'low' | 'medium' | 'high';
  [key: string]: any;
}

export class WordMapDebugLite {
  private editor: WordMapEditor;
  private isEnabled: boolean = false;
  private logs: DebugLogEntryLite[] = [];
  private maxLogs: number = 100; // 軽量版は100件まで
  private performanceData: PerformanceDataLite;
  
  constructor(editor: WordMapEditor) {
    this.editor = editor;
    this.performanceData = {
      renderTimes: [],
      eventCounts: {},
      lastRenderTime: 0
    };
    
    this.initializeDebugSystem();
  }

  /**
   * デバッグシステム初期化
   */
  private initializeDebugSystem(): void {
    console.log('[DEBUG-LITE] 軽量デバッグシステム初期化');
    this.setupErrorHandling();
    this.setupBasicPerformanceMonitoring();
    this.setupIssueDetectors();
  }

  /**
   * エラーハンドリング設定
   */
  private setupErrorHandling(): void {
    window.addEventListener('error', (e) => {
      this.logError('GlobalError', e.error, {
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        severity: 'high'
      });
    });

    window.addEventListener('unhandledrejection', (e) => {
      this.logError('UnhandledPromiseRejection', new Error(String(e.reason)), {
        severity: 'high'
      });
    });
  }

  /**
   * 基本的なパフォーマンス監視設定
   */
  private setupBasicPerformanceMonitoring(): void {
    // レンダリング時間の記録
    const originalRender = this.editor.render?.bind(this.editor);
    if (originalRender) {
      this.editor.render = (...args: any[]) => {
        const startTime = performance.now();
        const result = originalRender(...args);
        const renderTime = performance.now() - startTime;
        this.recordRenderTime(renderTime);
        return result;
      };
    }
  }

  /**
   * 基本的な問題検出器設定
   */
  private setupIssueDetectors(): void {
    // 定期的な問題検出（軽量版は30秒間隔）
    setInterval(() => {
      if (this.isEnabled) {
        this.runBasicIssueDetection();
      }
    }, 30000);
  }

  /**
   * 基本的な問題検出実行
   */
  private runBasicIssueDetection(): void {
    try {
      this.checkD3DataBinding();
      this.checkDOMSync();
      this.checkPerformanceDegradation();
      this.checkMemoryLeak();
    } catch (error) {
      this.logError('IssueDetectionError', error as Error);
    }
  }

  /**
   * D3.jsデータバインディング問題検出
   */
  private checkD3DataBinding(): void {
    if (!this.editor.data) return;

    const dataNodes = this.editor.data.nodes?.length || 0;
    const domNodes = document.querySelectorAll('#nodesGroup circle').length;
    const dataLinks = this.editor.data.links?.length || 0;
    const domLinks = document.querySelectorAll('#linksGroup line').length;

    if (dataNodes !== domNodes || dataLinks !== domLinks) {
      this.logError('D3DataBindingMismatch', new Error('Data and DOM node count mismatch'), {
        dataNodes,
        domNodes,
        dataLinks,
        domLinks,
        severity: 'high'
      } as IssueDetectionContext);
    }
  }

  /**
   * DOM同期問題検出
   */
  private checkDOMSync(): void {
    const selectedElements = this.editor.state?.selectedElements || [];
    const domSelectedElements = document.querySelectorAll('.selected').length;

    if (selectedElements.length !== domSelectedElements) {
      this.logError('DOMSyncMismatch', new Error('State and DOM selection mismatch'), {
        stateSelected: selectedElements.length,
        domSelected: domSelectedElements,
        severity: 'medium'
      } as IssueDetectionContext);
    }
  }

  /**
   * パフォーマンス劣化検出
   */
  private checkPerformanceDegradation(): void {
    const recentRenderTimes = this.performanceData.renderTimes.slice(-10);
    if (recentRenderTimes.length < 10) return;

    const averageTime = recentRenderTimes.reduce((a, b) => a + b, 0) / recentRenderTimes.length;
    
    if (averageTime > 50) { // 50ms以上は警告
      this.logEvent('warn', 'パフォーマンス劣化検出', {
        averageRenderTime: averageTime.toFixed(2),
        threshold: 50
      });
    }
  }

  /**
   * メモリリーク検出
   */
  private checkMemoryLeak(): void {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      const memoryInfo = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };

      // メモリ使用量が90%を超えた場合
      if (memoryInfo.used / memoryInfo.limit > 0.9) {
        this.logEvent('warn', 'メモリ使用量高', memoryInfo);
      }
    }
  }

  /**
   * レンダリング時間記録
   */
  private recordRenderTime(time: number): void {
    this.performanceData.renderTimes.push(time);
    this.performanceData.lastRenderTime = time;
    
    // 最新20件のみ保持
    if (this.performanceData.renderTimes.length > 20) {
      this.performanceData.renderTimes = this.performanceData.renderTimes.slice(-20);
    }
  }

  /**
   * イベントログ記録
   */
  public logEvent(level: 'debug' | 'info' | 'warn' | 'error' = 'info', message: string, data: any = null): void {
    const timestamp = new Date().toISOString();
    const logEntry: DebugLogEntryLite = {
      timestamp,
      level,
      message,
      data,
      source: 'debug-lite'
    };

    this.logs.push(logEntry);
    
    // 最大ログ数を超えた場合は古いものを削除
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // コンソール出力
    if (this.isEnabled) {
      const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](`[DEBUG-LITE] ${message}`, data);
    }
  }

  /**
   * エラーログ記録
   */
  public logError(type: string, error: Error | null, context: IssueDetectionContext | null = null): void {
    const timestamp = new Date().toISOString();
    const logEntry: DebugLogEntryLite = {
      timestamp,
      level: 'error',
      type,
      message: error?.message || String(error),
      stack: error?.stack,
      context,
      severity: context?.severity || 'medium',
      source: 'debug-lite'
    };

    this.logs.push(logEntry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // 重要なエラーは常にコンソール出力
    if (logEntry.severity === 'high' || this.isEnabled) {
      console.error(`[DEBUG-LITE] ${type}:`, error, context);
    }
  }

  /**
   * デバッグ有効化
   */
  public enable(): void {
    this.isEnabled = true;
    console.log('[DEBUG-LITE] デバッグモード有効化');
    this.logEvent('info', 'デバッグモード有効化');
  }

  /**
   * デバッグ無効化
   */
  public disable(): void {
    this.isEnabled = false;
    console.log('[DEBUG-LITE] デバッグモード無効化');
  }

  /**
   * デバッグトグル
   */
  public toggle(): void {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  /**
   * デバッグデータクリア
   */
  public clearDebugData(): void {
    this.logs = [];
    this.performanceData.renderTimes = [];
    this.performanceData.eventCounts = {};
    this.logEvent('info', 'デバッグデータクリア完了');
  }

  /**
   * 基本統計情報取得
   */
  public getBasicStats(): DebugStatsLite {
    const recentRenderTimes = this.performanceData.renderTimes.slice(-10);
    const averageRenderTime = recentRenderTimes.length > 0 
      ? recentRenderTimes.reduce((a, b) => a + b, 0) / recentRenderTimes.length 
      : 0;

    let memoryUsage: { used: number; total: number } | null = null;
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      memoryUsage = {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024)
      };
    }

    return {
      logsCount: this.logs.length,
      errorCount: this.logs.filter(log => log.level === 'error').length,
      warningCount: this.logs.filter(log => log.level === 'warn').length,
      averageRenderTime: parseFloat(averageRenderTime.toFixed(2)),
      lastRenderTime: parseFloat(this.performanceData.lastRenderTime.toFixed(2)),
      memoryUsage
    };
  }

  /**
   * コンソールに基本統計を出力
   */
  public showStats(): void {
    const stats = this.getBasicStats();
    console.group('[DEBUG-LITE] 基本統計');
    console.log('ログ数:', stats.logsCount);
    console.log('エラー数:', stats.errorCount);
    console.log('警告数:', stats.warningCount);
    console.log('平均レンダリング時間:', stats.averageRenderTime + 'ms');
    console.log('最新レンダリング時間:', stats.lastRenderTime + 'ms');
    if (stats.memoryUsage) {
      console.log('メモリ使用量:', `${stats.memoryUsage.used}MB / ${stats.memoryUsage.total}MB`);
    }
    console.groupEnd();
  }

  /**
   * デバッグデータエクスポート（基本情報のみ）
   */
  public exportDebugData(): void {
    const data = {
      timestamp: new Date().toISOString(),
      version: 'lite',
      stats: this.getBasicStats(),
      recentLogs: this.logs.slice(-20), // 最新20件のみ
      performanceData: {
        recentRenderTimes: this.performanceData.renderTimes.slice(-10)
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-lite-${new Date().getTime()}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.logEvent('info', 'デバッグデータエクスポート完了');
  }

  /**
   * デバッグ状態の取得
   */
  public getStatus(): { enabled: boolean; logsCount: number; errors: number; warnings: number } {
    return {
      enabled: this.isEnabled,
      logsCount: this.logs.length,
      errors: this.logs.filter(log => log.level === 'error').length,
      warnings: this.logs.filter(log => log.level === 'warn').length
    };
  }

  /**
   * 最新ログの取得
   */
  public getRecentLogs(count: number = 10): DebugLogEntryLite[] {
    return this.logs.slice(-count);
  }

  /**
   * パフォーマンスデータの取得
   */
  public getPerformanceData(): PerformanceDataLite {
    return { ...this.performanceData };
  }

  /**
   * 問題検出の手動実行
   */
  public runManualIssueDetection(): void {
    console.log('[DEBUG-LITE] 手動問題検出実行');
    this.runBasicIssueDetection();
    this.logEvent('info', '手動問題検出完了');
  }

  /**
   * ログレベルフィルタリング
   */
  public getLogsByLevel(level: 'debug' | 'info' | 'warn' | 'error'): DebugLogEntryLite[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * デバッグ情報の概要取得
   */
  public getSummary(): string {
    const stats = this.getBasicStats();
    return `Debug-Lite: ${this.isEnabled ? 'ON' : 'OFF'} | Logs: ${stats.logsCount} | Errors: ${stats.errorCount} | Avg Render: ${stats.averageRenderTime}ms`;
  }
}

// 軽量版デバッグクラスをグローバルに公開（レガシー互換性のため）
if (typeof window !== 'undefined') {
  (window as any).WordMapDebugLite = WordMapDebugLite;
}

export default WordMapDebugLite;