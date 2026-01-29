import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import { ApiClient } from '../lib/api/index.js';
import type { QAUseMcpServer } from './server.js';
import { getName, getVersion } from './utils/package.js';

interface AuthRequest extends IncomingMessage {
  apiKey?: string;
  body?: unknown;
}

export class HttpMcpServer {
  private app: express.Application;
  private server: Server;
  private mcpServer: QAUseMcpServer;
  private port: number;
  private transports: Map<string, StreamableHTTPServerTransport>;

  constructor(mcpServer: QAUseMcpServer, port: number = 3000) {
    this.app = express();
    this.server = mcpServer.getServer();
    this.mcpServer = mcpServer;
    this.port = port;
    this.transports = new Map();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json());

    // CORS middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private async authenticateRequest(req: AuthRequest): Promise<boolean> {
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

    // Store API key in request for later use
    req.apiKey = apiKey;
    return true;
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        name: getName(),
        version: getVersion(),
        mode: 'http-sse',
        transport: 'StreamableHTTP',
      });
    });

    // MCP endpoint - handles both GET (SSE) and POST (messages)
    this.app.all('/mcp', async (req: Request, res: Response) => {
      const authReq = req as unknown as AuthRequest;
      authReq.body = req.body;

      // Authenticate request
      const isAuthenticated = await this.authenticateRequest(authReq);
      if (!isAuthenticated) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or invalid Authorization header. Expected: Bearer <api-key>',
        });
      }

      // Set API key on MCP server so tools can use it
      if (authReq.apiKey) {
        this.mcpServer.setApiKey(authReq.apiKey);
      }

      // Create or get transport for this request
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      let transport: StreamableHTTPServerTransport;

      if (sessionId && this.transports.has(sessionId)) {
        transport = this.transports.get(sessionId)!;
      } else {
        // Create new transport
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id: string) => {
            this.transports.set(id, transport);
          },
          onsessionclosed: (id: string) => {
            this.transports.delete(id);
          },
        });

        // Connect transport to MCP server
        await this.server.connect(transport);
      }

      // Handle the request with the transport
      try {
        await transport.handleRequest(
          authReq as IncomingMessage,
          res as unknown as ServerResponse,
          req.body
        );
      } catch (error) {
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found. Use /mcp for MCP protocol or /health for health check.`,
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`${getName()} MCP Server running on port ${this.port}`);
        console.log(`Version: ${getVersion()}`);
        console.log(`Transport: StreamableHTTP (SSE + JSON-RPC)`);
        console.log(`\nEndpoints:`);
        console.log(`  GET  /health - Health check (no auth required)`);
        console.log(`  GET  /mcp - Establish SSE connection (auth required)`);
        console.log(`  POST /mcp - Send JSON-RPC message (auth required)`);
        console.log(`  DELETE /mcp - Close session (auth required)`);
        console.log(`\nAuthentication: Bearer token required (API key)`);
        console.log(`\nExample:`);
        console.log(`  # Establish connection`);
        console.log(
          `  curl -N -H "Authorization: Bearer YOUR_KEY" http://localhost:${this.port}/mcp`
        );
        resolve();
      });
    });
  }
}
