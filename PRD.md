# PRD: QA-Use

## What is it?
A CLI tool that connects local development environments to the desplega.ai platform for automated QA testing and monitoring.

## Core Features

### Browser Management
- Spin up a local Playwright browser instance
- Port forward the browser WebSocket endpoint using localtunnel
- Provide remote access to the browser for automated testing

### API Integration
- Connect to desplega.ai API with authentication (API key required)
- Establish WebSocket connection for real-time communication
- Send/receive testing commands and results
- Optional: Open registration page in browser if no API key configured

### Git Integration
- Monitor local git repository for file changes
- Generate AI-powered summaries of code changes
- Automatically notify desplega.ai of relevant updates

## User Flow
1. User runs `qa-use init` to configure API credentials
   - If no desplega.ai API key found, optionally opens `app.desplega.ai/register`
   - Prompts for API keys (desplega.ai + AI provider)
2. User runs `qa-use start` to begin monitoring
3. Tool launches browser, establishes connections, and monitors git
4. On file changes, tool summarizes changes and sends to desplega.ai
5. desplega.ai can trigger tests via the exposed browser instance

## Tech Stack

### Core Dependencies
- **Node.js** - Runtime environment
- **Playwright 1.55.0** - Browser automation and WebSocket management
- **localtunnel** - Port forwarding for browser WebSocket endpoint
- **tasuku** - Async task management and progress display
- **ink** - Interactive CLI interface components

### AI Integration
- **Vercel AI SDK** - Unified interface for multiple AI providers
- **Supported providers** (in order of priority):
  1. OpenRouter API
  2. OpenAI API
  3. Anthropic API
  4. Gemini API

### Additional Libraries
- **chokidar** - File system monitoring for git changes
- **ws** - WebSocket client for desplega.ai connection
- **commander** - CLI argument parsing

## Configuration
- Config file: `~/.qa-use/config.json`
- Required: API key for desplega.ai and chosen AI provider
- Optional: Custom browser launch options, file watch patterns

### Environment Support
- **Production**: `api.desplega.ai` (default)
- **Local Development**: `localhost:3000` or custom endpoint
- Registration URL: `app.desplega.ai/register`

### API Configuration
```json
{
  "apiUrl": "https://api.desplega.ai",
  "apiKey": "your-api-key",
  "aiProvider": "openrouter",
  "aiApiKey": "your-ai-key"
}
```
