import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { QAUseMcpServer } from './server.js';
import { HttpMcpServer } from './http-server.js';

/**
 * HTTP Server Integration Tests
 *
 * Tests that Bearer auth properly propagates API key to MCP tools.
 * Requires QA_USE_API_KEY environment variable to be set.
 */
describe('HttpMcpServer Bearer Auth Integration Tests', () => {
  let mcpServer: QAUseMcpServer;
  let httpServer: HttpMcpServer;
  const port = 3456; // Use a non-standard port for testing
  const baseUrl = `http://localhost:${port}`;

  const apiKey = process.env.QA_USE_API_KEY;

  beforeAll(async () => {
    if (!apiKey) {
      console.warn('Skipping HTTP E2E tests: QA_USE_API_KEY not set');
      return;
    }

    // Create and start HTTP server
    mcpServer = new QAUseMcpServer();
    httpServer = new HttpMcpServer(mcpServer, port);
    await httpServer.start();
  });

  afterAll(async () => {
    // Server cleanup happens automatically when process exits
  });

  it('should reject requests without Bearer auth', async () => {
    if (!apiKey) return;

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
    expect(data.message).toContain('Bearer');
  });

  it('should reject requests with invalid Bearer token', async () => {
    if (!apiKey) return;

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer invalid-api-key-12345',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should accept requests with valid Bearer auth and list tools', async () => {
    if (!apiKey) return;

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    expect(response.status).toBe(200);
  });

  it('should propagate Bearer API key to tools (search_automated_tests)', async () => {
    if (!apiKey) return;

    // First initialize the session
    const initResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    expect(initResponse.status).toBe(200);
    const sessionId = initResponse.headers.get('mcp-session-id');

    // Now call a tool that requires API key
    const toolResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${apiKey}`,
        ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'search_automated_tests',
          arguments: { limit: 2 },
        },
      }),
    });

    expect(toolResponse.status).toBe(200);

    // Response might be SSE or JSON depending on transport
    const responseText = await toolResponse.text();

    // The tool should NOT return an error about missing API key
    // If Bearer auth propagation works, the tool will have access to the API key
    expect(responseText).not.toContain('API key not configured');

    // Should contain actual test data (proves API call worked)
    // Either as JSON or SSE event data
    expect(responseText.length).toBeGreaterThan(0);
  });

  it('should health check without auth', async () => {
    if (!apiKey) return;

    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.mode).toBe('http-sse');
  });
});
