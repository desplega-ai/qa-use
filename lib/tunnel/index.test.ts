import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TunnelManager } from './index';

// Mock the localtunnel module
const mockTunnel = {
  url: 'https://test-subdomain.lt.desplega.ai',
  on: mock(() => {}),
  close: mock(() => {}),
};

const mockLocaltunnel = mock(() => Promise.resolve(mockTunnel));

mock.module('@desplega.ai/localtunnel', () => ({
  default: mockLocaltunnel,
}));

describe('TunnelManager', () => {
  let tunnelManager: TunnelManager;

  beforeEach(() => {
    tunnelManager = new TunnelManager();
    mockLocaltunnel.mockClear();
    mockTunnel.on.mockClear();
    mockTunnel.close.mockClear();
  });

  describe('generateDeterministicSubdomain (static)', () => {
    it('should generate consistent subdomain for same API key and index', () => {
      const apiKey = 'test-api-key-123';
      const subdomain1 = TunnelManager.generateDeterministicSubdomain(apiKey, 0);
      const subdomain2 = TunnelManager.generateDeterministicSubdomain(apiKey, 0);

      expect(subdomain1).toBe(subdomain2);
    });

    it('should generate subdomain with correct format', () => {
      const apiKey = 'test-api-key-123';
      const subdomain = TunnelManager.generateDeterministicSubdomain(apiKey, 0);

      expect(subdomain).toMatch(/^qa-use-[a-f0-9]{6}-\d$/);
    });

    it('should generate different subdomains for different indices', () => {
      const apiKey = 'test-api-key-123';
      const subdomain0 = TunnelManager.generateDeterministicSubdomain(apiKey, 0);
      const subdomain1 = TunnelManager.generateDeterministicSubdomain(apiKey, 1);
      const subdomain9 = TunnelManager.generateDeterministicSubdomain(apiKey, 9);

      expect(subdomain0).not.toBe(subdomain1);
      expect(subdomain0).not.toBe(subdomain9);
      expect(subdomain1).not.toBe(subdomain9);
    });

    it('should generate different subdomains for different API keys', () => {
      const subdomain1 = TunnelManager.generateDeterministicSubdomain('api-key-1', 0);
      const subdomain2 = TunnelManager.generateDeterministicSubdomain('api-key-2', 0);

      expect(subdomain1).not.toBe(subdomain2);
    });

    it('should clamp session index to valid range (0-9)', () => {
      const apiKey = 'test-api-key';

      // Test negative index
      const subdomainNegative = TunnelManager.generateDeterministicSubdomain(apiKey, -5);
      expect(subdomainNegative).toMatch(/^qa-use-[a-f0-9]{6}-0$/);

      // Test index > 9
      const subdomainLarge = TunnelManager.generateDeterministicSubdomain(apiKey, 15);
      expect(subdomainLarge).toMatch(/^qa-use-[a-f0-9]{6}-9$/);

      // Test valid indices
      const subdomain0 = TunnelManager.generateDeterministicSubdomain(apiKey, 0);
      const subdomain5 = TunnelManager.generateDeterministicSubdomain(apiKey, 5);
      const subdomain9 = TunnelManager.generateDeterministicSubdomain(apiKey, 9);

      expect(subdomain0).toMatch(/^qa-use-[a-f0-9]{6}-0$/);
      expect(subdomain5).toMatch(/^qa-use-[a-f0-9]{6}-5$/);
      expect(subdomain9).toMatch(/^qa-use-[a-f0-9]{6}-9$/);
    });

    it('should use first 6 characters of SHA-256 hash', () => {
      // We can verify the subdomain contains exactly 6 hex characters for the hash part
      const apiKey = 'test-api-key';
      const subdomain = TunnelManager.generateDeterministicSubdomain(apiKey, 0);

      const parts = subdomain.split('-');
      expect(parts).toHaveLength(4); // qa, use, <hash>, <index>
      expect(parts[2]).toHaveLength(6);
      expect(parts[2]).toMatch(/^[a-f0-9]{6}$/);
    });
  });

  describe('startTunnel', () => {
    it('should create a tunnel', async () => {
      const session = await tunnelManager.startTunnel(3000);

      expect(mockLocaltunnel).toHaveBeenCalledTimes(1);
      const callArgs = mockLocaltunnel.mock.calls[0][0];

      expect(callArgs.port).toBe(3000);
      expect(callArgs.host).toBe('https://lt.desplega.ai');
      expect(callArgs.local_host).toBe('localhost');
      expect(session.publicUrl).toBe(mockTunnel.url);
      expect(session.localPort).toBe(3000);
      expect(session.isActive).toBe(true);
    });

    it('should use custom subdomain when provided', async () => {
      await tunnelManager.startTunnel(3000, { subdomain: 'my-custom-subdomain' });

      const callArgs = mockLocaltunnel.mock.calls[0][0];
      expect(callArgs.subdomain).toBe('my-custom-subdomain');
    });

    it('should generate subdomain when not provided', async () => {
      await tunnelManager.startTunnel(3000);

      const callArgs = mockLocaltunnel.mock.calls[0][0];
      expect(callArgs.subdomain).toMatch(/^qa-use-\d{6}$/);
    });

    it('should generate deterministic subdomain when API key provided', async () => {
      const apiKey = 'test-api-key-123';
      await tunnelManager.startTunnel(3000, { apiKey, sessionIndex: 0 });

      const callArgs = mockLocaltunnel.mock.calls[0][0];
      expect(callArgs.subdomain).toMatch(/^qa-use-[a-f0-9]{6}-\d$/);
    });

    it('should generate same subdomain for same API key and index', async () => {
      const apiKey = 'test-api-key-123';

      await tunnelManager.startTunnel(3000, { apiKey, sessionIndex: 0 });
      const firstCall = mockLocaltunnel.mock.calls[0][0];

      // Stop tunnel to allow creating a new one
      await tunnelManager.stopTunnel();
      mockLocaltunnel.mockClear();

      await tunnelManager.startTunnel(3000, { apiKey, sessionIndex: 0 });
      const secondCall = mockLocaltunnel.mock.calls[0][0];

      expect(firstCall.subdomain).toBe(secondCall.subdomain);
    });

    it('should generate different subdomains for different session indices', async () => {
      const apiKey = 'test-api-key-123';

      await tunnelManager.startTunnel(3000, { apiKey, sessionIndex: 0 });
      const firstCall = mockLocaltunnel.mock.calls[0][0];

      await tunnelManager.stopTunnel();
      mockLocaltunnel.mockClear();

      await tunnelManager.startTunnel(3000, { apiKey, sessionIndex: 1 });
      const secondCall = mockLocaltunnel.mock.calls[0][0];

      expect(firstCall.subdomain).not.toBe(secondCall.subdomain);
    });

    it('should generate different subdomains for different API keys', async () => {
      await tunnelManager.startTunnel(3000, { apiKey: 'api-key-1', sessionIndex: 0 });
      const firstCall = mockLocaltunnel.mock.calls[0][0];

      await tunnelManager.stopTunnel();
      mockLocaltunnel.mockClear();

      await tunnelManager.startTunnel(3000, { apiKey: 'api-key-2', sessionIndex: 0 });
      const secondCall = mockLocaltunnel.mock.calls[0][0];

      expect(firstCall.subdomain).not.toBe(secondCall.subdomain);
    });

    it('should prefer custom subdomain over deterministic generation', async () => {
      await tunnelManager.startTunnel(3000, {
        subdomain: 'custom-domain',
        apiKey: 'test-key',
        sessionIndex: 0,
      });

      const callArgs = mockLocaltunnel.mock.calls[0][0];
      expect(callArgs.subdomain).toBe('custom-domain');
    });

    it('should use custom local host when provided', async () => {
      await tunnelManager.startTunnel(3000, { localHost: '127.0.0.1' });

      const callArgs = mockLocaltunnel.mock.calls[0][0];
      expect(callArgs.local_host).toBe('127.0.0.1');
    });

    it('should use TUNNEL_HOST environment variable when set', async () => {
      const originalHost = process.env.TUNNEL_HOST;
      process.env.TUNNEL_HOST = 'https://custom-tunnel.example.com';

      await tunnelManager.startTunnel(3000);

      const callArgs = mockLocaltunnel.mock.calls[0][0];
      expect(callArgs.host).toBe('https://custom-tunnel.example.com');

      // Restore original value
      if (originalHost !== undefined) {
        process.env.TUNNEL_HOST = originalHost;
      } else {
        delete process.env.TUNNEL_HOST;
      }
    });

    it('should throw error if tunnel session already active', async () => {
      await tunnelManager.startTunnel(3000);

      await expect(tunnelManager.startTunnel(3001)).rejects.toThrow(
        'Tunnel session already active'
      );
    });

    it('should register event handlers for tunnel', async () => {
      await tunnelManager.startTunnel(3000);

      expect(mockTunnel.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockTunnel.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should mark session as inactive on close event', async () => {
      await tunnelManager.startTunnel(3000);

      // Get the close handler
      const closeHandler = mockTunnel.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];

      expect(closeHandler).toBeDefined();

      // Simulate close event
      if (closeHandler) {
        closeHandler();
      }

      expect(tunnelManager.getSession()?.isActive).toBe(false);
    });
  });

  describe('stopTunnel', () => {
    it('should close the tunnel and clear session', async () => {
      await tunnelManager.startTunnel(3000);
      await tunnelManager.stopTunnel();

      expect(mockTunnel.close).toHaveBeenCalledTimes(1);
      expect(tunnelManager.getSession()).toBeNull();
    });

    it('should do nothing if no active session', async () => {
      await tunnelManager.stopTunnel();

      expect(mockTunnel.close).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully during cleanup', async () => {
      await tunnelManager.startTunnel(3000);
      mockTunnel.close.mockImplementation(() => {
        throw new Error('Close failed');
      });

      // Should not throw
      await expect(tunnelManager.stopTunnel()).resolves.toBeUndefined();
    });
  });

  describe('getSession', () => {
    it('should return null when no session active', () => {
      expect(tunnelManager.getSession()).toBeNull();
    });

    it('should return session when active', async () => {
      await tunnelManager.startTunnel(3000);
      const session = tunnelManager.getSession();

      expect(session).not.toBeNull();
      expect(session?.publicUrl).toBe(mockTunnel.url);
    });
  });

  describe('isActive', () => {
    it('should return false when no session', () => {
      expect(tunnelManager.isActive()).toBe(false);
    });

    it('should return true when session is active', async () => {
      await tunnelManager.startTunnel(3000);
      expect(tunnelManager.isActive()).toBe(true);
    });

    it('should return false when session is inactive', async () => {
      await tunnelManager.startTunnel(3000);

      // Simulate close event
      const closeHandler = mockTunnel.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];

      if (closeHandler) {
        closeHandler();
      }

      expect(tunnelManager.isActive()).toBe(false);
    });
  });

  describe('getPublicUrl', () => {
    it('should return null when no session', () => {
      expect(tunnelManager.getPublicUrl()).toBeNull();
    });

    it('should return public URL when session active', async () => {
      await tunnelManager.startTunnel(3000);
      expect(tunnelManager.getPublicUrl()).toBe('https://test-subdomain.lt.desplega.ai');
    });
  });

  describe('getWebSocketUrl', () => {
    it('should return null when no session', () => {
      expect(tunnelManager.getWebSocketUrl('ws://localhost:9222/ws')).toBeNull();
    });

    it('should convert https URL to wss and append WebSocket path', async () => {
      await tunnelManager.startTunnel(3000);

      const wsUrl = tunnelManager.getWebSocketUrl('ws://localhost:9222/ws/browser/abc123');
      expect(wsUrl).toBe('wss://test-subdomain.lt.desplega.ai/ws/browser/abc123');
    });

    it('should handle http to ws conversion', async () => {
      mockTunnel.url = 'http://test.lt.desplega.ai';
      await tunnelManager.startTunnel(3000);

      const wsUrl = tunnelManager.getWebSocketUrl('ws://localhost:9222/ws');
      expect(wsUrl).toBe('ws://test.lt.desplega.ai/ws');
    });

    it('should return null for invalid WebSocket URL', async () => {
      await tunnelManager.startTunnel(3000);

      const wsUrl = tunnelManager.getWebSocketUrl('invalid-url');
      expect(wsUrl).toBeNull();
    });
  });
});
