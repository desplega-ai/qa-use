import { describe, expect, it } from 'bun:test';
import { normalizeRef } from './browser-utils.js';

describe('normalizeRef', () => {
  describe('quote stripping', () => {
    it('should strip double quotes', () => {
      expect(normalizeRef('"e31"')).toBe('e31');
    });

    it('should strip single quotes', () => {
      expect(normalizeRef("'e31'")).toBe('e31');
    });

    it('should strip double quotes from custom selectors', () => {
      expect(normalizeRef('"__custom__data-testid=rf__node-1"')).toBe(
        '__custom__data-testid=rf__node-1'
      );
    });

    it('should strip single quotes from custom selectors', () => {
      expect(normalizeRef("'__custom__data-testid=rf__node-2'")).toBe(
        '__custom__data-testid=rf__node-2'
      );
    });
  });

  describe('@ symbol stripping', () => {
    it('should strip leading @ symbol', () => {
      expect(normalizeRef('@e31')).toBe('e31');
    });

    it('should strip @ from custom selectors', () => {
      expect(normalizeRef('@__custom__data-testid=rf__node-1')).toBe(
        '__custom__data-testid=rf__node-1'
      );
    });
  });

  describe('combined quote and @ stripping', () => {
    it('should strip quotes then @ symbol', () => {
      expect(normalizeRef('"@e31"')).toBe('e31');
      expect(normalizeRef("'@e31'")).toBe('e31');
    });

    it('should strip quotes then @ from custom selectors', () => {
      expect(normalizeRef('"@__custom__data-testid=rf__node-1"')).toBe(
        '__custom__data-testid=rf__node-1'
      );
      expect(normalizeRef("'@__custom__data-testid=rf__node-2'")).toBe(
        '__custom__data-testid=rf__node-2'
      );
    });
  });

  describe('already normalized refs', () => {
    it('should handle already normalized standard refs', () => {
      expect(normalizeRef('e31')).toBe('e31');
      expect(normalizeRef('e1')).toBe('e1');
      expect(normalizeRef('e123')).toBe('e123');
      expect(normalizeRef('e999')).toBe('e999');
    });

    it('should handle already normalized custom selectors', () => {
      expect(normalizeRef('__custom__data-testid=rf__node-1')).toBe(
        '__custom__data-testid=rf__node-1'
      );
    });
  });

  describe('edge cases', () => {
    it('should not strip mismatched quotes', () => {
      expect(normalizeRef('"e31\'')).toBe('"e31\'');
      expect(normalizeRef('\'e31"')).toBe('\'e31"');
    });

    it('should handle empty strings', () => {
      expect(normalizeRef('')).toBe('');
    });

    it('should handle just quotes', () => {
      expect(normalizeRef('""')).toBe('');
      expect(normalizeRef("''")).toBe('');
    });

    it('should handle just @ symbol', () => {
      expect(normalizeRef('@')).toBe('');
    });

    it('should handle quoted @ symbol', () => {
      expect(normalizeRef('"@"')).toBe('');
      expect(normalizeRef("'@'")).toBe('');
    });

    it('should only strip leading @, not multiple', () => {
      expect(normalizeRef('@@e31')).toBe('@e31');
      expect(normalizeRef('@@@e31')).toBe('@@e31');
    });

    it('should only strip leading @ if present', () => {
      expect(normalizeRef('e31@')).toBe('e31@');
      expect(normalizeRef('e@31')).toBe('e@31');
    });
  });

  describe('real-world usage', () => {
    it('should handle refs from user copy-paste with quotes', () => {
      expect(normalizeRef('"e31"')).toBe('e31');
      expect(normalizeRef("'e31'")).toBe('e31');
    });

    it('should handle refs from snapshot output with @ prefix', () => {
      expect(normalizeRef('@e31')).toBe('e31');
    });

    it('should handle combined quote and @ from user input', () => {
      expect(normalizeRef('"@e31"')).toBe('e31');
    });

    it('should handle custom selector refs from snapshot', () => {
      expect(normalizeRef('__custom__data-testid=rf__node-1')).toBe(
        '__custom__data-testid=rf__node-1'
      );
    });

    it('should handle custom selector refs with quotes from CLI', () => {
      expect(normalizeRef('"__custom__data-testid=rf__node-1"')).toBe(
        '__custom__data-testid=rf__node-1'
      );
    });
  });
});
