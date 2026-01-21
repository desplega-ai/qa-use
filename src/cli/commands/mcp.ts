/**
 * MCP Command - Start the MCP server in various modes
 */

import { Command } from 'commander';

export const mcpCommand = new Command('mcp')
  .description('Start the MCP server')
  .option('--http, --api', 'Run in HTTP API server mode (default: stdio)')
  .option('-p, --port <port>', 'Port for HTTP server', '3000')
  .action(async (options) => {
    const { logConfigSources } = await import('../../../lib/env/index.js');

    // Log configuration sources (helps users understand where credentials come from)
    logConfigSources();

    const port = parseInt(options.port, 10);

    if (options.http) {
      // HTTP API server mode
      const { QAUseMcpServer } = await import('../../server.js');
      const { HttpMcpServer } = await import('../../http-server.js');

      const mcpServer = new QAUseMcpServer();
      const httpServer = new HttpMcpServer(mcpServer, port);

      await httpServer.start();
    } else {
      // Default stdio mode
      const { QAUseMcpServer } = await import('../../server.js');
      const server = new QAUseMcpServer();
      await server.start();
    }
  });

// Tunnel subcommand
mcpCommand
  .command('tunnel')
  .description('Run persistent WebSocket tunnel for backend-initiated tasks')
  .option('--visible', 'Show browser window (default: headless)')
  .option('-s, --subdomain <name>', 'Custom subdomain for tunnel')
  .action(async (options) => {
    const { logConfigSources } = await import('../../../lib/env/index.js');

    // Log configuration sources
    logConfigSources();

    const { startTunnelMode } = await import('../../tunnel-mode.js');
    await startTunnelMode({
      headless: !options.visible,
      subdomain: options.subdomain,
    });
  });
