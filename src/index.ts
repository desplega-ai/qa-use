#!/usr/bin/env node

/**
 * QA-Use MCP Server
 * An MCP server for browser automation and QA testing
 */

import { version } from 'node:process';
import { logConfigSources } from '../lib/env/index.js';

const [major, minor] = version.substring(1).split('.').map(Number);

if (major < 18) {
  console.error(
    `ERROR: \`qa-use-mcp\` requires Node.js 18.0.0 or newer. Current version: ${process.version}`
  );
  process.exit(1);
}

// Parse command-line arguments
const args = process.argv.slice(2);
const helpFlag = args.includes('--help') || args.includes('-h');
const httpFlag = args.includes('--http') || args.includes('--api');
const tunnelFlag = args.includes('tunnel');
const visibleFlag = args.includes('--visible');
const portIndex = args.findIndex((arg) => arg === '--port' || arg === '-p');
const port = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1]) : 3000;
const subdomainIndex = args.findIndex((arg) => arg === '--subdomain' || arg === '-s');
const subdomain =
  subdomainIndex !== -1 && args[subdomainIndex + 1] ? args[subdomainIndex + 1] : undefined;

if (helpFlag) {
  console.log(`
QA-Use MCP Server - Browser Automation and QA Testing

Usage:
  qa-use-mcp [command] [options]

Commands:
  tunnel                        Run persistent WebSocket tunnel for backend-initiated tasks

Options:
  --http, --api             Run in HTTP API server mode (default: stdio mode)
  --port, -p <port>         Port for HTTP server (default: 3000)
  --visible                 Show browser window in tunnel mode (default: headless)
  --subdomain, -s <name>    Custom subdomain for tunnel (default: deterministic based on API key)
  --help, -h                Show this help message

Modes:
  stdio (default):      Standard MCP server using stdio transport
  http (--http):        HTTP API server with Bearer token authentication
  tunnel:               Persistent tunnel allowing backend to initiate local browser tasks
                        (runs headless by default, use --visible to show browser)

Examples:
  qa-use-mcp                              # Run in stdio mode (default)
  qa-use-mcp --http                       # Run HTTP server on port 3000
  qa-use-mcp --http --port 8080           # Run HTTP server on port 8080
  qa-use-mcp tunnel                       # Start tunnel (deterministic subdomain from API key)
  qa-use-mcp tunnel --visible             # Start tunnel with visible browser
  qa-use-mcp tunnel --subdomain my-app    # Start tunnel with custom subdomain

Environment Variables:
  QA_USE_API_KEY       Your API key for desplega.ai
  QA_USE_API_URL       API URL (default: https://api.desplega.ai)
  QA_USE_APP_URL       App URL (default: https://app.desplega.ai)
  QA_USE_REGION        Region for tunnel (us, auto) (default: auto)

Configuration File:
  You can also set these values in ~/.qa-use.json:
  {
    "env": {
      "QA_USE_API_KEY": "your-api-key",
      "QA_USE_REGION": "us"
    }
  }
  Environment variables take precedence over the config file.

For more information, visit: https://github.com/desplega-ai/qa-use
`);
  process.exit(0);
}

// Log configuration sources (helps users understand where credentials come from)
logConfigSources();

// Load the appropriate server mode
if (tunnelFlag) {
  // Tunnel mode
  const { startTunnelMode } = await import('./tunnel-mode.js');
  await startTunnelMode({ headless: !visibleFlag, subdomain });
} else if (httpFlag) {
  // HTTP API server mode
  const { QAUseMcpServer } = await import('./server.js');
  const { HttpMcpServer } = await import('./http-server.js');

  const mcpServer = new QAUseMcpServer();
  const httpServer = new HttpMcpServer(mcpServer.getServer(), port);

  await httpServer.start();
} else {
  // Default stdio mode
  const { QAUseMcpServer } = await import('./server.js');
  const server = new QAUseMcpServer();
  await server.start();
}
