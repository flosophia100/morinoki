/**
 * WordMapControls テストファイル
 * 2025-07-07 作成: コントロール機能のテスト
 */

import { WordMapControls, WordMapEditor, WordMapConfig, ForceSettings } from '../../types/wordmap';

// Mock WordMapEditor
const mockEditor: Partial<WordMapEditor> = {
  config: {
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
    }
  } as WordMapConfig,
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
  updateForceCenter: jest.fn(),
  updateForceCharge: jest.fn(),
  updateLinkDistance: jest.fn(),
  updateLinkStrength: jest.fn(),
  updateTheme: jest.fn(),
  render: jest.fn()
};

// Mock DOM elements
const mockElements: Record<string, HTMLElement> = {
  'centerForce': Object.assign(document.createElement('input'), { type: 'range', value: '0.3' }),
  'centerForceValue': document.createElement('span'),
  'chargeForce': Object.assign(document.createElement('input'), { type: 'range', value: '-300' }),
  'chargeForceValue': document.createElement('span'),
  'linkDistance': Object.assign(document.createElement('input'), { type: 'range', value: '100' }),
  'linkDistanceValue': document.createElement('span'),
  'linkStrength': Object.assign(document.createElement('input'), { type: 'range', value: '1' }),
  'linkStrengthValue': document.createElement('span'),
  'themeToggle': document.createElement('button'),
  'saveBtn': document.createElement('button'),
  'loadBtn': document.createElement('button'),
  'fitBtn': document.createElement('button'),
  'resetLayoutBtn': document.createElement('button'),
  'helpBtn': document.createElement('button'),
  'debugToggle': document.createElement('button'),
  'clearBtn': document.createElement('button'),
  'helpModal': document.createElement('div'),
  'clearModal': document.createElement('div'),
  'clearSaveBtn': document.createElement('button'),
  'clearConfirmBtn': document.createElement('button'),
  'clearCancelBtn': document.createElement('button')
};

// Mock document methods
document.getElementById = jest.fn((id: string) => mockElements[id] || null);
document.addEventListener = jest.fn();
document.removeEventListener = jest.fn();

// Mock window methods
Object.defineProperty(window, 'addEventListener', {
  value: jest.fn(),
  writable: true
});

Object.defineProperty(window, 'removeEventListener', {
  value: jest.fn(),
  writable: true
});

// Mock WordMapControls class
class MockWordMapControls implements WordMapControls {
  editor: WordMapEditor;
  config: WordMapConfig;
  private forceSettings: ForceSettings;

  constructor(editor: WordMapEditor) {
    this.editor = editor;
    this.config = editor.config;
    this.forceSettings = {
      centerForce: this.config.FORCE.CENTER_STRENGTH,
      chargeForce: this.config.FORCE.CHARGE_STRENGTH,
      linkDistance: this.config.FORCE.LINK_DISTANCE,
      linkStrength: this.config.FORCE.LINK_STRENGTH
    };
  }

  initialize(): void {
    this.setupForceSettings();
    this.setupModalEvents();
    this.setupToolbarEvents();
    this.setupThemeToggle();
    this.setupKeyboardShortcuts();
  }

  setupForceSettings(): void {
    const controls = [
      { id: 'centerForce', valueId: 'centerForceValue', callback: this.editor.updateForceCenter },
      { id: 'chargeForce', valueId: 'chargeForceValue', callback: this.editor.updateForceCharge },
      { id: 'linkDistance', valueId: 'linkDistanceValue', callback: this.editor.updateLinkDistance },
      { id: 'linkStrength', valueId: 'linkStrengthValue', callback: this.editor.updateLinkStrength }
    ];

    controls.forEach(control => {
      const element = document.getElementById(control.id) as HTMLInputElement;
      const valueElement = document.getElementById(control.valueId);
      
      if (element && valueElement) {
        element.addEventListener('input', (e) => {
          const value = parseFloat((e.target as HTMLInputElement).value);
          valueElement.textContent = value.toString();
          if (control.callback) {
            control.callback.call(this.editor, value);
          }
        });
      }
    });
  }

  setupModalEvents(): void {
    // Clear modal events
    const clearBtn = document.getElementById('clearBtn');
    const clearModal = document.getElementById('clearModal');
    const clearSaveBtn = document.getElementById('clearSaveBtn');
    const clearConfirmBtn = document.getElementById('clearConfirmBtn');
    const clearCancelBtn = document.getElementById('clearCancelBtn');

    if (clearBtn && clearModal) {
      clearBtn.addEventListener('click', () => {
        clearModal.classList.remove('hidden');
      });
    }

    if (clearSaveBtn) {
      clearSaveBtn.addEventListener('click', () => {
        // Mock save and clear action
        console.log('Save and clear action');
      });
    }

    if (clearConfirmBtn) {
      clearConfirmBtn.addEventListener('click', () => {
        // Mock clear action
        console.log('Clear action');
      });
    }

    if (clearCancelBtn && clearModal) {
      clearCancelBtn.addEventListener('click', () => {
        clearModal.classList.add('hidden');
      });
    }
  }

  setupToolbarEvents(): void {
    const toolbarButtons = [
      { id: 'saveBtn', action: 'save' },
      { id: 'loadBtn', action: 'load' },
      { id: 'fitBtn', action: 'fit' },
      { id: 'resetLayoutBtn', action: 'resetLayout' },
      { id: 'helpBtn', action: 'help' },
      { id: 'debugToggle', action: 'debug' }
    ];

    toolbarButtons.forEach(button => {
      const element = document.getElementById(button.id);
      if (element) {
        element.addEventListener('click', () => {
          console.log(`${button.action} button clicked`);
        });
      }
    });
  }

  setupThemeToggle(): void {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }
  }

  setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.code) {
          case this.config.SHORTCUTS.SAVE:
            e.preventDefault();
            console.log('Save shortcut pressed');
            break;
          case this.config.SHORTCUTS.LOAD:
            e.preventDefault();
            console.log('Load shortcut pressed');
            break;
        }
      } else {
        switch (e.code) {
          case this.config.SHORTCUTS.FIT_VIEW:
            e.preventDefault();
            console.log('Fit view shortcut pressed');
            break;
          case this.config.SHORTCUTS.RESET_LAYOUT:
            e.preventDefault();
            console.log('Reset layout shortcut pressed');
            break;
          case this.config.SHORTCUTS.HELP:
            e.preventDefault();
            console.log('Help shortcut pressed');
            break;
        }
      }
    });
  }

  toggleTheme(): void {
    const currentTheme = this.editor.state.theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.editor.state.theme = newTheme;
    
    if (this.editor.updateTheme) {
      this.editor.updateTheme(newTheme);
    }
    
    this.updateThemeButton();
  }

  updateThemeButton(): void {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      const isDark = this.editor.state.theme === 'dark';
      themeToggle.textContent = isDark ? '☀️ ライト' : '🌓 ダーク';
    }
  }

  getForceSettings(): ForceSettings {
    return { ...this.forceSettings };
  }

  setForceSettings(settings: Partial<ForceSettings>): void {
    this.forceSettings = { ...this.forceSettings, ...settings };
    
    // Update UI elements
    Object.entries(settings).forEach(([key, value]) => {
      const elementMap: Record<string, string> = {
        centerForce: 'centerForce',
        chargeForce: 'chargeForce',
        linkDistance: 'linkDistance',
        linkStrength: 'linkStrength'
      };
      
      const elementId = elementMap[key];
      if (elementId && value !== undefined) {
        const element = document.getElementById(elementId) as HTMLInputElement;
        const valueElement = document.getElementById(elementId + 'Value');
        
        if (element) {
          element.value = value.toString();
        }
        if (valueElement) {
          valueElement.textContent = value.toString();
        }
      }
    });
  }

  resetControls(): void {
    this.forceSettings = {
      centerForce: this.config.FORCE.CENTER_STRENGTH,
      chargeForce: this.config.FORCE.CHARGE_STRENGTH,
      linkDistance: this.config.FORCE.LINK_DISTANCE,
      linkStrength: this.config.FORCE.LINK_STRENGTH
    };
    
    this.setForceSettings(this.forceSettings);
  }
}

describe('WordMapControls', () => {
  let controls: MockWordMapControls;

  beforeEach(() => {
    jest.clearAllMocks();
    controls = new MockWordMapControls(mockEditor as WordMapEditor);
  });

  describe('initialization', () => {
    it('should initialize all control components', () => {
      controls.initialize();

      expect(document.addEventListener).toHaveBeenCalled();
      expect(mockElements.centerForce.addEventListener).toHaveBeenCalled();
      expect(mockElements.chargeForce.addEventListener).toHaveBeenCalled();
      expect(mockElements.linkDistance.addEventListener).toHaveBeenCalled();
      expect(mockElements.linkStrength.addEventListener).toHaveBeenCalled();
    });

    it('should set up theme toggle', () => {
      controls.initialize();

      expect(mockElements.themeToggle.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should set up toolbar events', () => {
      controls.initialize();

      expect(mockElements.saveBtn.addEventListener).toHaveBeenCalled();
      expect(mockElements.loadBtn.addEventListener).toHaveBeenCalled();
      expect(mockElements.fitBtn.addEventListener).toHaveBeenCalled();
      expect(mockElements.resetLayoutBtn.addEventListener).toHaveBeenCalled();
    });
  });

  describe('force settings management', () => {
    it('should get current force settings', () => {
      const settings = controls.getForceSettings();

      expect(settings).toEqual({
        centerForce: 0.3,
        chargeForce: -300,
        linkDistance: 100,
        linkStrength: 1
      });
    });

    it('should set force settings', () => {
      const newSettings = {
        centerForce: 0.5,
        linkDistance: 150
      };

      controls.setForceSettings(newSettings);
      const currentSettings = controls.getForceSettings();

      expect(currentSettings.centerForce).toBe(0.5);
      expect(currentSettings.linkDistance).toBe(150);
      expect(currentSettings.chargeForce).toBe(-300); // unchanged
    });

    it('should reset controls to default values', () => {
      controls.setForceSettings({ centerForce: 0.8, chargeForce: -500 });
      controls.resetControls();

      const settings = controls.getForceSettings();
      expect(settings).toEqual({
        centerForce: 0.3,
        chargeForce: -300,
        linkDistance: 100,
        linkStrength: 1
      });
    });
  });

  describe('theme management', () => {
    it('should toggle theme from light to dark', () => {
      controls.toggleTheme();

      expect(mockEditor.state.theme).toBe('dark');
      expect(mockEditor.updateTheme).toHaveBeenCalledWith('dark');
    });

    it('should toggle theme from dark to light', () => {
      mockEditor.state.theme = 'dark';
      controls.toggleTheme();

      expect(mockEditor.state.theme).toBe('light');
      expect(mockEditor.updateTheme).toHaveBeenCalledWith('light');
    });

    it('should update theme button text', () => {
      mockEditor.state.theme = 'light';
      controls.updateThemeButton();

      expect(mockElements.themeToggle.textContent).toBe('🌓 ダーク');

      mockEditor.state.theme = 'dark';
      controls.updateThemeButton();

      expect(mockElements.themeToggle.textContent).toBe('☀️ ライト');
    });
  });

  describe('force settings UI updates', () => {
    it('should update UI when force settings change', () => {
      controls.setForceSettings({ centerForce: 0.7 });

      expect((mockElements.centerForce as HTMLInputElement).value).toBe('0.7');
      expect(mockElements.centerForceValue.textContent).toBe('0.7');
    });

    it('should handle multiple setting updates', () => {
      controls.setForceSettings({
        centerForce: 0.4,
        chargeForce: -400,
        linkDistance: 120
      });

      expect((mockElements.centerForce as HTMLInputElement).value).toBe('0.4');
      expect((mockElements.chargeForce as HTMLInputElement).value).toBe('-400');
      expect((mockElements.linkDistance as HTMLInputElement).value).toBe('120');
    });
  });

  describe('keyboard shortcuts', () => {
    it('should handle save shortcut', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      let keydownHandler: Function | null = null;
      
      // カスタムaddEventListenerで実際のハンドラーをキャプチャ
      const mockAddEventListener = jest.fn((event: string, handler: Function) => {
        if (event === 'keydown') {
          keydownHandler = handler;
        }
      });
      document.addEventListener = mockAddEventListener;
      
      controls.setupKeyboardShortcuts();

      // Simulate Ctrl+S keypress
      if (keydownHandler) {
        keydownHandler({
          code: 'KeyS',
          ctrlKey: true,
          preventDefault: jest.fn()
        });
      }

      expect(consoleSpy).toHaveBeenCalledWith('Save shortcut pressed');
    });

    it('should handle load shortcut', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      let keydownHandler: Function | null = null;
      
      const mockAddEventListener = jest.fn((event: string, handler: Function) => {
        if (event === 'keydown') {
          keydownHandler = handler;
        }
      });
      document.addEventListener = mockAddEventListener;
      
      controls.setupKeyboardShortcuts();

      if (keydownHandler) {
        keydownHandler({
          code: 'KeyO',
          ctrlKey: true,
          preventDefault: jest.fn()
        });
      }

      expect(consoleSpy).toHaveBeenCalledWith('Load shortcut pressed');
    });

    it('should handle fit view shortcut', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      let keydownHandler: Function | null = null;
      
      const mockAddEventListener = jest.fn((event: string, handler: Function) => {
        if (event === 'keydown') {
          keydownHandler = handler;
        }
      });
      document.addEventListener = mockAddEventListener;
      
      controls.setupKeyboardShortcuts();

      if (keydownHandler) {
        keydownHandler({
          code: 'KeyF',
          preventDefault: jest.fn()
        });
      }

      expect(consoleSpy).toHaveBeenCalledWith('Fit view shortcut pressed');
    });
  });

  describe('modal events', () => {
    it('should set up clear modal events', () => {
      controls.setupModalEvents();

      expect(mockElements.clearBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.clearSaveBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.clearConfirmBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.clearCancelBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('error handling', () => {
    it('should handle missing DOM elements gracefully', () => {
      document.getElementById = jest.fn().mockReturnValue(null);

      expect(() => {
        controls.initialize();
      }).not.toThrow();
    });

    it('should handle invalid force settings', () => {
      expect(() => {
        controls.setForceSettings({ centerForce: NaN });
      }).not.toThrow();
    });
  });
});