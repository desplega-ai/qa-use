# QA-Use MCP Server

An MCP (Model Context Protocol) server that provides browser automation and QA testing capabilities. This server can be used with MCP clients like Claude to perform automated browser testing.

## MCP Client Configuration

Configure this server in your MCP client:

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "desplega-qa": {
      "command": "npx",
      "args": ["-y", "@desplega.ai/qa-use-mcp"],
      "env": {
        "QA_USE_API_KEY": "your-desplega-ai-api-key"
      }
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add desplega-qa npx @desplega.ai/qa-use-mcp --env QA_USE_API_KEY=your-desplega-ai-api-key
```

Or add without the API key first and configure it later:

```bash
claude mcp add desplega-qa npx @desplega.ai/qa-use-mcp
```

### Other MCP Clients

For other MCP clients (Cline, Cursor, etc.), use the standard configuration:

```json
{
  "mcpServers": {
    "desplega-qa": {
      "command": "npx",
      "args": ["-y", "@desplega.ai/qa-use-mcp"],
      "env": {
        "QA_USE_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Features

- **Browser Management**: Launch and control Playwright browser instances
- **Tunneling**: Create public tunnels for browser WebSocket endpoints using localtunnel
- **API Integration**: Connect to desplega.ai API for QA testing workflows
- **Session Management**: Manage multiple QA testing sessions
- **Async Session Monitoring**: Handle sessions that require user input during execution
- **Interactive Elicitation**: Get prompted when remote sessions need your input to continue

## Quick Start

1. **Initialize the server** (with interactive setup):
   ```
   init_qa_server with interactive=true
   ```

2. **Start a QA session**:
   ```
   start_qa_session with url="https://example.com" and task="test the login form"
   ```

3. **Monitor for user input** (sessions may ask questions during execution):
   ```
   monitor_qa_session with sessionId="session-id" and autoRespond=true
   ```

4. **Respond when prompted**:
   ```
   respond_to_qa_session with sessionId="session-id" and response="your answer"
   ```

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

## MCP Tools

The server exposes the following MCP tools:

### `init_qa_server`

Initialize the QA server environment with API credentials.

**Parameters:**
- `apiKey` (string, required): API key for desplega.ai
- `forceInstall` (boolean, optional): Force reinstall of Playwright browsers

### `list_qa_sessions`

List all active QA testing sessions.

### `get_qa_session`

Get detailed information about a specific QA session.

**Parameters:**
- `sessionId` (string, required): The session ID to retrieve

### `start_qa_session`

Start a new QA testing session with browser automation.

**Parameters:**
- `url` (string, required): The URL to test
- `task` (string, required): The testing task description
- `mode` (string, optional): Testing mode - "fast", "normal", or "max"
- `headless` (boolean, optional): Run browser in headless mode

### `send_message_to_qa_session`

Send control messages to an active session.

**Parameters:**
- `sessionId` (string, required): The session ID
- `action` (string, required): Action to perform - "pause", "response", or "close"
- `data` (string, optional): Additional message data

## Configuration

### Environment Variables

Create a `.env` file in your project root or set the following environment variable:

```bash
QA_USE_API_KEY=your-desplega-ai-api-key
```

### MCP Client Configuration

To use this server with MCP clients like Claude Desktop, add the following to your MCP client configuration:

#### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "qa-use": {
      "command": "npx",
      "args": ["-y", "qa-use-mcp"],
      "capabilities": ["tools"],
      "env": {
        "QA_USE_API_KEY": "your-desplega-ai-api-key"
      }
    }
  }
}
```

Alternatively, if you have the API key in your system environment:

```json
{
  "mcpServers": {
    "qa-use": {
      "command": "npx",
      "args": ["-y", "qa-use-mcp"],
      "capabilities": ["tools"]
    }
  }
}
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

- **`src/`**: Main MCP server implementation
- **`lib/browser/`**: Browser management functionality using Playwright
- **`lib/tunnel/`**: Tunneling and port forwarding using localtunnel
- **`lib/api/`**: API client for desplega.ai integration

## License

ISC
