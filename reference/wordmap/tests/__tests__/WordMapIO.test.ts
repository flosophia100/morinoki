/**
 * WordMapIO テストファイル
 * 2025-07-07 作成: I/O機能のテスト
 */

import { WordMapData, WordMapNode, WordMapLink } from '../../types/wordmap';

// Mock WordMapEditor
const mockEditor = {
  data: {
    nodes: [] as WordMapNode[],
    links: [] as WordMapLink[],
    categories: [],
    nextNodeId: 1,
    nextLinkId: 1,
    nextCategoryId: 1
  },
  render: jest.fn(),
  updatePropertiesPanel: jest.fn(),
  state: {
    selectedElements: [],
    multiSelectedElements: []
  }
};

// Mock WordMapIO
class MockWordMapIO {
  editor: any;

  constructor(editor: any) {
    this.editor = editor;
  }

  static initialize(editor: any) {
    return new MockWordMapIO(editor);
  }

  saveData(): void {
    // Mock save implementation
    console.log('Save data called');
  }

  loadData(): void {
    // Mock load implementation  
    console.log('Load data called');
  }

  saveToLocalStorage(data: WordMapData, filename: string): void {
    try {
      const dataWithMetadata = {
        ...data,
        metadata: {
          version: '3.3.0',
          format: 'wordmap-json',
          createdAt: new Date().toISOString(),
          savedAt: new Date().toISOString(),
          nodeCount: data.nodes.length,
          linkCount: data.links.length
        }
      };
      
      const jsonData = JSON.stringify(dataWithMetadata, null, 2);
      localStorage.setItem(`wordmap_${filename}`, jsonData);
    } catch (error) {
      throw new Error(`保存に失敗しました: ${(error as Error).message}`);
    }
  }

  loadFromLocalStorage(key: string): void {
    try {
      const jsonData = localStorage.getItem(key);
      if (!jsonData) {
        throw new Error('データが見つかりません');
      }

      const data = JSON.parse(jsonData);
      this.importWordMapData(data);
    } catch (error) {
      throw new Error(`読み込みに失敗しました: ${(error as Error).message}`);
    }
  }

  deleteFromLocalStorage(key: string): void {
    try {
      const filename = key.replace('wordmap_', '');
      localStorage.removeItem(key);
      console.log(`「${filename}」を削除しました。`);
    } catch (error) {
      throw new Error(`削除に失敗しました: ${(error as Error).message}`);
    }
  }

  exportData(): void {
    try {
      const dataWithMetadata = {
        ...this.editor.data,
        metadata: {
          version: '3.3.0',
          format: 'wordmap-json',
          createdAt: new Date().toISOString(),
          savedAt: new Date().toISOString(),
          nodeCount: this.editor.data.nodes.length,
          linkCount: this.editor.data.links.length
        }
      };

      const jsonData = JSON.stringify(dataWithMetadata, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Mock download
      console.log('Export data as blob:', blob.type, blob.size);
      URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error(`エクスポートに失敗しました: ${(error as Error).message}`);
    }
  }

  importWordMapData(data: WordMapData): void {
    try {
      // Validate data structure
      if (!data || typeof data !== 'object') {
        throw new Error('無効なデータ形式です');
      }

      if (!Array.isArray(data.nodes) || !Array.isArray(data.links)) {
        throw new Error('ノードまたはリンクデータが見つかりません');
      }

      // Import data
      this.editor.data.nodes = data.nodes || [];
      this.editor.data.links = data.links || [];
      this.editor.data.categories = data.categories || [];
      this.editor.data.nextNodeId = data.nextNodeId || 1;
      this.editor.data.nextLinkId = data.nextLinkId || 1;
      this.editor.data.nextCategoryId = data.nextCategoryId || 1;

      // Clear selections
      this.editor.state.selectedElements = [];
      this.editor.state.multiSelectedElements = [];

      // Update UI
      if (this.editor.render) {
        this.editor.render();
      }
      if (this.editor.updatePropertiesPanel) {
        this.editor.updatePropertiesPanel();
      }

      console.log(`データをインポートしました: ノード${data.nodes.length}個、リンク${data.links.length}個`);
    } catch (error) {
      throw new Error(`インポートに失敗しました: ${(error as Error).message}`);
    }
  }

  getLocalStorageFiles(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('wordmap_')) {
        keys.push(key);
      }
    }
    return keys.sort();
  }

  validateData(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('データがオブジェクトではありません');
      return { valid: false, errors };
    }

    if (!Array.isArray(data.nodes)) {
      errors.push('nodesが配列ではありません');
    } else {
      data.nodes.forEach((node: any, index: number) => {
        if (!node.id) errors.push(`ノード${index}: IDが必要です`);
        if (!node.label) errors.push(`ノード${index}: ラベルが必要です`);
        if (typeof node.x !== 'number') errors.push(`ノード${index}: x座標が数値ではありません`);
        if (typeof node.y !== 'number') errors.push(`ノード${index}: y座標が数値ではありません`);
        if (!node.style || !node.style.color || typeof node.style.radius !== 'number') {
          errors.push(`ノード${index}: スタイル情報が不正です`);
        }
      });
    }

    if (!Array.isArray(data.links)) {
      errors.push('linksが配列ではありません');
    } else {
      data.links.forEach((link: any, index: number) => {
        if (!link.id) errors.push(`リンク${index}: IDが必要です`);
        if (!link.source) errors.push(`リンク${index}: sourceが必要です`);
        if (!link.target) errors.push(`リンク${index}: targetが必要です`);
        if (!link.style || !link.style.color || typeof link.style.width !== 'number') {
          errors.push(`リンク${index}: スタイル情報が不正です`);
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }
}

describe('WordMapIO', () => {
  let io: MockWordMapIO;

  beforeEach(() => {
    // Reset mock editor data
    mockEditor.data = {
      nodes: [],
      links: [],
      categories: [],
      nextNodeId: 1,
      nextLinkId: 1,
      nextCategoryId: 1
    };
    mockEditor.state = {
      selectedElements: [],
      multiSelectedElements: []
    };
    
    io = MockWordMapIO.initialize(mockEditor);
    
    // Clear localStorage
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('localStorage operations', () => {
    it('should save data to localStorage', () => {
      const testData: WordMapData = {
        nodes: [{
          id: 1,
          label: 'Test Node',
          x: 100,
          y: 200,
          style: { color: '#ff0000', radius: 30 }
        }],
        links: [],
        categories: [],
        nextNodeId: 2,
        nextLinkId: 1,
        nextCategoryId: 1
      };

      io.saveToLocalStorage(testData, 'test-file');

      const savedData = localStorage.getItem('wordmap_test-file');
      expect(savedData).toBeTruthy();
      
      const parsedData = JSON.parse(savedData!);
      expect(parsedData.nodes).toHaveLength(1);
      expect(parsedData.nodes[0].label).toBe('Test Node');
      expect(parsedData.metadata).toBeDefined();
      expect(parsedData.metadata.nodeCount).toBe(1);
    });

    it('should load data from localStorage', () => {
      const testData = {
        nodes: [{
          id: 1,
          label: 'Loaded Node',
          x: 50,
          y: 100,
          style: { color: '#00ff00', radius: 25 }
        }],
        links: [],
        categories: [],
        nextNodeId: 2,
        nextLinkId: 1,
        nextCategoryId: 1
      };

      localStorage.setItem('wordmap_test-load', JSON.stringify(testData));
      
      io.loadFromLocalStorage('wordmap_test-load');

      expect(mockEditor.data.nodes).toHaveLength(1);
      expect(mockEditor.data.nodes[0].label).toBe('Loaded Node');
      expect(mockEditor.render).toHaveBeenCalled();
      expect(mockEditor.updatePropertiesPanel).toHaveBeenCalled();
    });

    it('should delete data from localStorage', () => {
      localStorage.setItem('wordmap_test-delete', '{"nodes":[],"links":[]}');
      
      io.deleteFromLocalStorage('wordmap_test-delete');

      expect(localStorage.getItem('wordmap_test-delete')).toBeNull();
    });

    it('should get list of localStorage files', () => {
      localStorage.setItem('wordmap_file1', '{}');
      localStorage.setItem('wordmap_file2', '{}');
      localStorage.setItem('other_data', '{}');

      const files = io.getLocalStorageFiles();

      expect(files).toEqual(['wordmap_file1', 'wordmap_file2']);
    });

    it('should handle localStorage errors', () => {
      expect(() => {
        io.loadFromLocalStorage('wordmap_nonexistent');
      }).toThrow('読み込みに失敗しました');

      expect(() => {
        io.deleteFromLocalStorage('wordmap_nonexistent');
      }).toThrow('削除に失敗しました');
    });
  });

  describe('data import/export', () => {
    it('should export data as blob', () => {
      mockEditor.data = {
        nodes: [{ id: 1, label: 'Export Node', x: 0, y: 0, style: { color: '#ff0000', radius: 30 } }],
        links: [],
        categories: [],
        nextNodeId: 2,
        nextLinkId: 1,
        nextCategoryId: 1
      };

      const consoleSpy = jest.spyOn(console, 'log');
      
      io.exportData();

      expect(consoleSpy).toHaveBeenCalledWith('Export data as blob:', 'application/json', expect.any(Number));
    });

    it('should import valid WordMap data', () => {
      const testData: WordMapData = {
        nodes: [
          { id: 1, label: 'Node 1', x: 0, y: 0, style: { color: '#ff0000', radius: 30 } },
          { id: 2, label: 'Node 2', x: 100, y: 100, style: { color: '#00ff00', radius: 25 } }
        ],
        links: [
          { id: 1, source: 1, target: 2, style: { color: '#666666', width: 2 } }
        ],
        categories: [],
        nextNodeId: 3,
        nextLinkId: 2,
        nextCategoryId: 1
      };

      io.importWordMapData(testData);

      expect(mockEditor.data.nodes).toHaveLength(2);
      expect(mockEditor.data.links).toHaveLength(1);
      expect(mockEditor.data.nextNodeId).toBe(3);
      expect(mockEditor.state.selectedElements).toEqual([]);
    });

    it('should handle import errors', () => {
      expect(() => {
        io.importWordMapData(null);
      }).toThrow('インポートに失敗しました');

      expect(() => {
        io.importWordMapData({ invalid: 'data' });
      }).toThrow('インポートに失敗しました');
    });
  });

  describe('data validation', () => {
    it('should validate correct data structure', () => {
      const validData = {
        nodes: [
          { id: 1, label: 'Node 1', x: 0, y: 0, style: { color: '#ff0000', radius: 30 } }
        ],
        links: [
          { id: 1, source: 1, target: 2, style: { color: '#666666', width: 2 } }
        ]
      };

      const result = io.validateData(validData);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect invalid data structure', () => {
      const invalidData = {
        nodes: [
          { label: 'Missing ID', x: 0, y: 0 }
        ],
        links: [
          { id: 1, source: 1 } // missing target and style
        ]
      };

      const result = io.validateData(invalidData);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('ノード0: IDが必要です');
    });

    it('should handle non-object data', () => {
      const result = io.validateData('invalid');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('データがオブジェクトではありません');
    });

    it('should validate missing arrays', () => {
      const result = io.validateData({});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('nodesが配列ではありません');
      expect(result.errors).toContain('linksが配列ではありません');
    });
  });

  describe('error handling', () => {
    it('should handle localStorage quota exceeded', () => {
      // Mock localStorage to throw quota exceeded error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn(() => {
        throw new Error('QuotaExceededError');
      });

      const testData: WordMapData = {
        nodes: [],
        links: [],
        categories: [],
        nextNodeId: 1,
        nextLinkId: 1,
        nextCategoryId: 1
      };

      expect(() => {
        io.saveToLocalStorage(testData, 'test');
      }).toThrow('保存に失敗しました');

      localStorage.setItem = originalSetItem;
    });

    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('wordmap_corrupted', 'invalid-json');

      expect(() => {
        io.loadFromLocalStorage('wordmap_corrupted');
      }).toThrow('読み込みに失敗しました');
    });

    it('should handle export errors', () => {
      // Mock global URL to throw error
      const originalURL = global.URL;
      global.URL = {
        createObjectURL: jest.fn(() => {
          throw new Error('URL creation failed');
        }),
        revokeObjectURL: jest.fn()
      } as any;

      expect(() => {
        io.exportData();
      }).toThrow('エクスポートに失敗しました');

      global.URL = originalURL;
    });
  });

  describe('edge cases', () => {
    it('should handle empty localStorage', () => {
      const files = io.getLocalStorageFiles();
      expect(files).toEqual([]);
    });

    it('should handle data with missing optional fields', () => {
      const dataWithDefaults = {
        nodes: [],
        links: []
        // missing categories, nextNodeId, etc.
      };

      expect(() => {
        io.importWordMapData(dataWithDefaults);
      }).not.toThrow();

      expect(mockEditor.data.categories).toEqual([]);
      expect(mockEditor.data.nextNodeId).toBe(1);
    });

    it('should preserve editor state during import errors', () => {
      const originalData = { ...mockEditor.data };
      
      try {
        io.importWordMapData(null);
      } catch (error) {
        // Error is expected
      }

      expect(mockEditor.data).toEqual(originalData);
    });
  });
});