/**
 * WordMapCore テストファイル
 * 2025-07-07 作成: コア機能のテスト
 */

import { WordMapData, WordMapNode, WordMapLink } from '../../types/wordmap';

// Mock D3WordMapEditor
class MockD3WordMapEditor {
  public data: WordMapData;
  public config: any;
  public state: any;

  constructor(containerId: string, config?: any) {
    this.config = config || {
      CANVAS: { WIDTH: 800, HEIGHT: 600 },
      NODE: { DEFAULT_RADIUS: 30 },
      LINK: { DEFAULT_WIDTH: 2 }
    };
    
    this.state = {
      selectedElements: [],
      multiSelectedElements: [],
      mode: 'unified',
      zoom: 1,
      forceEnabled: true,
      isDragging: false,
      theme: 'light',
      isShiftPressed: false
    };

    this.data = {
      nodes: [],
      links: [],
      categories: [],
      nextNodeId: 1,
      nextLinkId: 1,
      nextCategoryId: 1
    };
  }

  addNode(x: number, y: number, label: string = 'New Node'): WordMapNode {
    const node: WordMapNode = {
      id: this.data.nextNodeId++,
      label,
      x,
      y,
      style: {
        color: '#e74c3c',
        radius: this.config.NODE.DEFAULT_RADIUS
      }
    };
    
    this.data.nodes.push(node);
    return node;
  }

  addLink(sourceId: string | number, targetId: string | number): WordMapLink | null {
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
        color: '#666666',
        width: this.config.LINK.DEFAULT_WIDTH
      }
    };
    
    this.data.links.push(link);
    return link;
  }

  removeNode(nodeId: string | number): boolean {
    const nodeIndex = this.data.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) {
      return false;
    }

    // Remove connected links
    this.data.links = this.data.links.filter(link => 
      link.source !== nodeId && link.target !== nodeId
    );

    // Remove node
    this.data.nodes.splice(nodeIndex, 1);
    return true;
  }

  removeLink(linkId: string | number): boolean {
    const linkIndex = this.data.links.findIndex(l => l.id === linkId);
    if (linkIndex === -1) {
      return false;
    }

    this.data.links.splice(linkIndex, 1);
    return true;
  }

  clearAllData(): void {
    this.data.nodes = [];
    this.data.links = [];
    this.data.categories = [];
    this.data.nextNodeId = 1;
    this.data.nextLinkId = 1;
    this.data.nextCategoryId = 1;
    this.state.selectedElements = [];
    this.state.multiSelectedElements = [];
  }

  selectElement(element: WordMapNode | WordMapLink): void {
    this.state.selectedElements = [element];
  }

  multiSelectElement(element: WordMapNode | WordMapLink): void {
    if (!this.state.multiSelectedElements.includes(element)) {
      this.state.multiSelectedElements.push(element);
    }
  }

  deselectAll(): void {
    this.state.selectedElements = [];
    this.state.multiSelectedElements = [];
  }

  getNodeById(id: string | number): WordMapNode | undefined {
    return this.data.nodes.find(n => n.id === id);
  }

  getLinkById(id: string | number): WordMapLink | undefined {
    return this.data.links.find(l => l.id === id);
  }

  updateNodeStyle(nodeId: string | number, style: Partial<{ color: string; radius: number }>): boolean {
    const node = this.getNodeById(nodeId);
    if (!node) {
      return false;
    }

    node.style = { ...node.style, ...style };
    return true;
  }

  updateLinkStyle(linkId: string | number, style: Partial<{ color: string; width: number; lineStyle: string }>): boolean {
    const link = this.getLinkById(linkId);
    if (!link) {
      return false;
    }

    link.style = { ...link.style, ...style };
    return true;
  }

  getStats(): { nodeCount: number; linkCount: number } {
    return {
      nodeCount: this.data.nodes.length,
      linkCount: this.data.links.length
    };
  }
}

describe('WordMapCore (D3WordMapEditor)', () => {
  let editor: MockD3WordMapEditor;

  beforeEach(() => {
    editor = new MockD3WordMapEditor('test-container');
  });

  describe('initialization', () => {
    it('should initialize with empty data', () => {
      expect(editor.data.nodes).toEqual([]);
      expect(editor.data.links).toEqual([]);
      expect(editor.data.categories).toEqual([]);
      expect(editor.data.nextNodeId).toBe(1);
      expect(editor.data.nextLinkId).toBe(1);
    });

    it('should initialize with default state', () => {
      expect(editor.state.selectedElements).toEqual([]);
      expect(editor.state.multiSelectedElements).toEqual([]);
      expect(editor.state.mode).toBe('unified');
      expect(editor.state.zoom).toBe(1);
      expect(editor.state.theme).toBe('light');
    });
  });

  describe('node management', () => {
    it('should add a new node', () => {
      const node = editor.addNode(100, 200, 'Test Node');
      
      expect(node.id).toBe(1);
      expect(node.label).toBe('Test Node');
      expect(node.x).toBe(100);
      expect(node.y).toBe(200);
      expect(node.style.color).toBe('#e74c3c');
      expect(editor.data.nodes.length).toBe(1);
    });

    it('should increment node IDs', () => {
      const node1 = editor.addNode(0, 0);
      const node2 = editor.addNode(0, 0);
      
      expect(node1.id).toBe(1);
      expect(node2.id).toBe(2);
      expect(editor.data.nextNodeId).toBe(3);
    });

    it('should remove a node and its connected links', () => {
      const node1 = editor.addNode(0, 0, 'Node 1');
      const node2 = editor.addNode(100, 0, 'Node 2');
      const link = editor.addLink(node1.id, node2.id);
      
      expect(editor.data.nodes.length).toBe(2);
      expect(editor.data.links.length).toBe(1);
      
      const removed = editor.removeNode(node1.id);
      
      expect(removed).toBe(true);
      expect(editor.data.nodes.length).toBe(1);
      expect(editor.data.links.length).toBe(0);
    });

    it('should return false when removing non-existent node', () => {
      const removed = editor.removeNode(999);
      expect(removed).toBe(false);
    });

    it('should get node by ID', () => {
      const node = editor.addNode(0, 0, 'Test Node');
      const foundNode = editor.getNodeById(node.id);
      
      expect(foundNode).toBe(node);
      expect(foundNode?.label).toBe('Test Node');
    });

    it('should update node style', () => {
      const node = editor.addNode(0, 0, 'Test Node');
      const updated = editor.updateNodeStyle(node.id, { color: '#ff0000', radius: 50 });
      
      expect(updated).toBe(true);
      expect(node.style.color).toBe('#ff0000');
      expect(node.style.radius).toBe(50);
    });
  });

  describe('link management', () => {
    it('should add a link between two nodes', () => {
      const node1 = editor.addNode(0, 0, 'Node 1');
      const node2 = editor.addNode(100, 0, 'Node 2');
      const link = editor.addLink(node1.id, node2.id);
      
      expect(link).not.toBeNull();
      expect(link!.id).toBe(1);
      expect(link!.source).toBe(node1.id);
      expect(link!.target).toBe(node2.id);
      expect(editor.data.links.length).toBe(1);
    });

    it('should return null when adding link with invalid nodes', () => {
      const link = editor.addLink(999, 1000);
      
      expect(link).toBeNull();
      expect(editor.data.links.length).toBe(0);
    });

    it('should remove a link', () => {
      const node1 = editor.addNode(0, 0, 'Node 1');
      const node2 = editor.addNode(100, 0, 'Node 2');
      const link = editor.addLink(node1.id, node2.id)!;
      
      const removed = editor.removeLink(link.id);
      
      expect(removed).toBe(true);
      expect(editor.data.links.length).toBe(0);
    });

    it('should get link by ID', () => {
      const node1 = editor.addNode(0, 0, 'Node 1');
      const node2 = editor.addNode(100, 0, 'Node 2');
      const link = editor.addLink(node1.id, node2.id)!;
      const foundLink = editor.getLinkById(link.id);
      
      expect(foundLink).toBe(link);
    });

    it('should update link style', () => {
      const node1 = editor.addNode(0, 0, 'Node 1');
      const node2 = editor.addNode(100, 0, 'Node 2');
      const link = editor.addLink(node1.id, node2.id)!;
      
      const updated = editor.updateLinkStyle(link.id, { color: '#ff0000', width: 5 });
      
      expect(updated).toBe(true);
      expect(link.style.color).toBe('#ff0000');
      expect(link.style.width).toBe(5);
    });
  });

  describe('selection management', () => {
    it('should select an element', () => {
      const node = editor.addNode(0, 0, 'Test Node');
      editor.selectElement(node);
      
      expect(editor.state.selectedElements).toEqual([node]);
    });

    it('should multi-select elements', () => {
      const node1 = editor.addNode(0, 0, 'Node 1');
      const node2 = editor.addNode(100, 0, 'Node 2');
      
      editor.multiSelectElement(node1);
      editor.multiSelectElement(node2);
      
      expect(editor.state.multiSelectedElements).toEqual([node1, node2]);
    });

    it('should not duplicate multi-selected elements', () => {
      const node = editor.addNode(0, 0, 'Test Node');
      
      editor.multiSelectElement(node);
      editor.multiSelectElement(node);
      
      expect(editor.state.multiSelectedElements).toEqual([node]);
    });

    it('should deselect all elements', () => {
      const node = editor.addNode(0, 0, 'Test Node');
      editor.selectElement(node);
      editor.multiSelectElement(node);
      
      editor.deselectAll();
      
      expect(editor.state.selectedElements).toEqual([]);
      expect(editor.state.multiSelectedElements).toEqual([]);
    });
  });

  describe('data management', () => {
    it('should clear all data', () => {
      const node1 = editor.addNode(0, 0, 'Node 1');
      const node2 = editor.addNode(100, 0, 'Node 2');
      const link = editor.addLink(node1.id, node2.id);
      editor.selectElement(node1);
      
      editor.clearAllData();
      
      expect(editor.data.nodes).toEqual([]);
      expect(editor.data.links).toEqual([]);
      expect(editor.data.nextNodeId).toBe(1);
      expect(editor.data.nextLinkId).toBe(1);
      expect(editor.state.selectedElements).toEqual([]);
      expect(editor.state.multiSelectedElements).toEqual([]);
    });

    it('should get statistics', () => {
      editor.addNode(0, 0, 'Node 1');
      editor.addNode(100, 0, 'Node 2');
      editor.addNode(200, 0, 'Node 3');
      editor.addLink(1, 2);
      
      const stats = editor.getStats();
      
      expect(stats.nodeCount).toBe(3);
      expect(stats.linkCount).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle missing nodes gracefully', () => {
      const node = editor.getNodeById(999);
      expect(node).toBeUndefined();
    });

    it('should handle missing links gracefully', () => {
      const link = editor.getLinkById(999);
      expect(link).toBeUndefined();
    });

    it('should handle style updates for non-existent elements', () => {
      const nodeUpdated = editor.updateNodeStyle(999, { color: '#ff0000' });
      const linkUpdated = editor.updateLinkStyle(999, { color: '#ff0000' });
      
      expect(nodeUpdated).toBe(false);
      expect(linkUpdated).toBe(false);
    });

    it('should handle empty data operations', () => {
      const stats = editor.getStats();
      expect(stats.nodeCount).toBe(0);
      expect(stats.linkCount).toBe(0);
      
      const removed = editor.removeNode(1);
      expect(removed).toBe(false);
    });
  });
});