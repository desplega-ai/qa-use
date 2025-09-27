#!/usr/bin/env node

/**
 * QA-Use MCP Server
 * An MCP server for browser automation and QA testing
 */

import { version } from 'node:process';

const [major, minor] = version.substring(1).split('.').map(Number);

if (major < 18) {
  console.error(
    `ERROR: \`qa-use-mcp\` requires Node.js 18.0.0 or newer. Current version: ${process.version}`
  );
  process.exit(1);
}

await import('./server.js');
