import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { ApiClient } from '../lib/api/index.js';
import { QAUseMcpServer } from '../dist/src/server.js';

interface AuthRequest extends IncomingMessage {
  apiKey?: string;
  body?: unknown;
}

// Store transports in a global map (survives across function calls in same instance)
const transports = new Map<string, StreamableHTTPServerTransport>();

// Create MCP server instance
let mcpServer: Server | null = null;

function getMcpServer(): Server {
  if (!mcpServer) {
    const qaServer = new QAUseMcpServer();
    mcpServer = qaServer.getServer();
  }
  return mcpServer;
}

async function authenticateRequest(req: AuthRequest): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const apiKey = authHeader.substring(7);
  if (!apiKey) {
    return false;
  }

  // Validate API key
  const apiClient = new ApiClient();
  const authResult = await apiClient.validateApiKey(apiKey);
  if (!authResult.success) {
    return false;
  }

  req.apiKey = apiKey;
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Session-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check endpoint
  if (req.url === '/health' || req.url === '/api/health') {
    return res.status(200).json({
      status: 'ok',
      name: '@desplega.ai/qa-use-mcp',
      version: '1.2.6',
      mode: 'vercel-serverless',
      transport: 'StreamableHTTP',
      note: 'Running on Vercel with 60s timeout limit',
    });
  }

  // MCP endpoint
  if (req.url === '/mcp' || req.url === '/api/mcp') {
    const authReq = req as unknown as AuthRequest;
    authReq.body = req.body;

    // Authenticate request
    const isAuthenticated = await authenticateRequest(authReq);
    if (!isAuthenticated) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Expected: Bearer <api-key>',
      });
    }

    // Get or create transport
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId)!;
    } else {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id: string) => {
          transports.set(id, transport);
        },
        onsessionclosed: (id: string) => {
          transports.delete(id);
        },
      });

      const server = getMcpServer();
      await server.connect(transport);
    }

    // Handle the request
    try {
      await transport.handleRequest(
        authReq as IncomingMessage,
        res as unknown as ServerResponse,
        req.body
      );
    } catch (error) {
      if (!res.headersSent) {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return;
  }

  // 404 for other routes
  return res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found. Use /mcp for MCP protocol or /health for health check.`,
  });
}
