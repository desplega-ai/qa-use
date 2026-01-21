#!/bin/bash

# Test script with real API key
# Usage: API_KEY=your-real-key ./scripts/test-with-real-key.sh

set -e

if [ -z "$API_KEY" ]; then
    echo "❌ Please set API_KEY environment variable"
    echo "Usage: API_KEY=your-real-key ./scripts/test-with-real-key.sh"
    exit 1
fi

echo "🚀 Testing with real API key..."

# Build first
bun run build

# Create a temporary test script
cat > /tmp/mcp-real-test.js << EOF
import { spawn } from 'child_process';
import readline from 'readline';

const client = spawn('node', ['dist/src/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

client.stderr.on('data', (data) => {
  console.error('Server:', data.toString());
});

const rl = readline.createInterface({
  input: client.stdout
});

// Initialize
const init = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: { tools: {} },
    clientInfo: { name: 'test-client', version: '1.0.0' }
  }
};

client.stdin.write(JSON.stringify(init) + '\n');

rl.once('line', (line) => {
  console.log('Init response:', JSON.parse(line));

  // Test with real API key
  const testInit = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'init_qa_server',
      arguments: {
        apiKey: '${API_KEY}',
        forceInstall: false
      }
    }
  };

  client.stdin.write(JSON.stringify(testInit) + '\n');

  rl.once('line', (line) => {
    console.log('API test response:', JSON.parse(line));
    client.kill();
  });
});
EOF

node /tmp/mcp-real-test.js
rm /tmp/mcp-real-test.js

echo "✅ Real API key test completed!"