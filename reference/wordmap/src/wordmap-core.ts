/**
 * WordMap エディタコアクラス
 * 2025-07-07 TypeScript変換: D3.js統合とデータ管理
 */

import { 
  WordMapEditor, 
  WordMapData, 
  WordMapNode, 
  WordMapLink, 
  WordMapCategory, 
  WordMapState, 
  WordMapConfig 
} from '../types/wordmap';
import { ErrorHandler } from './wordmap-utils';

declare global {
  const d3: any;
}

/**
 * D3WordMapEditor - メインエディタクラス
 */
export class D3WordMapEditor implements WordMapEditor {
  public container: HTMLElement;
  public svg: any;
  public viewport: any;
  public nodesGroup: any;
  public linksGroup: any;
  public data: WordMapData;
  public state: WordMapState;
  public config: WordMapConfig;
  public isLoadingFile: boolean = false;
  public hasUnsavedChanges: boolean = false;
  public history: any[] = [];
  public redoStack: any[] = [];
  public maxHistorySize: number = 50;

  // モジュール参照
  public palettes?: any;
  public properties?: any;
  public categories?: any;
  public controls?: any;
  public debugModule?: any;
  public uiModule?: any;
  public ioModule?: any;

  // D3関連プロパティ
  private simulation: any;
  private zoom: any;
  private dragBehavior: any;

  constructor(containerId: string, config?: WordMapConfig) {
    try {
      // コンテナ要素の取得
      this.container = document.getElementById(containerId) as HTMLElement;
      if (!this.container) {
        throw new Error(`Container element with id '${containerId}' not found`);
      }

      // 設定の初期化
      this.config = config || (typeof window !== 'undefined' && (window as any).CONFIG) || this.getDefaultConfig();

      // データの初期化
      this.data = this.initializeData();

      // 状態の初期化
      this.state = this.initializeState();

      // SVGとD3の初期化
      this.initializeD3();

      // 物理シミュレーションの初期化
      this.initializeSimulation();

      // イベントハンドラーの設定
      this.setupEventHandlers();

      console.log('D3WordMapEditor initialized successfully');
    } catch (error) {
      ErrorHandler.logError('D3WordMapEditor', 'initialization', error as Error);
      throw error;
    }
  }

  /**
   * デフォルト設定を取得
   */
  private getDefaultConfig(): WordMapConfig {
    return {
      DATA: {
        VERSION: '3.3.0',
        FORMAT: 'wordmap-json',
        CREATED_AT: new Date().toISOString()
      },
      CANVAS: {
        WIDTH: 800,
        HEIGHT: 600,
        MIN_ZOOM: 0.1,
        MAX_ZOOM: 5.0,
        BACKGROUND_COLOR: '#ffffff'
      },
      THEMES: {
        LIGHT: {
          name: 'light',
          background: '#ffffff',
          nodeStroke: '#333333',
          nodeFontColor: '#333333',
          gridColor: '#e0e0e0'
        },
        DARK: {
          name: 'dark',
          background: '#1a1a1a',
          nodeStroke: '#ffffff',
          nodeFontColor: '#ffffff',
          gridColor: '#404040'
        }
      },
      NODE: {
        DEFAULT_RADIUS: 30,
        MIN_RADIUS: 10,
        MAX_RADIUS: 80,
        STROKE_WIDTH: 2,
        STROKE_COLOR: '#333333',
        FONT_SIZE: 14,
        FONT_COLOR: '#333333',
        FONT_FAMILY: 'Arial, sans-serif'
      },
      LINK: {
        DEFAULT_WIDTH: 2,
        MIN_WIDTH: 1,
        MAX_WIDTH: 10,
        DEFAULT_COLOR: '#666666',
        DEFAULT_LINE_STYLE: 'solid',
        HITAREA_WIDTH: 10
      },
      FORCE: {
        LINK_DISTANCE: 100,
        LINK_STRENGTH: 1,
        CHARGE_STRENGTH: -300,
        CENTER_STRENGTH: 0.3,
        COLLISION_RADIUS: 35,
        ALPHA_MIN: 0.001,
        ALPHA_DECAY: 0.0228,
        VELOCITY_DECAY: 0.4
      },
      COLORS: {
        NODE_PALETTE: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'],
        LINK_PALETTE: ['#666666', '#999999', '#cccccc'],
        CATEGORY_PALETTES: {}
      },
      SIZES: {
        NODE_SIZES: [
          { label: 'S', value: 20, title: '小' },
          { label: 'M', value: 30, title: '中' },
          { label: 'L', value: 40, title: '大' }
        ]
      },
      ANIMATION: {
        TRANSITION_DURATION: 300,
        HOVER_SCALE: 1.1,
        SELECTION_STROKE_WIDTH: 4
      },
      DEBUG: {
        ENABLED: false,
        MODE: 'lite',
        LOG_LEVEL: 'info'
      },
      CATEGORIES: {
        DEFAULT_NODE_CATEGORIES: [],
        DEFAULT_LINK_CATEGORIES: [],
        MAX_NAME_LENGTH: 50
      },
      MULTI_SELECT: {
        ENABLED: true,
        HIGHLIGHT_COLOR: '#3498db',
        HIGHLIGHT_WIDTH: 3,
        MAX_SELECTIONS: 50
      },
      SHORTCUTS: {
        SELECT_MODE: 'Escape',
        CREATE_MODE: 'KeyN',
        LINK_MODE: 'KeyL',
        SAVE: 'KeyS',
        LOAD: 'KeyO',
        DELETE: 'Delete',
        ESCAPE: 'Escape',
        ZOOM_IN: 'Equal',
        ZOOM_OUT: 'Minus',
        FIT_VIEW: 'KeyF',
        RESET_LAYOUT: 'KeyR',
        HELP: 'KeyH'
      },
      FILE: {
        EXPORT_FORMAT: 'json'
      }
    };
  }

  /**
   * データの初期化
   */
  private initializeData(): WordMapData {
    return {
      nodes: [],
      links: [],
      categories: [],
      nextNodeId: 1,
      nextLinkId: 1,
      nextCategoryId: 1
    };
  }

  /**
   * 状態の初期化
   */
  private initializeState(): WordMapState {
    return {
      mode: 'unified',
      selectedElements: [],
      multiSelectedElements: [],
      zoom: 1,
      forceEnabled: true,
      isDragging: false,
      theme: 'light',
      isShiftPressed: false
    };
  }

  /**
   * D3.jsの初期化
   */
  private initializeD3(): void {
    if (typeof d3 === 'undefined') {
      throw new Error('D3.js library not found');
    }

    // SVGの作成
    this.svg = d3.select(this.container);
    
    if (this.svg.empty()) {
      throw new Error('Container element not found or not accessible by D3');
    }

    // ビューポートグループの作成
    this.viewport = this.svg.select('#viewport');
    if (this.viewport.empty()) {
      this.viewport = this.svg.append('g').attr('id', 'viewport');
    }

    // リンクグループの作成
    this.linksGroup = this.viewport.select('#linksGroup');
    if (this.linksGroup.empty()) {
      this.linksGroup = this.viewport.append('g').attr('id', 'linksGroup');
    }

    // ノードグループの作成
    this.nodesGroup = this.viewport.select('#nodesGroup');
    if (this.nodesGroup.empty()) {
      this.nodesGroup = this.viewport.append('g').attr('id', 'nodesGroup');
    }

    // ズーム機能の設定
    this.zoom = d3.zoom()
      .scaleExtent([this.config.CANVAS.MIN_ZOOM, this.config.CANVAS.MAX_ZOOM])
      .filter((event: any) => !event.ctrlKey && !event.button)
      .on('zoom', (event: any) => {
        this.viewport.attr('transform', event.transform);
        this.state.zoom = event.transform.k;
      });

    this.svg.call(this.zoom);
  }

  /**
   * 物理シミュレーションの初期化
   */
  private initializeSimulation(): void {
    this.simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id((d: any) => d.id).distance(this.config.FORCE.LINK_DISTANCE))
      .force('charge', d3.forceManyBody().strength(this.config.FORCE.CHARGE_STRENGTH))
      .force('center', d3.forceCenter(0, 0).strength(this.config.FORCE.CENTER_STRENGTH))
      .force('collision', d3.forceCollide().radius((d: any) => d.style.radius + 5))
      .alphaDecay(this.config.FORCE.ALPHA_DECAY)
      .velocityDecay(this.config.FORCE.VELOCITY_DECAY);

    this.simulation.on('tick', () => {
      this.updatePositions();
    });
  }

  /**
   * イベントハンドラーの設定
   */
  private setupEventHandlers(): void {
    // ダブルクリックでノード作成
    this.svg.on('dblclick', (event: any) => {
      if (event.target === this.svg.node()) {
        const [x, y] = d3.pointer(event, this.viewport.node());
        this.addNode(x, y);
      }
    });

    // キーボードイベント
    document.addEventListener('keydown', (event) => {
      this.handleKeydown(event);
    });

    document.addEventListener('keyup', (event) => {
      this.handleKeyup(event);
    });
  }

  /**
   * キーボードイベントの処理
   */
  private handleKeydown(event: KeyboardEvent): void {
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      this.state.isShiftPressed = true;
    }

    if (event.ctrlKey || event.metaKey) {
      switch (event.code) {
        case this.config.SHORTCUTS.SAVE:
          event.preventDefault();
          this.saveData();
          break;
        case this.config.SHORTCUTS.LOAD:
          event.preventDefault();
          this.loadData();
          break;
      }
    } else {
      switch (event.code) {
        case this.config.SHORTCUTS.DELETE:
          this.deleteSelected();
          break;
        case this.config.SHORTCUTS.ESCAPE:
          this.deselectAll();
          break;
        case this.config.SHORTCUTS.FIT_VIEW:
          this.fitToView();
          break;
        case this.config.SHORTCUTS.RESET_LAYOUT:
          this.resetLayout();
          break;
      }
    }
  }

  /**
   * キーアップイベントの処理
   */
  private handleKeyup(event: KeyboardEvent): void {
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      this.state.isShiftPressed = false;
    }
  }

  /**
   * ノードを追加
   */
  public addNode(x: number, y: number, label: string = 'New Node'): WordMapNode {
    const node: WordMapNode = {
      id: this.data.nextNodeId++,
      label,
      x,
      y,
      style: {
        color: this.config.COLORS.NODE_PALETTE[0],
        radius: this.config.NODE.DEFAULT_RADIUS
      },
      createdAt: Date.now()
    };

    this.data.nodes.push(node);
    this.hasUnsavedChanges = true;
    this.render();

    return node;
  }

  /**
   * リンクを追加
   */
  public addLink(sourceId: string | number, targetId: string | number): WordMapLink | null {
    const source = this.data.nodes.find(n => n.id === sourceId);
    const target = this.data.nodes.find(n => n.id === targetId);

    if (!source || !target) {
      return null;
    }

    const link: WordMapLink = {
      id: this.data.nextLinkId++,
      source: sourceId,
      target: targetId,
      style: {
        color: this.config.LINK.DEFAULT_COLOR,
        width: this.config.LINK.DEFAULT_WIDTH
      },
      createdAt: Date.now()
    };

    this.data.links.push(link);
    this.hasUnsavedChanges = true;
    this.render();

    return link;
  }

  /**
   * 選択されたノード/リンクを削除
   */
  public deleteSelected(): void {
    const toDelete = [...this.state.selectedElements, ...this.state.multiSelectedElements];
    
    toDelete.forEach(element => {
      if ('radius' in element.style) {
        // ノードの削除
        this.removeNode(element.id);
      } else {
        // リンクの削除
        this.removeLink(element.id);
      }
    });

    this.deselectAll();
  }

  /**
   * ノードを削除
   */
  public removeNode(nodeId: string | number): boolean {
    const nodeIndex = this.data.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) {
      return false;
    }

    // 関連するリンクを削除
    this.data.links = this.data.links.filter(
      link => link.source !== nodeId && link.target !== nodeId
    );

    // ノードを削除
    this.data.nodes.splice(nodeIndex, 1);
    this.hasUnsavedChanges = true;
    this.render();

    return true;
  }

  /**
   * リンクを削除
   */
  public removeLink(linkId: string | number): boolean {
    const linkIndex = this.data.links.findIndex(l => l.id === linkId);
    if (linkIndex === -1) {
      return false;
    }

    this.data.links.splice(linkIndex, 1);
    this.hasUnsavedChanges = true;
    this.render();

    return true;
  }

  /**
   * 全選択解除
   */
  public deselectAll(): void {
    this.state.selectedElements = [];
    this.state.multiSelectedElements = [];
    this.render();
  }

  /**
   * 描画処理
   */
  public render(): void {
    try {
      this.renderLinks();
      this.renderNodes();
      this.updateSimulation();
    } catch (error) {
      ErrorHandler.logError('D3WordMapEditor', 'render', error as Error);
    }
  }

  /**
   * リンクの描画
   */
  private renderLinks(): void {
    const links = this.linksGroup
      .selectAll('.link')
      .data(this.data.links, (d: any) => d.id);

    // 新しいリンクの追加
    const linkEnter = links.enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', (d: any) => d.style.color)
      .attr('stroke-width', (d: any) => d.style.width);

    // 既存リンクの更新
    links.merge(linkEnter)
      .attr('stroke', (d: any) => d.style.color)
      .attr('stroke-width', (d: any) => d.style.width);

    // 不要なリンクの削除
    links.exit().remove();
  }

  /**
   * ノードの描画
   */
  private renderNodes(): void {
    const nodes = this.nodesGroup
      .selectAll('.node')
      .data(this.data.nodes, (d: any) => d.id);

    // 新しいノードの追加
    const nodeEnter = nodes.enter()
      .append('g')
      .attr('class', 'node')
      .call(this.getDragBehavior());

    nodeEnter.append('circle')
      .attr('r', (d: any) => d.style.radius)
      .attr('fill', (d: any) => d.style.color)
      .attr('stroke', this.config.NODE.STROKE_COLOR)
      .attr('stroke-width', this.config.NODE.STROKE_WIDTH);

    nodeEnter.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', this.config.NODE.FONT_SIZE)
      .attr('font-family', this.config.NODE.FONT_FAMILY)
      .attr('fill', this.config.NODE.FONT_COLOR)
      .text((d: any) => d.label);

    // 既存ノードの更新
    const nodeUpdate = nodes.merge(nodeEnter);
    
    nodeUpdate.select('circle')
      .attr('r', (d: any) => d.style.radius)
      .attr('fill', (d: any) => d.style.color);

    nodeUpdate.select('text')
      .text((d: any) => d.label);

    // 不要なノードの削除
    nodes.exit().remove();
  }

  /**
   * ドラッグ動作の取得
   */
  private getDragBehavior(): any {
    return d3.drag()
      .on('start', (event: any, d: any) => {
        if (!event.active) {
          this.simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
        this.state.isDragging = true;
      })
      .on('drag', (event: any, d: any) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event: any, d: any) => {
        if (!event.active) {
          this.simulation.alphaTarget(0);
        }
        if (!d.pinned) {
          d.fx = null;
          d.fy = null;
        }
        this.state.isDragging = false;
      });
  }

  /**
   * 位置の更新
   */
  private updatePositions(): void {
    this.linksGroup.selectAll('.link')
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);

    this.nodesGroup.selectAll('.node')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
  }

  /**
   * シミュレーションの更新
   */
  private updateSimulation(): void {
    this.simulation
      .nodes(this.data.nodes)
      .force('link')
      .links(this.data.links);

    this.simulation.alpha(1).restart();
  }

  /**
   * ビューを中央に配置
   */
  public centerView(): void {
    const transform = d3.zoomIdentity.translate(0, 0);
    this.svg.transition()
      .duration(this.config.ANIMATION.TRANSITION_DURATION)
      .call(this.zoom.transform, transform);
  }

  /**
   * 全体をビューに収める
   */
  public fitToView(): void {
    if (this.data.nodes.length === 0) {
      return;
    }

    const bounds = this.calculateBounds();
    const fullWidth = bounds.maxX - bounds.minX;
    const fullHeight = bounds.maxY - bounds.minY;
    
    if (fullWidth === 0 || fullHeight === 0) {
      return;
    }

    const width = this.config.CANVAS.WIDTH;
    const height = this.config.CANVAS.HEIGHT;
    const midX = (bounds.minX + bounds.maxX) / 2;
    const midY = (bounds.minY + bounds.maxY) / 2;

    const scale = Math.min(
      width / fullWidth,
      height / fullHeight
    ) * 0.8;

    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-midX, -midY);

    this.svg.transition()
      .duration(this.config.ANIMATION.TRANSITION_DURATION)
      .call(this.zoom.transform, transform);
  }

  /**
   * ノードの境界を計算
   */
  private calculateBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    this.data.nodes.forEach(node => {
      const radius = node.style.radius;
      minX = Math.min(minX, node.x - radius);
      maxX = Math.max(maxX, node.x + radius);
      minY = Math.min(minY, node.y - radius);
      maxY = Math.max(maxY, node.y + radius);
    });

    return { minX, maxX, minY, maxY };
  }

  /**
   * レイアウトをリセット
   */
  public resetLayout(): void {
    this.simulation.alpha(1).restart();
  }

  /**
   * データを保存
   */
  public saveData(): void {
    if (this.ioModule?.saveData) {
      this.ioModule.saveData();
    } else {
      console.warn('IO module not available');
    }
  }

  /**
   * データを読み込み
   */
  public loadData(): void {
    if (this.ioModule?.loadData) {
      this.ioModule.loadData();
    } else {
      console.warn('IO module not available');
    }
  }

  /**
   * 全データをクリア
   */
  public clearAllData(): void {
    this.data.nodes = [];
    this.data.links = [];
    this.data.categories = [];
    this.data.nextNodeId = 1;
    this.data.nextLinkId = 1;
    this.data.nextCategoryId = 1;
    this.state.selectedElements = [];
    this.state.multiSelectedElements = [];
    this.hasUnsavedChanges = false;
    this.render();
  }

  /**
   * デバッグ機能を切り替え
   */
  public toggleDebug(): void {
    if (this.debugModule?.toggle) {
      this.debugModule.toggle();
    } else {
      console.warn('Debug module not available');
    }
  }

  /**
   * テーマを更新
   */
  public updateTheme(theme: 'light' | 'dark'): void {
    this.state.theme = theme;
    const themeConfig = this.config.THEMES[theme.toUpperCase() as 'LIGHT' | 'DARK'];
    
    if (themeConfig) {
      this.svg.style('background-color', themeConfig.background);
      this.render();
    }
  }

  /**
   * フォース設定を更新
   */
  public updateForceCenter(value: number): void {
    this.simulation.force('center').strength(value);
    this.simulation.alpha(0.3).restart();
  }

  public updateForceCharge(value: number): void {
    this.simulation.force('charge').strength(value);
    this.simulation.alpha(0.3).restart();
  }

  public updateLinkDistance(value: number): void {
    this.simulation.force('link').distance(value);
    this.simulation.alpha(0.3).restart();
  }

  public updateLinkStrength(value: number): void {
    this.simulation.force('link').strength(value);
    this.simulation.alpha(0.3).restart();
  }
}

// グローバルに公開（レガシー互換性のため）
if (typeof window !== 'undefined') {
  (window as any).D3WordMapEditor = D3WordMapEditor;
}

export default D3WordMapEditor;