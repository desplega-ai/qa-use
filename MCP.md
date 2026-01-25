# QA-Use MCP Server

An MCP (Model Context Protocol) server that provides comprehensive browser automation and QA testing capabilities. This server integrates with desplega.ai to offer automated testing, session monitoring, batch test execution, and intelligent test guidance using AAA (Arrange-Act-Assert) framework templates.

**Modes:**
- **stdio** - Standard MCP transport for local integrations (default)
- **HTTP/SSE** - StreamableHTTP transport for remote access and web integrations
- **tunnel** - Persistent WebSocket tunnel for backend-initiated tasks

> **Learn more:** Check out our comprehensive [MCP integration guide](https://www.desplega.ai/how-to/mcp) for detailed setup instructions and advanced usage patterns.

## Table of Contents

- [Quick Start](#quick-start)
- [MCP Client Configuration (stdio mode)](#mcp-client-configuration-stdio-mode)
- [HTTP Transport Mode (SSE)](#http-transport-mode-sse)
- [Tunnel Mode](#tunnel-mode)
- [MCP Tools Reference](#mcp-tools)
- [Configuration](#configuration)
- [Security Considerations](#security-considerations)

## Quick Start

```bash
# Run with stdio transport (for MCP clients)
npx @desplega.ai/qa-use mcp

# Run with HTTP transport (for web/remote access)
npx @desplega.ai/qa-use mcp --http --port 3000

# Run persistent tunnel (for backend-initiated tasks)
npx @desplega.ai/qa-use mcp tunnel
```

## MCP Client Configuration (stdio mode)

The server requires a desplega.ai API key - you can get one by using the `register_user` tool or by signing up at [desplega.ai](https://desplega.ai).

**Standard configuration for most MCP clients:**

```json
{
  "mcpServers": {
    "desplega-qa": {
      "command": "npx",
      "args": ["-y", "@desplega.ai/qa-use@latest", "mcp"],
      "env": {
        "QA_USE_API_KEY": "your-desplega-ai-api-key"
      }
    }
  }
}
```

> **Optional:** Add `"QA_USE_REGION": "us"` to the `env` section to use the US region for faster tunnel connections from North America. If not set, defaults to automatic region selection.

<details>
  <summary>Claude Code</summary>
    Use the Claude Code CLI to add the QA-Use MCP server (<a href="https://docs.anthropic.com/en/docs/claude-code/mcp">guide</a>):

```bash
claude mcp add desplega-qa -- npx @desplega.ai/qa-use@latest mcp --env QA_USE_API_KEY=your-desplega-ai-api-key
```

For US region (optional):
```bash
claude mcp add desplega-qa -- npx @desplega.ai/qa-use@latest mcp --env QA_USE_API_KEY=your-desplega-ai-api-key --env QA_USE_REGION=us
```

Or add without environment variables and configure them later through the interactive setup:

```bash
claude mcp add desplega-qa -- npx @desplega.ai/qa-use@latest mcp
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
      "args": ["-y", "@desplega.ai/qa-use@latest", "mcp"],
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
codex mcp add desplega-qa -- npx @desplega.ai/qa-use@latest mcp
```

</details>

<details>
  <summary>Copilot / VS Code</summary>
  Follow the MCP install <a href="https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server">guide</a>,
  with the standard config from above. You can also install the QA-Use MCP server using the VS Code CLI:

  ```bash
  code --add-mcp '{"name":"desplega-qa","command":"npx","args":["-y","@desplega.ai/qa-use@latest","mcp"],"env":{"QA_USE_API_KEY":"your-desplega-ai-api-key"}}'
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
      "args": ["-y", "@desplega.ai/qa-use@latest", "mcp"],
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
gemini mcp add desplega-qa npx @desplega.ai/qa-use@latest mcp
```

**Globally:**

```bash
gemini mcp add -s user desplega-qa npx @desplega.ai/qa-use@latest mcp
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
The same way @desplega.ai/qa-use can be configured for JetBrains Junie in `Settings | Tools | Junie | MCP Settings` -> `Add`. Use the config provided above.

</details>

<details>
  <summary>Zed</summary>
  Add to your Zed settings:

```json
{
  "mcpServers": {
    "desplega-qa": {
      "command": "npx",
      "args": ["-y", "@desplega.ai/qa-use@latest", "mcp"],
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

| Feature | stdio (default) | HTTP/SSE | Tunnel |
|---------|----------------|----------|---------|
| **Use Case** | Local MCP clients (Claude Desktop, Cline, etc.) | Web apps, remote access, API integrations | Backend-initiated tasks, CI/CD |
| **Setup** | Configured in MCP client settings | Start server, connect via HTTP | Single command, auto-registers |
| **Authentication** | Via environment variables | Bearer token on each request | Via environment variables |
| **Network** | Local process only | Can be exposed remotely | Tunneled to backend |
| **Protocol** | Native MCP stdio | MCP over HTTP with SSE | WebSocket via localtunnel |
| **Browser** | On-demand | On-demand | Persistent with heartbeat |
| **Best For** | Desktop IDE integrations | Microservices, web dashboards, custom clients | Backend-controlled testing, CI/CD pipelines |

### Starting the HTTP Server

Run the server with the `mcp --http` or `mcp --api` flags:

```bash
# Default port (3000)
npx @desplega.ai/qa-use mcp --http

# Custom port
npx @desplega.ai/qa-use mcp --http --port 8080

# Show help
npx @desplega.ai/qa-use mcp --help
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

### Docker Deployment

The HTTP mode is perfect for containerized deployments. Example Dockerfile:

```dockerfile
FROM node:18-slim

# Install dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
    libgbm1 libasound2 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Install qa-use
RUN npm install -g @desplega.ai/qa-use

# Expose port
EXPOSE 3000

# Set API key via environment variable
ENV QA_USE_API_KEY=your-api-key-here

# Start in HTTP mode
CMD ["qa-use", "mcp", "--http", "--port", "3000"]
```

Run the container:

```bash
docker build -t qa-use .
docker run -d -p 3000:3000 \
  -e QA_USE_API_KEY=your-api-key \
  qa-use
```

### Vercel Deployment

Deploy to Vercel for serverless hosting:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/desplega-ai/qa-use)

**Quick setup:**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Vercel Build Settings:**
- **Build Command**: `bun build`
- **Output Directory**: `dist`
- **Install Command**: `bun install`

**Environment Variables** (set in Vercel dashboard):
- `QA_USE_API_KEY` - Your desplega.ai API key

> **Important**: Vercel has execution time limits (60s max on Pro plan) which may affect long-running SSE connections. For production use with long-running sessions, consider:
> - **Railway** - Better for persistent connections
> - **Render** - Supports long-running services
> - **Fly.io** - Full control over processes
> - **Self-hosted VPS** - No limits

### Unified CLI

All MCP modes are accessed via the `mcp` subcommand:

```bash
# Standard MCP mode (stdio) - default
npx @desplega.ai/qa-use mcp

# HTTP transport mode (SSE)
npx @desplega.ai/qa-use mcp --http

# Tunnel mode (persistent WebSocket)
npx @desplega.ai/qa-use mcp tunnel
```

All modes support the complete MCP tools and functionality. The HTTP mode follows the official MCP Streamable HTTP specification.

## Tunnel Mode

The tunnel mode creates a persistent WebSocket tunnel that allows the desplega.ai backend to initiate browser automation tasks using your local browser. This is perfect for scenarios where you want the backend to control test execution while using your local environment's browser.

### When to Use Tunnel Mode

| Scenario | Best Mode |
|----------|-----------|
| Backend-initiated tests | **Tunnel** |
| CI/CD pipelines with local browsers | **Tunnel** |
| Remote test execution on local environment | **Tunnel** |
| Interactive MCP client testing | **stdio** |
| Web dashboard integrations | **HTTP/SSE** |

### How It Works

1. **Start Tunnel**: Creates a Playwright browser and localtunnel
2. **Register WebSocket**: Sends the tunneled WebSocket URL to desplega.ai backend
3. **Heartbeat**: Sends keepalive signals every 5 seconds to maintain the connection
4. **Backend Control**: Backend can now initiate test sessions using your local browser

### Starting Tunnel Mode

```bash
# Start tunnel with headless browser (default)
npx @desplega.ai/qa-use mcp tunnel

# Start tunnel with visible browser
npx @desplega.ai/qa-use mcp tunnel --visible
```

### Example Output

```
QA-Use Tunnel Mode
====================
Mode: Headless

Validating API key...
API key valid

Starting browser tunnel...
Browser started
Tunnel created

WebSocket URL: wss://qa-use-123456.lt.desplega.ai/...
Registered with backend

Heartbeat active (every 5s)
   Press Ctrl+C to stop

[10:30:15] Heartbeat #1 sent
[10:30:20] Heartbeat #2 sent
[10:30:25] Heartbeat #3 sent
```

### Environment Variables

Set your API key before starting tunnel mode:

```bash
export QA_USE_API_KEY=your-desplega-ai-api-key
npx @desplega.ai/qa-use mcp tunnel
```

Optionally configure the US region for better tunnel performance from North America:

```bash
export QA_USE_API_KEY=your-desplega-ai-api-key
export QA_USE_REGION=us
npx @desplega.ai/qa-use mcp tunnel
```

Alternatively, you can use a config file instead of environment variables. See [Configuration](#configuration) for details.

### Options

- **`--visible`**: Show browser window instead of headless mode (useful for debugging)

### Use Cases

#### 1. CI/CD Integration
Run tunnel mode in your CI/CD pipeline to allow backend-initiated tests:

```yaml
# .github/workflows/qa.yml
- name: Start QA Tunnel
  run: |
    export QA_USE_API_KEY=${{ secrets.QA_USE_API_KEY }}
    npx @desplega.ai/qa-use mcp tunnel &
    sleep 10  # Wait for tunnel to establish
```

#### 2. Development Testing
Keep a tunnel running while developing to allow ad-hoc tests from the backend:

```bash
# Terminal 1: Keep tunnel running
npx @desplega.ai/qa-use mcp tunnel

# Terminal 2: Trigger tests from backend via API/dashboard
# The backend will use your local browser through the tunnel
```

#### 3. Debugging with Visible Browser
When you need to see what's happening:

```bash
npx @desplega.ai/qa-use mcp tunnel --visible
```

### Graceful Shutdown

Press `Ctrl+C` to stop the tunnel. The server will:
1. Stop sending heartbeats
2. Close the tunnel
3. Shutdown the browser
4. Clean up resources

### Differences from Other Modes

| Feature | stdio | HTTP/SSE | **Tunnel** |
|---------|-------|----------|------------|
| **Control** | Local MCP client | HTTP requests | Backend-initiated |
| **Browser** | On-demand | On-demand | **Persistent** |
| **Heartbeat** | N/A | N/A | **Every 5s** |
| **Use Case** | Desktop IDEs | Web apps | **Backend tasks** |
| **Visibility** | Configurable | Configurable | **Headless default** |

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

Create a `.env` file in your project root or set the following environment variables:

```bash
# Required: Your desplega.ai API key
QA_USE_API_KEY=your-desplega-ai-api-key

# Optional: Region selection for tunnel and API routing
# Values: "us" | "auto"
# Default: "auto" (if not set)
# - "us": Uses lt.us.desplega.ai for localtunnel and routes to US region
# - "auto": Uses default lt.desplega.ai and automatic region routing
QA_USE_REGION=us

# Optional: Custom API endpoint (default: https://api.desplega.ai)
QA_USE_API_URL=https://api.desplega.ai

# Optional: Custom app URL (default: https://app.desplega.ai)
QA_USE_APP_URL=https://app.desplega.ai

# Optional: Custom tunnel host (overrides QA_USE_REGION setting)
TUNNEL_HOST=https://lt.desplega.ai
```

#### Regional Configuration

The `QA_USE_REGION` variable allows you to route your tunnel and API requests to specific regions:

- **Not set** (default): Uses automatic region selection (`lt.desplega.ai`)
- **`QA_USE_REGION=us`**: Uses US-based tunnel host (`lt.us.desplega.ai`) and routes sessions to the US region. Recommended for users primarily testing from North America.
- **`QA_USE_REGION=auto`**: Explicitly sets automatic region selection (same as not setting it)

Example configuration for US region:
```bash
export QA_USE_API_KEY=your-api-key
export QA_USE_REGION=us
npx @desplega.ai/qa-use mcp
```

> **Note:** If `QA_USE_REGION` is not set, the system automatically defaults to `"auto"` behavior.

### Configuration File

As an alternative to environment variables, you can store your configuration in `~/.qa-use.json`:

```json
{
  "env": {
    "QA_USE_API_KEY": "your-api-key-here",
    "QA_USE_API_URL": "https://api.desplega.ai",
    "QA_USE_APP_URL": "https://app.desplega.ai",
    "QA_USE_REGION": "us"
  }
}
```

**Priority order:**
1. Environment variables (highest priority)
2. Config file (`~/.qa-use.json`)
3. Default values

This is useful when you don't want to set environment variables or when using MCP clients that don't support environment configuration.

## Security Considerations

When running in HTTP mode:

- **Always use HTTPS** in production (consider using a reverse proxy like nginx)
- **Protect your API key** - it provides full access to your desplega.ai account
- **Use firewall rules** to restrict access to trusted IP addresses
- **Consider rate limiting** for public-facing deployments
- **Monitor access logs** for suspicious activity

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
