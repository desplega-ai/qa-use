#!/bin/bash

# Test script for init_qa_server MCP tool
# Based on MCP Inspector CLI guide

set -e

echo "🚀 Testing init_qa_server MCP tool..."

# Build the project first
echo "📦 Building project..."
bun run build

# Create temporary file for MCP communication
TEMP_FILE=$(mktemp)
echo "📝 Using temp file: $TEMP_FILE"

# Start the MCP server in background
echo "🔄 Starting MCP server..."
node dist/src/index.js > "$TEMP_FILE" 2>&1 &
SERVER_PID=$!

# Give server time to start
sleep 2

# Function to cleanup
cleanup() {
    echo "🧹 Cleaning up..."
    kill $SERVER_PID 2>/dev/null || true
    rm -f "$TEMP_FILE"
}
trap cleanup EXIT

# Test init_qa_server tool call via stdio
echo "🧪 Testing init_qa_server..."

# Create test payload
cat << 'EOF' | node dist/src/index.js
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "init_qa_server",
    "arguments": {
      "apiKey": "test-api-key-123",
      "forceInstall": false
    }
  }
}
EOF

echo ""
echo "✅ Test completed! Check the output above for results."
echo "💡 Note: This test will fail API validation since we're using a test key."
echo "🔧 For real testing, replace 'test-api-key-123' with your actual desplega.ai API key."