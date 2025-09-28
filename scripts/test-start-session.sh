#!/bin/bash

# Test script for start_qa_session MCP tool

set -e

echo "🎬 Testing start_qa_session MCP tool..."

# Build the project first
echo "📦 Building project..."
pnpm build

echo "🧪 Testing start_qa_session..."

# Test start_qa_session tool call via stdio (basic test)
cat << 'EOF' | node dist/src/index.js
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "start_qa_session",
    "arguments": {
      "url": "https://example.com",
      "task": "Test the homepage for accessibility and basic functionality"
    }
  }
}
EOF

echo ""
echo "🔐 Testing start_qa_session with login parameters..."

# Test start_qa_session with login parameters
cat << 'EOF' | node dist/src/index.js
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "start_qa_session",
    "arguments": {
      "url": "https://example.com/login",
      "task": "Test login functionality with provided credentials",
      "login_username": "testuser@example.com",
      "login_password": "securepass123"
    }
  }
}
EOF

echo ""
echo "✅ Test completed! Check the output above for results."
echo "💡 Note: This will attempt to start a real browser session with tunneling."
echo "🔧 Make sure you have initialized the server with a valid API key first."