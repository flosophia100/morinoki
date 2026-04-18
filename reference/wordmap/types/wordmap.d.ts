/**
 * ワードマップエディター TypeScript型定義
 * 2025-07-07 作成: 型安全性とIntelliSense向上
 */

// D3.jsの基本型定義
declare global {
  const d3: any; // D3.js v7の型定義
}

// 基本的なデータ構造
export interface WordMapNode {
  id: string | number;
  label: string;
  description?: string;
  x: number;
  y: number;
  style: {
    color: string;
    radius: number;
  };
  pinned?: boolean;
  category?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface WordMapLink {
  id: string | number;
  source: WordMapNode | string | number;
  target: WordMapNode | string | number;
  name?: string;
  style: {
    color: string;
    width: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
  };
  category?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface WordMapCategory {
  id: string | number;
  name: string;
  type: 'node' | 'link';
  color: string;
  palette?: string;
  createdAt?: number;
  updatedAt?: number;
}

export type CategoryType = 'node' | 'link';
export type ThemeType = 'light' | 'dark';
export type FileFormat = 'json' | 'csv';

export interface WordMapData {
  metadata?: {
    version: string;
    format: string;
    createdAt: string;
    savedAt: string;
    nodeCount: number;
    linkCount: number;
  };
  nodes: WordMapNode[];
  links: WordMapLink[];
  categories: WordMapCategory[];
  nextNodeId: number;
  nextLinkId: number;
  nextCategoryId: number;
}

// エディター状態
export interface WordMapState {
  mode: 'unified';
  selectedElements: (WordMapNode | WordMapLink)[];
  multiSelectedElements: (WordMapNode | WordMapLink)[];
  zoom: number;
  forceEnabled: boolean;
  isDragging: boolean;
  theme: 'light' | 'dark';
  isShiftPressed: boolean;
}

// 設定型定義
export interface WordMapConfig {
  DATA: {
    VERSION: string;
    FORMAT: string;
    CREATED_AT: string;
  };
  CANVAS: {
    WIDTH: number;
    HEIGHT: number;
    MIN_ZOOM: number;
    MAX_ZOOM: number;
    BACKGROUND_COLOR: string;
  };
  THEMES: {
    LIGHT: ThemeConfig;
    DARK: ThemeConfig;
  };
  NODE: NodeConfig;
  LINK: LinkConfig;
  FORCE: ForceConfig;
  COLORS: ColorConfig;
  SIZES: {
    NODE_SIZES: SizeOption[];
  };
  ANIMATION: AnimationConfig;
  DEBUG: DebugConfig;
  CATEGORIES: CategoryConfig;
  MULTI_SELECT: MultiSelectConfig;
  SHORTCUTS: ShortcutConfig;
  FILE: FileConfig;
}

export interface ThemeConfig {
  name: string;
  background: string;
  nodeStroke: string;
  nodeFontColor: string;
  gridColor: string;
}

export interface NodeConfig {
  DEFAULT_RADIUS: number;
  MIN_RADIUS: number;
  MAX_RADIUS: number;
  STROKE_WIDTH: number;
  STROKE_COLOR: string;
  FONT_SIZE: number;
  FONT_COLOR: string;
  FONT_FAMILY: string;
}

export interface LinkConfig {
  DEFAULT_WIDTH: number;
  MIN_WIDTH: number;
  MAX_WIDTH: number;
  DEFAULT_COLOR: string;
  DEFAULT_LINE_STYLE: 'solid' | 'dashed' | 'dotted';
  HITAREA_WIDTH: number;
}

export interface ForceConfig {
  LINK_DISTANCE: number;
  LINK_STRENGTH: number;
  CHARGE_STRENGTH: number;
  CENTER_STRENGTH: number;
  COLLISION_RADIUS: number;
  ALPHA_MIN: number;
  ALPHA_DECAY: number;
  VELOCITY_DECAY: number;
}

export interface ColorConfig {
  NODE_PALETTE: string[];
  LINK_PALETTE: string[];
  CATEGORY_PALETTES: Record<string, string[]>;
}

export interface SizeOption {
  label: string;
  value: number;
  title: string;
}

export interface AnimationConfig {
  TRANSITION_DURATION: number;
  HOVER_SCALE: number;
  SELECTION_STROKE_WIDTH: number;
}

export interface DebugConfig {
  ENABLED: boolean;
  MODE: 'lite' | 'dev' | 'full';
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

export interface CategoryConfig {
  DEFAULT_NODE_CATEGORIES: WordMapCategory[];
  DEFAULT_LINK_CATEGORIES: WordMapCategory[];
  MAX_NAME_LENGTH: number;
}

export interface MultiSelectConfig {
  ENABLED: boolean;
  HIGHLIGHT_COLOR: string;
  HIGHLIGHT_WIDTH: number;
  MAX_SELECTIONS: number;
}

export interface ShortcutConfig {
  SELECT_MODE: string;
  CREATE_MODE: string;
  LINK_MODE: string;
  SAVE: string;
  LOAD: string;
  DELETE: string;
  ESCAPE: string;
  ZOOM_IN: string;
  ZOOM_OUT: string;
  FIT_VIEW: string;
  RESET_LAYOUT: string;
  HELP: string;
}

export interface FileConfig {
  EXPORT_FORMAT: string;
}

// エラーハンドリング型
export interface ErrorInfo {
  source: string;
  type: string;
  message: string;
  stack?: string;
  context?: any;
  timestamp: string;
}

export interface EventInfo {
  source: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  timestamp: string;
}

// デバッグ関連型
export interface DebugStats {
  logsCount: number;
  errorCount: number;
  warningCount: number;
  averageRenderTime: number;
  lastRenderTime: number;
  memoryUsage?: {
    used: number;
    total: number;
  };
}

export interface DebugLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  source: string;
  type?: string;
  stack?: string;
  context?: any;
}

export interface SaveOptions {
  filename: string;
  format: FileFormat;
  location: 'localStorage' | 'download';
}

export interface LoadOptions {
  source: 'localStorage' | 'file';
  key?: string;
  file?: File;
}

export interface PerformanceData {
  renderTimes: number[];
  eventCounts: Record<string, number>;
  lastRenderTime: number;
  memoryUsage?: Array<{
    timestamp: number;
    used: number;
    total: number;
  }>;
}

// UI関連型
export interface PaletteStates {
  selectedNodeColor?: string;
  selectedLinkColor?: string;
  selectedNodeSize?: string;
  availableColors: {
    nodes: string[];
    links: string[];
  };
}

export interface UIState {
  palettes?: PaletteStates;
  controls?: ForceSettings;
  theme: 'light' | 'dark';
}

export interface ForceSettings {
  centerForce: number;
  chargeForce: number;
  linkDistance: number;
  linkStrength: number;
}

// クラス型定義
export interface WordMapEditor {
  container: HTMLElement;
  svg: any; // D3 selection
  viewport: any; // D3 selection
  nodesGroup: any; // D3 selection
  linksGroup: any; // D3 selection
  data: WordMapData;
  state: WordMapState;
  config: WordMapConfig;
  isLoadingFile: boolean;
  hasUnsavedChanges: boolean;
  history: any[];
  redoStack: any[];
  maxHistorySize: number;
  
  // モジュール参照
  palettes?: WordMapPalettes;
  properties?: WordMapProperties;
  categories?: WordMapCategories;
  controls?: WordMapControls;
  debugModule?: WordMapDebugLite | WordMapDebugDev | WordMapDebug;
  uiModule?: WordMapUI;
  ioModule?: WordMapIO;

  // メソッド
  render(): void;
  centerView(): void;
  fitToView(): void;
  resetLayout(): void;
  saveData(): void;
  loadData(): void;
  clearAllData(): void;
  toggleDebug(): void;
  updateTheme(theme: 'light' | 'dark'): void;
  updateForceCenter(value: number): void;
  updateForceCharge(value: number): void;
  updateLinkDistance(value: number): void;
  updateLinkStrength(value: number): void;
}

export interface WordMapPalettes {
  editor: WordMapEditor;
  config: WordMapConfig;
  
  initialize(): void;
  initializeColorPalette(): void;
  initializeLinkColorPalette(): void;
  initializeSizeSelector(): void;
  initializeStyleSelector(): void;
  initializeCategoryColorPalette(): void;
  updateCategoryColorPalette(paletteName: string): void;
  updateColorPaletteSelection(color: string, paletteId?: string): void;
  updateLinkColorPaletteSelection(color: string): void;
  updateSizeSelectorSelection(size: string): void;
  updateStyleSelectorSelection(style: string): void;
  resetPaletteSelections(): void;
  getPaletteStates(): PaletteStates;
}

export interface WordMapControls {
  editor: WordMapEditor;
  config: WordMapConfig;
  
  initialize(): void;
  setupForceSettings(): void;
  setupModalEvents(): void;
  setupToolbarEvents(): void;
  setupThemeToggle(): void;
  setupKeyboardShortcuts(): void;
  toggleTheme(): void;
  updateThemeButton(): void;
  getForceSettings(): ForceSettings;
  setForceSettings(settings: Partial<ForceSettings>): void;
  resetControls(): void;
}

export interface WordMapProperties {
  editor: WordMapEditor;
  config: WordMapConfig;
  
  initialize(): void;
  updatePropertiesPanel(): void;
  updateSelectedNode(): void;
  updateSelectedLink(): void;
  updateSelectedLinkStyle(style: string): void;
  updateMultiSelectedElements(): void;
}

export interface WordMapCategories {
  editor: WordMapEditor;
  config: WordMapConfig;
  
  initialize(): void;
  updateCategories(): void;
  changeCategoryColor(categoryId: string | number, newColor: string): void;
}

export interface WordMapUI {
  editor: WordMapEditor;
  config: WordMapConfig;
  palettes?: WordMapPalettes;
  properties?: WordMapProperties;
  categories?: WordMapCategories;
  controls?: WordMapControls;
  
  initialize(): void;
  resetUI(): void;
  getUIState(): UIState;
  loadModule(moduleName: string): Promise<void>;
  getDebugInfo(): any;
}

export interface WordMapIO {
  editor: WordMapEditor;
  
  saveData(): void;
  loadData(): void;
  saveToLocalStorage(data: WordMapData, filename: string): void;
  loadFromLocalStorage(key: string): void;
  deleteFromLocalStorage(key: string): void;
  exportData(): void;
  importWordMapData(data: WordMapData): void;
}

export interface WordMapDebugLite {
  editor: WordMapEditor;
  isEnabled: boolean;
  logs: any[];
  maxLogs: number;
  performanceData: PerformanceData;
  
  enable(): void;
  disable(): void;
  toggle(): void;
  logEvent(level: string, message: string, data?: any): void;
  logError(type: string, error: Error, context?: any): void;
  clearDebugData(): void;
  getBasicStats(): DebugStats;
  showStats(): void;
  exportDebugData(): void;
}

export interface WordMapDebugDev extends WordMapDebugLite {
  panelVisible: boolean;
  
  runBasicTests(): void;
  updateDebugDisplay(): void;
}

export interface WordMapDebug extends WordMapDebugDev {
  // フル機能版の追加メソッド
}

// ユーティリティ型
export interface WordMapUtils {
  ErrorHandler: {
    logError(source: string, type: string, error: Error, context?: any, debugModule?: any): ErrorInfo;
    logEvent(source: string, level: string, message: string, data?: any, debugModule?: any): EventInfo;
    wrapAsyncFunction(fn: Function, source: string, debugModule?: any): Function;
  };
  DOMHelper: {
    getElementById(id: string, required?: boolean): HTMLElement | null;
    querySelector(selector: string, required?: boolean): Element | null;
    querySelectorAll(selector: string): NodeListOf<Element>;
    addEventListenerSafe(element: Element | null, event: string, handler: Function, options?: any): boolean;
    removeEventListenerSafe(element: Element | null, event: string, handler: Function, options?: any): boolean;
    createElementWithClass(tag: string, className?: string, textContent?: string): HTMLElement;
    toggleClass(element: Element | null, className: string, force?: boolean): boolean;
    setAttributes(element: Element | null, attributes: Record<string, string>): boolean;
  };
  PaletteBuilder: {
    createColorPalette(colors: string[], selectedColor?: string, onColorSelect?: Function): HTMLElement;
    createSizeSelector(sizes: SizeOption[], selectedSize?: number, onSizeSelect?: Function): HTMLElement;
  };
  ValidationHelper: {
    isValidNode(node: any): node is WordMapNode;
    isValidLink(link: any): link is WordMapLink;
    validateDataStructure(data: any): { valid: boolean; errors: string[]; stats: { nodeCount: number; linkCount: number; } };
    sanitizeFileName(filename: string): string;
    normalizeColor(color: string): string;
  };
  PerformanceHelper: {
    measureFunction(fn: Function, name?: string): Function;
    measureAsyncFunction(fn: Function, name?: string): Function;
    debounce(func: Function, wait: number): Function;
    throttle(func: Function, limit: number): Function;
  };
}

// グローバル変数の型定義
declare global {
  interface Window {
    CONFIG: WordMapConfig;
    WordMapUtils: WordMapUtils;
    WordMapEditor: new (containerId: string, config?: WordMapConfig) => WordMapEditor;
    WordMapUI: new (editor: WordMapEditor) => WordMapUI;
    WordMapPalettes: new (editor: WordMapEditor) => WordMapPalettes;
    WordMapControls: new (editor: WordMapEditor) => WordMapControls;
    WordMapProperties: new (editor: WordMapEditor) => WordMapProperties;
    WordMapCategories: new (editor: WordMapEditor) => WordMapCategories;
    WordMapIO: {
      initialize(editor: WordMapEditor): WordMapIO;
    };
    WordMapDebugLite: new (editor: WordMapEditor) => WordMapDebugLite;
    WordMapDebugDev: new (editor: WordMapEditor) => WordMapDebugDev;
    WordMapDebug: new (editor: WordMapEditor) => WordMapDebug;
    wordMapEditor: WordMapEditor;
  }
}

export {};