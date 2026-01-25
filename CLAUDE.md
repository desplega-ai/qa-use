# QA-Use MCP Server

MCP server for browser automation and QA testing using Playwright, integrating with desplega.ai.

## Quick Reference

**IMPORTANT: Always use `bun`, never `npm` or `yarn`.**

```bash
bun install           # Install dependencies
bun run build         # Build TypeScript
bun run dev           # Development with hot reload
bun test              # Run tests with bun
bun run lint:fix      # Fix linting issues
bun run format        # Format code
bun run typecheck     # Type check
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

## Browser CLI & REPL Sync

**IMPORTANT:** When modifying browser commands in `src/cli/commands/browser/*.ts`, also update the REPL in `src/cli/commands/browser/run.ts`, and vice versa. They share the same functionality:

- CLI: `qa-use browser <command>` (individual command files)
- REPL: `qa-use browser run` then `<command>` (commands object in run.ts)

Both must support the same options and behavior.

## E2E Testing with Browser API CLI

Use this flow to manually test browser API functionality against a local backend.

**Note:** The `.qa-use-tests.json` file is pre-configured with localhost:5005 and a valid API key. No env setup needed - just run commands directly.

```bash
# No env setup required - .qa-use-tests.json handles it

# Create a browser session (--no-headless to see the browser)
bun run cli browser create --no-headless

# Navigate to test site
bun run cli browser goto https://evals.desplega.ai/

# Get page snapshot (shows ARIA tree with element refs)
bun run cli browser snapshot

# Click an element by ref (e.g., e31 for Buttons Demo link)
bun run cli browser click e31

# Or click by text (AI-based semantic selection)
bun run cli browser click --text "Home"

# Take a screenshot
bun run cli browser screenshot /tmp/screenshot.png

# Get session status (shows app_url for web UI)
bun run cli browser status

# Close the session
bun run cli browser close

# After closing, fetch logs
bun run cli browser logs console -s <session-id>
bun run cli browser logs network -s <session-id>
```

**Test site:** https://evals.desplega.ai/ has various UI components (buttons, checkboxes, forms, etc.) for testing browser interactions.
