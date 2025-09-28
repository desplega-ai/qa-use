import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  CallToolResult,
  TextContent,
  ProgressToken,
  Resource,
  Prompt,
} from '@modelcontextprotocol/sdk/types.js';

import { BrowserManager } from '../lib/browser/index.js';
import { TunnelManager } from '../lib/tunnel/index.js';
import { ApiClient } from '../lib/api/index.js';
import { getName, getVersion } from './utils/package.js';

// TypeScript interfaces based on Python models
interface UserInputIntent {
  question?: string;
  priority?: string;
  reasoning?: string;
  memory?: unknown;
  confidence?: string;
  description?: string;
  tasks_pending?: boolean;
  previous_step_analysis?: string;
}

interface SessionData {
  status?: string;
  wsUrl?: string;
  url?: string;
  task?: string;
  pending_user_input?: UserInputIntent;
  last_done?: unknown;
  liveview_url?: string;
  test_id?: string;
  agent_id?: string;
  blocks?: unknown[];
  history?: unknown[];
  model_name?: string;
  recording_path?: string;
  app_config_id?: string;
  organization_id?: string;
  dependency_test_ids?: string[];
}

interface QASessionResponse {
  id: string;
  status: string;
  createdAt: string;
  data?: SessionData;
  source?: string;
}

interface InitQaServerParams {
  apiKey?: string;
  forceInstall?: boolean;
  interactive?: boolean;
}

interface RegisterUserParams {
  email: string;
}

interface ListQaSessionsParams {
  limit?: number;
  offset?: number;
  query?: string;
}

interface StartQaSessionParams {
  url?: string;
  task: string;
  dependencyId?: string;
}

interface MonitorQaSessionParams {
  sessionId: string;
  autoRespond?: boolean;
  wait_for_completion?: boolean;
  timeout?: number;
}

interface InteractWithQaSessionParams {
  sessionId: string;
  action: 'respond' | 'pause' | 'close';
  message?: string;
}

interface FindAutomatedTestParams {
  testId?: string;
  query?: string;
  limit?: number;
  offset?: number;
}

interface RunAutomatedTestsParams {
  test_ids: string[];
  ws_url?: string;
  app_config_id?: string;
}

interface ListTestRunsParams {
  test_id?: string;
  run_id?: string;
  limit?: number;
  offset?: number;
}

type ViewportConfigType = 'big_desktop' | 'desktop' | 'mobile' | 'tablet';

interface UpdateAppConfigParams {
  base_url?: string;
  login_url?: string;
  login_username?: string;
  login_password?: string;
  vp_type?: ViewportConfigType;
}

interface ListAppConfigsParams {
  limit?: number;
  offset?: number;
  query?: string;
}

interface SessionSummary {
  id: string;
  status: string;
  createdAt: string;
  data: {
    status?: string;
    url?: string;
    task?: string;
    test_id?: string;
    agent_id?: string;
    liveview_url?: string;
    hasPendingInput: boolean;
    lastActivity: string;
    historyCount: number;
    blocksCount: number;
  };
  source?: string;
  note: string;
}

interface SessionDetails {
  id: string;
  status: string;
  createdAt: string;
  data: {
    status?: string;
    url?: string;
    task?: string;
    test_id?: string;
    agent_id?: string;
    liveview_url?: string;
    pending_user_input?: UserInputIntent;
    last_done?: unknown;
    model_name?: string;
    recording_path?: string;
    dependency_test_ids?: string[];
    history: unknown[];
    historyNote?: string;
    blocks: unknown[];
    blocksNote?: string;
  };
  source?: string;
}

interface TestSummary {
  id: string;
  name: string;
  description?: string;
  url?: string;
  task?: string;
  status?: string;
  created_at: string;
  dependency_test_ids?: string[];
  note: string;
}

interface StartSessionResult {
  success: boolean;
  message: string;
  sessionId: string;
  note: string;
  session: {
    id: string;
    status: string;
    createdAt: string;
    data: {
      agent_id?: string;
      test_id?: string;
      url?: string;
      task?: string;
      status?: string;
      liveview_url?: string;
      dependency_test_ids?: string[];
    };
    source?: string;
  };
}

class QAUseMcpServer {
  private server: Server;
  private globalApiClient: ApiClient;
  private browserManager: BrowserManager | null = null;
  private tunnelManager: TunnelManager | null = null;

  constructor() {
    this.server = new Server(
      {
        name: getName(),
        version: getVersion(),
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.globalApiClient = new ApiClient();
    this.setupTools();
    this.setupResources();
    this.setupPrompts();
  }

  private createSessionSummary(session: QASessionResponse): SessionSummary {
    return {
      id: session.id,
      status: session.status,
      createdAt: session.createdAt,
      data: {
        status: session.data?.status,
        url: session.data?.url,
        task:
          session.data?.task && session.data.task.length > 50
            ? session.data.task.substring(0, 50) + '...'
            : session.data?.task,
        test_id: session.data?.test_id,
        agent_id: session.data?.agent_id,
        liveview_url: session.data?.liveview_url,
        hasPendingInput: !!session.data?.pending_user_input,
        lastActivity: session.data?.last_done ? 'Recent activity available' : 'No recent activity',
        historyCount: session.data?.history?.length ?? 0,
        blocksCount: session.data?.blocks?.length ?? 0,
      },
      source: session.source,
      note: 'Use monitor_qa_session for full details including history and blocks',
    };
  }

  private createSessionDetails(session: QASessionResponse): SessionDetails {
    const result = {
      id: session.id,
      status: session.status,
      createdAt: session.createdAt,
      data: {
        status: session.data?.status,
        url: session.data?.url,
        task: session.data?.task,
        test_id: session.data?.test_id,
        agent_id: session.data?.agent_id,
        liveview_url: session.data?.liveview_url,
        pending_user_input: session.data?.pending_user_input,
        last_done: session.data?.last_done,
        model_name: session.data?.model_name,
        recording_path: session.data?.recording_path,
        dependency_test_ids: session.data?.dependency_test_ids,
        // Limit history to last 5 entries
        history: session.data?.history?.slice(-5) ?? [],
        historyNote:
          session.data?.history && session.data.history.length > 5
            ? `Showing last 5 of ${session.data.history.length} total history entries`
            : undefined,
        // Limit blocks to last 10 entries
        blocks: session.data?.blocks?.slice(-10) ?? [],
        blocksNote:
          session.data?.blocks && session.data.blocks.length > 10
            ? `Showing last 10 of ${session.data.blocks.length} total blocks`
            : undefined,
      },
      source: session.source,
    };
    return result;
  }

  private createTestSummary(test: {
    id: string;
    name: string;
    description?: string;
    url?: string;
    task?: string;
    status?: string;
    created_at: string;
    dependency_test_ids?: string[];
  }): TestSummary {
    return {
      id: test.id,
      name: test.name,
      description:
        test.description && test.description.length > 60
          ? test.description.substring(0, 60) + '...'
          : test.description,
      url: test.url,
      task: test.task && test.task.length > 60 ? test.task.substring(0, 60) + '...' : test.task,
      status: test.status,
      created_at: test.created_at,
      dependency_test_ids: test.dependency_test_ids,
      note: 'Use find_automated_test({testId: "specific-id"}) for full details',
    };
  }

  private setupTools(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'init_qa_server',
            description:
              'Initialize QA server environment and start browser. Browser runs in visible mode for better debugging.',
            inputSchema: {
              type: 'object',
              properties: {
                apiKey: {
                  type: 'string',
                  description:
                    'API key for desplega.ai (optional if QA_USE_API_KEY env var is set)',
                },
                forceInstall: {
                  type: 'boolean',
                  description: 'Force reinstall of Playwright browsers',
                },
                interactive: {
                  type: 'boolean',
                  description: 'Enable interactive mode for API key setup if not provided',
                },
              },
              required: [],
            },
          },
          {
            name: 'register_user',
            description: 'Register a new user and get API key',
            inputSchema: {
              type: 'object',
              properties: {
                email: {
                  type: 'string',
                  description: 'Email address to register',
                },
              },
              required: ['email'],
            },
          },
          {
            name: 'list_qa_sessions',
            description: 'List QA testing sessions with pagination and search',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of sessions to return (default: 10, min: 1)',
                  minimum: 1,
                },
                offset: {
                  type: 'number',
                  description: 'Number of sessions to skip (default: 0, min: 0)',
                  minimum: 0,
                },
                query: {
                  type: 'string',
                  description: 'Search query to filter sessions by task, URL, or status',
                },
              },
            },
          },
          {
            name: 'start_qa_session',
            description:
              'Start a new QA testing session. Returns sessionId (data.agent_id) for subsequent operations. URL is optional - if not provided, uses the app config base_url. Use update_app_config to set login credentials and base URL first.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'Optional URL to test (overrides app config base_url if provided)',
                },
                task: {
                  type: 'string',
                  description: 'The testing task description',
                },
                dependencyId: {
                  type: 'string',
                  description: 'Optional test ID that this session depends on',
                },
              },
              required: ['task'],
            },
          },
          {
            name: 'monitor_qa_session',
            description:
              'Monitor a session for pending user input and track completion. Keep calling until status is "closed" or "idle". Use wait_for_completion to automatically wait.',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'The session ID to monitor',
                },
                autoRespond: {
                  type: 'boolean',
                  description:
                    'Automatically check for pending input and format response instructions',
                },
                wait_for_completion: {
                  type: 'boolean',
                  description:
                    'Wait for session to complete (closed/idle) with MCP timeout protection (max 25s per call)',
                },
                timeout: {
                  type: 'number',
                  description:
                    'User timeout in seconds for wait_for_completion (default: 60). Note: MCP timeout protection limits each call to 25s max.',
                  minimum: 1,
                },
              },
              required: ['sessionId'],
            },
          },
          {
            name: 'interact_with_qa_session',
            description:
              'Interact with a QA session - respond to questions, pause, or close session',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'The session ID to interact with',
                },
                action: {
                  type: 'string',
                  enum: ['respond', 'pause', 'close'],
                  description:
                    'Action to perform: respond (answer question), pause (stop session), or close (end session)',
                },
                message: {
                  type: 'string',
                  description:
                    'Your response message (required for "respond" action, optional for others)',
                },
              },
              required: ['sessionId', 'action'],
            },
          },
          {
            name: 'find_automated_test',
            description:
              'Find automated tests by ID or search query. If testId provided, returns detailed info for that test. Otherwise searches with optional query/pagination.',
            inputSchema: {
              type: 'object',
              properties: {
                testId: {
                  type: 'string',
                  description:
                    'Specific test ID to retrieve detailed information for (if provided, other params ignored)',
                },
                query: {
                  type: 'string',
                  description:
                    'Search query to filter tests by name, description, URL, or task (ignored if testId provided)',
                },
                limit: {
                  type: 'number',
                  description:
                    'Maximum number of tests to return (default: 10, min: 1) (ignored if testId provided)',
                  minimum: 1,
                },
                offset: {
                  type: 'number',
                  description:
                    'Number of tests to skip (default: 0, min: 0) (ignored if testId provided)',
                  minimum: 0,
                },
              },
            },
          },
          {
            name: 'run_automated_tests',
            description:
              'Execute multiple automated tests simultaneously. Uses the global browser WebSocket URL from init_qa_server.',
            inputSchema: {
              type: 'object',
              properties: {
                test_ids: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  description: 'Array of test IDs to execute',
                  minItems: 1,
                },
                ws_url: {
                  type: 'string',
                  description:
                    'Optional WebSocket URL override (uses global tunnel URL by default)',
                },
                app_config_id: {
                  type: 'string',
                  description:
                    'Optional app config ID to run tests against (uses API key default config if not provided)',
                },
              },
              required: ['test_ids'],
            },
          },
          {
            name: 'list_test_runs',
            description: 'List test runs with optional filtering by test ID or run ID',
            inputSchema: {
              type: 'object',
              properties: {
                test_id: {
                  type: 'string',
                  description: 'Filter test runs by specific test ID',
                },
                run_id: {
                  type: 'string',
                  description: 'Filter test runs by specific run ID',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of test runs to return (default: 10, min: 1)',
                  minimum: 1,
                },
                offset: {
                  type: 'number',
                  description: 'Number of test runs to skip (default: 0, min: 0)',
                  minimum: 0,
                },
              },
            },
          },
          {
            name: 'update_app_config',
            description:
              'Update app configuration settings (base URL, login settings, viewport type)',
            inputSchema: {
              type: 'object',
              properties: {
                base_url: {
                  type: 'string',
                  description: 'Base URL for the application being tested',
                },
                login_url: {
                  type: 'string',
                  description: 'Login page URL for the application',
                },
                login_username: {
                  type: 'string',
                  description: 'Default username for login testing',
                },
                login_password: {
                  type: 'string',
                  description: 'Default password for login testing',
                },
                vp_type: {
                  type: 'string',
                  enum: ['big_desktop', 'desktop', 'mobile', 'tablet'],
                  description: 'Viewport configuration type for browser testing (default: desktop)',
                },
              },
            },
          },
          {
            name: 'list_app_configs',
            description: 'List app configurations with pagination and search filtering',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of app configs to return (default: 10, min: 1)',
                  minimum: 1,
                },
                offset: {
                  type: 'number',
                  description: 'Number of app configs to skip (default: 0, min: 0)',
                  minimum: 0,
                },
                query: {
                  type: 'string',
                  description: 'Search query to filter app configs by name, base URL, or status',
                },
              },
            },
          },
          {
            name: 'get_current_app_config',
            description:
              'Get the current app configuration details (equivalent to /check endpoint)',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: params } = request.params;

      if (name === 'init_qa_server') {
        return this.handleInitQaServer(params as unknown as InitQaServerParams);
      }

      if (name === 'register_user') {
        return this.handleRegisterUser(params as unknown as RegisterUserParams);
      }

      if (name === 'list_qa_sessions') {
        return this.handleListQaSessions(params as unknown as ListQaSessionsParams);
      }

      if (name === 'start_qa_session') {
        return this.handleStartQaSession(params as unknown as StartQaSessionParams);
      }

      if (name === 'monitor_qa_session') {
        return this.handleMonitorQaSession(params as unknown as MonitorQaSessionParams);
      }

      if (name === 'interact_with_qa_session') {
        return this.handleInteractWithQaSession(params as unknown as InteractWithQaSessionParams);
      }

      if (name === 'find_automated_test') {
        return this.handleFindAutomatedTest(params as unknown as FindAutomatedTestParams);
      }

      if (name === 'run_automated_tests') {
        return this.handleRunAutomatedTests(params as unknown as RunAutomatedTestsParams);
      }

      if (name === 'list_test_runs') {
        return this.handleListTestRuns(params as unknown as ListTestRunsParams);
      }

      if (name === 'update_app_config') {
        return this.handleUpdateAppConfig(params as unknown as UpdateAppConfigParams);
      }

      if (name === 'list_app_configs') {
        return this.handleListAppConfigs(params as unknown as ListAppConfigsParams);
      }

      if (name === 'get_current_app_config') {
        return this.handleGetCurrentAppConfig();
      }

      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
    });
  }

  private async handleInitQaServer(params: InitQaServerParams): Promise<CallToolResult> {
    try {
      const { apiKey, forceInstall, interactive } = params;
      const headless = false; // Always run in visible mode for better debugging

      // Use provided API key or fall back to environment variable
      if (apiKey) {
        this.globalApiClient.setApiKey(apiKey);
      } else if (!this.globalApiClient.getApiKey()) {
        if (interactive) {
          return {
            content: [
              {
                type: 'text',
                text: `🚀 Welcome to QA-Use MCP Server!

To get started, you need an API key from desplega.ai.

**Do you already have an API key?**

**Option 1: I have an API key**
Run: \`{"method": "tools/call", "params": {"name": "init_qa_server", "arguments": {"apiKey": "your-api-key-here"}}}\`

**Option 2: I need to register**
If you don't have an account yet, you can register with your email:
Run: \`{"method": "tools/call", "params": {"name": "register_user", "arguments": {"email": "your-email@example.com"}}}\`

After registration, you'll receive an API key that you can use in Option 1.`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: 'No API key provided and QA_USE_API_KEY environment variable not set. Please provide an API key, set the environment variable, or use interactive=true for setup assistance.',
              },
            ],
            isError: true,
          };
        }
      }

      const authResult = await this.globalApiClient.validateApiKey();
      if (!authResult.success) {
        return {
          content: [
            {
              type: 'text',
              text: `API key validation failed: ${authResult.message}`,
            },
          ],
          isError: true,
        };
      }

      // Initialize BrowserManager
      this.browserManager = new BrowserManager();

      if (forceInstall) {
        await this.browserManager.installPlaywrightBrowsers();
      }

      // Start the browser
      const browserSession = await this.browserManager.startBrowser({ headless });
      const wsEndpoint = browserSession.wsEndpoint;

      // Initialize TunnelManager and create tunnel for browser WebSocket
      this.tunnelManager = new TunnelManager();

      // Extract port from WebSocket URL (e.g., ws://127.0.0.1:9222/devtools/browser/xxx)
      const wsUrl = new URL(wsEndpoint);
      const browserPort = parseInt(wsUrl.port);

      const tunnelSession = await this.tunnelManager.startTunnel(browserPort);
      const tunnelWsUrl = this.tunnelManager.getWebSocketUrl(wsEndpoint);

      const apiUrl = this.globalApiClient.getApiUrl();
      const appUrl = ApiClient.getAppUrl();
      const appConfigId = this.globalApiClient.getAppConfigId();

      let initMessage = `QA server initialized successfully. API key validated and browser started.\nAPI URL: ${apiUrl}\nApp URL: ${appUrl}\nLocal Browser WebSocket: ${wsEndpoint}\nTunneled Browser WebSocket: ${tunnelWsUrl}\nTunnel URL: ${tunnelSession.publicUrl}\nHeadless mode: ${headless}`;

      if (appConfigId) {
        initMessage += `\nApp Config ID: ${appConfigId}`;
      }

      // Include app config details if available
      if (authResult.data?.app_config) {
        const appConfig = authResult.data.app_config;
        initMessage += `\nApp Config: ${appConfig.name} (${appConfig.base_url})`;
        if (appConfig.login_url) {
          initMessage += `\nLogin URL: ${appConfig.login_url}`;
        }

        // Check if app config needs setup
        if (!appConfig.base_url || appConfig.base_url.trim() === '') {
          initMessage += `\n\n🔧 **Setup Required**: Your app config needs a base URL. Run this to configure:
{
  "tool": "update_app_config",
  "params": {
    "base_url": "https://your-app.com",
    "login_url": "https://your-app.com/login",
    "login_username": "test@example.com"
  }
}`;
        }
      } else {
        initMessage += `\n\n🔧 **First Time Setup**: Configure your testing environment:
{
  "tool": "update_app_config",
  "params": {
    "base_url": "https://your-app.com",
    "login_url": "https://your-app.com/login",
    "login_username": "test@example.com",
    "login_password": "your-password"
  }
}

After setup, you can start testing without specifying URLs:
{
  "tool": "start_qa_session",
  "params": {
    "task": "Test the main functionality"
  }
}`;
      }

      return {
        content: [
          {
            type: 'text',
            text: initMessage,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleRegisterUser(params: RegisterUserParams): Promise<CallToolResult> {
    try {
      const { email } = params;

      const result = await this.globalApiClient.register(email);

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Registration successful! ${result.message}\n\nYour API key: ${result.apiKey}\n\nNow you can run: {"method": "tools/call", "params": {"name": "init_qa_server", "arguments": {"apiKey": "${result.apiKey}"}}}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Registration failed: ${result.message}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleListQaSessions(params: ListQaSessionsParams): Promise<CallToolResult> {
    try {
      if (!this.globalApiClient.getApiKey()) {
        return {
          content: [
            {
              type: 'text',
              text: 'API key not configured. Please run init_qa_server first with an API key.',
            },
          ],
          isError: true,
        };
      }

      try {
        // Set defaults: limit=10, offset=0, query=empty
        const options = {
          limit: params.limit || 10,
          offset: params.offset || 0,
          query: params.query || '',
        };

        const sessions = await this.globalApiClient.listSessions(options);
        const sessionSummaries = sessions.map((session) => this.createSessionSummary(session));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  sessions: sessionSummaries,
                  displayed: sessions.length,
                  limit: options.limit,
                  offset: options.offset,
                  query: options.query || 'none',
                  note: 'This is a summary view. Use monitor_qa_session with a specific sessionId to get full details including complete history and blocks. Use limit/offset for pagination.',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to fetch sessions: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list sessions: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleStartQaSession(params: StartQaSessionParams): Promise<CallToolResult> {
    try {
      const { url, task, dependencyId } = params;

      if (!this.globalApiClient.getApiKey()) {
        return {
          content: [
            {
              type: 'text',
              text: 'API key not configured. Please run init_qa_server first with an API key.',
            },
          ],
          isError: true,
        };
      }

      if (!this.browserManager || !this.browserManager.isActive()) {
        return {
          content: [
            {
              type: 'text',
              text: 'Browser not initialized. Please run init_qa_server first to start the browser.',
            },
          ],
          isError: true,
        };
      }

      if (!this.tunnelManager || !this.tunnelManager.isActive()) {
        return {
          content: [
            {
              type: 'text',
              text: 'Tunnel not initialized. Please run init_qa_server first to create the tunnel.',
            },
          ],
          isError: true,
        };
      }

      const localWsUrl = this.browserManager.getWebSocketEndpoint();
      if (!localWsUrl) {
        return {
          content: [
            {
              type: 'text',
              text: 'Browser WebSocket endpoint not available. Please reinitialize the server.',
            },
          ],
          isError: true,
        };
      }

      const wsUrl = this.tunnelManager.getWebSocketUrl(localWsUrl);
      if (!wsUrl) {
        return {
          content: [
            {
              type: 'text',
              text: 'Failed to create tunneled WebSocket URL. Please reinitialize the server.',
            },
          ],
          isError: true,
        };
      }

      try {
        const session = await this.globalApiClient.createSession({
          url,
          task,
          wsUrl,
          dependencyId,
        });

        const sessionId = session.data?.agent_id;
        const result = {
          success: true,
          message: 'QA session started successfully',
          sessionId: sessionId,
          note: `Use sessionId "${sessionId}" for monitoring, responding, and controlling this session`,
          session: {
            id: session.id,
            status: session.status,
            createdAt: session.createdAt,
            data: {
              agent_id: session.data?.agent_id,
              test_id: session.data?.test_id,
              url: session.data?.url,
              task: session.data?.task,
              status: session.data?.status,
              liveview_url: session.data?.liveview_url,
              dependency_test_ids: session.data?.dependency_test_ids,
            },
            source: session.source,
          },
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to start session: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to start session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleMonitorQaSession(params: MonitorQaSessionParams): Promise<CallToolResult> {
    try {
      const { sessionId, autoRespond = true, wait_for_completion = false, timeout = 60 } = params;

      if (!this.globalApiClient.getApiKey()) {
        return {
          content: [
            {
              type: 'text',
              text: 'API key not configured. Please run init_qa_server first with an API key.',
            },
          ],
          isError: true,
        };
      }

      if (wait_for_completion) {
        return this.handleWaitForCompletion(sessionId, timeout, autoRespond);
      }

      try {
        const session = await this.globalApiClient.getSession(sessionId);

        const result = {
          sessionId: session.id,
          status: session.data?.status || session.status,
          hasPendingInput: !!session.data?.pending_user_input,
          pendingInput: session.data?.pending_user_input,
          lastDone: session.data?.last_done,
          liveviewUrl: session.data?.liveview_url,
          note: 'Keep calling monitor_qa_session until status is "closed" or "idle". Use wait_for_completion=true to automatically wait.',
        };

        if (autoRespond && session.data?.pending_user_input) {
          const pendingInput = session.data.pending_user_input;

          // Use MCP's elicitation pattern to prompt for user input
          const elicitationText = `
🤖 **Session ${sessionId} requires your input to continue!**

**Context:** ${pendingInput.reasoning || 'The QA session needs input to proceed'}

**Question:** ${pendingInput.question || 'Please provide your response'}

**Priority:** ${pendingInput.priority || 'normal'}

Please provide your response below, and it will be automatically sent to the session.`;

          return {
            content: [
              {
                type: 'text',
                text: elicitationText,
              },
            ],
            isError: false,
            // This indicates to the MCP client that user input is needed
            // The response will be processed by the client and can trigger follow-up actions
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to monitor session: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to monitor session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleWaitForCompletion(
    sessionId: string,
    timeout: number,
    autoRespond: boolean
  ): Promise<CallToolResult> {
    const startTime = Date.now();
    const timeoutMs = timeout * 1000;
    let iteration = 0;

    try {
      const maxMcpTimeout = 25; // Maximum safe MCP request time (25 seconds to stay under 30s limit)
      const checkInterval = 2; // Check every 2 seconds
      const maxChecks = Math.min(
        Math.floor(maxMcpTimeout / checkInterval),
        Math.floor(timeout / checkInterval)
      );

      for (let i = 0; i < maxChecks; i++) {
        iteration++;

        try {
          const session = await this.globalApiClient.getSession(sessionId);
          const status = session.data?.status || session.status;
          const elapsed = Math.round((Date.now() - startTime) / 1000);

          // Send progress notification
          await this.server.notification({
            method: 'notifications/message',
            params: {
              level: 'info',
              logger: 'session_monitor',
              data: {
                sessionId,
                status,
                elapsed,
                iteration,
                progress: Math.round((i / maxChecks) * 100),
                message: `Monitoring session ${sessionId} - Status: ${status} (${elapsed}s elapsed)`,
              },
            },
          });

          // Check if session is complete
          if (status === 'closed' || status === 'idle') {
            const result = {
              sessionId: session.id,
              status: status,
              hasPendingInput: !!session.data?.pending_user_input,
              pendingInput: session.data?.pending_user_input,
              lastDone: session.data?.last_done,
              liveviewUrl: session.data?.liveview_url,
              completedAfter: elapsed,
              iterations: iteration,
              note: `Session completed with status: ${status}`,
            };

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `✅ Session ${sessionId} completed successfully!`,
                      result,
                      progressLog: `Monitored for ${elapsed} seconds with ${iteration} checks`,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          // Check for pending input
          if (autoRespond && session.data?.pending_user_input) {
            const pendingInput = session.data.pending_user_input;

            const elicitationText = `
🤖 **Session ${sessionId} requires your input to continue!**

**Monitoring stopped after ${elapsed} seconds** because the session is waiting for input.

**Context:** ${pendingInput.reasoning || 'The QA session needs input to proceed'}

**Question:** ${pendingInput.question || 'Please provide your response'}

**Priority:** ${pendingInput.priority || 'normal'}

Please use interact_with_qa_session tool with action="respond" to provide your response, then call monitor_qa_session again with wait_for_completion=true to continue monitoring.`;

            return {
              content: [
                {
                  type: 'text',
                  text: elicitationText,
                },
              ],
              isError: false,
            };
          }

          // Wait before next check (avoid tight loop)
          if (i < maxChecks - 1) {
            await new Promise((resolve) => setTimeout(resolve, checkInterval * 1000));
          }
        } catch (sessionError) {
          // If session not found or error, wait a bit and try again
          if (i < maxChecks - 1) {
            await new Promise((resolve) => setTimeout(resolve, checkInterval * 1000));
          }
          continue;
        }
      }

      // Reached max checks without completion (MCP timeout protection)
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      try {
        // Get final status before returning
        const session = await this.globalApiClient.getSession(sessionId);
        const status = session.data?.status || session.status;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  message: `⏳ Session ${sessionId} is still running after ${elapsed}s (Status: ${status})`,
                  sessionId,
                  currentStatus: status,
                  elapsed,
                  iterations: iteration,
                  note: `MCP timeout protection: monitored for ${elapsed}s. Call monitor_qa_session again with wait_for_completion=true to continue monitoring, or use without wait_for_completion for manual checking.`,
                  hasPendingInput: !!session.data?.pending_user_input,
                  pendingInput: session.data?.pending_user_input,
                  liveviewUrl: session.data?.liveview_url,
                },
                null,
                2
              ),
            },
          ],
          isError: false, // Not an error, just incomplete
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  message: `Session monitoring stopped after ${elapsed}s - could not get final status`,
                  sessionId,
                  elapsed,
                  iterations: iteration,
                  note: 'Call monitor_qa_session again to check current status',
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to wait for completion: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleInteractWithQaSession(
    params: InteractWithQaSessionParams
  ): Promise<CallToolResult> {
    try {
      const { sessionId, action, message = '' } = params;

      if (!this.globalApiClient.getApiKey()) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ API key not configured.\n\n🎯 Next step: init_qa_server({apiKey: "your-api-key"})',
            },
          ],
          isError: true,
        };
      }

      // Validate required message for respond action
      if (action === 'respond' && !message) {
        return {
          content: [
            {
              type: 'text',
              text:
                '❌ Message is required for "respond" action.\n\n🎯 Next step: interact_with_qa_session({sessionId: "' +
                sessionId +
                '", action: "respond", message: "your-response"})',
            },
          ],
          isError: true,
        };
      }

      try {
        // Map new action format to API format
        const apiAction = action === 'respond' ? 'response' : action;

        const result = await this.globalApiClient.sendMessage({
          sessionId,
          action: apiAction,
          data: message,
        });

        // Create conversational output based on action
        let responseText = '';
        switch (action) {
          case 'respond':
            responseText = `✅ Response sent: "${message}"\n\n🎯 Next step: monitor_qa_session({sessionId: "${sessionId}", wait_for_completion: true})`;
            break;
          case 'pause':
            responseText = `⏸️ Session paused\n\n🎯 Next step: monitor_qa_session({sessionId: "${sessionId}"}) to check status`;
            break;
          case 'close':
            responseText = `🛑 Session closed\n\n🎯 Next step: list_qa_sessions() to see other active sessions`;
            break;
        }

        return {
          content: [
            {
              type: 'text',
              text: responseText,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Failed to ${action} session: ${error instanceof Error ? error.message : 'Unknown error'}\n\n🎯 Next step: monitor_qa_session({sessionId: "${sessionId}"}) to check session status`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to interact with session: ${error instanceof Error ? error.message : 'Unknown error'}\n\n🎯 Next step: list_qa_sessions() to verify session exists`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleFindAutomatedTest(params: FindAutomatedTestParams): Promise<CallToolResult> {
    try {
      if (!this.globalApiClient.getApiKey()) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ API key not configured.\n\n🎯 Next step: init_qa_server({apiKey: "your-api-key"})',
            },
          ],
          isError: true,
        };
      }

      const { testId, query, limit = 10, offset = 0 } = params;

      try {
        // If testId provided, get specific test details
        if (testId) {
          const test = await this.globalApiClient.getTest(testId);
          return {
            content: [
              {
                type: 'text',
                text: `🔍 **Test Found:** ${test.name || testId}\n\n📋 **Details:**\n${JSON.stringify(test, null, 2)}\n\n🎯 Next step: run_automated_tests({test_ids: ["${testId}"]}) to execute this test`,
              },
            ],
          };
        }

        // Otherwise, search for tests
        const options = { limit, offset, query: query || '' };
        const tests = await this.globalApiClient.listTests(options);
        const testSummaries = tests.map((test) => this.createTestSummary(test));

        if (tests.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: query
                  ? `🔍 No tests found matching "${query}"\n\n🎯 Next step: find_automated_test() to see all available tests`
                  : '📋 No automated tests found\n\n🎯 Next step: Create tests in your desplega.ai dashboard',
              },
            ],
          };
        }

        if (tests.length === 1) {
          const singleTest = tests[0];
          return {
            content: [
              {
                type: 'text',
                text: `🎯 **Found 1 test:** ${singleTest.name || singleTest.id}\n\n📋 **Summary:**\n${JSON.stringify(testSummaries[0], null, 2)}\n\n🎯 Next steps:\n• find_automated_test({testId: "${singleTest.id}"}) for full details\n• run_automated_tests({test_ids: ["${singleTest.id}"]}) to execute`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `🔍 **Found ${tests.length} tests** ${query ? `matching "${query}"` : ''}\n\n📋 **Tests:**\n${JSON.stringify(testSummaries, null, 2)}\n\n🎯 Next steps:\n• find_automated_test({testId: "specific-id"}) for details on any test\n• run_automated_tests({test_ids: ["id1", "id2"]}) to execute multiple tests`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Failed to find tests: ${error instanceof Error ? error.message : 'Unknown error'}\n\n🎯 Next step: Verify your API key and try again`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to find tests: ${error instanceof Error ? error.message : 'Unknown error'}\n\n🎯 Next step: Check your connection and try again`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleRunAutomatedTests(params: RunAutomatedTestsParams): Promise<CallToolResult> {
    try {
      const { test_ids, ws_url, app_config_id } = params;

      if (!this.globalApiClient.getApiKey()) {
        return {
          content: [
            {
              type: 'text',
              text: 'API key not configured. Please run init_qa_server first with an API key.',
            },
          ],
          isError: true,
        };
      }

      // Use provided ws_url or fall back to the global tunneled URL
      const websocketUrl = ws_url || this.getGlobalWebSocketUrl();

      if (!websocketUrl) {
        return {
          content: [
            {
              type: 'text',
              text: 'No WebSocket URL available. Please run init_qa_server first to set up browser tunneling, or provide ws_url parameter.',
            },
          ],
          isError: true,
        };
      }

      try {
        const result = await this.globalApiClient.runTests({
          test_ids,
          ws_url: websocketUrl,
          app_config_id,
        });

        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    message: `✅ Successfully started ${test_ids.length} automated tests`,
                    test_run_id: result.test_run_id,
                    test_ids: test_ids,
                    ws_url: websocketUrl,
                    app_config_id: app_config_id || 'Using API key default config',
                    sessions: result.sessions,
                    note: 'Tests are now running. Use list_qa_sessions to monitor progress or monitor_qa_session with individual session IDs.',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message: result.message || 'Failed to start tests',
                    test_ids: test_ids,
                    ws_url: websocketUrl,
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to run tests: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to run tests: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleListTestRuns(params: ListTestRunsParams): Promise<CallToolResult> {
    try {
      if (!this.globalApiClient.getApiKey()) {
        return {
          content: [
            {
              type: 'text',
              text: 'API key not configured. Please run init_qa_server first with an API key.',
            },
          ],
          isError: true,
        };
      }

      try {
        // Set defaults: limit=10, offset=0
        const options = {
          test_id: params.test_id,
          run_id: params.run_id,
          limit: params.limit || 10,
          offset: params.offset || 0,
        };

        const testRuns = await this.globalApiClient.listTestRuns(options);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  test_runs: testRuns,
                  displayed: testRuns.length,
                  limit: options.limit,
                  offset: options.offset,
                  filters: {
                    test_id: options.test_id || 'none',
                    run_id: options.run_id || 'none',
                  },
                  note: 'Test runs with execution details, status, and performance metrics. Use limit/offset for pagination.',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to fetch test runs: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list test runs: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleUpdateAppConfig(params: UpdateAppConfigParams): Promise<CallToolResult> {
    try {
      if (!this.globalApiClient.getApiKey()) {
        return {
          content: [
            {
              type: 'text',
              text: 'API key not configured. Please run init_qa_server first with an API key.',
            },
          ],
          isError: true,
        };
      }

      try {
        const result = await this.globalApiClient.updateAppConfig(params);

        if (result.success) {
          const appConfigId = this.globalApiClient.getAppConfigId();
          let successMessage = `✅ App config updated successfully! ${result.message}`;

          if (appConfigId) {
            successMessage += `\nApp Config ID: ${appConfigId}`;
          }

          // List the changes made
          const changes = Object.entries(params)
            .filter(([_, value]) => value !== undefined)
            .map(([key, value]) => `  - ${key}: ${value}`)
            .join('\n');

          if (changes) {
            successMessage += `\n\nUpdated settings:\n${changes}`;
          }

          successMessage +=
            '\n\n💡 **Tip:** These settings will be used for future QA sessions. You may need to restart active sessions for changes to take effect.';

          return {
            content: [
              {
                type: 'text',
                text: successMessage,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Failed to update app config: ${result.message}`,
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to update app config: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to update app config: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleListAppConfigs(params: ListAppConfigsParams): Promise<CallToolResult> {
    try {
      if (!this.globalApiClient.getApiKey()) {
        return {
          content: [
            {
              type: 'text',
              text: 'API key not configured. Please run init_qa_server first with an API key.',
            },
          ],
          isError: true,
        };
      }

      try {
        // Set defaults: limit=10, offset=0, query=empty
        const options = {
          limit: params.limit || 10,
          offset: params.offset || 0,
          query: params.query || '',
        };

        const appConfigs = await this.globalApiClient.listAppConfigs(options);

        // Create summary view for better readability
        const configSummaries = appConfigs.map((config) => ({
          id: config.id,
          name: config.name,
          base_url: config.base_url,
          login_url: config.login_url || 'Not configured',
          login_username: config.login_username || 'Not configured',
          vp_type: config.vp_type,
          status: config.status,
          organization_id: config.organization_id,
          created_at: config.created_at,
          updated_at: config.updated_at || 'Never updated',
          remove_popups: config.remove_popups,
          failure_status: config.failure_status,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  app_configs: configSummaries,
                  displayed: appConfigs.length,
                  limit: options.limit,
                  offset: options.offset,
                  query: options.query || 'none',
                  note: 'App configurations available for your organization. Use update_app_config to modify settings. Use limit/offset for pagination.',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to fetch app configs: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list app configs: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetCurrentAppConfig(): Promise<CallToolResult> {
    try {
      if (!this.globalApiClient.getApiKey()) {
        return {
          content: [
            {
              type: 'text',
              text: 'API key not configured. Please run init_qa_server first with an API key.',
            },
          ],
          isError: true,
        };
      }

      try {
        const checkData = await this.globalApiClient.validateApiKey();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(checkData, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to get current app config: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get current app config: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private getGlobalWebSocketUrl(): string | null {
    if (!this.tunnelManager || !this.browserManager) {
      return null;
    }

    const browserWsUrl = this.browserManager.getWebSocketEndpoint();
    if (!browserWsUrl) {
      return null;
    }

    return this.tunnelManager.getWebSocketUrl(browserWsUrl);
  }

  private setupResources(): void {
    // List resources handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'qa-use://guides/getting-started',
            name: 'Getting Started Guide',
            description: 'Complete guide to setting up and using QA-Use MCP server',
            mimeType: 'text/markdown',
          },
          {
            uri: 'qa-use://guides/workflows',
            name: 'Testing Workflows',
            description: 'Common testing workflows and best practices',
            mimeType: 'text/markdown',
          },
          {
            uri: 'qa-use://guides/monitoring',
            name: 'Session Monitoring Guide',
            description: 'How to effectively monitor and manage QA sessions',
            mimeType: 'text/markdown',
          },
        ],
      };
    });

    // Read resource handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'qa-use://guides/getting-started':
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: this.getGettingStartedGuide(),
              },
            ],
          };

        case 'qa-use://guides/workflows':
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: this.getWorkflowsGuide(),
              },
            ],
          };

        case 'qa-use://guides/monitoring':
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: this.getMonitoringGuide(),
              },
            ],
          };

        default:
          throw new Error(`Resource not found: ${uri}`);
      }
    });
  }

  private setupPrompts(): void {
    // List prompts handler
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: 'aaa_login_test',
            description: 'Generate a login test using AAA (Arrange-Act-Assert) framework',
            arguments: [
              {
                name: 'url',
                description: 'The login page URL',
                required: true,
              },
              {
                name: 'username',
                description: 'Test username/email',
                required: false,
              },
              {
                name: 'password',
                description: 'Test password',
                required: false,
              },
              {
                name: 'expected_redirect',
                description: 'Expected URL or page after successful login',
                required: false,
              },
            ],
          },
          {
            name: 'aaa_form_test',
            description: 'Generate a form submission test using AAA framework',
            arguments: [
              {
                name: 'url',
                description: 'The form page URL',
                required: true,
              },
              {
                name: 'form_type',
                description: 'Type of form (contact, registration, checkout, etc.)',
                required: true,
              },
              {
                name: 'required_fields',
                description: 'Comma-separated list of required field names',
                required: false,
              },
              {
                name: 'success_message',
                description: 'Expected success message after submission',
                required: false,
              },
            ],
          },
          {
            name: 'aaa_ecommerce_test',
            description: 'Generate an e-commerce workflow test using AAA framework',
            arguments: [
              {
                name: 'product_url',
                description: 'Product page URL',
                required: true,
              },
              {
                name: 'workflow_type',
                description: 'E-commerce workflow (add_to_cart, checkout, search, etc.)',
                required: true,
              },
              {
                name: 'product_name',
                description: 'Product name for testing',
                required: false,
              },
              {
                name: 'quantity',
                description: 'Quantity to add to cart',
                required: false,
              },
            ],
          },
          {
            name: 'aaa_navigation_test',
            description: 'Generate a navigation test using AAA framework',
            arguments: [
              {
                name: 'base_url',
                description: 'Website base URL',
                required: true,
              },
              {
                name: 'menu_items',
                description: 'Comma-separated list of menu items to test',
                required: false,
              },
              {
                name: 'navigation_type',
                description: 'Type of navigation (main_menu, footer, breadcrumb, etc.)',
                required: false,
              },
            ],
          },
          {
            name: 'comprehensive_test_scenario',
            description: 'Generate a comprehensive test scenario for specific use case',
            arguments: [
              {
                name: 'scenario_type',
                description:
                  'Type of scenario (authentication, validation, accessibility, performance, mobile)',
                required: true,
              },
              {
                name: 'url',
                description: 'Target URL for testing',
                required: true,
              },
              {
                name: 'specific_feature',
                description: 'Specific feature or functionality to test',
                required: false,
              },
              {
                name: 'browser_type',
                description: 'Browser or device type (desktop, mobile, tablet)',
                required: false,
              },
            ],
          },
        ],
      };
    });

    // Get prompt handler
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'aaa_login_test':
          return {
            description: 'AAA framework login test',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: this.generateLoginTestPrompt(args),
                },
              },
            ],
          };

        case 'aaa_form_test':
          return {
            description: 'AAA framework form test',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: this.generateFormTestPrompt(args),
                },
              },
            ],
          };

        case 'aaa_ecommerce_test':
          return {
            description: 'AAA framework e-commerce test',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: this.generateEcommerceTestPrompt(args),
                },
              },
            ],
          };

        case 'aaa_navigation_test':
          return {
            description: 'AAA framework navigation test',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: this.generateNavigationTestPrompt(args),
                },
              },
            ],
          };

        case 'comprehensive_test_scenario':
          return {
            description: 'Comprehensive test scenario',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: this.generateComprehensiveTestPrompt(args),
                },
              },
            ],
          };

        default:
          throw new Error(`Prompt not found: ${name}`);
      }
    });
  }

  private generateLoginTestPrompt(args: Record<string, unknown> = {}): string {
    const url = String(args.url || 'https://example.com/login');
    const username = String(args.username || 'testuser@example.com');
    const password = String(args.password || 'securepass123');
    const expectedRedirect = String(args.expected_redirect || '/dashboard');

    return `Create a comprehensive login test using the AAA (Arrange-Act-Assert) framework for QA-Use MCP server.

**ARRANGE:**
Navigate to the login page at ${url} and prepare test credentials. Verify the page has loaded correctly and the login form is visible with username/email and password fields.

**ACT:**
Enter username "${username}" in the email/username field, enter password "${password}" in the password field, and click the "Sign In" or "Login" button to submit the form.

**ASSERT:**
Verify that the page redirects to ${expectedRedirect}, check that the user is properly authenticated (look for user menu, welcome message, or logout option), and confirm no error messages are displayed.

**QA-Use Implementation Tips:**
- Use specific selectors: reference exact input labels like "Email" or "Username"
- Wait for state changes: ensure page load is complete before acting
- Verify multiple aspects: URL change, UI elements, and authentication state
- Handle loading states: account for any loading spinners or async operations
- **Setup Required**: First configure your app using update_app_config with login credentials and base URL

**Example workflow:**
1. **Configure app first:**
\`\`\`json
{
  "tool": "update_app_config",
  "params": {
    "base_url": "${url}",
    "login_url": "${url}",
    "login_username": "${username}",
    "login_password": "${password}"
  }
}
\`\`\`

2. **Then start testing:**
\`\`\`json
{
  "tool": "start_qa_session",
  "params": {
    "task": "Test login functionality using configured credentials"
  }
}
\`\`\`

Write the task description for start_qa_session following this AAA structure.`;
  }

  private generateFormTestPrompt(args: Record<string, unknown> = {}): string {
    const url = String(args.url || 'https://example.com/contact');
    const formType = String(args.form_type || 'contact');
    const requiredFields = String(args.required_fields || 'name, email, message');
    const successMessage = String(args.success_message || 'Message sent successfully');

    return `Create a comprehensive ${formType} form test using the AAA (Arrange-Act-Assert) framework for QA-Use MCP server.

**ARRANGE:**
Navigate to the ${formType} form at ${url} and prepare test data. Verify the form is loaded with all required fields visible: ${requiredFields}. Ensure the form is empty and ready for input.

**ACT:**
Fill out the ${formType} form with appropriate test data for each required field (${requiredFields}). Submit the form by clicking the submit button (commonly labeled "Send", "Submit", or "Send Message").

**ASSERT:**
Verify that a success message appears stating "${successMessage}", check that the form submission was processed correctly, and confirm the form either clears or shows appropriate confirmation state.

**QA-Use Implementation Tips:**
- Be specific with field selectors: use exact labels like "Full Name", "Email Address", "Your Message"
- Test data should be realistic: use proper email formats, appropriate text lengths
- Wait for submission: account for any loading states or async form processing
- Verify thoroughly: check success message, form state, and any redirect behavior

Additional validation tests to consider:
- Required field validation (leave fields empty)
- Email format validation (enter invalid email)
- Character limit validation (exceed maximum length)

Write the task description for start_qa_session following this AAA structure.`;
  }

  private generateEcommerceTestPrompt(args: Record<string, unknown> = {}): string {
    const productUrl = String(args.product_url || 'https://shop.example.com/products/widget-123');
    const workflowType = String(args.workflow_type || 'add_to_cart');
    const productName = String(args.product_name || 'Test Widget');
    const quantity = String(args.quantity || '1');

    const workflows = {
      add_to_cart: {
        arrange: `Navigate to the product page at ${productUrl} and verify "${productName}" is displayed and in stock. Check that product options (size, color, quantity) are available for selection.`,
        act: `Select appropriate product options, set quantity to "${quantity}", and click the "Add to Cart" button. Wait for the add-to-cart action to complete.`,
        assert: `Verify the cart icon updates to show the correct item count, check that a confirmation notification appears, and confirm the product appears in the cart dropdown or mini-cart view.`,
      },
      checkout: {
        arrange: `Add "${productName}" to cart from ${productUrl}, navigate to the checkout page, and verify cart contents are correct. Ensure checkout form fields are displayed.`,
        act: `Fill out shipping information (name, address, contact details), select payment method, review order details, and click "Place Order" or "Complete Purchase".`,
        assert: `Verify order confirmation page displays, check that order number is generated, confirm total amount is correct, and verify confirmation email is mentioned.`,
      },
      search: {
        arrange: `Navigate to the homepage or main shop page and locate the search functionality. Verify the search bar is visible and functional.`,
        act: `Enter "${productName}" in the search field and submit the search by clicking the search button or pressing Enter.`,
        assert: `Verify search results page loads, check that relevant products are displayed, confirm search term is shown in results, and verify product links are working.`,
      },
    };

    const workflow = workflows[workflowType as keyof typeof workflows] || workflows.add_to_cart;

    return `Create a comprehensive e-commerce ${workflowType} test using the AAA (Arrange-Act-Assert) framework for QA-Use MCP server.

**ARRANGE:**
${workflow.arrange}

**ACT:**
${workflow.act}

**ASSERT:**
${workflow.assert}

**QA-Use Implementation Tips:**
- Use specific selectors: reference exact button text like "Add to Cart", size options like "Medium", color names
- Wait for updates: cart count updates and page transitions may be asynchronous
- Verify multiple elements: cart count, notifications, product visibility, pricing
- Handle dynamic content: product availability, price changes, inventory updates
- Account for loading states: product images, cart updates, checkout processing

**E-commerce Specific Considerations:**
- Product availability may change during testing
- Cart persistence across page navigation
- Price calculations and tax handling
- Inventory management and stock levels
- Payment processing simulation (if applicable)

Write the task description for start_qa_session following this AAA structure.`;
  }

  private generateNavigationTestPrompt(args: Record<string, unknown> = {}): string {
    const baseUrl = String(args.base_url || 'https://example.com');
    const menuItems = String(args.menu_items || 'Home, About, Services, Products, Contact');
    const navigationType = String(args.navigation_type || 'main_menu');

    return `Create a comprehensive ${navigationType} navigation test using the AAA (Arrange-Act-Assert) framework for QA-Use MCP server.

**ARRANGE:**
Start at the homepage ${baseUrl} and locate the ${navigationType}. Verify the navigation menu is visible and contains the expected items: ${menuItems}. Ensure all menu items are clickable and properly displayed.

**ACT:**
Click through each ${navigationType} item systematically: ${menuItems}. For each item, navigate to the page, verify it loads, then return to test the next item (or test in sequence if appropriate).

**ASSERT:**
For each navigation item, verify:
- The page loads correctly with appropriate content
- The URL changes to the expected path
- The page title is relevant and correct
- The active navigation item is highlighted or styled appropriately
- Any breadcrumb navigation is accurate
- The page contains expected content sections

**QA-Use Implementation Tips:**
- Use exact menu text: "About Us", "Our Services", "Contact Us" as they appear
- Wait for page loads: ensure each page fully loads before moving to the next
- Verify visual states: active/current page styling, hover effects
- Check responsive behavior: mobile menu functionality if applicable
- Test accessibility: keyboard navigation, focus indicators

**Navigation Specific Tests:**
- **Main Menu**: Primary site navigation
- **Footer Menu**: Secondary links and legal pages
- **Breadcrumb**: Hierarchical navigation path
- **Mobile Menu**: Hamburger menu and responsive design
- **Sidebar Menu**: Category or section-based navigation

**Additional Verification Points:**
- Logo links back to homepage
- Navigation consistency across pages
- External links open appropriately
- Dropdown/submenu functionality (if present)
- Search functionality integration

Write the task description for start_qa_session following this AAA structure with specific focus on ${navigationType} testing.`;
  }

  private generateComprehensiveTestPrompt(args: Record<string, unknown> = {}): string {
    const scenarioType = String(args.scenario_type || 'authentication');
    const url = String(args.url || 'https://example.com');
    const specificFeature = String(args.specific_feature || 'core functionality');
    const browserType = String(args.browser_type || 'desktop');

    const scenarios = {
      authentication: {
        focus: 'User authentication flow including login, logout, and session management',
        considerations:
          'Password requirements, session timeout, remember me functionality, error handling',
      },
      validation: {
        focus: 'Form validation and data input handling',
        considerations:
          'Required fields, format validation, character limits, error messages, real-time validation',
      },
      accessibility: {
        focus: 'Web accessibility compliance and usability',
        considerations:
          'Keyboard navigation, screen reader compatibility, focus indicators, ARIA labels, color contrast',
      },
      performance: {
        focus: 'Page load times, responsiveness, and resource optimization',
        considerations:
          'Load times, image optimization, network requests, cache behavior, mobile performance',
      },
      mobile: {
        focus: 'Mobile device compatibility and responsive design',
        considerations:
          'Touch interactions, viewport scaling, mobile menu, gesture support, responsive layout',
      },
    };

    const scenario = scenarios[scenarioType as keyof typeof scenarios] || scenarios.authentication;

    return `Create a comprehensive ${scenarioType} test scenario using the AAA (Arrange-Act-Assert) framework for QA-Use MCP server.

**Test Focus:** ${scenario.focus}
**Target:** ${specificFeature} on ${url}
**Browser/Device:** ${browserType}

**ARRANGE:**
Navigate to ${url} and prepare the testing environment for ${scenarioType} testing. Verify the page loads correctly and the target feature "${specificFeature}" is accessible. Set up any necessary preconditions for ${browserType} testing.

**ACT:**
Execute the primary ${scenarioType} workflow for "${specificFeature}". This should include the main user interaction flow and any edge cases relevant to ${scenarioType} testing.

**ASSERT:**
Verify that the ${scenarioType} requirements are met:
- Core functionality works as expected
- ${scenario.considerations}
- User experience is appropriate for ${browserType}
- No errors or accessibility issues are present

**${scenarioType.toUpperCase()} Specific Testing Guidelines:**

${this.getScenarioSpecificGuidelines(scenarioType, browserType)}

**QA-Use Implementation Tips:**
- Use specific selectors appropriate for ${browserType} testing
- Account for ${scenarioType}-specific timing and loading requirements
- Verify multiple aspects: functionality, usability, and compliance
- Test edge cases and error conditions
- Ensure comprehensive coverage of the ${specificFeature}

**Success Criteria:**
- All ${scenarioType} requirements are validated
- The feature works correctly across different conditions
- User experience is optimized for ${browserType}
- No critical issues or blockers are identified

Write the task description for start_qa_session following this AAA structure with comprehensive ${scenarioType} testing focus.`;
  }

  private getScenarioSpecificGuidelines(scenarioType: string, browserType: string): string {
    const guidelines = {
      authentication: `
- Test successful login with valid credentials
- Verify failed login with invalid credentials
- Check session persistence and timeout behavior
- Test logout functionality and session cleanup
- Verify password reset and account recovery flows
- Check remember me functionality if available`,

      validation: `
- Test all required field validations
- Verify email format and other input format validations
- Check character limits and boundary conditions
- Test real-time validation feedback
- Verify error message clarity and positioning
- Test form submission with various input combinations`,

      accessibility: `
- Navigate using only keyboard (Tab, Enter, Arrow keys)
- Test screen reader compatibility with ARIA labels
- Verify focus indicators are visible and logical
- Check color contrast meets WCAG guidelines
- Test with assistive technology simulation
- Verify semantic HTML structure and headings`,

      performance: `
- Measure and verify page load times under 3 seconds
- Check image loading and optimization
- Monitor network requests and resource sizes
- Test performance under different network conditions
- Verify caching behavior and subsequent load times
- Check for performance bottlenecks and optimization opportunities`,

      mobile: `
- Test touch interactions and gesture support
- Verify responsive design across different screen sizes
- Check mobile menu and navigation functionality
- Test form interactions with mobile keyboards
- Verify pinch-to-zoom and scrolling behavior
- Check orientation changes (portrait/landscape)`,
    };

    return guidelines[scenarioType as keyof typeof guidelines] || guidelines.authentication;
  }

  private getGettingStartedGuide(): string {
    return `# QA-Use MCP Server - Getting Started Guide

## Quick Setup (New App Config Workflow)

### 1. Initialize the Server
\`\`\`json
{
  "tool": "init_qa_server",
  "params": {
    "apiKey": "your-api-key"
  }
}
\`\`\`

### 2. Configure Your App (One-time setup)
\`\`\`json
{
  "tool": "update_app_config",
  "params": {
    "base_url": "https://your-app.com",
    "login_url": "https://your-app.com/login",
    "login_username": "test@example.com",
    "login_password": "your-password",
    "vp_type": "desktop"
  }
}
\`\`\`

### 3. Start Testing (URL optional - uses app config)
\`\`\`json
{
  "tool": "start_qa_session",
  "params": {
    "task": "Test login functionality using configured credentials"
  }
}
\`\`\`

### 4. Monitor Progress
\`\`\`json
{
  "tool": "monitor_qa_session",
  "params": {
    "sessionId": "session-id-from-start-response",
    "wait_for_completion": true,
    "timeout": 120
  }
}
\`\`\`

## New Workflow Benefits

- **One-time Setup**: Configure your app once, test repeatedly
- **User Isolation**: Each user has their own app config
- **Simplified Testing**: No need to pass URL/credentials every time
- **Flexible Overrides**: Can still specify URL for specific tests
- **Multi-Config Support**: Test against different environments

## Core Concepts

- **App Configs**: Centralized configuration for your testing environment
- **Sessions**: Individual QA testing instances using your app config
- **Tunneling**: Automatic browser WebSocket URL tunneling for remote access
- **Monitoring**: Real-time session progress tracking
- **Batch Testing**: Execute multiple automated tests simultaneously

## New User Journey

1. **Register** → Get API key (if needed)
2. **Initialize** → \`init_qa_server\` with API key
3. **Configure** → \`update_app_config\` with your app settings
4. **Test** → \`start_qa_session\` (URL optional)
5. **Monitor** → \`list_app_configs\` to see available configs
6. **Batch** → \`run_automated_tests\` with optional app_config_id

## Next Steps

1. Read the Workflows guide for app config patterns
2. Check out AAA Framework templates for effective test writing
3. Explore monitoring best practices
4. Use \`list_app_configs\` to see other available configurations
`;
  }

  private getWorkflowsGuide(): string {
    return `# QA-Use Testing Workflows

## New Workflow: App Config-Based Testing
*Recommended workflow with centralized configuration*

1. **Initialize** → \`init_qa_server\` with API key
2. **Configure** → \`update_app_config\` (one-time setup)
3. **Test** → \`start_qa_session\` (URL optional)
4. **Monitor** → \`monitor_qa_session\`
5. **Explore** → \`list_app_configs\` to see other environments

### App Config Setup Example
\`\`\`json
{
  "tool": "update_app_config",
  "params": {
    "base_url": "https://staging.myapp.com",
    "login_url": "https://staging.myapp.com/auth/login",
    "login_username": "tester@mycompany.com",
    "login_password": "secure-test-password",
    "vp_type": "desktop"
  }
}
\`\`\`

### Testing with App Config
\`\`\`json
{
  "tool": "start_qa_session",
  "params": {
    "task": "Test user registration flow"
  }
}
\`\`\`

## Workflow 1: Interactive Testing
*For manual testing with AI assistance*

1. **Initialize** → \`init_qa_server\`
2. **Configure** → \`update_app_config\` (if first time)
3. **Start Session** → \`start_qa_session\` (URL optional)
4. **Monitor & Interact** → \`monitor_qa_session\` + \`interact_with_qa_session\`
5. **Completion** → Session reaches "closed" or "idle"

## Workflow 2: Automated Batch Testing
*For running pre-defined test suites*

1. **Initialize** → \`init_qa_server\`
2. **Find Tests** → \`find_automated_test\`
3. **Run Tests** → \`run_automated_tests\` (with optional app_config_id)
4. **Monitor Progress** → \`list_qa_sessions\` + \`monitor_qa_session\`

### Multi-Environment Testing
\`\`\`json
{
  "tool": "run_automated_tests",
  "params": {
    "test_ids": ["login-test", "checkout-test"],
    "app_config_id": "staging-config-id"
  }
}
\`\`\`

## Workflow 3: Test Development
*For creating and refining test cases*

1. **Find Tests** → \`find_automated_test\` (by query or testId)
2. **Start New Session** → \`start_qa_session\` (uses app config + pass dependencyId if needed)
3. **Monitor & Iterate** → \`monitor_qa_session\`

## Best Practices

### App Configuration
- **One-time Setup**: Configure your app once per environment
- **User Isolation**: Each team member has their own app config
- **Environment Management**: Use \`list_app_configs\` to see available configs
- **Override When Needed**: Still pass URL for specific page testing

### Session Management
- Always use \`wait_for_completion=true\` for unattended monitoring
- Set appropriate timeouts (default: 60s, recommended: 120-300s for complex tests)
- Use pagination (\`limit\`/\`offset\`) when listing many sessions

### Error Handling
- Check session status regularly: "active", "pending", "closed", "idle"
- Handle user input requests promptly
- Monitor for timeout conditions

### Performance
- Use batch testing for multiple related tests
- Leverage global WebSocket URL for consistent browser access
- Implement proper cleanup with session monitoring
- Use \`app_config_id\` to test against different environments efficiently
`;
  }

  private getMonitoringGuide(): string {
    return `# Session Monitoring Guide

## Monitoring Strategies

### 1. Manual Monitoring (Interactive)
Best for development and debugging:

\`\`\`json
{
  "tool": "monitor_qa_session",
  "params": {
    "sessionId": "your-session-id",
    "autoRespond": true
  }
}
\`\`\`

**When to use**: Development, debugging, interactive testing
**Frequency**: Call repeatedly until status is "closed" or "idle"

### 2. Automatic Monitoring (Fire-and-forget)
Best for production and batch testing:

\`\`\`json
{
  "tool": "monitor_qa_session",
  "params": {
    "sessionId": "your-session-id",
    "wait_for_completion": true,
    "timeout": 300
  }
}
\`\`\`

**When to use**: Batch testing, CI/CD, unattended runs
**Timeout recommendations**:
- Simple tests: 60-120 seconds
- Complex workflows: 180-300 seconds
- Deep testing: 300-600 seconds

### 3. Batch Monitoring
Monitor multiple sessions efficiently:

\`\`\`json
{
  "tool": "list_qa_sessions",
  "params": {
    "limit": 20,
    "offset": 0
  }
}
\`\`\`

## Session Status Guide

| Status | Meaning | Action Required |
|--------|---------|----------------|
| \`active\` | Running normally | Continue monitoring |
| \`pending\` | Waiting for user input | Use \`interact_with_qa_session\` with action="respond" |
| \`closed\` | ✅ Completed successfully | Review results |
| \`idle\` | ⏸️ Paused/waiting | May need intervention |
| \`failed\` | ❌ Error occurred | Check logs, retry |

## Best Practices

### Monitoring Frequency
- **Interactive**: Every 5-10 seconds
- **Automatic**: Let \`wait_for_completion\` handle it
- **Batch**: Every 30-60 seconds for overview

### Timeout Management
\`\`\`javascript
// Good timeout settings
{
  "simple_login": 60,      // Basic form interactions
  "e_commerce": 180,       // Shopping flow with payments
  "complex_workflow": 300, // Multi-step processes
  "integration_test": 600  // Full system tests
}
\`\`\`

### Error Handling
1. **Session Not Found**: Check session ID, may have expired
2. **Timeout**: Increase timeout or break into smaller tests
3. **Pending Input**: Always respond promptly to avoid blocking
4. **API Errors**: Check API key and network connectivity

### Response Handling
When session requires input:

\`\`\`json
{
  "tool": "interact_with_qa_session",
  "params": {
    "sessionId": "session-id",
    "action": "respond",
    "message": "Your specific response based on the question"
  }
}
\`\`\`

## Common Patterns

### Pattern 1: App Config-Based Testing (Recommended)
\`\`\`javascript
// 1. Configure once (if not already done)
update_app_config({
  base_url: "https://staging.app.com",
  login_username: "test@company.com",
  login_password: "secure-password"
})

// 2. Start session (URL optional - uses app config)
start_qa_session({task: "Test user registration flow"})

// 3. Get session ID from response.data.agent_id
const sessionId = response.data.agent_id

// 4. Wait for completion
monitor_qa_session({
  sessionId,
  wait_for_completion: true,
  timeout: 180
})
\`\`\`

### Pattern 2: URL Override Testing
\`\`\`javascript
// Test specific page while keeping app config for credentials
start_qa_session({
  url: "https://app.com/special-feature",
  task: "Test special feature page"
})

// Monitor as usual
monitor_qa_session({sessionId, wait_for_completion: true})
\`\`\`

### Pattern 3: Multi-Environment Batch Testing
\`\`\`javascript
// 1. See available configurations
const configs = list_app_configs({limit: 10})

// 2. Run tests against specific config
run_automated_tests({
  test_ids: ['test1', 'test2', 'test3'],
  app_config_id: 'staging-config-id'
})

// 3. Monitor all sessions
const sessions = list_qa_sessions({limit: 50})
sessions.forEach(session => {
  if (session.status === 'active') {
    monitor_qa_session({
      sessionId: session.id,
      wait_for_completion: true
    })
  }
})
\`\`\`

### Pattern 4: Interactive Testing
\`\`\`javascript
// 1. Start session with app config
start_qa_session({task: "Interactive exploration"})

// 2. Monitor with auto-respond
while (status !== 'closed' && status !== 'idle') {
  const result = monitor_qa_session({sessionId, autoRespond: true})
  if (result.hasPendingInput) {
    // Handle user input prompt
    interact_with_qa_session({sessionId, action: "respond", message: response})
  }
  wait(5000) // Wait 5 seconds
}
\`\`\`

## Troubleshooting

### Session Stuck in "active"
- Increase timeout
- Check if user input is required
- Verify browser connectivity

### High Response Times
- Use pagination for large session lists
- Monitor fewer sessions simultaneously
- Check network connectivity

### Memory Usage
- Clean up completed sessions regularly
- Use appropriate timeouts
- Avoid monitoring too many sessions concurrently
`;
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.info(`${getName()} running (PID: ${process.pid}, Version: ${getVersion()})`);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private async cleanup(): Promise<void> {
    if (this.tunnelManager) {
      await this.tunnelManager.stopTunnel();
    }
    if (this.browserManager) {
      await this.browserManager.stopBrowser();
    }
  }
}

// Start the server
const server = new QAUseMcpServer();
await server.start();
