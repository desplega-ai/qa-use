#!/usr/bin/env node

/**
 * QA-Use MCP Server - Stdio Entry Point
 *
 * This file starts the MCP server in stdio mode (the default for MCP).
 * For other modes (HTTP, tunnel), use the unified CLI: `qa-use mcp --http` or `qa-use mcp tunnel`
 */

import { version } from 'node:process';
import { logConfigSources } from '../lib/env/index.js';
import { QAUseMcpServer } from './server.js';

const [major] = version.substring(1).split('.').map(Number);

if (major < 18) {
  console.error(
    `ERROR: \`qa-use\` requires Node.js 18.0.0 or newer. Current version: ${process.version}`
  );
  process.exit(1);
}

// Log configuration sources (helps users understand where credentials come from)
logConfigSources();

// Start stdio server (default MCP mode)
const server = new QAUseMcpServer();
await server.start();
