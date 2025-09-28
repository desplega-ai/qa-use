#!/bin/bash

# Test script for start_qa_session MCP tool

set -e

echo "🎬 Testing start_qa_session MCP tool..."

# Build the project first
echo "📦 Building project..."
pnpm build

echo "🧪 Testing start_qa_session..."

# Test start_qa_session tool call via stdio (using app config base URL)
cat << 'EOF' | node dist/src/index.js
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "start_qa_session",
    "arguments": {
      "task": "Test the configured app using the app config base URL and login settings"
    }
  }
}
EOF

echo ""
echo "🌐 Testing start_qa_session with URL override..."

# Test start_qa_session with URL override
cat << 'EOF' | node dist/src/index.js
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "start_qa_session",
    "arguments": {
      "url": "https://example.com/special-page",
      "task": "Test a specific page overriding the app config base URL"
    }
  }
}
EOF

echo ""
echo "⚙️ Testing update_app_config..."

# Test update_app_config tool
cat << 'EOF' | node dist/src/index.js
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "update_app_config",
    "arguments": {
      "base_url": "https://example.com/app",
      "login_url": "https://example.com/login",
      "login_username": "demo@example.com",
      "vp_type": "desktop"
    }
  }
}
EOF

echo ""
echo "📋 Testing list_app_configs..."

# Test list_app_configs tool
cat << 'EOF' | node dist/src/index.js
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "list_app_configs",
    "arguments": {
      "limit": 5,
      "offset": 0
    }
  }
}
EOF

echo ""
echo "🚀 Testing run_automated_tests with app_config_id..."

# Test run_automated_tests with app_config_id
cat << 'EOF' | node dist/src/index.js
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "run_automated_tests",
    "arguments": {
      "test_ids": ["test-1", "test-2"],
      "app_config_id": "d79afd44-031d-4756-a4a4-1f2b55ad6069"
    }
  }
}
EOF

echo ""
echo "✅ Test completed! Check the output above for results."
echo ""
echo "📋 **New Workflow Summary:**"
echo "1. 🔧 Initialize: init_qa_server with API key"
echo "2. ⚙️  Configure: update_app_config with base_url, login credentials"
echo "3. 🧪 Test: start_qa_session (URL optional - uses app config)"
echo "4. 📊 Monitor: list_app_configs to see other configs"
echo "5. 🚀 Batch: run_automated_tests with optional app_config_id"
echo ""
echo "💡 Note: URL in start_qa_session is now optional and will use app config base_url"
echo "🔐 Login credentials are now set via update_app_config, not per session"