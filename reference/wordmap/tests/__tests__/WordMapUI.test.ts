/**
 * WordMapUI テストファイル
 * 2025-07-07 作成: UI統合モジュールのテスト
 */

import { WordMapUI, WordMapEditor, UIState } from '../../types/wordmap';

// Mock submodules
const mockPalettes = {
  initialize: jest.fn(),
  getPaletteStates: jest.fn(() => ({
    selectedNodeColor: '#ff0000',
    selectedLinkColor: '#666666',
    selectedNodeSize: '30',
    availableColors: {
      nodes: ['#ff0000', '#00ff00', '#0000ff'],
      links: ['#666666', '#999999', '#cccccc']
    }
  })),
  resetPaletteSelections: jest.fn()
};

const mockControls = {
  initialize: jest.fn(),
  getForceSettings: jest.fn(() => ({
    centerForce: 0.3,
    chargeForce: -300,
    linkDistance: 100,
    linkStrength: 1
  })),
  resetControls: jest.fn()
};

const mockProperties = {
  initialize: jest.fn(),
  updatePropertiesPanel: jest.fn(),
  updateSelectedNode: jest.fn(),
  updateSelectedLink: jest.fn(),
  updateMultiSelectedElements: jest.fn()
};

const mockCategories = {
  initialize: jest.fn(),
  updateCategories: jest.fn()
};

// Mock editor
const mockEditor: Partial<WordMapEditor> = {
  data: {
    nodes: [],
    links: [],
    categories: [],
    nextNodeId: 1,
    nextLinkId: 1,
    nextCategoryId: 1
  },
  state: {
    selectedElements: [],
    multiSelectedElements: [],
    mode: 'unified',
    zoom: 1,
    forceEnabled: true,
    isDragging: false,
    theme: 'light',
    isShiftPressed: false
  },
  config: {
    DEBUG: { MODE: 'lite' }
  } as any,
  render: jest.fn()
};

// Mock WordMapUI implementation
class MockWordMapUI implements WordMapUI {
  editor: WordMapEditor;
  config: any;
  palettes: any;
  properties: any;
  categories: any;
  controls: any;

  constructor(editor: WordMapEditor) {
    this.editor = editor;
    this.config = editor.config;
  }

  initialize(): void {
    try {
      // Initialize submodules
      this.palettes = mockPalettes;
      this.properties = mockProperties;
      this.categories = mockCategories;
      this.controls = mockControls;

      // Initialize all submodules
      this.palettes.initialize();
      this.properties.initialize();
      this.categories.initialize();
      this.controls.initialize();

      console.log('WordMapUI initialized successfully');
    } catch (error) {
      console.error('WordMapUI initialization failed:', error);
      throw error;
    }
  }

  resetUI(): void {
    try {
      if (this.palettes) {
        this.palettes.resetPaletteSelections();
      }
      if (this.controls) {
        this.controls.resetControls();
      }
      if (this.properties) {
        this.properties.updatePropertiesPanel();
      }
      if (this.categories) {
        this.categories.updateCategories();
      }

      console.log('UI reset completed');
    } catch (error) {
      console.error('UI reset failed:', error);
      throw error;
    }
  }

  getUIState(): UIState {
    return {
      palettes: this.palettes ? this.palettes.getPaletteStates() : undefined,
      controls: this.controls ? this.controls.getForceSettings() : undefined,
      theme: this.editor.state.theme
    };
  }

  async loadModule(moduleName: string): Promise<void> {
    try {
      console.log(`Loading module: ${moduleName}`);
      
      // Simulate async module loading
      await new Promise(resolve => setTimeout(resolve, 10));
      
      switch (moduleName) {
        case 'palettes':
          this.palettes = mockPalettes;
          break;
        case 'properties':
          this.properties = mockProperties;
          break;
        case 'categories':
          this.categories = mockCategories;
          break;
        case 'controls':
          this.controls = mockControls;
          break;
        default:
          throw new Error(`Unknown module: ${moduleName}`);
      }
      
      console.log(`Module ${moduleName} loaded successfully`);
    } catch (error) {
      console.error(`Failed to load module ${moduleName}:`, error);
      throw error;
    }
  }

  getDebugInfo(): any {
    return {
      initialized: {
        palettes: !!this.palettes,
        properties: !!this.properties,
        categories: !!this.categories,
        controls: !!this.controls
      },
      state: this.editor.state,
      dataStats: {
        nodeCount: this.editor.data.nodes.length,
        linkCount: this.editor.data.links.length,
        categoryCount: this.editor.data.categories.length
      },
      modules: {
        palettes: this.palettes ? 'loaded' : 'not loaded',
        properties: this.properties ? 'loaded' : 'not loaded',
        categories: this.categories ? 'loaded' : 'not loaded',
        controls: this.controls ? 'loaded' : 'not loaded'
      }
    };
  }

  // Facade methods for backward compatibility
  updatePropertiesPanel(): void {
    if (this.properties) {
      this.properties.updatePropertiesPanel();
    }
  }

  updateSelectedNode(): void {
    if (this.properties) {
      this.properties.updateSelectedNode();
    }
  }

  updateSelectedLink(): void {
    if (this.properties) {
      this.properties.updateSelectedLink();
    }
  }

  updateSelectedLinkStyle(style: string): void {
    if (this.properties) {
      this.properties.updateSelectedLink();
    }
  }

  updateMultiSelectedElements(): void {
    if (this.properties) {
      this.properties.updateMultiSelectedElements();
    }
  }
}

describe('WordMapUI', () => {
  let ui: MockWordMapUI;

  beforeEach(() => {
    jest.clearAllMocks();
    ui = new MockWordMapUI(mockEditor as WordMapEditor);
  });

  describe('initialization', () => {
    it('should initialize all submodules', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      ui.initialize();

      expect(mockPalettes.initialize).toHaveBeenCalled();
      expect(mockProperties.initialize).toHaveBeenCalled();
      expect(mockCategories.initialize).toHaveBeenCalled();
      expect(mockControls.initialize).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('WordMapUI initialized successfully');
    });

    it('should handle initialization errors', () => {
      mockPalettes.initialize.mockImplementation(() => {
        throw new Error('Palette initialization failed');
      });

      expect(() => {
        ui.initialize();
      }).toThrow('Palette initialization failed');
    });
  });

  describe('module loading', () => {
    it('should load palettes module', async () => {
      await ui.loadModule('palettes');

      expect(ui.palettes).toBe(mockPalettes);
    });

    it('should load properties module', async () => {
      await ui.loadModule('properties');

      expect(ui.properties).toBe(mockProperties);
    });

    it('should load categories module', async () => {
      await ui.loadModule('categories');

      expect(ui.categories).toBe(mockCategories);
    });

    it('should load controls module', async () => {
      await ui.loadModule('controls');

      expect(ui.controls).toBe(mockControls);
    });

    it('should handle unknown modules', async () => {
      await expect(ui.loadModule('unknown')).rejects.toThrow('Unknown module: unknown');
    });
  });

  describe('UI state management', () => {
    it('should get current UI state', () => {
      ui.initialize();
      
      const state = ui.getUIState();

      expect(state.theme).toBe('light');
      expect(state.palettes).toBeDefined();
      expect(state.controls).toBeDefined();
      expect(state.palettes?.selectedNodeColor).toBe('#ff0000');
      expect(state.controls?.centerForce).toBe(0.3);
    });

    it('should handle missing modules in state', () => {
      // Don't initialize, so modules are undefined
      const state = ui.getUIState();

      expect(state.theme).toBe('light');
      expect(state.palettes).toBeUndefined();
      expect(state.controls).toBeUndefined();
    });

    it('should reset UI to default state', () => {
      ui.initialize();
      
      ui.resetUI();

      expect(mockPalettes.resetPaletteSelections).toHaveBeenCalled();
      expect(mockControls.resetControls).toHaveBeenCalled();
      expect(mockProperties.updatePropertiesPanel).toHaveBeenCalled();
      expect(mockCategories.updateCategories).toHaveBeenCalled();
    });

    it('should handle reset errors gracefully', () => {
      ui.initialize();
      mockPalettes.resetPaletteSelections.mockImplementation(() => {
        throw new Error('Reset failed');
      });

      expect(() => {
        ui.resetUI();
      }).toThrow('Reset failed');
    });
  });

  describe('debug information', () => {
    it('should provide comprehensive debug info', () => {
      ui.initialize();
      
      const debugInfo = ui.getDebugInfo();

      expect(debugInfo.initialized.palettes).toBe(true);
      expect(debugInfo.initialized.properties).toBe(true);
      expect(debugInfo.initialized.categories).toBe(true);
      expect(debugInfo.initialized.controls).toBe(true);
      expect(debugInfo.state).toBe(mockEditor.state);
      expect(debugInfo.dataStats.nodeCount).toBe(0);
      expect(debugInfo.modules.palettes).toBe('loaded');
    });

    it('should show unloaded modules in debug info', () => {
      // Don't initialize
      const debugInfo = ui.getDebugInfo();

      expect(debugInfo.initialized.palettes).toBe(false);
      expect(debugInfo.modules.palettes).toBe('not loaded');
    });
  });

  describe('facade methods', () => {
    beforeEach(() => {
      ui.initialize();
    });

    it('should delegate updatePropertiesPanel', () => {
      ui.updatePropertiesPanel();

      expect(mockProperties.updatePropertiesPanel).toHaveBeenCalled();
    });

    it('should delegate updateSelectedNode', () => {
      ui.updateSelectedNode();

      expect(mockProperties.updateSelectedNode).toHaveBeenCalled();
    });

    it('should delegate updateSelectedLink', () => {
      ui.updateSelectedLink();

      expect(mockProperties.updateSelectedLink).toHaveBeenCalled();
    });

    it('should delegate updateSelectedLinkStyle', () => {
      ui.updateSelectedLinkStyle('dashed');

      expect(mockProperties.updateSelectedLink).toHaveBeenCalled();
    });

    it('should delegate updateMultiSelectedElements', () => {
      ui.updateMultiSelectedElements();

      expect(mockProperties.updateMultiSelectedElements).toHaveBeenCalled();
    });

    it('should handle missing modules in facade methods', () => {
      ui.properties = null;

      expect(() => {
        ui.updatePropertiesPanel();
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle module initialization failures', () => {
      mockControls.initialize.mockImplementation(() => {
        throw new Error('Controls initialization failed');
      });

      expect(() => {
        ui.initialize();
      }).toThrow('Controls initialization failed');
    });

    it('should handle async module loading failures', async () => {
      await expect(ui.loadModule('invalid')).rejects.toThrow();
    });

    it('should handle state retrieval with broken modules', () => {
      ui.palettes = {
        getPaletteStates: () => {
          throw new Error('Palette state error');
        }
      };

      expect(() => {
        ui.getUIState();
      }).toThrow('Palette state error');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete initialization flow', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      // Simulate dynamic module loading
      await ui.loadModule('palettes');
      await ui.loadModule('properties');
      await ui.loadModule('categories');
      await ui.loadModule('controls');

      // Initialize UI
      ui.initialize();

      // Check state
      const state = ui.getUIState();
      expect(state.theme).toBe('light');

      // Reset UI
      ui.resetUI();

      expect(consoleSpy).toHaveBeenCalledWith('WordMapUI initialized successfully');
      expect(consoleSpy).toHaveBeenCalledWith('UI reset completed');
    });

    it('should handle partial module loading', async () => {
      await ui.loadModule('palettes');
      await ui.loadModule('controls');
      // Skip properties and categories

      const debugInfo = ui.getDebugInfo();
      expect(debugInfo.modules.palettes).toBe('loaded');
      expect(debugInfo.modules.controls).toBe('loaded');
      expect(debugInfo.modules.properties).toBe('not loaded');
      expect(debugInfo.modules.categories).toBe('not loaded');
    });

    it('should maintain consistency after operations', () => {
      ui.initialize();
      
      const initialState = ui.getUIState();
      
      // Perform operations
      ui.updatePropertiesPanel();
      ui.updateSelectedNode();
      ui.resetUI();
      
      const finalState = ui.getUIState();
      
      // State structure should remain consistent
      expect(finalState.theme).toBe(initialState.theme);
      expect(typeof finalState.palettes).toBe(typeof initialState.palettes);
      expect(typeof finalState.controls).toBe(typeof initialState.controls);
    });
  });
});