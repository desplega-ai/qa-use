# QA-Use MCP Server

An MCP (Model Context Protocol) server that provides comprehensive browser automation and QA testing capabilities. This server integrates with desplega.ai to offer automated testing, session monitoring, batch test execution, and intelligent test guidance using AAA (Arrange-Act-Assert) framework templates.

## MCP Client Configuration

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
- **Progress Monitoring**: Real-time progress notifications with MCP timeout protection (25s max per call)
- **Batch Test Execution**: Run multiple automated tests simultaneously with dependency management
- **Interactive Elicitation**: Intelligent prompts when remote sessions need user input to continue
- **Test Discovery**: Search and list automated tests with pagination and filtering
- **Test Run Analytics**: View test execution history with performance metrics and flakiness scores
- **AAA Framework Templates**: Pre-built prompts for login, forms, e-commerce, navigation, and comprehensive testing scenarios
- **User Registration**: Built-in user registration system for new desplega.ai accounts
- **Comprehensive Documentation**: Built-in MCP resources with guides, workflows, and best practices

## Quick Start

### 1. Initialize Server
```
init_qa_server with interactive=true
```
Or with direct API key:
```
init_qa_server with apiKey="your-api-key"
```

### 2. Register New Account (if needed)
```
register_user with email="your-email@example.com"
```

### 3. Configure App Settings (one-time setup)
```
update_app_config with base_url="https://example.com" and login_url="https://example.com/login" and login_username="user@example.com" and vp_type="desktop"
```

### 4. Start Testing Session
```
start_qa_session with task="test the login form"
```
Or with URL override:
```
start_qa_session with url="https://specific-page.com" and task="test specific page"
```

### 5. Monitor Progress (with timeout protection)
```
monitor_qa_session with sessionId="session-id" and wait_for_completion=true and timeout=180
```

### 5. Use AAA Framework Templates
Generate structured test prompts:
```
Use prompt: aaa_login_test with url="https://app.example.com/login"
```

### 6. Run Batch Tests
```
run_automated_tests with test_ids=["test-1", "test-2", "test-3"]
```

### 7. View Test History
```
list_test_runs with test_id="test-123" and limit=20
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

The server exposes comprehensive MCP tools for browser automation and QA testing:

### Core Server Management

#### `init_qa_server`
Initialize the QA server environment with API credentials and browser setup.

**Parameters:**
- `apiKey` (string, optional): API key for desplega.ai (uses env var if not provided)
- `forceInstall` (boolean, optional): Force reinstall of Playwright browsers
- `interactive` (boolean, optional): Enable interactive setup for missing credentials

#### `register_user`
Register a new user account with desplega.ai and receive an API key.

**Parameters:**
- `email` (string, required): Email address for registration

### Session Management

#### `list_qa_sessions`
List QA testing sessions with pagination and search capabilities.

**Parameters:**
- `limit` (number, optional): Maximum sessions to return (default: 10)
- `offset` (number, optional): Number of sessions to skip (default: 0)
- `query` (string, optional): Search query for filtering sessions

#### `start_qa_session`
Start a new QA testing session with browser automation.

**Parameters:**
- `url` (string, optional): The URL to test (uses app config base_url if not provided)
- `task` (string, required): The testing task description
- `dependencyId` (string, optional): Test ID that this session depends on

#### `monitor_qa_session`
Monitor session progress with MCP timeout protection and real-time notifications.

**Parameters:**
- `sessionId` (string, required): The session ID to monitor
- `autoRespond` (boolean, optional): Auto-format response instructions (default: true)
- `wait_for_completion` (boolean, optional): Wait for completion with timeout protection
- `timeout` (number, optional): User timeout in seconds (default: 60, max 25s per MCP call)

#### `interact_with_qa_session`
Interact with a QA session - respond to questions, pause, or close session.

**Parameters:**
- `sessionId` (string, required): The session ID to interact with
- `action` (string, required): Action to perform - "respond", "pause", or "close"
- `message` (string, optional): Your response message (required for "respond" action)

### Test Management

#### `find_automated_test`
Find automated tests by ID or search query. Smart tool that returns detailed info if testId provided, otherwise searches tests.

**Parameters:**
- `testId` (string, optional): Specific test ID to get detailed information (if provided, other params ignored)
- `query` (string, optional): Search query to filter tests by name, description, URL, or task
- `limit` (number, optional): Maximum tests to return (default: 10)
- `offset` (number, optional): Number of tests to skip (default: 0)

#### `run_automated_tests`
Execute multiple automated tests simultaneously with dependency management.

**Parameters:**
- `test_ids` (array, required): Array of test IDs to execute
- `app_config_id` (string, optional): Override app config for this test run

### App Configuration Management

#### `update_app_config`
Update your application configuration settings (one-time setup).

**Parameters:**
- `base_url` (string, optional): Default URL for testing sessions
- `login_url` (string, optional): Login page URL for authentication
- `login_username` (string, optional): Username for login credentials
- `login_password` (string, optional): Password for login credentials
- `vp_type` (string, optional): Viewport type - "mobile" or "desktop" (default: "desktop")

#### `list_app_configs`
List your saved app configurations.

**Parameters:**
- `limit` (number, optional): Maximum configs to return (default: 10)
- `offset` (number, optional): Number of configs to skip (default: 0)

#### `get_current_app_config`
Get details about your current active app configuration.

**Parameters:**
- None (no parameters required)

#### `list_test_runs`
List test run history with performance metrics and filtering capabilities.

**Parameters:**
- `test_id` (string, optional): Filter by specific test ID
- `run_id` (string, optional): Filter by specific run ID
- `limit` (number, optional): Maximum test runs to return (default: 10)
- `offset` (number, optional): Number of test runs to skip (default: 0)

### Built-in Documentation

The server includes comprehensive MCP resources and prompts:

#### MCP Resources
- **Getting Started Guide**: Complete setup and usage instructions
- **Testing Workflows**: Common patterns for interactive, batch, and development testing
- **Session Monitoring Guide**: Best practices for monitoring and timeout management

#### MCP Prompts (AAA Framework Templates)
- **`aaa_login_test`**: Generate login tests using Arrange-Act-Assert framework
- **`aaa_form_test`**: Generate form submission tests with validation
- **`aaa_ecommerce_test`**: Generate e-commerce workflow tests (add to cart, checkout, search)
- **`aaa_navigation_test`**: Generate navigation and menu testing scenarios
- **`comprehensive_test_scenario`**: Generate comprehensive tests for authentication, validation, accessibility, performance, or mobile testing

## Configuration

### Environment Variables

Create a `.env` file in your project root or set the following environment variable:

```bash
QA_USE_API_KEY=your-desplega-ai-api-key
```


## Usage Examples

### Interactive Testing Workflow
```bash
# 1. Initialize server
init_qa_server with interactive=true

# 2. Configure app settings (one-time setup)
update_app_config with base_url="https://app.example.com" and login_url="https://app.example.com/login" and login_username="testuser@example.com"

# 3. Start a test session (URL is now optional)
start_qa_session with task="Test user registration flow"

# 4. Monitor with automatic waiting
monitor_qa_session with sessionId="session-123" and wait_for_completion=true and timeout=300

# 5. Interact with session (respond, pause, or close)
interact_with_qa_session with sessionId="session-123" and action="respond" and message="john.doe@example.com"
```

### Batch Testing Workflow
```bash
# 1. Find available tests
find_automated_test with query="login" and limit=10

# 2. Run multiple tests simultaneously
run_automated_tests with test_ids=["login-test-1", "signup-test-2", "checkout-test-3"]

# 3. Monitor progress
list_qa_sessions with limit=20

# 4. Check test run history
list_test_runs with limit=50
```

### Using AAA Framework Templates
```bash
# Generate a login test using AAA framework
Use prompt: aaa_login_test with url="https://app.example.com/login" and username="testuser" and expected_redirect="/dashboard"

# Generate an e-commerce test
Use prompt: aaa_ecommerce_test with product_url="https://shop.example.com/widget" and workflow_type="add_to_cart" and quantity="2"

# Generate a comprehensive accessibility test
Use prompt: comprehensive_test_scenario with scenario_type="accessibility" and url="https://app.example.com" and browser_type="desktop"
```

### Test Run Analytics
```bash
# View test runs for a specific test
list_test_runs with test_id="login-test-123" and limit=20

# Filter by run status or time period
list_test_runs with limit=50 and offset=0

# Get specific test run details with PFS metrics
list_test_runs with run_id="run-456"
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
