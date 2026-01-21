# QA-Use MCP Server

MCP server for browser automation and QA testing using Playwright, integrating with desplega.ai.

## Quick Reference

```bash
bun install           # Install dependencies
bun build             # Build TypeScript
bun dev               # Development with hot reload
bun test              # Run tests with bun
bun lint:fix          # Fix linting issues
bun format            # Format code
bun typecheck         # Type check
```

## Tech Stack

- **Runtime**: Node.js 20+, TypeScript, bun
- **MCP**: @modelcontextprotocol/sdk (stdio & HTTP/SSE transports)
- **Browser**: Playwright (Chromium)
- **Tunneling**: @desplega.ai/localtunnel
- **Testing**: Bun test runner

## Architecture

```
src/
├── cli/               # Unified CLI (qa-use command)
│   ├── index.ts       # CLI entry point
│   └── commands/      # CLI subcommands (setup, info, test, mcp)
├── index.ts           # MCP stdio entry point (direct invocation)
├── server.ts          # Main MCP server, tools & session management
├── http-server.ts     # HTTP/SSE transport implementation
├── tunnel-mode.ts     # Persistent WebSocket tunnel mode
└── types.ts           # Type definitions

lib/
├── api/               # desplega.ai API client
├── browser/           # Playwright browser management
├── env/               # Environment & config loading
└── tunnel/            # Localtunnel wrapper
```

## Key Concepts

- **Three modes**: stdio (default MCP), HTTP/SSE (web), tunnel (backend-initiated)
- **BrowserSession**: Wraps browser + tunnel with TTL (30min default), auto-cleanup
- **Max 10 concurrent sessions** with automatic deadline refresh on interaction
- **25s max per MCP call** for timeout protection

## Environment Variables

```bash
QA_USE_API_KEY=xxx      # Required: desplega.ai API key
QA_USE_REGION=us        # Optional: "us" or "auto" (default)
QA_USE_API_URL=xxx      # Optional: API endpoint override
```

Or use `~/.qa-use.json` config file (env vars take precedence).

## Code Style

- ESLint + Prettier configured
- Use `.js` extensions in imports (ESM)
- Debug with `console.error()` (stdout reserved for MCP)
- Run `make all` (format + lint + build) before committing
