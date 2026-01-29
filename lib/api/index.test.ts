/**
 * ApiClient Unit Tests for importTestDefinition
 */

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { ApiClient } from './index.js';

// Mock axios
const mockAxiosInstance = {
  get: mock(() => Promise.resolve({ data: {} })),
  post: mock(() => Promise.resolve({ data: {} })),
  delete: mock(() => Promise.resolve({ data: {} })),
  defaults: {
    baseURL: 'https://api.desplega.ai',
    headers: {} as Record<string, string>,
  },
};

mock.module('axios', () => ({
  default: {
    create: () => mockAxiosInstance,
    isAxiosError: (err: unknown) =>
      typeof err === 'object' && err !== null && 'response' in err && 'isAxiosError' in err,
  },
}));

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    // Reset mocks
    mockAxiosInstance.get.mockReset();
    mockAxiosInstance.post.mockReset();
    mockAxiosInstance.delete.mockReset();

    // Clear environment variables
    delete process.env.QA_USE_API_KEY;
    delete process.env.QA_USE_API_URL;

    client = new ApiClient();
    client.setApiKey('test-key');
  });

  describe('importTestDefinition', () => {
    const testDef = {
      name: 'Test Definition',
      steps: [{ goto: 'https://example.com' }],
    };

    it('should pass force option when provided', async () => {
      const mockResult = {
        success: true,
        imported: [{ name: 'Test', id: '123', action: 'created', version_hash: 'abc123' }],
        errors: [],
      };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      await client.importTestDefinition([testDef], { upsert: true, force: true });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/vibe-qa/cli/import', {
        test_definitions: [testDef],
        upsert: true,
        dry_run: false,
        force: true,
      });
    });

    it('should default force to false', async () => {
      const mockResult = {
        success: true,
        imported: [{ name: 'Test', id: '123', action: 'created' }],
        errors: [],
      };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      await client.importTestDefinition([testDef], { upsert: true });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/vibe-qa/cli/import', {
        test_definitions: [testDef],
        upsert: true,
        dry_run: false,
        force: false,
      });
    });

    it('should handle conflict action in response', async () => {
      const mockResult = {
        success: true,
        imported: [
          {
            name: 'Test',
            id: '123',
            action: 'conflict',
            message: 'Remote modified since last sync',
            prev_version_hash: 'old123',
            version_hash: 'new456',
          },
        ],
        errors: [],
      };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const result = await client.importTestDefinition([testDef], { upsert: true });

      expect(result.success).toBe(true);
      expect(result.imported[0].action).toBe('conflict');
      expect(result.imported[0].message).toBe('Remote modified since last sync');
      expect(result.imported[0].prev_version_hash).toBe('old123');
      expect(result.imported[0].version_hash).toBe('new456');
    });

    it('should handle unchanged action in response', async () => {
      const mockResult = {
        success: true,
        imported: [
          {
            name: 'Test',
            id: '123',
            action: 'unchanged',
            version_hash: 'same123',
          },
        ],
        errors: [],
      };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const result = await client.importTestDefinition([testDef], { upsert: true });

      expect(result.success).toBe(true);
      expect(result.imported[0].action).toBe('unchanged');
    });

    it('should pass dry_run option', async () => {
      const mockResult = {
        success: true,
        imported: [{ name: 'Test', id: '123', action: 'created' }],
        errors: [],
      };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      await client.importTestDefinition([testDef], { dry_run: true });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/vibe-qa/cli/import', {
        test_definitions: [testDef],
        upsert: true,
        dry_run: true,
        force: false,
      });
    });

    it('should use default options when none provided', async () => {
      const mockResult = {
        success: true,
        imported: [],
        errors: [],
      };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      await client.importTestDefinition([testDef]);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/vibe-qa/cli/import', {
        test_definitions: [testDef],
        upsert: true,
        dry_run: false,
        force: false,
      });
    });
  });
});
