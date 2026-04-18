/**
 * WordMapUtils モックファイル
 * 2025-07-07 作成: WordMapUtilsの実装とテスト用モック
 * 
 * @fileoverview テスト用のWordMapUtilsモック実装
 */

import { ErrorInfo, EventInfo, SizeOption } from '../../types/wordmap';

// WordMapUtils実装
export const WordMapUtilsMock = {
  ErrorHandler: {
    logError(source: string, type: string, error: Error, context?: any, debugModule?: any): ErrorInfo {
      const errorInfo: ErrorInfo = {
        source,
        type,
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
      };
      
      if (debugModule && debugModule.logError) {
        debugModule.logError(errorInfo);
      }
      
      return errorInfo;
    },

    logEvent(source: string, level: string, message: string, data?: any, debugModule?: any): EventInfo {
      const eventInfo: EventInfo = {
        source,
        level: level as 'debug' | 'info' | 'warn' | 'error',
        message,
        data,
        timestamp: new Date().toISOString()
      };
      
      if (debugModule && debugModule.logEvent) {
        debugModule.logEvent(eventInfo);
      }
      
      return eventInfo;
    },

    wrapAsyncFunction(fn: Function, source: string, debugModule?: any): Function {
      return async function(...args: any[]) {
        try {
          const result = await fn.apply(this, args);
          return result;
        } catch (error) {
          const errorInfo = WordMapUtilsMock.ErrorHandler.logError(
            source, 
            'async', 
            error as Error, 
            { args }, 
            debugModule
          );
          throw error;
        }
      };
    }
  },

  DOMHelper: {
    getElementById(id: string, required: boolean = false): HTMLElement | null {
      const element = document.getElementById(id);
      if (required && !element) {
        throw new Error(`Required element with id '${id}' not found`);
      }
      return element;
    },

    querySelector(selector: string, required: boolean = false): Element | null {
      const element = document.querySelector(selector);
      if (required && !element) {
        throw new Error(`Required element with selector '${selector}' not found`);
      }
      return element;
    },

    querySelectorAll(selector: string): NodeListOf<Element> {
      return document.querySelectorAll(selector);
    },

    addEventListenerSafe(element: Element | null, event: string, handler: Function, options?: any): boolean {
      if (!element || typeof handler !== 'function') {
        return false;
      }
      try {
        element.addEventListener(event, handler as EventListener, options);
        return true;
      } catch (error) {
        console.warn(`Failed to add event listener: ${error}`);
        return false;
      }
    },

    removeEventListenerSafe(element: Element | null, event: string, handler: Function, options?: any): boolean {
      if (!element || typeof handler !== 'function') {
        return false;
      }
      try {
        element.removeEventListener(event, handler as EventListener, options);
        return true;
      } catch (error) {
        console.warn(`Failed to remove event listener: ${error}`);
        return false;
      }
    },

    createElementWithClass(tag: string, className?: string, textContent?: string): HTMLElement {
      const element = document.createElement(tag);
      if (className) {
        element.className = className;
      }
      if (textContent) {
        element.textContent = textContent;
      }
      return element;
    },

    toggleClass(element: Element | null, className: string, force?: boolean): boolean {
      if (!element) {
        return false;
      }
      try {
        return element.classList.toggle(className, force);
      } catch (error) {
        console.warn(`Failed to toggle class: ${error}`);
        return false;
      }
    },

    setAttributes(element: Element | null, attributes: Record<string, string>): boolean {
      if (!element) {
        return false;
      }
      try {
        Object.entries(attributes).forEach(([key, value]) => {
          element.setAttribute(key, value);
        });
        return true;
      } catch (error) {
        console.warn(`Failed to set attributes: ${error}`);
        return false;
      }
    }
  },

  PaletteBuilder: {
    createColorPalette(colors: string[], selectedColor?: string, onColorSelect?: Function): HTMLElement {
      const palette = document.createElement('div');
      palette.className = 'color-palette';
      
      colors.forEach(color => {
        const colorBtn = document.createElement('button');
        colorBtn.className = 'color-btn';
        if (selectedColor === color) {
          colorBtn.classList.add('active');
        }
        colorBtn.style.backgroundColor = color;
        (colorBtn as any).dataset.color = color;
        
        if (onColorSelect) {
          colorBtn.addEventListener('click', () => onColorSelect(color));
        }
        
        palette.appendChild(colorBtn);
      });
      
      return palette;
    },

    createSizeSelector(sizes: SizeOption[], selectedSize?: number, onSizeSelect?: Function): HTMLElement {
      const selector = document.createElement('div');
      selector.className = 'size-selector';
      
      sizes.forEach(size => {
        const sizeBtn = document.createElement('button');
        sizeBtn.className = 'size-btn';
        if (selectedSize === size.value) {
          sizeBtn.classList.add('active');
        }
        sizeBtn.textContent = size.label;
        sizeBtn.title = size.title;
        (sizeBtn as any).dataset.size = size.value.toString();
        
        if (onSizeSelect) {
          sizeBtn.addEventListener('click', () => onSizeSelect(size.value));
        }
        
        selector.appendChild(sizeBtn);
      });
      
      return selector;
    }
  },

  ValidationHelper: {
    isValidNode(node: any): boolean {
      if (!node || typeof node !== 'object') {
        return false;
      }
      
      const requiredFields = ['id', 'label', 'x', 'y', 'style'];
      const hasRequiredFields = requiredFields.every(field => field in node);
      
      if (!hasRequiredFields) {
        return false;
      }
      
      if (!node.style || typeof node.style !== 'object') {
        return false;
      }
      
      const requiredStyleFields = ['color', 'radius'];
      const hasRequiredStyleFields = requiredStyleFields.every(field => field in node.style);
      
      return hasRequiredStyleFields;
    },

    isValidLink(link: any): boolean {
      if (!link || typeof link !== 'object') {
        return false;
      }
      
      const requiredFields = ['id', 'source', 'target', 'style'];
      const hasRequiredFields = requiredFields.every(field => field in link);
      
      if (!hasRequiredFields) {
        return false;
      }
      
      if (!link.style || typeof link.style !== 'object') {
        return false;
      }
      
      const requiredStyleFields = ['color', 'width'];
      const hasRequiredStyleFields = requiredStyleFields.every(field => field in link.style);
      
      return hasRequiredStyleFields;
    },

    validateDataStructure(data: any): { valid: boolean; errors: string[]; stats: { nodeCount: number; linkCount: number; } } {
      const errors: string[] = [];
      let nodeCount = 0;
      let linkCount = 0;
      
      if (!data || typeof data !== 'object') {
        errors.push('Data must be an object');
        return { valid: false, errors, stats: { nodeCount, linkCount } };
      }
      
      if (!Array.isArray(data.nodes)) {
        errors.push('Data must have a nodes array');
      } else {
        nodeCount = data.nodes.length;
        data.nodes.forEach((node: any, index: number) => {
          if (!WordMapUtilsMock.ValidationHelper.isValidNode(node)) {
            errors.push(`Invalid node at index ${index}`);
          }
        });
      }
      
      if (!Array.isArray(data.links)) {
        errors.push('Data must have a links array');
      } else {
        linkCount = data.links.length;
        data.links.forEach((link: any, index: number) => {
          if (!WordMapUtilsMock.ValidationHelper.isValidLink(link)) {
            errors.push(`Invalid link at index ${index}`);
          }
        });
      }
      
      return {
        valid: errors.length === 0,
        errors,
        stats: { nodeCount, linkCount }
      };
    },

    sanitizeFileName(filename: string): string {
      // Remove invalid characters for file names
      return filename.replace(/[<>:"/\\|?*]/g, '').trim();
    },

    normalizeColor(color: string): string {
      // Convert hex colors to lowercase
      if (color.startsWith('#')) {
        return color.toLowerCase();
      }
      return color;
    }
  },

  PerformanceHelper: {
    measureFunction(fn: Function, name?: string): Function {
      return function(...args: any[]) {
        const start = performance.now();
        const result = fn.apply(this, args);
        const end = performance.now();
        
        if (name) {
          console.log(`${name} execution time: ${end - start}ms`);
        }
        
        return result;
      };
    },

    measureAsyncFunction(fn: Function, name?: string): Function {
      return async function(...args: any[]) {
        const start = performance.now();
        const result = await fn.apply(this, args);
        const end = performance.now();
        
        if (name) {
          console.log(`${name} execution time: ${end - start}ms`);
        }
        
        return result;
      };
    },

    debounce(func: Function, wait: number): Function {
      let timeout: NodeJS.Timeout | null = null;
      
      return function(...args: any[]) {
        const later = () => {
          timeout = null;
          func.apply(this, args);
        };
        
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
      };
    },

    throttle(func: Function, limit: number): Function {
      let inThrottle: boolean = false;
      
      return function(...args: any[]) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }
  }
};