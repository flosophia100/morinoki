/**
 * Jest テストセットアップ
 * 2025-07-07 作成: テスト環境の初期化とモック設定
 */

// DOM環境のセットアップ
Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: (callback: FrameRequestCallback) => {
    return setTimeout(callback, 16);
  },
});

Object.defineProperty(window, 'cancelAnimationFrame', {
  writable: true,
  value: (id: number) => {
    clearTimeout(id);
  },
});

// Performance API のモック
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: () => Date.now(),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000,
    },
  },
});

// LocalStorage のモック
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: new LocalStorageMock(),
});

// D3.js のモック
const d3Mock = {
  select: jest.fn(() => ({
    append: jest.fn(() => d3Mock.select()),
    attr: jest.fn(() => d3Mock.select()),
    style: jest.fn(() => d3Mock.select()),
    text: jest.fn(() => d3Mock.select()),
    on: jest.fn(() => d3Mock.select()),
    call: jest.fn(() => d3Mock.select()),
    transition: jest.fn(() => d3Mock.select()),
    duration: jest.fn(() => d3Mock.select()),
    node: jest.fn(() => ({ getBoundingClientRect: () => ({ width: 800, height: 600 }) })),
  })),
  selectAll: jest.fn(() => ({
    data: jest.fn(() => d3Mock.selectAll()),
    enter: jest.fn(() => d3Mock.selectAll()),
    exit: jest.fn(() => d3Mock.selectAll()),
    remove: jest.fn(() => d3Mock.selectAll()),
    attr: jest.fn(() => d3Mock.selectAll()),
    style: jest.fn(() => d3Mock.selectAll()),
    text: jest.fn(() => d3Mock.selectAll()),
    on: jest.fn(() => d3Mock.selectAll()),
  })),
  zoom: jest.fn(() => ({
    scaleExtent: jest.fn(() => d3Mock.zoom()),
    filter: jest.fn(() => d3Mock.zoom()),
    on: jest.fn(() => d3Mock.zoom()),
    transform: jest.fn(),
  })),
  zoomIdentity: {
    translate: jest.fn(() => d3Mock.zoomIdentity),
  },
  forceSimulation: jest.fn(() => ({
    force: jest.fn(() => d3Mock.forceSimulation()),
    nodes: jest.fn(() => d3Mock.forceSimulation()),
    on: jest.fn(() => d3Mock.forceSimulation()),
    alpha: jest.fn(() => d3Mock.forceSimulation()),
    alphaTarget: jest.fn(() => d3Mock.forceSimulation()),
    restart: jest.fn(() => d3Mock.forceSimulation()),
    stop: jest.fn(() => d3Mock.forceSimulation()),
  })),
  forceLink: jest.fn(() => ({
    id: jest.fn(() => d3Mock.forceLink()),
    distance: jest.fn(() => d3Mock.forceLink()),
    strength: jest.fn(() => d3Mock.forceLink()),
  })),
  forceManyBody: jest.fn(() => ({
    strength: jest.fn(() => d3Mock.forceManyBody()),
  })),
  forceCenter: jest.fn(() => d3Mock.forceCenter()),
  forceCollide: jest.fn(() => ({
    radius: jest.fn(() => d3Mock.forceCollide()),
  })),
  drag: jest.fn(() => ({
    on: jest.fn(() => d3Mock.drag()),
  })),
  event: {
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    x: 100,
    y: 100,
    transform: {
      k: 1,
      x: 0,
      y: 0,
    },
  },
};

(global as any).d3 = d3Mock;

// File API のモック
global.File = class MockFile {
  constructor(
    public chunks: any[],
    public name: string,
    public options: any = {}
  ) {}
  
  get type() {
    return this.options.type || '';
  }
  
  get size() {
    return this.chunks.reduce((size, chunk) => size + chunk.length, 0);
  }
};

global.FileReader = class MockFileReader {
  result: string | null = null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

  readAsText(file: File) {
    setTimeout(() => {
      this.result = JSON.stringify({ test: 'data' });
      if (this.onload) {
        this.onload.call(this, { target: this } as any);
      }
    }, 0);
  }
};

// URL API のモック
global.URL = {
  createObjectURL: jest.fn(() => 'mock-object-url'),
  revokeObjectURL: jest.fn(),
} as any;

// Blob API のモック
global.Blob = class MockBlob {
  constructor(public chunks: any[], public options: any = {}) {}
  
  get type() {
    return this.options.type || '';
  }
  
  get size() {
    return this.chunks.reduce((size, chunk) => size + chunk.length, 0);
  }
};

// Console のモック（テスト時のログ出力制御）
const originalConsole = { ...console };

beforeEach(() => {
  // テスト中はコンソール出力を抑制
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  // テスト後はコンソールを復元
  Object.assign(console, originalConsole);
});

// DOM要素の基本モック
document.createElement = jest.fn((tagName: string) => {
  const element = {
    tagName: tagName.toUpperCase(),
    className: '',
    id: '',
    innerHTML: '',
    textContent: '',
    style: {},
    dataset: {},
    value: '',
    type: '',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    getAttribute: jest.fn(),
    setAttribute: jest.fn(),
    removeAttribute: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(() => true),
      contains: jest.fn(() => false),
    },
    click: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn(),
    getBoundingClientRect: jest.fn(() => ({
      width: 100,
      height: 100,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
    })),
    children: [],
    parentNode: null,
    nextSibling: null,
    previousSibling: null,
  };
  
  return element as any;
});

document.getElementById = jest.fn((id: string) => {
  if (id === 'wordmapSvg') {
    return document.createElement('svg');
  }
  return null;
});

document.querySelector = jest.fn();
document.querySelectorAll = jest.fn(() => []);

// グローバルエラーハンドラーのモック
window.addEventListener = jest.fn();
window.removeEventListener = jest.fn();

console.log('Jest setup completed successfully');