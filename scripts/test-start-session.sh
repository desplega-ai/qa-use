#!/bin/bash

# Test script for start_qa_session MCP tool

set -e

echo "🎬 Testing start_qa_session MCP tool..."

# Build the project first
echo "📦 Building project..."
pnpm build

echo "🧪 Testing start_qa_session..."

# Test start_qa_session tool call via stdio
cat << 'EOF' | node dist/src/index.js
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "start_qa_session",
    "arguments": {
      "url": "https://example.com",
      "task": "Test the homepage for accessibility and basic functionality",
      "mode": "normal",
      "headless": true
    }
  }
}
EOF

echo ""
echo "✅ Test completed! Check the output above for results."
echo "💡 Note: This will attempt to start a real browser session with tunneling."
echo "🔧 Make sure you have initialized the server with a valid API key first."