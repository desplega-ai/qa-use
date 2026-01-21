#!/bin/bash

# Test script for list_qa_sessions MCP tool

set -e

echo "📋 Testing list_qa_sessions MCP tool..."

# Build the project first
echo "📦 Building project..."
bun run build

echo "🧪 Testing list_qa_sessions..."

# Test list_qa_sessions tool call via stdio
cat << 'EOF' | node dist/src/index.js
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_qa_sessions",
    "arguments": {}
  }
}
EOF

echo ""
echo "✅ Test completed! Check the output above for results."