import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import http from 'node:http';
import { TunnelManager } from './index';

describe('TunnelManager Integration Tests', () => {
  let tunnelManager: TunnelManager;
  let testServer: http.Server;
  let testPort: number;

  beforeEach(async () => {
    tunnelManager = new TunnelManager();

    // Create a simple test HTTP server
    return new Promise<void>((resolve) => {
      testServer = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Hello from test server');
      });

      testServer.listen(0, () => {
        const addr = testServer.address();
        if (addr && typeof addr === 'object') {
          testPort = addr.port;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    await tunnelManager.stopTunnel();

    return new Promise<void>((resolve, reject) => {
      if (testServer) {
        testServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  });

  it('should create a real tunnel with authentication', async () => {
    const session = await tunnelManager.startTunnel(testPort);

    expect(session).toBeDefined();
    expect(session.publicUrl).toMatch(/^https?:\/\/.+\.lt\.desplega\.ai$/);
    expect(session.localPort).toBe(testPort);
    expect(session.isActive).toBe(true);
    expect(tunnelManager.isActive()).toBe(true);
  }, 10000); // 10 second timeout for network operations

  it('should create tunnel with custom subdomain', async () => {
    const subdomain = `qa-use-test-${Date.now().toString().slice(-6)}`;
    const session = await tunnelManager.startTunnel(testPort, { subdomain });

    // Note: subdomain may not be honored depending on availability
    // Just verify tunnel was created successfully
    expect(session.publicUrl).toMatch(/^https?:\/\/.+\.lt\.desplega\.ai$/);
    expect(session.isActive).toBe(true);
  }, 10000);

  it('should generate WebSocket URL from tunnel', async () => {
    await tunnelManager.startTunnel(testPort);

    const wsUrl = tunnelManager.getWebSocketUrl('ws://localhost:9222/ws/browser/abc123');

    expect(wsUrl).toBeDefined();
    expect(wsUrl).toMatch(/^wss?:\/\/.+\.lt\.desplega\.ai\/ws\/browser\/abc123$/);
  }, 10000);

  it('should properly close tunnel', async () => {
    await tunnelManager.startTunnel(testPort);

    expect(tunnelManager.isActive()).toBe(true);

    await tunnelManager.stopTunnel();

    expect(tunnelManager.isActive()).toBe(false);
    expect(tunnelManager.getSession()).toBeNull();
  }, 10000);

  it('should handle multiple start/stop cycles', async () => {
    // First cycle
    await tunnelManager.startTunnel(testPort);
    expect(tunnelManager.isActive()).toBe(true);
    await tunnelManager.stopTunnel();
    expect(tunnelManager.isActive()).toBe(false);

    // Second cycle
    await tunnelManager.startTunnel(testPort);
    expect(tunnelManager.isActive()).toBe(true);
    await tunnelManager.stopTunnel();
    expect(tunnelManager.isActive()).toBe(false);
  }, 20000);
});
