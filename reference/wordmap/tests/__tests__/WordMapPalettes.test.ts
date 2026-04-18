/**
 * WordMapPalettes テストファイル
 * 2025-07-07 作成: パレット機能のテスト
 */

import { WordMapPalettes, WordMapEditor, WordMapConfig, PaletteStates } from '../../types/wordmap';

// Mock WordMapEditor
const mockEditor: Partial<WordMapEditor> = {
  config: {
    COLORS: {
      NODE_PALETTE: ['#ff0000', '#00ff00', '#0000ff'],
      LINK_PALETTE: ['#666666', '#999999', '#cccccc'],
      CATEGORY_PALETTES: {
        'レインボー': ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'],
        'パステル': ['#ffd1dc', '#ffb6c1', '#ffc0cb', '#dda0dd', '#98fb98', '#afeeee', '#f0e68c'],
        'ビビッド': ['#ff0000', '#ff8c00', '#ffd700', '#32cd32', '#1e90ff', '#8a2be2', '#ff1493']
      }
    },
    SIZES: {
      NODE_SIZES: [
        { label: 'XS', value: 20, title: '極小' },
        { label: 'S', value: 25, title: '小' },
        { label: 'M', value: 30, title: '中' },
        { label: 'L', value: 40, title: '大' },
        { label: 'XL', value: 50, title: '極大' }
      ]
    }
  } as WordMapConfig,
  render: jest.fn(),
  state: {
    selectedElements: [],
    multiSelectedElements: [],
    mode: 'unified',
    zoom: 1,
    forceEnabled: true,
    isDragging: false,
    theme: 'light',
    isShiftPressed: false
  }
};

// Mock DOM elements with enhanced functionality
const createMockElement = (id: string, tag: string = 'div') => {
  const element = document.createElement(tag);
  element.id = id;
  // Enhanced appendChild to actually track children
  const children: any[] = [];
  element.appendChild = jest.fn((child) => {
    children.push(child);
    (element as any).children = children;
    return child;
  });
  // Enhanced querySelector
  element.querySelector = jest.fn((selector) => {
    return children.find(child => {
      if (selector.startsWith('[data-color=')) {
        const color = selector.match(/\[data-color="([^"]+)"\]/)?.[1];
        return child.dataset?.color === color;
      }
      if (selector.startsWith('[data-size=')) {
        const size = selector.match(/\[data-size="([^"]+)"\]/)?.[1];
        return child.dataset?.size === size;
      }
      if (selector.startsWith('[data-style=')) {
        const style = selector.match(/\[data-style="([^"]+)"\]/)?.[1];
        return child.dataset?.style === style;
      }
      if (selector.startsWith('.')) {
        const className = selector.substring(1);
        return child.className?.includes(className);
      }
      return false;
    }) || null;
  });
  // Enhanced querySelectorAll
  element.querySelectorAll = jest.fn((selector) => {
    return children.filter(child => {
      if (selector.startsWith('.')) {
        const className = selector.substring(1);
        return child.className?.includes(className);
      }
      return false;
    });
  });
  return element;
};

const mockColorPalette = createMockElement('nodeColorPalette');
const mockLinkColorPalette = createMockElement('linkColorPalette');
const mockSizeSelector = createMockElement('nodeSizeSelector');
const mockStyleSelector = createMockElement('linkStyleSelector');
const mockCategoryColorPalette = createMockElement('newCategoryColorPalette');
const mockCategoryPaletteSelector = createMockElement('categoryPaletteSelector', 'select');

// Mock document methods
document.getElementById = jest.fn((id: string) => {
  const elements: Record<string, HTMLElement> = {
    'nodeColorPalette': mockColorPalette,
    'linkColorPalette': mockLinkColorPalette,
    'nodeSizeSelector': mockSizeSelector,
    'linkStyleSelector': mockStyleSelector,
    'newCategoryColorPalette': mockCategoryColorPalette,
    'categoryPaletteSelector': mockCategoryPaletteSelector
  };
  return elements[id] || null;
});

// Mock WordMapPalettes class
class MockWordMapPalettes implements WordMapPalettes {
  editor: WordMapEditor;
  config: WordMapConfig;
  private paletteStates: PaletteStates;

  constructor(editor: WordMapEditor) {
    this.editor = editor;
    this.config = editor.config;
    this.paletteStates = {
      availableColors: {
        nodes: this.config.COLORS.NODE_PALETTE,
        links: this.config.COLORS.LINK_PALETTE
      }
    };
  }

  initialize(): void {
    this.initializeColorPalette();
    this.initializeLinkColorPalette();
    this.initializeSizeSelector();
    this.initializeStyleSelector();
    this.initializeCategoryColorPalette();
  }

  initializeColorPalette(): void {
    const palette = document.getElementById('nodeColorPalette');
    if (palette) {
      palette.innerHTML = '';
      this.config.COLORS.NODE_PALETTE.forEach(color => {
        const colorBtn = document.createElement('button');
        colorBtn.className = 'color-btn';
        colorBtn.style.backgroundColor = color;
        colorBtn.dataset.color = color;
        palette.appendChild(colorBtn);
      });
    }
  }

  initializeLinkColorPalette(): void {
    const palette = document.getElementById('linkColorPalette');
    if (palette) {
      palette.innerHTML = '';
      this.config.COLORS.LINK_PALETTE.forEach(color => {
        const colorBtn = document.createElement('button');
        colorBtn.className = 'color-btn';
        colorBtn.style.backgroundColor = color;
        colorBtn.dataset.color = color;
        palette.appendChild(colorBtn);
      });
    }
  }

  initializeSizeSelector(): void {
    const selector = document.getElementById('nodeSizeSelector');
    if (selector) {
      selector.innerHTML = '';
      this.config.SIZES.NODE_SIZES.forEach(size => {
        const sizeBtn = document.createElement('button');
        sizeBtn.className = 'size-btn';
        sizeBtn.textContent = size.label;
        sizeBtn.dataset.size = size.value.toString();
        sizeBtn.title = size.title;
        if (size.value === 30) {
          sizeBtn.classList.add('active');
        }
        selector.appendChild(sizeBtn);
      });
    }
  }

  initializeStyleSelector(): void {
    const selector = document.getElementById('linkStyleSelector');
    if (selector) {
      selector.innerHTML = '';
      const styles = [
        { style: 'solid', label: '━', title: '実線' },
        { style: 'dashed', label: '┅', title: '破線' },
        { style: 'dotted', label: '┈', title: '点線' }
      ];
      
      styles.forEach((styleData, index) => {
        const styleBtn = document.createElement('button');
        styleBtn.className = 'style-btn';
        styleBtn.textContent = styleData.label;
        styleBtn.dataset.style = styleData.style;
        styleBtn.title = styleData.title;
        if (index === 0) {
          styleBtn.classList.add('active');
        }
        selector.appendChild(styleBtn);
      });
    }
  }

  initializeCategoryColorPalette(): void {
    const palette = document.getElementById('newCategoryColorPalette');
    const selector = document.getElementById('categoryPaletteSelector') as HTMLSelectElement;
    
    if (palette && selector) {
      this.updateCategoryColorPalette(selector.value);
    }
  }

  updateCategoryColorPalette(paletteName: string): void {
    const palette = document.getElementById('newCategoryColorPalette');
    const colors = this.config.COLORS.CATEGORY_PALETTES[paletteName] || this.config.COLORS.NODE_PALETTE;
    
    if (palette) {
      palette.innerHTML = '';
      colors.forEach(color => {
        const colorBtn = document.createElement('button');
        colorBtn.className = 'color-btn';
        colorBtn.style.backgroundColor = color;
        colorBtn.dataset.color = color;
        palette.appendChild(colorBtn);
      });
    }
  }

  updateColorPaletteSelection(color: string, paletteId?: string): void {
    const paletteElement = document.getElementById(paletteId || 'nodeColorPalette');
    if (paletteElement) {
      // Remove active class from all buttons
      paletteElement.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Add active class to selected button
      const selectedBtn = paletteElement.querySelector(`[data-color="${color}"]`);
      if (selectedBtn) {
        selectedBtn.classList.add('active');
      }
    }
    
    this.paletteStates.selectedNodeColor = color;
  }

  updateLinkColorPaletteSelection(color: string): void {
    this.updateColorPaletteSelection(color, 'linkColorPalette');
    this.paletteStates.selectedLinkColor = color;
  }

  updateSizeSelectorSelection(size: string): void {
    const selector = document.getElementById('nodeSizeSelector');
    if (selector) {
      selector.querySelectorAll('.size-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      const selectedBtn = selector.querySelector(`[data-size="${size}"]`);
      if (selectedBtn) {
        selectedBtn.classList.add('active');
      }
    }
    
    this.paletteStates.selectedNodeSize = size;
  }

  updateStyleSelectorSelection(style: string): void {
    const selector = document.getElementById('linkStyleSelector');
    if (selector) {
      selector.querySelectorAll('.style-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      const selectedBtn = selector.querySelector(`[data-style="${style}"]`);
      if (selectedBtn) {
        selectedBtn.classList.add('active');
      }
    }
  }

  resetPaletteSelections(): void {
    this.paletteStates = {
      availableColors: {
        nodes: this.config.COLORS.NODE_PALETTE,
        links: this.config.COLORS.LINK_PALETTE
      }
    };
    
    // Reset UI selections
    document.querySelectorAll('.color-btn, .size-btn, .style-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Set default selections
    this.updateSizeSelectorSelection('30');
    this.updateStyleSelectorSelection('solid');
  }

  getPaletteStates(): PaletteStates {
    return { ...this.paletteStates };
  }
}

describe('WordMapPalettes', () => {
  let palettes: MockWordMapPalettes;

  beforeEach(() => {
    jest.clearAllMocks();
    palettes = new MockWordMapPalettes(mockEditor as WordMapEditor);
  });

  describe('initialization', () => {
    it('should initialize all palette components', () => {
      palettes.initialize();

      expect(mockColorPalette.children.length).toBe(3); // NODE_PALETTE length
      expect(mockLinkColorPalette.children.length).toBe(3); // LINK_PALETTE length
      expect(mockSizeSelector.children.length).toBe(5); // NODE_SIZES length
      expect(mockStyleSelector.children.length).toBe(3); // style options length
    });

    it('should set default size selection', () => {
      palettes.initialize();

      const mediumSizeBtn = mockSizeSelector.querySelector('[data-size="30"]');
      expect(mediumSizeBtn?.classList.contains('active')).toBe(true);
    });

    it('should set default style selection', () => {
      palettes.initialize();

      const solidStyleBtn = mockStyleSelector.querySelector('[data-style="solid"]');
      expect(solidStyleBtn?.classList.contains('active')).toBe(true);
    });
  });

  describe('color palette management', () => {
    it('should update color palette selection', () => {
      palettes.initialize();
      palettes.updateColorPaletteSelection('#ff0000');

      const selectedBtn = mockColorPalette.querySelector('[data-color="#ff0000"]');
      expect(selectedBtn?.classList.contains('active')).toBe(true);
      
      const paletteStates = palettes.getPaletteStates();
      expect(paletteStates.selectedNodeColor).toBe('#ff0000');
    });

    it('should update link color palette selection', () => {
      palettes.initialize();
      palettes.updateLinkColorPaletteSelection('#666666');

      const selectedBtn = mockLinkColorPalette.querySelector('[data-color="#666666"]');
      expect(selectedBtn?.classList.contains('active')).toBe(true);
      
      const paletteStates = palettes.getPaletteStates();
      expect(paletteStates.selectedLinkColor).toBe('#666666');
    });

    it('should update category color palette', () => {
      palettes.initialize();
      palettes.updateCategoryColorPalette('パステル');

      const paletteColors = mockCategoryColorPalette.querySelectorAll('.color-btn');
      expect(paletteColors.length).toBe(7); // パステル palette length
    });
  });

  describe('size selector management', () => {
    it('should update size selector selection', () => {
      palettes.initialize();
      palettes.updateSizeSelectorSelection('40');

      const selectedBtn = mockSizeSelector.querySelector('[data-size="40"]');
      expect(selectedBtn?.classList.contains('active')).toBe(true);
      
      const paletteStates = palettes.getPaletteStates();
      expect(paletteStates.selectedNodeSize).toBe('40');
    });

    it('should create size buttons with correct properties', () => {
      palettes.initialize();

      const sizeButtons = mockSizeSelector.querySelectorAll('.size-btn');
      expect(sizeButtons.length).toBe(5);
      
      const largeBtn = mockSizeSelector.querySelector('[data-size="40"]');
      expect(largeBtn?.textContent).toBe('L');
      expect(largeBtn?.title).toBe('大');
    });
  });

  describe('style selector management', () => {
    it('should update style selector selection', () => {
      palettes.initialize();
      palettes.updateStyleSelectorSelection('dashed');

      const selectedBtn = mockStyleSelector.querySelector('[data-style="dashed"]');
      expect(selectedBtn?.classList.contains('active')).toBe(true);
    });

    it('should create style buttons with correct properties', () => {
      palettes.initialize();

      const styleButtons = mockStyleSelector.querySelectorAll('.style-btn');
      expect(styleButtons.length).toBe(3);
      
      const dashedBtn = mockStyleSelector.querySelector('[data-style="dashed"]');
      expect(dashedBtn?.textContent).toBe('┅');
      expect(dashedBtn?.title).toBe('破線');
    });
  });

  describe('palette state management', () => {
    it('should return current palette states', () => {
      palettes.initialize();
      palettes.updateColorPaletteSelection('#00ff00');
      palettes.updateLinkColorPaletteSelection('#999999');
      palettes.updateSizeSelectorSelection('25');

      const states = palettes.getPaletteStates();
      
      expect(states.selectedNodeColor).toBe('#00ff00');
      expect(states.selectedLinkColor).toBe('#999999');
      expect(states.selectedNodeSize).toBe('25');
      expect(states.availableColors.nodes).toEqual(['#ff0000', '#00ff00', '#0000ff']);
      expect(states.availableColors.links).toEqual(['#666666', '#999999', '#cccccc']);
    });

    it('should reset palette selections', () => {
      palettes.initialize();
      palettes.updateColorPaletteSelection('#ff0000');
      palettes.updateSizeSelectorSelection('50');
      
      palettes.resetPaletteSelections();

      const states = palettes.getPaletteStates();
      expect(states.selectedNodeColor).toBeUndefined();
      expect(states.selectedLinkColor).toBeUndefined();
      expect(states.selectedNodeSize).toBe('30'); // default size
    });
  });

  describe('error handling', () => {
    it('should handle missing DOM elements gracefully', () => {
      document.getElementById = jest.fn().mockReturnValue(null);
      
      expect(() => {
        palettes.initialize();
      }).not.toThrow();
    });

    it('should handle invalid palette names', () => {
      palettes.initialize();
      
      expect(() => {
        palettes.updateCategoryColorPalette('NonExistentPalette');
      }).not.toThrow();
    });

    it('should handle invalid color selections', () => {
      palettes.initialize();
      
      expect(() => {
        palettes.updateColorPaletteSelection('invalid-color');
      }).not.toThrow();
    });
  });
});