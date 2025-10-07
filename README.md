# QA-Use MCP Server

An MCP (Model Context Protocol) server that provides comprehensive browser automation and QA testing capabilities. This server integrates with desplega.ai to offer automated testing, session monitoring, batch test execution, and intelligent test guidance using AAA (Arrange-Act-Assert) framework templates.

**Transport Modes:**
- 📟 **stdio** - Standard MCP transport for local integrations (default)
- 🌐 **HTTP/SSE** - StreamableHTTP transport for remote access and web integrations

[![QA-Use Demo](static/demo-thumbnail.png)](https://www.youtube.com/watch?v=ts3XsYneiO4)

> **Learn more:** Check out our comprehensive [MCP integration guide](https://www.desplega.ai/how-to/mcp) for detailed setup instructions and advanced usage patterns.

## Quick Start

```bash
# Run with stdio transport (for MCP clients)
npx @desplega.ai/qa-use-mcp

# Run with HTTP transport (for web/remote access)
npx @desplega.ai/qa-use-mcp --http --port 3000
```

## Table of Contents

- [MCP Client Configuration (stdio mode)](#mcp-client-configuration-stdio-mode)
- [HTTP Transport Mode (SSE)](#http-transport-mode-sse)
- [Features](#features)
- [Installation](#installation)
- [Development](#development)
- [Available Tools](#available-tools)

## MCP Client Configuration (stdio mode)

The server requires a desplega.ai API key - you can get one by using the `register_user` tool or by signing up at [desplega.ai](https://desplega.ai).

**Standard configuration for most MCP clients:**

```json
{
  "mcpServers": {
    "desplega-qa": {
      "command": "npx",
      "args": ["-y", "@desplega.ai/qa-use-mcp@latest"],
      "env": {
        "QA_USE_API_KEY": "your-desplega-ai-api-key"
      }
    }
  }
}
```

<details>
  <summary>Claude Code</summary>
    Use the Claude Code CLI to add the QA-Use MCP server (<a href="https://docs.anthropic.com/en/docs/claude-code/mcp">guide</a>):

```bash
claude mcp add desplega-qa npx @desplega.ai/qa-use-mcp@latest --env QA_USE_API_KEY=your-desplega-ai-api-key
```

Or add without the API key and configure it later through the interactive setup:

```bash
claude mcp add desplega-qa npx @desplega.ai/qa-use-mcp@latest
```

</details>

<details>
  <summary>Claude Desktop</summary>
  Add to your <code>claude_desktop_config.json</code>:

```json
{
  "mcpServers": {
    "desplega-qa": {
      "command": "npx",
      "args": ["-y", "@desplega.ai/qa-use-mcp@latest"],
      "env": {
        "QA_USE_API_KEY": "your-desplega-ai-api-key"
      }
    }
  }
}
```

</details>

<details>
  <summary>Cline</summary>
  Follow <a href="https://docs.cline.bot/mcp/configuring-mcp-servers">https://docs.cline.bot/mcp/configuring-mcp-servers</a> and use the config provided above.
</details>

<details>
  <summary>Codex</summary>
  Follow the <a href="https://github.com/openai/codex/blob/main/docs/advanced.md#model-context-protocol-mcp">configure MCP guide</a>
  using the standard config from above. You can also install the QA-Use MCP server using the Codex CLI:

```bash
codex mcp add desplega-qa -- npx @desplega.ai/qa-use-mcp@latest
```

</details>

<details>
  <summary>Copilot / VS Code</summary>
  Follow the MCP install <a href="https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server">guide</a>,
  with the standard config from above. You can also install the QA-Use MCP server using the VS Code CLI:

  ```bash
  code --add-mcp '{"name":"desplega-qa","command":"npx","args":["-y","@desplega.ai/qa-use-mcp@latest"],"env":{"QA_USE_API_KEY":"your-desplega-ai-api-key"}}'
  ```
</details>

<details>
  <summary>Cursor</summary>

**Or install manually:**

Go to `Cursor Settings` -> `MCP` -> `New MCP Server`. Use the config provided above.

</details>

<details>
  <summary>Continue</summary>
  Add to your Continue <code>config.json</code>:

```json
{
  "mcpServers": {
    "desplega-qa": {
      "command": "npx",
      "args": ["-y", "@desplega.ai/qa-use-mcp@latest"],
      "env": {
        "QA_USE_API_KEY": "your-desplega-ai-api-key"
      }
    }
  }
}
```

</details>

<details>
  <summary>Gemini CLI</summary>
Install the QA-Use MCP server using the Gemini CLI.

**Project wide:**

```bash
gemini mcp add desplega-qa npx @desplega.ai/qa-use-mcp@latest
```

**Globally:**

```bash
gemini mcp add -s user desplega-qa npx @desplega.ai/qa-use-mcp@latest
```

Alternatively, follow the <a href="https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md#how-to-set-up-your-mcp-server">MCP guide</a> and use the standard config from above.

</details>

<details>
  <summary>Gemini Code Assist</summary>
  Follow the <a href="https://cloud.google.com/gemini/docs/codeassist/use-agentic-chat-pair-programmer#configure-mcp-servers">configure MCP guide</a>
  using the standard config from above.
</details>

<details>
  <summary>JetBrains AI Assistant & Junie</summary>

Go to `Settings | Tools | AI Assistant | Model Context Protocol (MCP)` -> `Add`. Use the config provided above.
The same way @desplega.ai/qa-use-mcp can be configured for JetBrains Junie in `Settings | Tools | Junie | MCP Settings` -> `Add`. Use the config provided above.

</details>

<details>
  <summary>Zed</summary>
  Add to your Zed settings:

```json
{
  "mcpServers": {
    "desplega-qa": {
      "command": "npx",
      "args": ["-y", "@desplega.ai/qa-use-mcp@latest"],
      "env": {
        "QA_USE_API_KEY": "your-desplega-ai-api-key"
      }
    }
  }
}
```

</details>

### Your first prompt

Enter the following prompt in your MCP Client to check if everything is working:

```
Initialize QA server and test the login form at https://app.example.com
```

Your MCP client should initialize the server, set up browser automation, and start testing the specified form.

> [!NOTE]
> The MCP server will start browser and tunnel resources automatically when needed. First-time setup requires running `init_qa_server` with `interactive=true` or providing your desplega.ai API key.

## Features

- **Browser Management**: Launch and control Playwright browser instances with headless/headed modes
- **Tunneling**: Create public tunnels for browser WebSocket endpoints using localtunnel
- **API Integration**: Full integration with desplega.ai API for comprehensive QA testing workflows
- **Session Management**: Create, monitor, and control multiple QA testing sessions with real-time status
  - Smart session lifecycle management with automatic cleanup
  - Up to 10 concurrent browser sessions with clear error handling
  - 30-minute default TTL with automatic deadline refresh on interaction
  - Background cleanup task for expired sessions
- **Progress Monitoring**: Real-time progress notifications with MCP timeout protection (25s max per call)
- **Batch Test Execution**: Run multiple automated tests simultaneously with dependency management
- **Interactive Elicitation**: Intelligent prompts when remote sessions need user input to continue
- **Test Discovery**: Search and list automated tests with pagination and filtering
- **Test Run Analytics**: View test execution history with performance metrics and flakiness scores
- **AAA Framework Templates**: Pre-built prompts for login, forms, e-commerce, navigation, and comprehensive testing scenarios
- **User Registration**: Built-in user registration system for new desplega.ai accounts
- **Comprehensive Documentation**: Built-in MCP resources with guides, workflows, and best practices

## HTTP Transport Mode (SSE)

In addition to the standard MCP stdio transport, QA-Use can run with StreamableHTTP transport using Server-Sent Events (SSE). This mode implements the official [MCP Streamable HTTP specification](https://spec.modelcontextprotocol.io/specification/basic/transports/#http-with-sse) and is useful for web-based integrations, remote access, or when you need HTTP-based MCP connectivity.

### When to Use Each Mode

| Feature | stdio (default) | HTTP/SSE |
|---------|----------------|----------|
| **Use Case** | Local MCP clients (Claude Desktop, Cline, etc.) | Web apps, remote access, API integrations |
| **Setup** | Configured in MCP client settings | Start server, connect via HTTP |
| **Authentication** | Via environment variables | Bearer token on each request |
| **Network** | Local process only | Can be exposed remotely |
| **Protocol** | Native MCP stdio | MCP over HTTP with SSE |
| **Best For** | Desktop IDE integrations | Microservices, web dashboards, custom clients |

### Starting the HTTP Server

Run the server with the `--http` or `--api` flag:

```bash
# Default port (3000)
npx @desplega.ai/qa-use-mcp --http

# Custom port
npx @desplega.ai/qa-use-mcp --http --port 8080

# Show help
npx @desplega.ai/qa-use-mcp --help
```

### Authentication

All MCP endpoints (except `/health`) require authentication via Bearer token with a valid desplega.ai API key:

```bash
# Establish SSE connection
curl -N -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/mcp
```

Get your API key by:
- Using the `register_user` tool
- Signing up at [desplega.ai](https://desplega.ai)

### MCP Endpoints

This server implements the [MCP Streamable HTTP transport specification](https://spec.modelcontextprotocol.io/specification/basic/transports/#http-with-sse):

#### Health Check
```bash
GET /health
# No authentication required
# Returns server status and version
```

#### MCP Protocol Endpoint
```bash
# Establish SSE connection for receiving messages
GET /mcp
Headers: Authorization: Bearer YOUR_API_KEY

# Send JSON-RPC messages to the server
POST /mcp
Headers:
  Authorization: Bearer YOUR_API_KEY
  Content-Type: application/json
Body: JSON-RPC 2.0 message

# Close session
DELETE /mcp
Headers:
  Authorization: Bearer YOUR_API_KEY
  MCP-Session-ID: <session-id>
```

### Example Usage

#### Initialize MCP Connection
```bash
# Start SSE stream in one terminal
curl -N -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/mcp

# In another terminal, send initialize message
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'
```

#### Call MCP Tools
```bash
# List available tools
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'

# Start automated test session
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "start_automated_session",
      "arguments": {
        "task": "Test login functionality"
      }
    }
  }'
```

### MCP Client Support

Any MCP client that supports the StreamableHTTP transport can connect to this server. You'll need to:

1. Configure the client with the HTTP endpoint: `http://localhost:3000/mcp`
2. Add authentication header: `Authorization: Bearer YOUR_API_KEY`
3. The client will automatically handle SSE streams and JSON-RPC messaging

> **Note:** Most current MCP clients (Claude Desktop, Cline, etc.) use stdio transport by default. The HTTP mode is primarily for:
> - Custom integrations and web applications
> - Remote server deployments
> - Microservices architectures
> - API gateways and proxies

### Security Considerations

When running in HTTP mode:

- ✅ **Always use HTTPS** in production (consider using a reverse proxy like nginx)
- ✅ **Protect your API key** - it provides full access to your desplega.ai account
- ✅ **Use firewall rules** to restrict access to trusted IP addresses
- ✅ **Consider rate limiting** for public-facing deployments
- ✅ **Monitor access logs** for suspicious activity

Example nginx configuration for HTTPS:

```nginx
server {
    listen 443 ssl;
    server_name qa-mcp.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Required for SSE
        proxy_buffering off;
        proxy_read_timeout 24h;
    }
}
```

### Docker Deployment

The HTTP mode is perfect for containerized deployments. Example Dockerfile:

```dockerfile
FROM node:18-slim

# Install dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
    libgbm1 libasound2 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Install qa-use-mcp
RUN npm install -g @desplega.ai/qa-use-mcp

# Expose port
EXPOSE 3000

# Set API key via environment variable
ENV QA_USE_API_KEY=your-api-key-here

# Start in HTTP mode
CMD ["qa-use-mcp", "--http", "--port", "3000"]
```

Run the container:

```bash
docker build -t qa-use-mcp .
docker run -d -p 3000:3000 \
  -e QA_USE_API_KEY=your-api-key \
  qa-use-mcp
```

### Backward Compatibility

The HTTP server mode is fully backward compatible. Running without the `--http` flag uses the standard MCP stdio transport:

```bash
# Standard MCP mode (stdio) - default
npx @desplega.ai/qa-use-mcp

# HTTP transport mode (SSE)
npx @desplega.ai/qa-use-mcp --http
```

Both modes support all MCP tools and functionality. The HTTP mode follows the official MCP Streamable HTTP specification.


## Installation

Install and run directly with npx:

```bash
npx @desplega.ai/qa-use-mcp
```

Or install globally:

```bash
npm install -g @desplega.ai/qa-use-mcp
qa-use-mcp  # or: desplega-qa
```

## Development

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd qa-use-mcp
pnpm install
```

Build the project:

```bash
pnpm build
```

Start the development server:

```bash
pnpm dev
```

<!-- AUTO-GENERATED-TOOLS-START -->
## MCP Tools

The server exposes the following MCP tools for browser automation and QA testing:

### Setup & Configuration

#### `ensure_installed`
Ensure API key is set, validate authentication, and install Playwright browsers.

**Parameters:**
- `apiKey` (string, optional): API key for desplega.ai (optional if QA_USE_API_KEY env var is set)

#### `register_user`
Register a new user account with desplega.ai and receive an API key.

**Parameters:**
- `email` (string, required): Email address for registration

#### `update_configuration`
Update application configuration settings including base URL, login credentials, and viewport type.

**Parameters:**
- `base_url` (string, optional): Base URL for the application being tested
- `login_url` (string, optional): Login page URL for the application
- `login_username` (string, optional): Default username for login testing
- `login_password` (string, optional): Default password for login testing
- `vp_type` (string, optional): Viewport configuration type: big_desktop, desktop, mobile, or tablet (default: desktop)

#### `get_configuration`
Get the current application configuration details including base URL, login settings, and viewport.

**Parameters:** None

#### `reset_browser_sessions`
Reset and cleanup all active browser sessions. This will kill all browsers and tunnels. Use this when you hit the maximum session limit or need to free up resources.

**Parameters:** None

### Session Management

#### `search_sessions`
Search and list all sessions (automated tests and development sessions) with pagination and filtering.

**Parameters:**
- `limit` (number, optional): Maximum number of sessions to return (default: 10, min: 1)
- `offset` (number, optional): Number of sessions to skip (default: 0, min: 0)
- `query` (string, optional): Search query to filter sessions by task, URL, or status

#### `start_automated_session`
Start an automated E2E test session for QA flows and automated testing. Returns sessionId for monitoring.

**Parameters:**
- `task` (string, required): The testing task or scenario to execute
- `url` (string, optional): Optional URL to test (overrides app config base_url if provided)
- `dependencyId` (string, optional): Optional test ID that this session depends on (must be a self test ID created by your app configuration)
- `headless` (boolean, optional): Run browser in headless mode (default: false for better visibility)

#### `start_dev_session`
Start an interactive development session for debugging and exploration. Session will not auto-pilot and allows manual browser interaction.

**Parameters:**
- `task` (string, required): Description of what you want to explore or debug. Can be a placeholder like "Waiting for user input"
- `url` (string, optional): Optional URL to start from (overrides app config base_url if provided)
- `headless` (boolean, optional): Run browser in headless mode (default: false for development visibility)

#### `monitor_session`
Monitor a session status. Keep calling until status is "closed". Will alert if session needs user input, is idle, or pending.

**Parameters:**
- `sessionId` (string, required): The session ID to monitor
- `wait` (boolean, optional): Wait for session to reach any non-running state with MCP timeout protection (max 25s per call)
- `timeout` (number, optional): User timeout in seconds for wait mode (default: 60)

#### `interact_with_session`
Interact with a session - respond to questions, pause, or close the session.

**Parameters:**
- `sessionId` (string, required): The session ID to interact with
- `action` (string, required): Action to perform: respond (answer question), pause (stop session), or close (end session)
- `message` (string, optional): Your response message (required for "respond" action, optional for others)

### Test Management

#### `search_automated_tests`
Search for automated tests by ID or query. If testId provided, returns detailed info for that test. Otherwise searches with optional query/pagination.

**Parameters:**
- `testId` (string, optional): Specific test ID to retrieve detailed information for (if provided, other params ignored)
- `query` (string, optional): Search query to filter tests by name, description, URL, or task (ignored if testId provided)
- `limit` (number, optional): Maximum number of tests to return (default: 10, min: 1) (ignored if testId provided)
- `offset` (number, optional): Number of tests to skip (default: 0, min: 0) (ignored if testId provided)
- `self_only` (boolean, optional): Filter tests by app configuration. When true, only returns tests created by your application configuration. Default: false to allow running tests from other configs locally.

#### `run_automated_tests`
Execute multiple automated tests simultaneously.

**Parameters:**
- `test_ids` (array, required): Array of test IDs to execute
- `app_config_id` (string, optional): Optional app config ID to run tests against (uses API key default config if not provided)
- `ws_url` (string, optional): Optional WebSocket URL override (uses global tunnel URL by default)

#### `search_automated_test_runs`
Search automated test runs with optional filtering by test ID or run ID.

**Parameters:**
- `test_id` (string, optional): Filter test runs by specific test ID
- `run_id` (string, optional): Filter test runs by specific run ID
- `limit` (number, optional): Maximum number of test runs to return (default: 10, min: 1)
- `offset` (number, optional): Number of tests to skip (default: 0, min: 0)

<!-- AUTO-GENERATED-TOOLS-END -->

### Built-in Documentation

The server includes comprehensive MCP resources and prompts:

#### MCP Resources
- **Getting Started Guide**: Complete setup and usage instructions
- **Testing Workflows**: Common patterns for interactive, batch, and development testing
- **Tool Reference**: Detailed documentation for all available MCP tools

#### MCP Prompts
- **`aaa_test`**: Generate structured test scenarios using the Arrange-Act-Assert (AAA) framework with customizable parameters

## Configuration

### Environment Variables

Create a `.env` file in your project root or set the following environment variable:

```bash
QA_USE_API_KEY=your-desplega-ai-api-key
```


## Usage Examples

### Interactive Testing Workflow
```bash
# 1. Initialize server and install browsers
ensure_installed

# 2. Configure app settings (one-time setup)
update_configuration with base_url="https://app.example.com" and login_url="https://app.example.com/login" and login_username="testuser@example.com"

# 3. Start an automated test session
start_automated_session with task="Test user registration flow"

# 4. Monitor session progress
monitor_session with sessionId="session-123" and wait=true and timeout=300

# 5. Interact with session if needed (respond, pause, or close)
interact_with_session with sessionId="session-123" and action="respond" and message="john.doe@example.com"
```

### Development & Debugging Workflow
```bash
# 1. Start an interactive dev session (no auto-pilot)
start_dev_session with task="Exploring the checkout flow" and url="https://app.example.com/cart"

# 2. Monitor and interact as needed
monitor_session with sessionId="dev-session-456"

# 3. Close when done
interact_with_session with sessionId="dev-session-456" and action="close"
```

### Batch Testing Workflow
```bash
# 1. Find available tests
search_automated_tests with query="login" and limit=10

# 2. Run multiple tests simultaneously
run_automated_tests with test_ids=["login-test-1", "signup-test-2", "checkout-test-3"]

# 3. Monitor progress
search_sessions with limit=20

# 4. Check test run history
search_automated_test_runs with limit=50
```

### Using AAA Framework Template
```bash
# Generate a structured test using AAA framework
Use prompt: aaa_test with test_type="login" and url="https://app.example.com/login" and feature="user authentication"
```

### Resource Management
```bash
# When you hit the 10 session limit or need to free up resources
reset_browser_sessions

# This will clean up all active browsers and tunnels
# Useful when sessions aren't closing properly or you need to restart fresh
```

## Testing

Use the provided test scripts to test MCP server functionality:

```bash
# Test server initialization (uses env var if available)
./scripts/test-init.sh

# Test listing sessions
./scripts/test-list-sessions.sh

# Test starting a session
./scripts/test-start-session.sh

# Test with real API key from environment
node scripts/mcp-test.js
```

## Architecture

The project is organized into modular components:

- **`src/`**: Main MCP server implementation with comprehensive tool handlers
  - MCP protocol implementation with tools, resources, and prompts
  - Session management and monitoring with timeout protection
  - BrowserSession management with automatic lifecycle tracking
    - Each session wraps browser + tunnel with TTL and deadline tracking
    - Session types: 'dev', 'automated', and 'test_run'
    - Automatic cleanup on expiration or completion
  - Real-time progress notifications using MCP logging specification
  - AAA framework prompt templates for structured testing
- **`lib/browser/`**: Browser management functionality using Playwright
  - Headless and headed browser support
  - WebSocket endpoint management for remote control
- **`lib/tunnel/`**: Tunneling and port forwarding using localtunnel
  - Public tunnel creation for browser WebSocket access
  - Automatic WebSocket URL conversion for remote testing
- **`lib/api/`**: Complete API client for desplega.ai integration
  - Session lifecycle management (create, monitor, respond)
  - Test discovery and execution
  - Test run analytics and history
  - User registration and authentication
  - Batch test execution with dependency handling

### Key Features Implementation

#### MCP Timeout Protection
- Limited monitoring calls to 25 seconds to prevent MCP timeouts
- Automatic continuation support for long-running sessions
- Real-time progress notifications during session monitoring

#### AAA Framework Integration
- Pre-built templates for login, forms, e-commerce, and navigation testing
- Comprehensive test scenarios for accessibility, performance, and mobile testing
- Dynamic argument support for customizable test generation

#### Test Analytics
- Complete test run history with performance metrics
- Probabilistic Flakiness Score (PFS) tracking
- Execution timing and error tracking
- Filtering and pagination for large datasets

## License

MIT
