#!/usr/bin/env node
/**
 * Script to auto-generate MCP tools documentation for README.md
 *
 * IMPORTANT: Tool definitions below MUST match src/server.ts
 * The script validates that all tools exist in the source code
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Read the server.ts source for validation
const serverPath = join(rootDir, 'src', 'server.ts');
const serverCode = readFileSync(serverPath, 'utf-8');

// Read the README
const readmePath = join(rootDir, 'README.md');
let readme = readFileSync(readmePath, 'utf-8');

// Tool definitions - SINGLE SOURCE OF TRUTH for documentation
// These MUST match the tools defined in src/server.ts
const toolDefinitions = {
  'ensure_installed': {
    description: 'Ensure API key is set, validate authentication, and install Playwright browsers.',
    parameters: [
      { name: 'apiKey', type: 'string', required: false, description: 'API key for desplega.ai (optional if QA_USE_API_KEY env var is set)' }
    ]
  },
  'register_user': {
    description: 'Register a new user account with desplega.ai and receive an API key.',
    parameters: [
      { name: 'email', type: 'string', required: true, description: 'Email address for registration' }
    ]
  },
  'update_configuration': {
    description: 'Update application configuration settings including base URL, login credentials, and viewport type.',
    parameters: [
      { name: 'base_url', type: 'string', required: false, description: 'Base URL for the application being tested' },
      { name: 'login_url', type: 'string', required: false, description: 'Login page URL for the application' },
      { name: 'login_username', type: 'string', required: false, description: 'Default username for login testing' },
      { name: 'login_password', type: 'string', required: false, description: 'Default password for login testing' },
      { name: 'vp_type', type: 'string', required: false, description: 'Viewport configuration type: big_desktop, desktop, mobile, or tablet (default: desktop)' }
    ]
  },
  'get_configuration': {
    description: 'Get the current application configuration details including base URL, login settings, and viewport.',
    parameters: []
  },
  'search_sessions': {
    description: 'Search and list all sessions (automated tests and development sessions) with pagination and filtering.',
    parameters: [
      { name: 'limit', type: 'number', required: false, description: 'Maximum number of sessions to return (default: 10, min: 1)' },
      { name: 'offset', type: 'number', required: false, description: 'Number of sessions to skip (default: 0, min: 0)' },
      { name: 'query', type: 'string', required: false, description: 'Search query to filter sessions by task, URL, or status' }
    ]
  },
  'start_automated_session': {
    description: 'Start an automated E2E test session for QA flows and automated testing. Returns sessionId for monitoring.',
    parameters: [
      { name: 'task', type: 'string', required: true, description: 'The testing task or scenario to execute' },
      { name: 'url', type: 'string', required: false, description: 'Optional URL to test (overrides app config base_url if provided)' },
      { name: 'dependencyId', type: 'string', required: false, description: 'Optional test ID that this session depends on (must be a self test ID created by your app configuration)' },
      { name: 'headless', type: 'boolean', required: false, description: 'Run browser in headless mode (default: false for better visibility)' }
    ]
  },
  'start_dev_session': {
    description: 'Start an interactive development session for debugging and exploration. Session will not auto-pilot and allows manual browser interaction.',
    parameters: [
      { name: 'task', type: 'string', required: true, description: 'Description of what you want to explore or debug. Can be a placeholder like "Waiting for user input"' },
      { name: 'url', type: 'string', required: false, description: 'Optional URL to start from (overrides app config base_url if provided)' },
      { name: 'headless', type: 'boolean', required: false, description: 'Run browser in headless mode (default: false for development visibility)' }
    ]
  },
  'monitor_session': {
    description: 'Monitor a session status. Keep calling until status is "closed". Will alert if session needs user input, is idle, or pending.',
    parameters: [
      { name: 'sessionId', type: 'string', required: true, description: 'The session ID to monitor' },
      { name: 'wait', type: 'boolean', required: false, description: 'Wait for session to reach any non-running state with MCP timeout protection (max 25s per call)' },
      { name: 'timeout', type: 'number', required: false, description: 'User timeout in seconds for wait mode (default: 60)' }
    ]
  },
  'interact_with_session': {
    description: 'Interact with a session - respond to questions, pause, or close the session.',
    parameters: [
      { name: 'sessionId', type: 'string', required: true, description: 'The session ID to interact with' },
      { name: 'action', type: 'string', required: true, description: 'Action to perform: respond (answer question), pause (stop session), or close (end session)' },
      { name: 'message', type: 'string', required: false, description: 'Your response message (required for "respond" action, optional for others)' }
    ]
  },
  'search_automated_tests': {
    description: 'Search for automated tests by ID or query. If testId provided, returns detailed info for that test. Otherwise searches with optional query/pagination.',
    parameters: [
      { name: 'testId', type: 'string', required: false, description: 'Specific test ID to retrieve detailed information for (if provided, other params ignored)' },
      { name: 'query', type: 'string', required: false, description: 'Search query to filter tests by name, description, URL, or task (ignored if testId provided)' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum number of tests to return (default: 10, min: 1) (ignored if testId provided)' },
      { name: 'offset', type: 'number', required: false, description: 'Number of tests to skip (default: 0, min: 0) (ignored if testId provided)' },
      { name: 'self_only', type: 'boolean', required: false, description: 'Filter tests by app configuration. When true, only returns tests created by your application configuration. Default: false to allow running tests from other configs locally.' }
    ]
  },
  'run_automated_tests': {
    description: 'Execute multiple automated tests simultaneously.',
    parameters: [
      { name: 'test_ids', type: 'array', required: true, description: 'Array of test IDs to execute' },
      { name: 'app_config_id', type: 'string', required: false, description: 'Optional app config ID to run tests against (uses API key default config if not provided)' },
      { name: 'ws_url', type: 'string', required: false, description: 'Optional WebSocket URL override (uses global tunnel URL by default)' }
    ]
  },
  'search_automated_test_runs': {
    description: 'Search automated test runs with optional filtering by test ID or run ID.',
    parameters: [
      { name: 'test_id', type: 'string', required: false, description: 'Filter test runs by specific test ID' },
      { name: 'run_id', type: 'string', required: false, description: 'Filter test runs by specific run ID' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum number of test runs to return (default: 10, min: 1)' },
      { name: 'offset', type: 'number', required: false, description: 'Number of tests to skip (default: 0, min: 0)' }
    ]
  }
};

// Categories for grouping
const categories = {
  'Setup & Configuration': ['ensure_installed', 'register_user', 'update_configuration', 'get_configuration'],
  'Session Management': ['search_sessions', 'start_automated_session', 'start_dev_session', 'monitor_session', 'interact_with_session'],
  'Test Management': ['search_automated_tests', 'run_automated_tests', 'search_automated_test_runs']
};

// Validate that all documented tools exist in server.ts
console.log('Validating tool definitions against source code...');
for (const toolName of Object.keys(toolDefinitions)) {
  if (!serverCode.includes(`name: '${toolName}'`)) {
    console.error(`❌ ERROR: Tool '${toolName}' not found in server.ts!`);
    console.error('   Please update src/server.ts or remove from this script.');
    process.exit(1);
  }
}
console.log('✓ All tools validated');

// Generate markdown
function generateToolsMarkdown() {
  let markdown = '## MCP Tools\n\n';
  markdown += 'The server exposes the following MCP tools for browser automation and QA testing:\n\n';

  for (const [category, toolNames] of Object.entries(categories)) {
    markdown += `### ${category}\n\n`;

    for (const toolName of toolNames) {
      const tool = toolDefinitions[toolName];
      if (!tool) {
        console.warn(`Warning: Tool ${toolName} not found in definitions`);
        continue;
      }

      markdown += `#### \`${toolName}\`\n`;
      markdown += `${tool.description}\n\n`;

      if (tool.parameters.length > 0) {
        markdown += '**Parameters:**\n';
        for (const param of tool.parameters) {
          const required = param.required ? 'required' : 'optional';
          markdown += `- \`${param.name}\` (${param.type}, ${required}): ${param.description}\n`;
        }
        markdown += '\n';
      } else {
        markdown += '**Parameters:** None\n\n';
      }
    }
  }

  return markdown;
}

// Find and replace the auto-generated section
const startMarker = '<!-- AUTO-GENERATED-TOOLS-START -->';
const endMarker = '<!-- AUTO-GENERATED-TOOLS-END -->';

const startIndex = readme.indexOf(startMarker);
const endIndex = readme.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find auto-generation markers in README.md');
  process.exit(1);
}

const before = readme.substring(0, startIndex + startMarker.length);
const after = readme.substring(endIndex);

const toolsMarkdown = generateToolsMarkdown();
const newReadme = before + '\n' + toolsMarkdown + after;

writeFileSync(readmePath, newReadme, 'utf-8');

console.log('✅ README.md tools section updated successfully!');
console.log(`📝 Generated documentation for ${Object.keys(toolDefinitions).length} tools across ${Object.keys(categories).length} categories`);
