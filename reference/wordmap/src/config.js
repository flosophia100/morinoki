/**
 * WordMap エディタ設定ファイル (JavaScript互換版)
 * 2025-07-07 作成: TypeScript版からの互換バージョン
 */

// テーマ設定
const THEMES = {
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
};

// ノード設定
const NODE = {
    DEFAULT_RADIUS: 30,
    MIN_RADIUS: 10,
    MAX_RADIUS: 80,
    STROKE_WIDTH: 2,
    STROKE_COLOR: '#333333',
    FONT_SIZE: 14,
    FONT_COLOR: '#333333',
    FONT_FAMILY: 'Arial, sans-serif'
};

// リンク設定
const LINK = {
    DEFAULT_WIDTH: 2,
    MIN_WIDTH: 1,
    MAX_WIDTH: 10,
    DEFAULT_COLOR: '#666666',
    DEFAULT_LINE_STYLE: 'solid',
    HITAREA_WIDTH: 10
};

// フォース設定
const FORCE = {
    LINK_DISTANCE: 100,
    LINK_STRENGTH: 1,
    CHARGE_STRENGTH: -300,
    CENTER_STRENGTH: 0.3,
    COLLISION_RADIUS: 35,
    ALPHA_MIN: 0.001,
    ALPHA_DECAY: 0.0228,
    VELOCITY_DECAY: 0.4
};

// カラーパレット
const COLORS = {
    NODE_PALETTE: [
        '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
        '#1abc9c', '#e67e22', '#34495e', '#95a5a6', '#f1c40f',
        '#8e44ad', '#16a085', '#27ae60', '#2980b9', '#c0392b'
    ],
    LINK_PALETTE: [
        '#666666', '#999999', '#cccccc', '#333333', '#777777',
        '#aaaaaa', '#555555', '#888888', '#bbbbbb', '#444444'
    ],
    CATEGORY_PALETTES: {
        'モノクロ': ['#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff'],
        'レインボー': ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'],
        'パステル': ['#ffd1dc', '#ffb6c1', '#ffc0cb', '#dda0dd', '#98fb98', '#afeeee', '#f0e68c'],
        'ビビッド': ['#ff0000', '#ff8c00', '#ffd700', '#32cd32', '#1e90ff', '#8a2be2', '#ff1493'],
        'ナチュラル': ['#8b4513', '#228b22', '#4682b4', '#daa520', '#cd853f', '#2e8b57', '#4169e1'],
        'カフェ': ['#8b4513', '#a0522d', '#cd853f', '#deb887', '#f4a460', '#d2691e', '#bc8f8f']
    }
};

// サイズオプション
const NODE_SIZES = [
    { label: 'XS', value: 20, title: '極小' },
    { label: 'S', value: 25, title: '小' },
    { label: 'M', value: 30, title: '中' },
    { label: 'L', value: 40, title: '大' },
    { label: 'XL', value: 50, title: '極大' }
];

// アニメーション設定
const ANIMATION = {
    TRANSITION_DURATION: 300,
    HOVER_SCALE: 1.1,
    SELECTION_STROKE_WIDTH: 4
};

// デバッグ設定
const DEBUG = {
    ENABLED: false,
    MODE: 'lite',
    LOG_LEVEL: 'info'
};

// デフォルトカテゴリ
const DEFAULT_NODE_CATEGORIES = [
    { id: 1, name: '重要', type: 'node', color: '#e74c3c' },
    { id: 2, name: '通常', type: 'node', color: '#3498db' },
    { id: 3, name: '補足', type: 'node', color: '#95a5a6' }
];

const DEFAULT_LINK_CATEGORIES = [
    { id: 1, name: '強い関連', type: 'link', color: '#e74c3c' },
    { id: 2, name: '通常関連', type: 'link', color: '#666666' },
    { id: 3, name: '弱い関連', type: 'link', color: '#cccccc' }
];

// カテゴリ設定
const CATEGORIES = {
    DEFAULT_NODE_CATEGORIES,
    DEFAULT_LINK_CATEGORIES,
    MAX_NAME_LENGTH: 50
};

// 複数選択設定
const MULTI_SELECT = {
    ENABLED: true,
    HIGHLIGHT_COLOR: '#3498db',
    HIGHLIGHT_WIDTH: 3,
    MAX_SELECTIONS: 50
};

// キーボードショートカット
const SHORTCUTS = {
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
};

// ファイル設定
const FILE = {
    EXPORT_FORMAT: 'json'
};

// メイン設定オブジェクト
const CONFIG = {
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
    THEMES,
    NODE,
    LINK,
    FORCE,
    COLORS,
    SIZES: {
        NODE_SIZES
    },
    ANIMATION,
    DEBUG,
    CATEGORIES,
    MULTI_SELECT,
    SHORTCUTS,
    FILE
};

// グローバルに公開
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}

// モジュールエクスポート対応
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}