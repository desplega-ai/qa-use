import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { QAUseMcpServer } from './server.js';

/**
 * E2E Integration Tests for QA-Use MCP Server
 *
 * These tests run against the real Desplega API.
 * Requires QA_USE_API_KEY environment variable to be set.
 */
describe('QAUseMcpServer E2E Integration Tests', () => {
  let mcpServer: QAUseMcpServer;
  let client: Client;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;

  const apiKey = process.env.QA_USE_API_KEY;

  beforeAll(async () => {
    if (!apiKey) {
      console.warn('Skipping E2E tests: QA_USE_API_KEY not set');
      return;
    }

    // Create server instance
    mcpServer = new QAUseMcpServer();

    // Create in-memory transport for testing (returns array [client, server])
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Create client
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

    // Connect both ends - order matters: connect client first, then server
    await Promise.all([
      client.connect(clientTransport),
      mcpServer.getServer().connect(serverTransport),
    ]);
  });

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  it('should list available tools', async () => {
    if (!apiKey) return;

    const result = await client.listTools();

    expect(result.tools).toBeDefined();
    expect(result.tools.length).toBeGreaterThan(0);

    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain('ensure_installed');
    expect(toolNames).toContain('start_automated_session');
    expect(toolNames).toContain('start_dev_session');
    expect(toolNames).toContain('monitor_session');
    expect(toolNames).toContain('search_automated_tests');
    expect(toolNames).toContain('run_automated_tests');
  });

  it('should validate API key with ensure_installed', async () => {
    if (!apiKey) return;

    const result = await client.callTool({
      name: 'ensure_installed',
      arguments: { apiKey },
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();
    expect(result.content[0]).toHaveProperty('text');

    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('Environment ready');
    expect(text).toContain('API Key: Valid');
  }, 30000);

  it('should get configuration after ensure_installed', async () => {
    if (!apiKey) return;

    const result = await client.callTool({
      name: 'get_configuration',
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();
  }, 10000);

  it('should search for automated tests', async () => {
    if (!apiKey) return;

    const result = await client.callTool({
      name: 'search_automated_tests',
      arguments: { limit: 5 },
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();
  }, 15000);

  it('should start an automated session and close it', async () => {
    if (!apiKey) return;

    // Start an automated session
    const startResult = await client.callTool({
      name: 'start_automated_session',
      arguments: {
        task: 'E2E Test: Navigate to the homepage and verify it loads',
        headless: true,
      },
    });

    expect(startResult.isError).toBeFalsy();
    expect(startResult.content).toBeDefined();

    const startText = (startResult.content[0] as { text: string }).text;
    const startData = JSON.parse(startText);

    expect(startData.success).toBe(true);
    expect(startData.sessionId).toBeDefined();

    const sessionId = startData.sessionId;

    // Wait for session to be registered in the backend
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Try to monitor - may fail if session closes quickly, which is OK
    const monitorResult = await client.callTool({
      name: 'monitor_session',
      arguments: { sessionId },
    });

    // Monitor should work or give a clear error
    expect(monitorResult.content).toBeDefined();

    // Close the session (may already be closed)
    const closeResult = await client.callTool({
      name: 'interact_with_session',
      arguments: { sessionId, action: 'close' },
    });

    // Close should succeed or report already closed
    expect(closeResult.content).toBeDefined();
  }, 60000);

  it('should reuse healthy browser/tunnel on second session', async () => {
    if (!apiKey) return;

    // Start first session
    const firstResult = await client.callTool({
      name: 'start_automated_session',
      arguments: {
        task: 'E2E Test: First session for health check test',
        headless: true,
      },
    });

    expect(firstResult.isError).toBeFalsy();
    const firstData = JSON.parse((firstResult.content[0] as { text: string }).text);
    expect(firstData.success).toBe(true);

    // Wait for session to be registered
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Close first session (may fail, which is OK)
    await client.callTool({
      name: 'interact_with_session',
      arguments: { sessionId: firstData.sessionId, action: 'close' },
    });

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Start second session - should reuse browser/tunnel (health check)
    const secondResult = await client.callTool({
      name: 'start_automated_session',
      arguments: {
        task: 'E2E Test: Second session - should reuse resources',
        headless: true,
      },
    });

    expect(secondResult.isError).toBeFalsy();
    const secondData = JSON.parse((secondResult.content[0] as { text: string }).text);
    expect(secondData.success).toBe(true);

    // Wait for session to be registered
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Close second session (may fail, which is OK)
    await client.callTool({
      name: 'interact_with_session',
      arguments: { sessionId: secondData.sessionId, action: 'close' },
    });
  }, 120000);

  it('should reset browser sessions', async () => {
    if (!apiKey) return;

    const result = await client.callTool({
      name: 'reset_browser_sessions',
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();

    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('Successfully reset');
  }, 15000);
});
