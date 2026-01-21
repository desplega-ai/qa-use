---
date: 2026-01-20T12:00:00Z
updated: 2026-01-21T12:00:00Z
topic: "Test CLI Interface Implementation in qa-use"
author: claude
status: complete
autonomy: verbose
---

# Test CLI Interface Implementation Research

**Goal:** Implement a standalone CLI tool in qa-use that can run test definitions from anywhere - a portable, npm-installable alternative to the Python `be/cli/` that executes tests via the desplega API.

---

## Executive Summary

**Vision:** Users install `qa-use` globally via npm, write test definitions in YAML/JSON, and run them from any directory against the desplega API.

```bash
# Install globally
npm install -g @desplega.ai/qa-use

# Configure API key
qa-use setup

# Run tests from any project
qa-use test run login-flow
qa-use test run --all
qa-use test run checkout --persist
```

> **Update 2026-01-21:** All backend API endpoints are now implemented and available!

The desplega API exposes CLI functionality via `/vibe-qa/cli/*` endpoints:
- `POST /vibe-qa/cli/run` - Execute tests with SSE streaming
- `GET /vibe-qa/cli/export/{test_id}` - Export tests to YAML/JSON
- `POST /vibe-qa/cli/validate` - ✅ Validate test definitions without running
- `POST /vibe-qa/cli/import` - ✅ Create/update tests from definitions
- `GET /vibe-qa/cli/schema` - ✅ Get JSON Schema for IDE tooling

This research documents how to build the CLI interface in qa-use. **Next step:** Implement the qa-use client methods and CLI tool (see Implementation Checklist, Section 7).

---

## 1. CLI Tool Design

### 1.1 Target User Experience

```bash
# Global installation
npm install -g @desplega.ai/qa-use

# Or use npx
npx @desplega.ai/qa-use test run login-flow

# Project-local installation
npm install --save-dev @desplega.ai/qa-use
```

### 1.2 CLI Commands

All test-related commands are grouped under `qa-use test`:

| Command | Description |
|---------|-------------|
| `qa-use test run <test>` | Run a test by name from `qa-tests/` |
| `qa-use test run --id <uuid>` | Run a test by ID from the cloud |
| `qa-use test run --all` | Run all tests in `qa-tests/` |
| `qa-use test list` | List local test definition files |
| `qa-use test list --cloud` | List tests saved in the cloud |
| `qa-use test export <test-id>` | Export a cloud test to local YAML |
| `qa-use test validate <test>` | Validate a test definition without running |
| `qa-use test sync` | Sync local tests with cloud (push/pull) |
| `qa-use test init` | Initialize qa-tests/ and .qa-use.json |

Top-level commands (not under `test`):

| Command | Description |
|---------|-------------|
| `qa-use setup` | Interactive setup - configure API key |
| `qa-use info` | Show current configuration |
| `qa-use serve` | Start MCP server (existing functionality) |

### 1.3 Command Options

```bash
# Run options
qa-use test run login-flow \
  --persist              # Save test to cloud after run
  --no-headless          # Show browser window
  --no-autofix           # Disable AI self-healing
  --screenshots          # Capture screenshots at each step
  --var email=test@x.com # Override variables
  --app-config-id <uuid> # Use specific app config by ID
  --timeout 300          # Timeout in seconds

# Browser tunneling (automatic)
# If the app config's base_url points to localhost (e.g., http://localhost:3000),
# the CLI automatically:
#   1. Launches a local Playwright browser
#   2. Creates a WebSocket tunnel via localtunnel
#   3. Sends ws_url to the API so it can control the local browser
# This is the same behavior as MCP session tools (start_automated_session, etc.)

# List options
qa-use test list --details    # Show step counts, variables, deps
qa-use test list --cloud      # List cloud tests instead of local

# Export options
qa-use test export <id> --format json    # Export as JSON instead of YAML
qa-use test export <id> --no-deps        # Don't include dependencies

# Validate options
qa-use test validate login-flow --strict # Treat warnings as errors
```

### 1.4 Configuration File

Create `.qa-use-tests.json` in project root or home directory:

```json
{
  "api_key": "qau_xxxx",
  "default_app_config_id": "550e8400-e29b-41d4-a716-446655440000",
  "test_directory": "./qa-tests",
  "defaults": {
    "headless": true,
    "persist": false,
    "timeout": 300
  }
}
```

> **Note:** This is separate from `~/.qa-use.json` which is used for MCP server environment variables (`{ "env": {...} }`). The test CLI uses `.qa-use-tests.json` to avoid conflicts.

Environment variables override config file:
- `QA_USE_API_KEY`
- `QA_USE_API_URL`
- `QA_USE_REGION`

### 1.5 Test Definition Directory Structure

```
my-project/
├── .qa-use-tests.json        # Test CLI config (api_key, default_app_config_id, defaults)
├── qa-tests/
│   ├── auth/
│   │   ├── login.yaml        # qa-use test run auth/login
│   │   └── logout.yaml
│   ├── checkout/
│   │   ├── add-to-cart.yaml
│   │   └── complete-order.yaml
│   └── smoke.yaml            # qa-use test run smoke
└── package.json
```

### 1.6 Example Test Definition

```yaml
# qa-tests/auth/login.yaml
name: Login Flow
app_config_id: 550e8400-e29b-41d4-a716-446655440000  # Or omit to use default from .qa-use-tests.json
variables:
  email: test@example.com
  password: secret123
steps:
  - action: goto
    url: /login
  - action: fill
    target: "email input"
    value: "$email"
  - action: fill
    target: "password input"
    value: "$password"
  - action: click
    target: "sign in button"
  - action: to_contain_text
    target: "welcome message"
    value: "Welcome"
```

### 1.7 CLI Output

```bash
$ qa-use test run auth/login

✓ Validated test definition
✓ Connected to desplega API
✓ Browser session started

Running: Login Flow (5 steps)

  [1/5] goto /login .......................... ✓ 0.8s
  [2/5] fill email input ..................... ✓ 0.3s
  [3/5] fill password input .................. ✓ 0.2s
  [4/5] click sign in button ................. ✓ 0.5s
  [5/5] assert welcome message ............... ✓ 0.1s

✓ Test passed in 1.9s

Assets:
  Recording: https://app.desplega.ai/recordings/xxx
```

```bash
$ qa-use test list

Tests in ./test_definitions:

  auth/login          Login Flow              5 steps
  auth/logout         Logout Flow             2 steps
  checkout/add-cart   Add to Cart             4 steps
  checkout/complete   Complete Order          8 steps  (depends: auth/login)

4 tests found
```

```bash
$ qa-use test list --cloud

Cloud tests:

  ID                                    Name              Steps   Last Run
  550e8400-e29b-41d4-a716-446655440000  Login Flow        5       2 hours ago (passed)
  660e8400-e29b-41d4-a716-446655440001  Checkout Flow     8       1 day ago (failed)

2 tests found
```

---

## 2. Current State Analysis

### 2.1 Available API Endpoints (Updated 2026-01-21)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/vibe-qa/cli/run` | POST | Execute test definitions with SSE streaming | ✅ Available |
| `/vibe-qa/cli/export/{test_id}` | GET | Export test to YAML/JSON format | ✅ Available |
| `/vibe-qa/cli/validate` | POST | Validate test definitions without running | ✅ Available |
| `/vibe-qa/cli/import` | POST | Create/update tests from definitions | ✅ Available |
| `/vibe-qa/cli/schema` | GET | Get JSON Schema for IDE tooling | ✅ Available |

Full documentation: https://api.desplega.ai/vibe-qa/cli/docs.md

### 2.2 Current qa-use MCP Tools

| Tool | Purpose |
|------|---------|
| `ensure_installed` | Validate API key, install Playwright browsers |
| `register_user` | Register new user and get API key |
| `search_sessions` | List sessions with pagination |
| `start_automated_session` | Start automated E2E test session |
| `start_dev_session` | Start interactive dev session |
| `monitor_session` | Poll session status |
| `interact_with_session` | Respond/pause/close session |
| `search_automated_tests` | Search DB tests |
| `run_automated_tests` | Run existing DB tests |
| `search_automated_test_runs` | Search test runs |
| `update_configuration` | Update app config |
| `get_configuration` | Get current app config |
| `reset_browser_sessions` | Cleanup all browser sessions |

### 2.3 Current ApiClient Methods

```typescript
// Auth
setApiKey(apiKey: string): void
validateApiKey(apiKey?: string): Promise<AuthResponse>
register(email: string): Promise<RegisterResponse>

// Sessions
createSession(options: CreateSessionOptions): Promise<CreateSessionResponse>
listSessions(options: ListOptions): Promise<TestAgentV2Session[]>
getSession(sessionId: string): Promise<TestAgentV2Session>
sendMessage(options: SendMessageOptions): Promise<any>

// Tests (DB-based only)
listTests(options: ListOptions): Promise<AutomatedTest[]>
getTest(testId: string): Promise<AutomatedTest>
runTests(options: RunTestsOptions): Promise<RunTestsResponse>
listTestRuns(options: ListTestRunsOptions): Promise<TestRun[]>

// Config
updateAppConfig(config: UpdateAppConfigSchema): Promise<UpdateAppConfigResponse>
listAppConfigs(options: ListAppConfigsOptions): Promise<AppConfig[]>
setWsUrl(wsUrl: string): Promise<...>
```

---

## 2. Gap Analysis

### 2.4 Missing Features in qa-use

> **Update 2026-01-21:** The backend API now fully supports all CLI endpoints including validate, import, and schema. The gap analysis below reflects what qa-use client needs to implement.

| Feature | API Support | qa-use Support | Priority |
|---------|-------------|----------------|----------|
| Run test definitions (YAML/JSON) | ✅ `/cli/run` | **Missing** | Critical |
| Export test to YAML/JSON | ✅ `/cli/export` | **Missing** | High |
| SSE streaming for test progress | ✅ Yes | **Missing** | Critical |
| Local test file discovery | N/A (client-side) | **Missing** | High |
| Test definition validation | ✅ `/cli/validate` | **Missing** | High |
| Import/create tests from definitions | ✅ `/cli/import` | **Missing** | High |
| JSON Schema for IDE tooling | ✅ `/cli/schema` | **Missing** | Medium |

### 2.5 Required New ApiClient Methods

```typescript
// CLI methods to add - ALL API ENDPOINTS NOW AVAILABLE
async runCliTest(options: RunCliTestOptions): Promise<SSEStream>
async exportTest(testId: string, format?: 'yaml' | 'json', includeDeps?: boolean): Promise<string>
async validateTestDefinition(definitions: TestDefinition[]): Promise<ValidationResult>
async importTestDefinition(definitions: TestDefinition[], options?: ImportOptions): Promise<ImportResult>
async getTestDefinitionSchema(): Promise<JSONSchema>
```

### 2.6 Required New MCP Tools

| Tool | Purpose | API Status |
|------|---------|------------|
| `run_test_definitions` | Run inline TestDefinitions via SSE | ✅ Ready |
| `export_test` | Export DB test to YAML/JSON | ✅ Ready |
| `validate_test_definition` | Validate without running | ✅ Ready |
| `import_test_definition` | Create test from definition | ✅ Ready |
| `get_test_schema` | Get JSON Schema for IDE tooling | ✅ Ready |
| `list_local_tests` | Discover local test files (client-side) | N/A |

---

## 3. Implementation Plan for qa-use

### 3.1 Phase 1: Core CLI Integration

#### 3.1.1 Add SSE Support to ApiClient

The `/cli/run` endpoint returns Server-Sent Events. Need to add SSE handling:

```typescript
// lib/api/index.ts

export interface RunCliTestOptions {
  test_definitions?: TestDefinition[];
  test_id?: string;
  persist?: boolean;
  headless?: boolean;
  allow_fix?: boolean;
  capture_screenshots?: boolean;
  store_recording?: boolean;
  store_har?: boolean;
  ws_url?: string;
}

export interface SSEEvent {
  event: string;
  data: any;
}

export type SSECallback = (event: SSEEvent) => void;

export interface RunCliTestResult {
  run_id: string;
  status: 'passed' | 'failed' | 'error' | 'cancelled' | 'timeout';
  duration_seconds: number;
  steps: StepResult[];
  assets?: {
    recording_url?: string;
    har_url?: string;
  };
  error?: string;
}

async runCliTest(
  options: RunCliTestOptions,
  onEvent?: SSECallback
): Promise<RunCliTestResult> {
  // Use EventSource or fetch with ReadableStream for SSE
  const response = await fetch(`${this.baseUrl}/vibe-qa/cli/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(options),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result: RunCliTestResult;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const events = parseSSE(chunk);

    for (const event of events) {
      if (onEvent) onEvent(event);

      if (event.event === 'complete' || event.event === 'error') {
        result = event.data;
      }
    }
  }

  return result;
}
```

#### 3.1.2 Add Export Method

```typescript
// lib/api/index.ts

async exportTest(
  testId: string,
  format: 'yaml' | 'json' = 'yaml',
  includeDeps: boolean = true
): Promise<string> {
  const params = new URLSearchParams();
  params.append('format', format);
  if (!includeDeps) params.append('no_deps', 'true');

  const response = await this.client.get(
    `/vibe-qa/cli/export/${testId}?${params.toString()}`
  );

  return response.data;
}
```

#### 3.1.3 Add MCP Tool: run_test_definitions

```typescript
// src/server.ts - new tool

{
  name: 'run_test_definitions',
  description: 'Run tests with inline YAML/JSON TestDefinitions. Returns real-time progress via SSE.',
  inputSchema: {
    type: 'object',
    properties: {
      test_definitions: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of TestDefinitions (include deps, server resolves by ID)'
      },
      test_id: {
        type: 'string',
        description: 'Or run existing DB test by ID'
      },
      persist: {
        type: 'boolean',
        description: 'Save test to DB after run (default: false)'
      },
      headless: {
        type: 'boolean',
        description: 'Run browser in headless mode (default: true)'
      },
      allow_fix: {
        type: 'boolean',
        description: 'Enable AI self-healing (default: true)'
      },
      capture_screenshots: {
        type: 'boolean',
        description: 'Capture screenshots (default: false)'
      }
    }
  }
}
```

#### 3.1.4 Add MCP Tool: export_test

```typescript
{
  name: 'export_test',
  description: 'Export a database test to YAML or JSON format',
  inputSchema: {
    type: 'object',
    properties: {
      test_id: {
        type: 'string',
        description: 'The test ID to export'
      },
      format: {
        type: 'string',
        enum: ['yaml', 'json'],
        description: 'Output format (default: yaml)'
      },
      include_deps: {
        type: 'boolean',
        description: 'Include dependency tests (default: true)'
      }
    },
    required: ['test_id']
  }
}
```

### 3.2 Phase 2: CLI Implementation

#### 3.2.1 New File Structure

```
qa-use/
├── src/
│   ├── cli/
│   │   ├── index.ts          # CLI entry point (commander)
│   │   ├── commands/
│   │   │   ├── test/         # qa-use test <subcommand>
│   │   │   │   ├── index.ts  # Test command group
│   │   │   │   ├── run.ts    # qa-use test run
│   │   │   │   ├── list.ts   # qa-use test list
│   │   │   │   ├── export.ts # qa-use test export
│   │   │   │   ├── validate.ts # qa-use test validate
│   │   │   │   ├── sync.ts   # qa-use test sync
│   │   │   │   └── init.ts   # qa-use test init
│   │   │   ├── setup.ts      # qa-use setup
│   │   │   ├── info.ts       # qa-use info
│   │   │   └── serve.ts      # qa-use serve (MCP server)
│   │   ├── lib/
│   │   │   ├── loader.ts     # Test file discovery & parsing
│   │   │   ├── runner.ts     # Test execution with SSE
│   │   │   ├── output.ts     # Console output formatting
│   │   │   └── config.ts     # .qa-use.json handling
│   │   └── types.ts          # CLI-specific types
│   ├── server.ts             # MCP server (existing)
│   └── index.ts              # Main entry
├── bin/
│   └── qa-use.js             # CLI binary entry
└── package.json              # Add "bin" field
```

#### 3.2.2 Package.json Updates

```json
{
  "name": "@desplega.ai/qa-use",
  "bin": {
    "qa-use": "./bin/qa-use.js"
  },
  "scripts": {
    "cli": "tsx src/cli/index.ts"
  }
}
```

#### 3.2.3 CLI Entry Point

```typescript
// src/cli/index.ts
import { Command } from 'commander';
import { testCommand } from './commands/test/index.js';
import { setupCommand } from './commands/setup.js';
import { infoCommand } from './commands/info.js';
import { serveCommand } from './commands/serve.js';
import { getVersion } from '../utils/package.js';

const program = new Command();

program
  .name('qa-use')
  .description('QA automation tool for desplega.ai')
  .version(getVersion());

// Top-level commands
program.addCommand(setupCommand);
program.addCommand(infoCommand);
program.addCommand(serveCommand);

// Test subcommand group
program.addCommand(testCommand);

program.parse();
```

```typescript
// src/cli/commands/test/index.ts
import { Command } from 'commander';
import { runCommand } from './run.js';
import { listCommand } from './list.js';
import { exportCommand } from './export.js';
import { validateCommand } from './validate.js';
import { syncCommand } from './sync.js';
import { initCommand } from './init.js';

export const testCommand = new Command('test')
  .description('Manage and run test definitions');

testCommand.addCommand(runCommand);
testCommand.addCommand(listCommand);
testCommand.addCommand(exportCommand);
testCommand.addCommand(validateCommand);
testCommand.addCommand(syncCommand);
testCommand.addCommand(initCommand);
```

#### 3.2.4 Browser Tunneling for Local App Configs

When running tests, the CLI must detect if the app config targets localhost and handle browser management accordingly:

```typescript
// src/cli/lib/browser.ts

async function shouldUseTunnel(appConfigId: string, client: ApiClient): Promise<boolean> {
  const config = await client.getAppConfig(appConfigId);
  const baseUrl = config.base_url || '';

  // Detect localhost URLs
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/.test(baseUrl);
}

async function runWithBrowser(options: RunOptions): Promise<RunResult> {
  const needsTunnel = await shouldUseTunnel(options.app_config_id, client);

  if (needsTunnel) {
    // Local app config - launch browser + tunnel
    const browser = await launchBrowser({ headless: options.headless });
    const tunnel = await createTunnel(browser.wsEndpoint());

    try {
      return await client.runCliTest({
        ...options,
        ws_url: tunnel.url,  // API controls our local browser
      });
    } finally {
      await tunnel.close();
      await browser.close();
    }
  } else {
    // Remote app config - API manages its own browser
    return await client.runCliTest(options);
  }
}
```

This mirrors the existing MCP session behavior (`start_automated_session`, `start_dev_session`) where:
- **Local base_url** → CLI launches browser, tunnels WebSocket, API sends commands
- **Remote base_url** → API launches its own browser, no tunnel needed

#### 3.2.5 Run Command Implementation

```typescript
// src/cli/commands/test/run.ts
import { Command } from 'commander';
import { loadTestWithDeps, loadAllTests } from '../../lib/loader.js';
import { runTest, printProgress } from '../../lib/runner.js';
import { loadConfig } from '../../lib/config.js';
import { ApiClient } from '../../../lib/api/index.js';

export const runCommand = new Command('run')
  .description('Run a test definition')
  .argument('[test]', 'Test name or path (e.g., auth/login)')
  .option('--id <uuid>', 'Run cloud test by ID instead of local file')
  .option('--all', 'Run all tests in qa-tests/')
  .option('--persist', 'Save test to cloud after run')
  .option('--no-headless', 'Show browser window')
  .option('--no-autofix', 'Disable AI self-healing')
  .option('--screenshots', 'Capture screenshots at each step')
  .option('--var <key=value...>', 'Variable overrides', collectVars, {})
  .option('--app-config <name>', 'App config to use')
  .option('--timeout <seconds>', 'Timeout in seconds', '300')
  .action(async (test, options) => {
    const config = await loadConfig();
    const client = new ApiClient();
    client.setApiKey(config.api_key);

    let testDefinitions;

    if (options.id) {
      // Run by cloud ID - no local definition needed
      testDefinitions = undefined;
    } else if (options.all) {
      // Load all test definitions
      testDefinitions = await loadAllTests(config.test_directory);
    } else if (test) {
      // Load specific test and its dependencies
      testDefinitions = await loadTestWithDeps(test, config.test_directory);
    } else {
      console.error('Usage: qa-use test run <test-name>');
      console.error('       qa-use test run --id <uuid>');
      console.error('       qa-use test run --all');
      process.exit(1);
    }

    // Apply variable overrides
    if (testDefinitions && Object.keys(options.var).length > 0) {
      applyVariableOverrides(testDefinitions, options.var);
    }

    // Run the test with SSE streaming
    await runTest(client, {
      test_definitions: testDefinitions,
      test_id: options.id,
      persist: options.persist,
      headless: options.headless !== false,
      allow_fix: options.autofix !== false,
      capture_screenshots: options.screenshots,
    }, printProgress);
  });

function collectVars(value: string, previous: Record<string, string>) {
  const [key, val] = value.split('=');
  return { ...previous, [key]: val };
}
```

#### 3.2.6 ID Injection After Persist/Import

When a test is persisted to the cloud, the CLI should update the local YAML file with the returned ID:

```typescript
// src/cli/lib/id-injector.ts
import * as fs from 'fs/promises';
import * as yaml from 'yaml';

export async function injectTestId(filePath: string, testId: string): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const doc = yaml.parseDocument(content);

  // Check if id already exists
  if (doc.get('id')) {
    return; // Already has an ID, don't overwrite
  }

  // Insert id after name (preserve formatting)
  const nameNode = doc.contents?.items?.find(
    (item: any) => item.key?.value === 'name'
  );
  const nameIndex = doc.contents?.items?.indexOf(nameNode) ?? 0;

  doc.contents?.items?.splice(nameIndex + 1, 0,
    doc.createPair('id', testId)
  );

  // Write back preserving comments and formatting
  await fs.writeFile(filePath, doc.toString(), 'utf-8');
}
```

**Usage in run command:**

```typescript
// After successful persist
if (options.persist && result.test_id && testFilePath) {
  await injectTestId(testFilePath, result.test_id);
  console.log(`✓ Test ID ${result.test_id} saved to ${testFilePath}`);
}
```

**Usage in sync command:**

```typescript
// qa-use test sync --push
for (const def of testDefinitions) {
  const result = await client.importTestDefinition([def]);
  if (result.imported[0]?.action === 'created') {
    await injectTestId(def._filePath, result.imported[0].id);
  }
}
```

#### 3.2.7 Test Loader

```typescript
// src/cli/loader.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import { glob } from 'glob';
import type { TestDefinition } from '../types/test-definition.js';

export async function discoverTests(directory: string): Promise<string[]> {
  const pattern = path.join(directory, '**/*.{yaml,yml,json}');
  return glob(pattern);
}

export async function loadTestDefinition(filePath: string): Promise<TestDefinition> {
  const content = await fs.readFile(filePath, 'utf-8');

  if (filePath.endsWith('.json')) {
    return JSON.parse(content);
  }

  return yaml.parse(content);
}

export async function loadTestWithDeps(
  testName: string,
  directory: string
): Promise<TestDefinition[]> {
  const definitions: TestDefinition[] = [];
  const loaded = new Set<string>();

  async function loadRecursive(name: string) {
    if (loaded.has(name)) return;
    loaded.add(name);

    const filePath = resolveTestPath(name, directory);
    const def = await loadTestDefinition(filePath);

    // Load dependencies first
    if (def.depends_on) {
      await loadRecursive(def.depends_on);
    }

    definitions.push(def);
  }

  await loadRecursive(testName);
  return definitions;
}

export function resolveTestPath(testName: string, directory: string): string {
  // Try exact path first
  const extensions = ['.yaml', '.yml', '.json'];

  for (const ext of extensions) {
    const fullPath = path.join(directory, testName + ext);
    // Check if exists...
  }

  throw new Error(`Test not found: ${testName}`);
}
```

### 3.3 Phase 3: MCP Tools (Optional Enhancement)

The MCP tools can wrap the CLI functionality for AI assistants:

```typescript
{
  name: 'list_local_tests',
  description: 'Discover test definition files in the local qa-tests/ directory',
  inputSchema: {
    type: 'object',
    properties: {
      directory: {
        type: 'string',
        description: 'Directory to search (default: ./test_definitions)'
      },
      pattern: {
        type: 'string',
        description: 'Glob pattern for test files (default: **/*.{yaml,yml,json})'
      }
    }
  }
}
```

---

## 4. API Endpoints Reference (Now Implemented)

> **Update 2026-01-21:** All proposed API enhancements have been implemented. This section now serves as a reference for the available endpoints.

### 4.1 Validation Endpoint ✅ IMPLEMENTED

**Purpose:** Validate TestDefinition without running it. Catches errors early.

```
POST /vibe-qa/cli/validate
```

**Request:**
```json
{
  "test_definitions": [
    {
      "name": "Login Flow",
      "app_config_id": "550e8400-e29b-41d4-a716-446655440000",
      "steps": [
        { "action": "goto", "url": "/login" },
        { "action": "fill", "target": "email input", "value": "test@example.com" }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": [
    {
      "path": "test_definitions[0].steps[1]",
      "message": "Consider using a variable for email address",
      "severity": "info"
    }
  ],
  "resolved": {
    "app_config_id": "550e8400-e29b-41d4-a716-446655440000",
    "total_steps": 2,
    "dependencies": []
  }
}
```

**Validation checks:**
- Schema validation (Pydantic)
- app_config_id exists and is accessible by API key's organization
- Variable references ($var) have corresponding definitions
- depends_on references valid test IDs
- Step actions are valid
- Required fields present for each action type (e.g., goto needs url)

### 4.2 Import Endpoint ✅ IMPLEMENTED

**Purpose:** Create/update tests from TestDefinitions (inverse of export).

```
POST /vibe-qa/cli/import
```

**Request:**
```json
{
  "test_definitions": [
    {
      "name": "Login Flow",
      "id": "existing-uuid-or-null",
      "app_config_id": "550e8400-e29b-41d4-a716-446655440000",
      "steps": [...]
    }
  ],
  "upsert": true,
  "dry_run": false
}
```

**Response:**
```json
{
  "success": true,
  "imported": [
    {
      "name": "Login Flow",
      "id": "generated-or-existing-uuid",
      "action": "created"
    }
  ],
  "errors": []
}
```

**Behavior:**
- If `id` is null/missing: create new Test record, return generated ID
- If `id` exists and `upsert=true`: update existing Test
- If `id` exists and `upsert=false`: error
- `dry_run=true`: validate and return what would happen without persisting

### 4.3 Schema Endpoint ✅ IMPLEMENTED

**Purpose:** Return JSON Schema for TestDefinition format.

```
GET /vibe-qa/cli/schema
```

**Response:** Returns JSON Schema (draft-07) with full definitions for:
- `TestDefinition` - Top-level test structure
- `SimpleStep` - Natural language step format
- `ExtendedStep` - Explicit control format with locator chains
- `ActionInstruction` - Action configuration with value strategies
- `LocatorInstruction` - Text-based or method chain locators
- `StepAction` - Enum of all supported actions

**Benefits:**
- IDE autocompletion for YAML/JSON files
- Client-side validation before API calls
- Documentation generation
- Type generation for TypeScript clients

### 4.4 Run Endpoint (Reference)

**Purpose:** Execute test definitions with real-time SSE streaming.

```
POST /vibe-qa/cli/run
```

**Request Parameters:**
- `test_definitions`: Array of TestDefinition objects (max 50)
- `test_id`: UUID to run existing database test
- `persist`: Save test to database (default: false)
- `headless`: Browser visibility (default: true)
- `allow_fix`: Enable AI self-healing (default: true)
- `capture_screenshots`: Pre/post screenshots (default: true)
- `store_recording`: Save browser recording (default: true)
- `store_har`: Save HAR file (default: true)
- `ws_url`: Optional remote browser WebSocket URL

**SSE Events:** `start`, `step_start`, `step_complete`, `complete`, `persisted`

**Limits:** 50 max test definitions, 100 steps per test, 300s timeout

### 4.5 Export Endpoint (Reference)

**Purpose:** Export database tests to YAML or JSON format.

```
GET /vibe-qa/cli/export/{test_id}?format=yaml&no_deps=false
```

Returns test definition with dependencies in multi-document YAML format.

### 4.6 Future Endpoints (Deferred)

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `POST /cli/generate-template` | Generate TestDefinition from session recording | Future |
| `POST /cli/run-batch` | Run multiple tests with parallel execution | Future |

See Appendix E for details on deferred endpoints.

---

## 5. TestDefinition Format Reference

From the API docs, here's the structure qa-use needs to support:

### 5.1 SimpleStep Format (Human-Readable)

```yaml
steps:
  - action: goto
    url: /login
  - action: fill
    target: "email input"
    value: "$email"
  - action: click
    target: "login button"
  - action: to_contain_text
    target: "welcome message"
    value: "Welcome back"
```

**Supported Actions:**
- Navigation: `goto`
- Input: `fill`, `select_option`
- Interaction: `click`, `hover`, `scroll`
- Wait: `wait`
- Assertions: `to_contain_text`, `to_have_url`, `to_be_visible`

### 5.2 ExtendedStep Format (Explicit Control)

```yaml
steps:
  - type: extended
    name: "Fill email field"
    action:
      type: fill
      value: "$email"
      value_strategy: variable
    locator:
      text: "email input field"
      chain:
        - method: getByRole
          args: ["textbox"]
          kwargs: { name: "Email" }
```

### 5.3 AI-Powered Actions

```yaml
steps:
  - action: ai_action
    value: "Complete the checkout process with default shipping"
  - action: ai_assertion
    value: "Verify order confirmation shows correct total"
```

### 5.4 Variables

```yaml
name: Login Test
variables:
  email: test@example.com
  password: secret123
steps:
  - action: fill
    target: "email input"
    value: "$email"
  - action: fill
    target: "password input"
    value: "$password"
```

### 5.5 Dependencies

```yaml
# login.yaml
name: Login Flow
id: login-test-id
steps: [...]

# checkout.yaml
name: Checkout Flow
depends_on: login-test-id
steps: [...]
```

---

## 6. TypeScript Types for qa-use

```typescript
// src/types/test-definition.ts

export type StepAction =
  | 'goto'
  | 'fill'
  | 'click'
  | 'hover'
  | 'scroll'
  | 'select_option'
  | 'wait'
  | 'to_contain_text'
  | 'to_have_url'
  | 'to_be_visible'
  | 'ai_action'
  | 'ai_assertion';

export type ValueStrategy = 'literal' | 'variable' | 'ai';

export interface SimpleStep {
  type?: 'simple';
  action: StepAction;
  target?: string;
  value?: string;
  url?: string;
  timeout?: number;
}

export interface ActionInstruction {
  type: StepAction;
  value?: string;
  value_strategy?: ValueStrategy;
  timeout?: number;
}

export interface LocatorChainItem {
  method: string;
  args?: any[];
  kwargs?: Record<string, any>;
}

export interface LocatorInstruction {
  text?: string;
  chain?: LocatorChainItem[];
}

export interface ExtendedStep {
  type: 'extended';
  name?: string;
  description?: string;
  action: ActionInstruction;
  locator?: LocatorInstruction;
  aaa_phase?: 'arrange' | 'act' | 'assert';
}

export type Step = SimpleStep | ExtendedStep;

export interface TestDefinition {
  name: string;
  id?: string;
  app_config_id?: string;  // UUID of the app config
  variables?: Record<string, string>;
  depends_on?: string;
  steps: Step[];
}

// SSE Event Types
export interface SSEStartEvent {
  run_id: string;
  total_steps: number;
}

export interface SSEStepStartEvent {
  run_id: string;
  step_index: number;
  name: string;
}

export interface SSEStepCompleteEvent {
  run_id: string;
  step_index: number;
  name: string;
  status: 'passed' | 'failed';
  duration: number;
  screenshot_url?: string;
}

export interface SSECompleteEvent {
  run_id: string;
  status: 'passed' | 'failed' | 'error' | 'cancelled' | 'timeout';
  duration_seconds: number;
  assets?: {
    recording_url?: string;
    har_url?: string;
  };
}

export interface SSEErrorEvent {
  run_id: string;
  error: string;
  step_index?: number;
  timeout?: boolean;
}

export interface SSEPersistedEvent {
  run_id: string;
  test_id: string;
}
```

---

## 7. Implementation Checklist

> **Update 2026-01-21:** All backend API endpoints are now available. The checklist below focuses on qa-use client implementation.

### Phase 1: Core API Integration (API Ready ✅)
- [ ] Add `TestDefinition` types to `src/types/test-definition.ts`
- [ ] Add SSE parsing utility to `lib/api/sse.ts`
- [ ] Add `runCliTest()` method to ApiClient (SSE streaming)
- [ ] Add `exportTest()` method to ApiClient
- [ ] Add `validateTestDefinition()` method to ApiClient
- [ ] Add `importTestDefinition()` method to ApiClient
- [ ] Add `getTestSchema()` method to ApiClient

### Phase 2: CLI Tool Implementation
- [ ] Set up CLI structure (`src/cli/`)
- [ ] Add `commander` dependency
- [ ] Add `yaml` parsing dependency
- [ ] Implement config loader (`.qa-use-tests.json`)
- [ ] Implement test file discovery (`loader.ts`)
- [ ] Implement dependency resolution
- [ ] Implement SSE progress output (`runner.ts`, `output.ts`)
- [ ] Implement browser tunneling for local app configs (`browser.ts`)
- [ ] Implement ID injection after persist/import (`id-injector.ts`)
- [ ] Add `bin/qa-use.js` entry point
- [ ] Update `package.json` with `bin` field

### Phase 3: CLI Commands
- [ ] `qa-use setup` - Interactive configuration
- [ ] `qa-use info` - Show configuration
- [ ] `qa-use serve` - Start MCP server
- [ ] `qa-use test init` - Initialize qa-tests/ directory
- [ ] `qa-use test run <test>` - Run local test definition
- [ ] `qa-use test run --id <uuid>` - Run cloud test
- [ ] `qa-use test run --all` - Run all local tests
- [ ] `qa-use test list` - List local tests
- [ ] `qa-use test list --cloud` - List cloud tests
- [ ] `qa-use test export <id>` - Export cloud test to YAML
- [ ] `qa-use test validate <test>` - Validate without running
- [ ] `qa-use test sync` - Bidirectional sync
- [ ] `qa-use test schema` - Download JSON schema for IDE

### Phase 4: MCP Tools (Optional)
- [ ] Add `run_test_definitions` MCP tool (wraps CLI)
- [ ] Add `export_test` MCP tool
- [ ] Add `validate_test_definition` MCP tool
- [ ] Add `import_test_definition` MCP tool
- [ ] Add `get_test_schema` MCP tool
- [ ] Add `list_local_tests` MCP tool

### Phase 5: Polish
- [ ] Add `--watch` mode for auto-rerun
- [ ] Add JUnit XML output for CI (`--output junit`)
- [ ] Add JSON output for agentic tools (`--output json`)
- [ ] Add HTML report generation
- [ ] Documentation and examples

---

## 8. API Status Summary

> **Update 2026-01-21:** All high-priority endpoints are now implemented.

| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `/vibe-qa/cli/run` | POST | ✅ Available | Execute tests with SSE streaming |
| `/vibe-qa/cli/export/{id}` | GET | ✅ Available | Export test to YAML/JSON |
| `/vibe-qa/cli/validate` | POST | ✅ Available | Validate definitions without running |
| `/vibe-qa/cli/import` | POST | ✅ Available | Create/update tests from definitions |
| `/vibe-qa/cli/schema` | GET | ✅ Available | Return JSON Schema for tooling |
| `/vibe-qa/cli/generate-template` | POST | 🔜 Future | Generate definition from session |
| `/vibe-qa/cli/run-batch` | POST | 🔜 Future | Run multiple tests with combined results |

**Next step:** Implement qa-use client methods and CLI tool (see Phase 1-3 checklist above).

---

## 9. Design Decisions (All Resolved)

1. ~~**Config file name:** `.qa-use.json` vs `.qarc` vs `qa-use.config.js`?~~
   **Resolved:** Use `.qa-use-tests.json` for test CLI config, separate from `~/.qa-use.json` (MCP server env vars).

2. ~~**Default test directory:** `qa-tests/` vs `tests/` vs `qa-tests/`?~~
   **Resolved:** `qa-tests/`

3. ~~**ID injection on sync:** Auto-modify YAML files to add cloud IDs? Or separate mapping file?~~
   **Resolved:** Auto-modify YAML files to inject `id` after import/sync:

   ```yaml
   # Before sync (local only)
   name: Login Flow
   app_config_id: 550e8400-...
   steps: [...]

   # After `qa-use test sync --push` or `qa-use test run --persist`
   name: Login Flow
   id: 660e8400-e29b-41d4-a716-446655440001  # Injected by CLI
   app_config_id: 550e8400-...
   steps: [...]
   ```

   **Behavior:**
   - `qa-use test run --persist` → If test has no `id`, inject the returned UUID into the YAML file
   - `qa-use test sync --push` → Import all local tests, inject IDs into files that lack them
   - `qa-use test sync --pull` → Export cloud tests, create/update local YAML files with IDs
   - `qa-use test export <id>` → Always includes the `id` field in output

   **Alternative (mapping file):** Store `{ "auth/login.yaml": "uuid-..." }` in `.qa-use-tests-ids.json` - but this adds complexity and can drift out of sync. Direct YAML modification is simpler.

4. ~~**CLI framework:** `commander` vs `yargs` vs `citty`?~~
   **Resolved:** `commander`

5. ~~**Global vs local install:** Primary use case - global `npm install -g` or project-local?~~
   **Resolved:** Support both - global for quick use, local for CI/CD.

6. ~~**Browser management:** Should CLI start its own browser, or always use API's remote browser?~~
   **Resolved:** Automatic based on app config's `base_url`. If localhost → launch local browser + tunnel `ws_url`. If remote → API manages browser.

7. ~~**Parallel test execution:** Support `--parallel` flag for running multiple tests concurrently?~~
   **Resolved:** Defer to future - requires `run-batch` API endpoint.

8. ~~**CI/CD output:** JUnit XML, TAP, or custom JSON format?~~
   **Resolved:** Both JUnit XML and JSON. Note: CLI is also aimed at agentic coding tools (e.g., Claude Code), so JSON output is important for machine consumption.

9. ~~**Interactive mode:** Should `qa-use run` support interactive prompts mid-test (like dev sessions)?~~
   **Resolved:** No - keep CLI simple and CI-friendly. Use MCP tools for interactive sessions.

---

## Appendix A: SSE Parsing Utility

```typescript
// lib/api/sse.ts

export interface SSEEvent {
  event: string;
  data: any;
  id?: string;
}

export function parseSSE(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = chunk.split('\n');

  let currentEvent: Partial<SSEEvent> = {};

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent.event = line.slice(7);
    } else if (line.startsWith('data: ')) {
      try {
        currentEvent.data = JSON.parse(line.slice(6));
      } catch {
        currentEvent.data = line.slice(6);
      }
    } else if (line.startsWith('id: ')) {
      currentEvent.id = line.slice(4);
    } else if (line === '') {
      if (currentEvent.event && currentEvent.data !== undefined) {
        events.push(currentEvent as SSEEvent);
      }
      currentEvent = {};
    }
  }

  return events;
}

export async function* streamSSE(
  response: Response
): AsyncGenerator<SSEEvent, void, unknown> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = parseSSE(buffer);

    for (const event of events) {
      yield event;
    }

    // Keep incomplete events in buffer
    const lastNewline = buffer.lastIndexOf('\n\n');
    if (lastNewline !== -1) {
      buffer = buffer.slice(lastNewline + 2);
    }
  }
}
```

---

## Appendix B: Example MCP Tool Implementation

```typescript
// src/server.ts - handler for run_test_definitions

case 'run_test_definitions': {
  const params = args as RunTestDefinitionsParams;

  if (!params.test_definitions && !params.test_id) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: 'Either test_definitions or test_id must be provided'
        })
      }]
    };
  }

  // Get browser WebSocket URL if we have a session
  const wsUrl = this.globalTunnel?.getUrl();

  const options: RunCliTestOptions = {
    test_definitions: params.test_definitions,
    test_id: params.test_id,
    persist: params.persist ?? false,
    headless: params.headless ?? true,
    allow_fix: params.allow_fix ?? true,
    capture_screenshots: params.capture_screenshots ?? false,
    ws_url: wsUrl,
  };

  const events: SSEEvent[] = [];

  try {
    const result = await this.globalApiClient.runCliTest(options, (event) => {
      events.push(event);
      // Could emit progress updates here
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: result.status === 'passed',
          result,
          events_count: events.length
        }, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }]
    };
  }
}
```

---

## Appendix C: Comparison with Existing Research

This research builds on the prior CLI API research document (`2026-01-19-cli-api-exposure.md`) which focused on the backend implementation. Key differences:

| Aspect | Backend Research | This Research |
|--------|------------------|---------------|
| Focus | API endpoint design | qa-use client integration |
| Scope | BE implementation details | MCP tools & ApiClient |

---

## Appendix D: Glossary - What is a "Session Recording"?

In desplega, a **session** refers to an AI agent's browser automation session. When a user starts a session (via `start_automated_session` or `start_dev_session`), the system:

1. **Launches a browser** (headless or visible)
2. **AI agent takes control** - navigates, clicks, fills forms based on the task
3. **Records every action** as "blocks" in the session's `data.blocks[]` array
4. **Stores history** of tasks and intents in `data.history[]`

A **session recording** is this captured sequence of actions. Each block contains:
- The action type (click, fill, goto, etc.)
- The target element (locator information)
- The value used (if applicable)
- Screenshots (pre/post action)
- Timing and status information

The **generate-template** concept would convert these recorded blocks back into a portable TestDefinition YAML/JSON file - essentially turning an exploratory AI session into a repeatable, version-controllable test script.

**Example flow:**
```
1. User: "Test the login flow on my app"
2. AI agent explores, clicks around, fills forms
3. Session records: goto /login -> fill email -> fill password -> click submit
4. User: "Export this as a test"
5. System generates:

   name: Login Flow
   steps:
     - action: goto
       url: /login
     - action: fill
       target: "email input"
       value: "$email"
     - action: fill
       target: "password input"
       value: "$password"
     - action: click
       target: "submit button"
```

This is the "record and export" workflow - similar to Playwright's codegen but AI-driven.

---

## Appendix E: Future API Enhancements (Deferred)

These endpoints are valuable but lower priority - to be implemented in future releases:

### E.1 Template Generation (`POST /cli/generate-template`)
Convert session recordings to TestDefinitions. Requires session block data parsing and simplification logic.

### E.2 Batch Operations (`POST /cli/run-batch`)
Run multiple tests with parallel execution and combined reporting. Useful for CI/CD but not essential for initial release.

---

## Appendix F: Comparison with Prior Research

> **Note:** Appendix F previously contained the Claude Code prompt for implementing the backend API endpoints. This has been removed as the endpoints are now fully implemented (2026-01-21).

| Aspect | Backend Research (2026-01-19) | This Research |
|--------|------------------------------|---------------|
| Focus | API endpoint design | qa-use client integration |
| Scope | Backend implementation details | MCP tools, ApiClient, CLI |
| Status | ✅ Complete | Ready for implementation |

The backend research established the API contract; this research documents how qa-use should consume it.
