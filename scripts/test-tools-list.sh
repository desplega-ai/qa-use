#!/bin/bash

# Test script to list available MCP tools

set -e

echo "🔧 Testing tools/list MCP endpoint..."

# Build the project first
echo "📦 Building project..."
bun run build

echo "🧪 Listing available tools..."

# Test tools/list call via stdio
cat << 'EOF' | node dist/src/index.js
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
EOF

echo ""
echo "✅ Test completed! Check the output above for available tools."