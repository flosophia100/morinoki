/**
 * ワードマップエディター 設定ファイル
 * 2025-06-20 作成: モジュール分離による設定の外部化
 */

const CONFIG = {
    // データバージョン
    DATA: {
        VERSION: '3.0.0',
        FORMAT: 'D3WordMap',
        CREATED_AT: '2025-06-21'
    },

    // キャンバス設定
    CANVAS: {
        WIDTH: 800,
        HEIGHT: 600,
        MIN_ZOOM: 0.1,
        MAX_ZOOM: 10,
        BACKGROUND_COLOR: '#fafafa'
    },

    // テーマ設定
    THEMES: {
        LIGHT: {
            name: 'light',
            background: '#fafafa',
            nodeStroke: '#333',
            nodeFontColor: 'white',
            gridColor: '#e0e0e0'
        },
        DARK: {
            name: 'dark',
            background: '#2d3748',
            nodeStroke: '#e2e8f0',
            nodeFontColor: '#2d3748',
            gridColor: '#4a5568'
        }
    },

    // ノード設定
    NODE: {
        DEFAULT_RADIUS: 30,
        MIN_RADIUS: 15,
        MAX_RADIUS: 100,
        STROKE_WIDTH: 2,
        STROKE_COLOR: '#333',
        FONT_SIZE: 12,
        FONT_COLOR: 'white',
        FONT_FAMILY: "'Roboto', Arial, sans-serif"
    },

    // リンク設定
    LINK: {
        DEFAULT_WIDTH: 2,
        MIN_WIDTH: 1,
        MAX_WIDTH: 10,
        DEFAULT_COLOR: '#999999',
        DEFAULT_LINE_STYLE: 'solid', // 'solid', 'dashed', 'dotted'
        HITAREA_WIDTH: 12
    },

    // フォースシミュレーション設定
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

    // カラーパレット
    COLORS: {
        NODE_PALETTE: [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a0e7e5',
            '#ffbe0b', '#fb5607', '#ff006e', '#8338ec', '#3a86ff', '#06ffa5',
            '#fd9644', '#e63946', '#f77f00', '#fcbf49', '#eae2b7', '#003049',
            '#d62d20', '#ffa8b6', '#c77dff', '#560bad', '#480ca8', '#3c096c',
            '#240046', '#10002b', '#e0aaff', '#c593ff', '#a663cc', '#ffc2d1'
        ],
        LINK_PALETTE: [
            '#999999', '#333333', '#666666', '#cccccc',
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24',
            '#6c5ce7', '#fd9644', '#e63946', '#003049'
        ],
        // 2025-06-22 追加: カテゴリ作成用の6種類配色パレット（各7色）
        CATEGORY_PALETTES: {
            モノクロ: ['#000000', '#1a1a1a', '#333333', '#666666', '#999999', '#cccccc', '#ffffff'],
            レインボー: ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e91e63'],
            パステル: ['#fab1a0', '#fdcb6e', '#e17055', '#81ecec', '#74b9ff', '#a29bfe', '#fd79a8'],
            ビビッド: ['#ff3838', '#ff9500', '#ffdd00', '#00d2ff', '#8c7ae6', '#e056fd', '#ff3855'],
            ナチュラル: ['#6c5ce7', '#a0e7e5', '#55a3ff', '#26de81', '#feca57', '#ff9ff3', '#54a0ff'],
            カフェ: ['#8b4513', '#cd853f', '#d2691e', '#bc8f8f', '#f4a460', '#deb887', '#ffe4b5']
        }
    },

    // サイズ設定
    SIZES: {
        NODE_SIZES: [
            { label: 'XS', value: 20, title: '極小' },
            { label: 'S', value: 25, title: '小' },
            { label: 'M', value: 30, title: '中' },
            { label: 'L', value: 40, title: '大' },
            { label: 'XL', value: 50, title: '極大' }
        ]
    },

    // アニメーション設定
    ANIMATION: {
        TRANSITION_DURATION: 300,
        HOVER_SCALE: 1.1,
        SELECTION_STROKE_WIDTH: 4
    },

    // デバッグ設定 - 必要最小限の設定のみ
    DEBUG: {
        ENABLED: false,
        MODE: 'lite', // 'lite', 'dev', 'full' - デバッグモードの選択
        LOG_LEVEL: 'info' // 'debug', 'info', 'warn', 'error'
        // PERFORMANCE_MONITORING: 各モジュールで個別管理
        // MAX_LOGS: 各デバッグモジュールで個別設定
        // LOAD_DEV_TOOLS: 未使用のため削除
    },

    // カテゴリ設定
    CATEGORIES: {
        DEFAULT_NODE_CATEGORIES: [
            // 2025-06-21 修正: 起動時はカテゴリなしで開始
        ],
        DEFAULT_LINK_CATEGORIES: [
            // 2025-06-21 修正: 起動時はカテゴリなしで開始
        ],
        MAX_NAME_LENGTH: 50
    },

    // 複数選択設定
    MULTI_SELECT: {
        ENABLED: true,
        HIGHLIGHT_COLOR: '#ff6b6b', // 2025-06-22 修正: 単一選択と同じ色に統一
        HIGHLIGHT_WIDTH: 4, // 2025-06-22 修正: 単一選択と同じ幅に統一
        MAX_SELECTIONS: 50
    },

    // UI設定 - 動的に決定されるためコメントアウト
    // UI: {
    //     SIDEBAR_WIDTH: 250,
    //     TOOLBAR_HEIGHT: 60, 
    //     HEADER_HEIGHT: 50,
    //     STATUS_BAR_HEIGHT: 30
    // },

    // キーボードショートカット
    SHORTCUTS: {
        SELECT_MODE: 'KeyV',
        CREATE_MODE: 'KeyC',
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

    // ファイル設定 - 使用されている部分のみ保持
    FILE: {
        EXPORT_FORMAT: 'json'
        // AUTO_SAVE_INTERVAL: カスタム実装により不要
        // BACKUP_COUNT: 未実装のため削除
        // SUPPORTED_FORMATS: コード内でハードコーディング済み
    }
};

// 設定の読み取り専用化
Object.freeze(CONFIG.DATA);
Object.freeze(CONFIG.CANVAS);
Object.freeze(CONFIG.NODE);
Object.freeze(CONFIG.LINK);
Object.freeze(CONFIG.FORCE);
Object.freeze(CONFIG.COLORS);
Object.freeze(CONFIG.SIZES);
Object.freeze(CONFIG.ANIMATION);
Object.freeze(CONFIG.DEBUG);
Object.freeze(CONFIG.UI);
Object.freeze(CONFIG.SHORTCUTS);
Object.freeze(CONFIG.FILE);
Object.freeze(CONFIG);

// モジュールエクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

// グローバル公開
window.CONFIG = CONFIG;