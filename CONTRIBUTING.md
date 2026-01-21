# Contributing to QA-Use MCP Server

Welcome! This guide will help you get the project running locally for development.

## Prerequisites

- **Node.js 18+** - Make sure you have Node.js installed
- **bun** - Fast all-in-one JavaScript runtime and package manager
- **Git** - For version control

## Quick Start (For Taras 😊)

```bash
# Clone the repo
git clone <your-repo-url>
cd qa-use-mcp

# Install dependencies
bun install

# Build the project
bun build

# Start development server
bun dev
```

## Development Workflow

### 1. Project Structure

```
qa-use-mcp/
├── src/
│   ├── index.ts          # Entry point
│   └── server.ts         # Main MCP server implementation
├── lib/
│   ├── browser/          # Browser management (Playwright)
│   ├── tunnel/           # Tunneling (localtunnel)
│   └── api/              # API client (desplega.ai)
├── scripts/              # Test scripts
└── dist/                 # Built output
```

### 2. Available Scripts

```bash
# Development
bun dev                  # Start with tsx (hot reload)
bun build               # Build TypeScript to JavaScript
bun start               # Build and run production version

# Code Quality
bun lint                # Run ESLint
bun lint:fix            # Fix linting issues
bun typecheck           # Type check without building
bun format              # Format code with Prettier

# Testing
./scripts/test-tools-list.sh      # List available MCP tools
./scripts/test-init.sh            # Test server initialization
./scripts/test-list-sessions.sh   # Test session listing
./scripts/test-start-session.sh   # Test session creation
```

### 3. Testing the MCP Server

The server implements the Model Context Protocol (MCP) and communicates via stdio. Here's how to test it:

#### Test Available Tools
```bash
./scripts/test-tools-list.sh
```

#### Test Server Initialization
```bash
./scripts/test-init.sh
```

#### Manual Testing with curl/JSON-RPC

You can also test manually by sending JSON-RPC messages:

```bash
# Build first
bun build

# Test tools list
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/src/index.js

# Test init (replace with real API key)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"init_qa_server","arguments":{"apiKey":"your-real-api-key"}}}' | node dist/src/index.js
```

### 4. Using with Claude Desktop

To test with Claude Desktop, add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "qa-use-dev": {
      "command": "node",
      "args": ["/absolute/path/to/qa-use-mcp/dist/src/index.js"],
      "env": {}
    }
  }
}
```

**Important**: Use absolute paths and make sure to build the project first!

### 5. Environment Setup

#### Getting API Keys

1. **desplega.ai API Key**: Sign up at [desplega.ai](https://app.desplega.ai) and get your API key
2. **Test Environment**: The server can work without API keys for basic browser management

#### Setting up Environment Variables

Create a `.env` file in the project root:

```bash
# .env
QA_USE_API_KEY=your-desplega-ai-api-key-here

# Optional: Override default URLs for development/testing
QA_USE_API_URL=http://localhost:3000  # Defaults to https://api.desplega.ai
QA_USE_APP_URL=http://localhost:3001  # Defaults to https://app.desplega.ai
```

Or set the environment variables in your shell:

```bash
export QA_USE_API_KEY=your-desplega-ai-api-key-here
export QA_USE_API_URL=http://localhost:3000  # For local development
export QA_USE_APP_URL=http://localhost:3001  # For local development
```

The server will automatically load the API key from the environment, so you can test initialization without providing the key in the tool call:

```bash
# Test with environment variable
node scripts/mcp-test.js
```

#### Browser Installation

Playwright browsers are installed automatically, but you can force install:

```bash
npx playwright install chromium
```

### 6. Development Tips

#### Hot Reload Development
```bash
# Start with hot reload (recommended for development)
bun dev

# In another terminal, test the server
./scripts/test-tools-list.sh
```

#### Debugging

Add debug logs to your code:

```typescript
console.error('Debug message'); // Use stderr for MCP servers
```

#### Common Issues

1. **Build Errors**: Make sure TypeScript compiles without errors
   ```bash
   bun typecheck
   ```

2. **Module Import Issues**: Ensure all imports use proper file extensions
   ```typescript
   import { something } from './file.js'; // Note the .js extension
   ```

3. **MCP Communication**: Make sure JSON-RPC messages are properly formatted

### 7. Code Style

The project uses:
- **TypeScript** for type safety
- **ESLint** for linting
- **Prettier** for code formatting

Run before committing:
```bash
bun lint:fix
bun format
bun typecheck
```

### 8. Architecture Notes

#### MCP Server Pattern
- Uses `@modelcontextprotocol/sdk` for MCP implementation
- Communicates via stdio transport
- Implements tools as JSON-RPC methods

#### Library Structure
- **Browser lib**: Manages Playwright browser instances
- **Tunnel lib**: Handles localtunnel for public access
- **API lib**: Integrates with desplega.ai platform

#### Session Management
- Each QA session maintains its own browser and tunnel
- Sessions are stored in memory (no persistence)
- Clean shutdown handles resource cleanup

## Deployment

### Publishing to npm

1. Update version in `package.json`
2. Build and test
3. Publish:

```bash
bun build
npm publish
```

### Testing the Published Package

```bash
# Test global installation
npm install -g qa-use-mcp
qa-use-mcp

# Test npx usage
npx qa-use-mcp
```

## Need Help?

- Check the [README.md](./README.md) for basic usage
- Look at the test scripts in `scripts/` for examples
- Check the MCP documentation at [modelcontextprotocol.io](https://modelcontextprotocol.io)

Happy coding! 🚀