/**
 * BrowserApiClient Unit Tests
 */

import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import axios from 'axios';
import { BrowserApiClient } from './browser.js';

// Mock axios
const mockAxiosInstance = {
  get: mock(() => Promise.resolve({ data: {} })),
  post: mock(() => Promise.resolve({ data: {} })),
  delete: mock(() => Promise.resolve({ data: {} })),
  defaults: {
    baseURL: 'https://api.desplega.ai/browsers/v1',
    headers: {},
  },
};

mock.module('axios', () => ({
  default: {
    create: () => mockAxiosInstance,
    isAxiosError: (err: unknown) =>
      typeof err === 'object' && err !== null && 'response' in err && 'isAxiosError' in err,
  },
}));

describe('BrowserApiClient', () => {
  let client: BrowserApiClient;

  beforeEach(() => {
    // Reset mocks
    mockAxiosInstance.get.mockReset();
    mockAxiosInstance.post.mockReset();
    mockAxiosInstance.delete.mockReset();

    // Clear environment variables
    delete process.env.QA_USE_API_KEY;
    delete process.env.QA_USE_API_URL;

    client = new BrowserApiClient();
  });

  describe('constructor', () => {
    it('should use default API URL', () => {
      const c = new BrowserApiClient();
      expect(c.getBaseUrl()).toContain('api.desplega.ai');
    });

    it('should use custom API URL', () => {
      const c = new BrowserApiClient('https://custom.api.com');
      // The URL should be set via axios.create
      expect(mockAxiosInstance.defaults.baseURL).toBeDefined();
    });
  });

  describe('setApiKey', () => {
    it('should set API key', () => {
      client.setApiKey('test-key-123');
      expect(client.getApiKey()).toBe('test-key-123');
    });
  });

  describe('createSession', () => {
    it('should create session with default options', async () => {
      const mockSession = {
        id: 'session-123',
        status: 'starting',
        created_at: '2026-01-23T10:00:00Z',
      };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockSession });

      const session = await client.createSession();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/sessions', {
        headless: true,
        viewport: 'desktop',
        timeout: 300,
      });
      expect(session.id).toBe('session-123');
      expect(session.status).toBe('starting');
    });

    it('should create session with custom options', async () => {
      const mockSession = {
        id: 'session-456',
        status: 'starting',
        created_at: '2026-01-23T10:00:00Z',
      };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockSession });

      const session = await client.createSession({
        headless: false,
        viewport: 'mobile',
        timeout: 600,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/sessions', {
        headless: false,
        viewport: 'mobile',
        timeout: 600,
      });
      expect(session.id).toBe('session-456');
    });
  });

  describe('listSessions', () => {
    it('should list sessions from array response', async () => {
      const mockSessions = [
        { id: 'session-1', status: 'active' },
        { id: 'session-2', status: 'starting' },
      ];
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockSessions });

      const sessions = await client.listSessions();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/sessions');
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('session-1');
    });

    it('should list sessions from object response', async () => {
      const mockResponse = {
        sessions: [
          { id: 'session-1', status: 'active' },
          { id: 'session-2', status: 'starting' },
        ],
      };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResponse });

      const sessions = await client.listSessions();

      expect(sessions).toHaveLength(2);
    });
  });

  describe('getSession', () => {
    it('should get session by ID', async () => {
      const mockSession = {
        id: 'session-123',
        status: 'active',
        url: 'https://example.com',
      };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockSession });

      const session = await client.getSession('session-123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/sessions/session-123');
      expect(session.id).toBe('session-123');
      expect(session.status).toBe('active');
    });
  });

  describe('deleteSession', () => {
    it('should delete session by ID', async () => {
      mockAxiosInstance.delete.mockResolvedValueOnce({ data: {} });

      await client.deleteSession('session-123');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/sessions/session-123');
    });
  });

  describe('executeAction', () => {
    it('should execute goto action', async () => {
      const mockResult = { success: true };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const result = await client.executeAction('session-123', {
        type: 'goto',
        url: 'https://example.com',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/sessions/session-123/action', {
        type: 'goto',
        url: 'https://example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should execute click action', async () => {
      const mockResult = { success: true };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const result = await client.executeAction('session-123', {
        type: 'click',
        ref: 'e3',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/sessions/session-123/action', {
        type: 'click',
        ref: 'e3',
      });
      expect(result.success).toBe(true);
    });

    it('should execute fill action', async () => {
      const mockResult = { success: true };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const result = await client.executeAction('session-123', {
        type: 'fill',
        ref: 'e4',
        value: 'test@example.com',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/sessions/session-123/action', {
        type: 'fill',
        ref: 'e4',
        value: 'test@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should execute scroll action', async () => {
      const mockResult = { success: true };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResult });

      const result = await client.executeAction('session-123', {
        type: 'scroll',
        direction: 'down',
        amount: 500,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/sessions/session-123/action', {
        type: 'scroll',
        direction: 'down',
        amount: 500,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getSnapshot', () => {
    it('should get ARIA snapshot', async () => {
      const mockSnapshot = {
        snapshot: '- heading "Example" [ref=e1]',
        url: 'https://example.com',
      };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockSnapshot });

      const snapshot = await client.getSnapshot('session-123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/sessions/session-123/snapshot');
      expect(snapshot.snapshot).toContain('Example');
      expect(snapshot.url).toBe('https://example.com');
    });
  });

  describe('getScreenshot', () => {
    it('should get screenshot as buffer', async () => {
      const mockData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockData });

      const buffer = await client.getScreenshot('session-123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/sessions/session-123/screenshot', {
        responseType: 'arraybuffer',
      });
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  describe('getUrl', () => {
    it('should get current URL', async () => {
      const mockResult = { url: 'https://example.com/page' };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResult });

      const url = await client.getUrl('session-123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/sessions/session-123/url');
      expect(url).toBe('https://example.com/page');
    });
  });

  describe('getStreamUrl', () => {
    it('should return WebSocket URL', () => {
      const url = client.getStreamUrl('session-123');

      expect(url).toContain('ws');
      expect(url).toContain('session-123');
      expect(url).toContain('/stream');
    });
  });

  describe('waitForStatus', () => {
    it('should return immediately if session is already active', async () => {
      const mockSession = {
        id: 'session-123',
        status: 'active',
        created_at: '2026-01-23T10:00:00Z',
      };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockSession });

      const session = await client.waitForStatus('session-123', 'active', 5000, 100);

      expect(session.status).toBe('active');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });

    it('should poll until session becomes active', async () => {
      const startingSession = {
        id: 'session-123',
        status: 'starting',
        created_at: '2026-01-23T10:00:00Z',
      };
      const activeSession = {
        id: 'session-123',
        status: 'active',
        created_at: '2026-01-23T10:00:00Z',
      };

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: startingSession })
        .mockResolvedValueOnce({ data: startingSession })
        .mockResolvedValueOnce({ data: activeSession });

      const session = await client.waitForStatus('session-123', 'active', 5000, 50);

      expect(session.status).toBe('active');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });

    it('should throw error if session is closed', async () => {
      const closedSession = {
        id: 'session-123',
        status: 'closed',
        created_at: '2026-01-23T10:00:00Z',
      };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: closedSession });

      await expect(client.waitForStatus('session-123', 'active', 5000, 100)).rejects.toThrow(
        'closed'
      );
    });
  });
});
