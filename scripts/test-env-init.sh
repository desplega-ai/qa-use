#!/bin/bash

# Test init_qa_server using environment variable

set -e

echo "🔑 Testing init_qa_server with environment variable..."

# Build first
echo "📦 Building project..."
bun run build

echo "🧪 Testing init without providing API key (should use env var)..."

# Test with environment variable (no apiKey parameter)
cat << 'EOF' | timeout 10 node dist/src/index.js 2>/dev/null || true
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {"tools": {}},
    "clientInfo": {"name": "test-client", "version": "1.0.0"}
  }
}
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "init_qa_server",
    "arguments": {
      "forceInstall": false
    }
  }
}
EOF

echo ""
echo "✅ Test completed!"
echo "💡 If you have QA_USE_API_KEY set in .env, the server will use it automatically."
echo "🔧 If not set, you'll get an error asking for the API key."