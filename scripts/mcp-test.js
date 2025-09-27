#!/usr/bin/env node

/**
 * Simple MCP client for testing the QA-Use MCP server
 * Based on MCP Inspector CLI patterns
 */

import { spawn } from 'child_process';
import readline from 'readline';

class MCPTestClient {
  constructor() {
    this.requestId = 1;
    this.server = null;
    this.initialized = false;
  }

  async startServer() {
    console.log('🚀 Starting QA-Use MCP Server...');

    this.server = spawn('node', ['dist/src/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    this.server.stderr.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });

    this.server.on('error', (error) => {
      console.error('Server error:', error);
    });

    this.server.on('exit', (code) => {
      console.log(`Server exited with code ${code}`);
    });

    // Setup readline for server output
    this.rl = readline.createInterface({
      input: this.server.stdout,
      output: process.stdout,
      terminal: false
    });

    return new Promise((resolve) => {
      setTimeout(resolve, 1000); // Give server time to start
    });
  }

  async sendRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method,
      params
    };

    console.log(`📤 Sending: ${JSON.stringify(request)}`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      this.rl.once('line', (line) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(line);
          console.log(`📥 Received: ${JSON.stringify(response, null, 2)}`);
          resolve(response);
        } catch (error) {
          console.log(`📥 Raw response: ${line}`);
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
      });

      this.server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async initialize() {
    console.log('🔧 Initializing MCP connection...');

    try {
      const response = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'qa-use-test-client',
          version: '1.0.0'
        }
      });

      this.initialized = true;
      console.log('✅ MCP connection initialized');
      return response;
    } catch (error) {
      console.error('❌ Failed to initialize:', error.message);
      throw error;
    }
  }

  async listTools() {
    if (!this.initialized) {
      throw new Error('Client not initialized');
    }

    console.log('🔧 Listing available tools...');
    return this.sendRequest('tools/list');
  }

  async callTool(name, args) {
    if (!this.initialized) {
      throw new Error('Client not initialized');
    }

    console.log(`🧪 Calling tool: ${name}`);
    return this.sendRequest('tools/call', {
      name,
      arguments: args
    });
  }

  async close() {
    if (this.server) {
      console.log('🛑 Stopping server...');
      this.server.kill();
    }
  }
}

async function main() {
  const client = new MCPTestClient();

  try {
    await client.startServer();
    await client.initialize();

    // Test tools list
    console.log('\n' + '='.repeat(50));
    await client.listTools();

    // Test init tool (with fake API key)
    console.log('\n' + '='.repeat(50));
    await client.callTool('init_qa_server', {
      apiKey: 'test-api-key-123',
      forceInstall: false
    });

    // Test list sessions
    console.log('\n' + '='.repeat(50));
    await client.callTool('list_qa_sessions', {});

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await client.close();
    process.exit(0);
  }
}

main().catch(console.error);