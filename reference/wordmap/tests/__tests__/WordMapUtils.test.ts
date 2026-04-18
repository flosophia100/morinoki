/**
 * WordMapUtils テストファイル
 * 2025-07-07 作成: ユーティリティ関数のテスト
 */

import { ErrorInfo, EventInfo, SizeOption } from '../../types/wordmap';

import { WordMapUtilsMock } from './WordMapUtils.mock';

// グローバル変数として設定
(global as any).WordMapUtils = WordMapUtilsMock;
const WordMapUtils = WordMapUtilsMock;

describe('WordMapUtils.ErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logError', () => {
    it('should create error info with required fields', () => {
      const error = new Error('Test error');
      const result = WordMapUtils.ErrorHandler.logError('test', 'unit', error);

      expect(result).toMatchObject({
        source: 'test',
        type: 'unit',
        message: 'Test error',
        timestamp: expect.any(String),
      });
    });

    it('should include stack trace when available', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      
      const result = WordMapUtils.ErrorHandler.logError('test', 'unit', error);
      
      expect(result.stack).toBeDefined();
    });

    it('should handle context data', () => {
      const error = new Error('Test error');
      const context = { nodeId: '123', action: 'delete' };
      
      const result = WordMapUtils.ErrorHandler.logError('test', 'unit', error, context);
      
      expect(result.context).toEqual(context);
    });
  });

  describe('logEvent', () => {
    it('should create event info with required fields', () => {
      const result = WordMapUtils.ErrorHandler.logEvent('test', 'info', 'Test message');

      expect(result).toMatchObject({
        source: 'test',
        level: 'info',
        message: 'Test message',
        timestamp: expect.any(String),
      });
    });

    it('should include data when provided', () => {
      const data = { count: 5, type: 'node' };
      const result = WordMapUtils.ErrorHandler.logEvent('test', 'info', 'Test message', data);

      expect(result.data).toEqual(data);
    });
  });

  describe('wrapAsyncFunction', () => {
    it('should wrap async function with error handling', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const wrapped = WordMapUtils.ErrorHandler.wrapAsyncFunction(mockFn, 'test');

      const result = await wrapped();
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalled();
    });

    it('should handle async function errors', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Async error'));
      const wrapped = WordMapUtils.ErrorHandler.wrapAsyncFunction(mockFn, 'test');

      await expect(wrapped()).rejects.toThrow('Async error');
    });
  });
});

describe('WordMapUtils.DOMHelper', () => {
  describe('getElementById', () => {
    it('should return element when found', () => {
      const mockElement = document.createElement('div');
      mockElement.id = 'test-id';
      document.getElementById = jest.fn().mockReturnValue(mockElement);

      const result = WordMapUtils.DOMHelper.getElementById('test-id');
      
      expect(result).toBe(mockElement);
    });

    it('should return null when element not found', () => {
      document.getElementById = jest.fn().mockReturnValue(null);

      const result = WordMapUtils.DOMHelper.getElementById('nonexistent');
      
      expect(result).toBeNull();
    });

    it('should throw error when required element not found', () => {
      document.getElementById = jest.fn().mockReturnValue(null);

      expect(() => {
        WordMapUtils.DOMHelper.getElementById('required-id', true);
      }).toThrow();
    });
  });

  describe('createElementWithClass', () => {
    it('should create element with class and text content', () => {
      const element = WordMapUtils.DOMHelper.createElementWithClass('div', 'test-class', 'Hello World');
      
      expect(element.tagName).toBe('DIV');
      expect(element.className).toBe('test-class');
      expect(element.textContent).toBe('Hello World');
    });

    it('should create element without optional parameters', () => {
      const element = WordMapUtils.DOMHelper.createElementWithClass('span');
      
      expect(element.tagName).toBe('SPAN');
      expect(element.className).toBe('');
      expect(element.textContent).toBe('');
    });
  });

  describe('toggleClass', () => {
    it('should toggle class on element', () => {
      const element = document.createElement('div');
      
      const result = WordMapUtils.DOMHelper.toggleClass(element, 'active');
      
      expect(result).toBe(true);
      expect(element.classList.toggle).toHaveBeenCalledWith('active', undefined);
    });

    it('should force class state when specified', () => {
      const element = document.createElement('div');
      
      WordMapUtils.DOMHelper.toggleClass(element, 'active', true);
      
      expect(element.classList.toggle).toHaveBeenCalledWith('active', true);
    });

    it('should handle null element gracefully', () => {
      const result = WordMapUtils.DOMHelper.toggleClass(null, 'active');
      
      expect(result).toBe(false);
    });
  });
});

describe('WordMapUtils.ValidationHelper', () => {
  describe('isValidNode', () => {
    it('should validate correct node structure', () => {
      const validNode = {
        id: '1',
        label: 'Test Node',
        x: 100,
        y: 200,
        style: {
          color: '#ff0000',
          radius: 30
        }
      };

      const result = WordMapUtils.ValidationHelper.isValidNode(validNode);
      
      expect(result).toBe(true);
    });

    it('should reject invalid node structure', () => {
      const invalidNode = {
        id: '1',
        // missing required fields
      };

      const result = WordMapUtils.ValidationHelper.isValidNode(invalidNode);
      
      expect(result).toBe(false);
    });
  });

  describe('sanitizeFileName', () => {
    it('should remove invalid characters from filename', () => {
      const result = WordMapUtils.ValidationHelper.sanitizeFileName('file<>name*.txt');
      
      expect(result).toBe('filename.txt');
    });

    it('should preserve valid characters', () => {
      const result = WordMapUtils.ValidationHelper.sanitizeFileName('valid-file_name.json');
      
      expect(result).toBe('valid-file_name.json');
    });
  });

  describe('normalizeColor', () => {
    it('should normalize hex color to lowercase', () => {
      const result = WordMapUtils.ValidationHelper.normalizeColor('#FF0000');
      
      expect(result).toBe('#ff0000');
    });

    it('should handle rgb color values', () => {
      const result = WordMapUtils.ValidationHelper.normalizeColor('rgb(255, 0, 0)');
      
      expect(result).toBe('rgb(255, 0, 0)');
    });
  });
});

describe('WordMapUtils.PerformanceHelper', () => {
  describe('debounce', () => {
    it('should debounce function calls', (done) => {
      const mockFn = jest.fn();
      const debouncedFn = WordMapUtils.PerformanceHelper.debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      setTimeout(() => {
        expect(mockFn).toHaveBeenCalledTimes(1);
        done();
      }, 150);
    });
  });

  describe('throttle', () => {
    it('should throttle function calls', (done) => {
      const mockFn = jest.fn();
      const throttledFn = WordMapUtils.PerformanceHelper.throttle(mockFn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(1);

      setTimeout(() => {
        throttledFn();
        expect(mockFn).toHaveBeenCalledTimes(2);
        done();
      }, 150);
    });
  });

  describe('measureFunction', () => {
    it('should measure function execution time', () => {
      const mockFn = jest.fn(() => 'result');
      const measuredFn = WordMapUtils.PerformanceHelper.measureFunction(mockFn, 'testFn');

      const result = measuredFn();

      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalled();
    });
  });
});