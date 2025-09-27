# PRD: QA-Use MCP Server

## What is it?
An **npx executable MCP server** that provides browser automation and QA testing capabilities through the Model Context Protocol. It exposes browser management, tunneling, and API connection functionalities to MCP clients like Claude.

## Architecture
- **MCP Server**: Implements the Model Context Protocol for tool-based interactions
- **npx Executable**: Can be installed and run globally via `npx qa-use-mcp`
- **Library Structure**: Core functionalities organized in `lib/` for reusability
- **TypeScript + pnpm**: Modern build system with TypeScript and pnpm package manager

## Core Features

### Browser Management (lib/browser)
- Playwright browser instance management
- Browser lifecycle control (start/stop/restart)
- Browser session isolation and configuration

### Tunneling (lib/tunnel)
- Port forwarding using localtunnel
- WebSocket endpoint exposure for remote access
- Secure tunnel management and cleanup

### API Integration (lib/api)
- desplega.ai API connection and authentication
- WebSocket communication for real-time updates
- Session management and status reporting

## MCP Tools

The server exposes the following MCP tools:

### 1. `init_qa_server`
**Description**: Initialize QA server environment
**Actions**:
- Install Playwright browsers if needed
- Validate API key configuration
- Start browser forwarding setup

### 2. `list_qa_sessions`
**Description**: List all active QA testing sessions
**Returns**: Array of session objects with status and metadata

### 3. `get_qa_session`
**Description**: Get detailed information about a specific QA session
**Parameters**: `sessionId` (string)
**Returns**: Session details including browser state, tunnel info, and logs

### 4. `start_qa_session`
**Description**: Start a new QA testing session
**Returns**: Session ID and connection details

### 5. `send_message_to_qa_session`
**Description**: Send control messages to an active session
**Parameters**:
- `sessionId` (string)
- `action` (enum): `pause`, `response`, `close`
- `data` (optional): Additional message data

## Tech Stack

### Core Dependencies
- **@modelcontextprotocol/sdk** - MCP server implementation
- **Playwright** - Browser automation
- **localtunnel** - Port forwarding
- **TypeScript** - Type safety and modern JS features
- **pnpm** - Fast, efficient package manager

### Build System
- **TypeScript Compiler** - Compilation to JavaScript
- **pnpm scripts** - Build, dev, and packaging workflows
- **ESM modules** - Modern module system

## Project Structure
```
qa-use-mcp/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── server.ts         # Main MCP server implementation
│   └── tools/            # MCP tool implementations
├── lib/
│   ├── browser/          # Browser management functionality
│   ├── tunnel/           # Tunneling and port forwarding
│   └── api/              # API connection and communication
├── package.json          # pnpm configuration with bin entry
├── tsconfig.json         # TypeScript configuration
└── README.md             # Usage and setup instructions
```

## Configuration
- Environment variables or config file for API keys
- Runtime configuration for browser options
- MCP server capabilities declaration

## Installation & Usage
```bash
# Install and run directly
npx qa-use-mcp

# Or install globally
npm install -g qa-use-mcp
qa-use-mcp
```

The server connects via stdio transport and exposes tools to MCP clients for browser automation and QA testing workflows.
