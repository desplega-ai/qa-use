import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';

import { BrowserManager } from '../lib/browser/index.js';
import { TunnelManager } from '../lib/tunnel/index.js';
import { ApiClient } from '../lib/api/index.js';

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
  headless?: boolean;
}

interface RegisterUserParams {
  email: string;
}

interface GetQaSessionParams {
  sessionId: string;
}

interface StartQaSessionParams {
  url: string;
  task: string;
  dependencyId?: string;
}

interface MonitorQaSessionParams {
  sessionId: string;
  autoRespond?: boolean;
}

interface RespondToQaSessionParams {
  sessionId: string;
  response: string;
}

interface SendMessageToQaSessionParams {
  sessionId: string;
  action: 'pause' | 'response' | 'close';
  data?: string;
}

interface GetAutomatedTestParams {
  testId: string;
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
        name: 'qa-use-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.globalApiClient = new ApiClient();
    this.setupTools();
  }

  private createSessionSummary(session: QASessionResponse): SessionSummary {
    return {
      id: session.id,
      status: session.status,
      createdAt: session.createdAt,
      data: {
        status: session.data?.status,
        url: session.data?.url,
        task: session.data?.task && session.data.task.length > 50
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
      note: 'Use get_qa_session for full details including history and blocks'
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
        historyNote: session.data?.history && session.data.history.length > 5
          ? `Showing last 5 of ${session.data.history.length} total history entries`
          : undefined,
        // Limit blocks to last 10 entries
        blocks: session.data?.blocks?.slice(-10) ?? [],
        blocksNote: session.data?.blocks && session.data.blocks.length > 10
          ? `Showing last 10 of ${session.data.blocks.length} total blocks`
          : undefined,
      },
      source: session.source,
    };
    return result;
  }

  private createTestSummary(test: { id: string; name: string; description?: string; url?: string; task?: string; status?: string; created_at: string; dependency_test_ids?: string[] }): TestSummary {
    return {
      id: test.id,
      name: test.name,
      description: test.description && test.description.length > 60
        ? test.description.substring(0, 60) + '...'
        : test.description,
      url: test.url,
      task: test.task && test.task.length > 60
        ? test.task.substring(0, 60) + '...'
        : test.task,
      status: test.status,
      created_at: test.created_at,
      dependency_test_ids: test.dependency_test_ids,
      note: 'Use get_automated_test for full details'
    };
  }

  private setupTools(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'init_qa_server',
            description: 'Initialize QA server environment and start browser',
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
                headless: {
                  type: 'boolean',
                  description: 'Run browser in headless mode (default: false)',
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
            description: 'List all QA testing sessions',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_qa_session',
            description: 'Get detailed information about a specific QA session',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'The session ID to retrieve',
                },
              },
              required: ['sessionId'],
            },
          },
          {
            name: 'start_qa_session',
            description: 'Start a new QA testing session. Returns sessionId (data.agent_id) for subsequent operations.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'The URL to test',
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
              required: ['url', 'task'],
            },
          },
          {
            name: 'monitor_qa_session',
            description:
              'Monitor a session for pending user input and provide interactive responses',
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
              },
              required: ['sessionId'],
            },
          },
          {
            name: 'respond_to_qa_session',
            description: 'Respond to a QA session that is waiting for user input',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'The session ID that needs a response',
                },
                response: {
                  type: 'string',
                  description: 'Your response to the pending question',
                },
              },
              required: ['sessionId', 'response'],
            },
          },
          {
            name: 'send_message_to_qa_session',
            description: 'Send control messages to an active session',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'The session ID',
                },
                action: {
                  type: 'string',
                  enum: ['pause', 'response', 'close'],
                  description: 'Action to perform',
                },
                data: {
                  type: 'string',
                  description: 'Additional message data',
                },
              },
              required: ['sessionId', 'action'],
            },
          },
          {
            name: 'search_automated_tests',
            description: 'Search and list all automated tests',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_automated_test',
            description: 'Get detailed information about a specific automated test',
            inputSchema: {
              type: 'object',
              properties: {
                testId: {
                  type: 'string',
                  description: 'The test ID to retrieve',
                },
              },
              required: ['testId'],
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
        return this.handleListQaSessions(params as unknown as Record<string, never>);
      }

      if (name === 'get_qa_session') {
        return this.handleGetQaSession(params as unknown as GetQaSessionParams);
      }

      if (name === 'start_qa_session') {
        return this.handleStartQaSession(params as unknown as StartQaSessionParams);
      }

      if (name === 'monitor_qa_session') {
        return this.handleMonitorQaSession(params as unknown as MonitorQaSessionParams);
      }

      if (name === 'respond_to_qa_session') {
        return this.handleRespondToQaSession(params as unknown as RespondToQaSessionParams);
      }

      if (name === 'send_message_to_qa_session') {
        return this.handleSendMessageToQaSession(params as unknown as SendMessageToQaSessionParams);
      }

      if (name === 'search_automated_tests') {
        return this.handleSearchAutomatedTests(params as unknown as Record<string, never>);
      }

      if (name === 'get_automated_test') {
        return this.handleGetAutomatedTest(params as unknown as GetAutomatedTestParams);
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
      const {
        apiKey,
        forceInstall,
        interactive,
        headless = false,
      } = params;

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

      return {
        content: [
          {
            type: 'text',
            text: `QA server initialized successfully. API key validated and browser started.\nAPI URL: ${apiUrl}\nApp URL: ${appUrl}\nLocal Browser WebSocket: ${wsEndpoint}\nTunneled Browser WebSocket: ${tunnelWsUrl}\nTunnel URL: ${tunnelSession.publicUrl}\nHeadless mode: ${headless}`,
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

  private async handleListQaSessions(params: Record<string, never>): Promise<CallToolResult> {
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
        const sessions = await this.globalApiClient.listSessions();

        // Limit to first 20 sessions to avoid token overflow
        const limitedSessions = sessions.slice(0, 20);
        const sessionSummaries = limitedSessions.map(session => this.createSessionSummary(session));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                sessions: sessionSummaries,
                displayed: limitedSessions.length,
                total: sessions.length,
                truncated: sessions.length > 20,
                note: sessions.length > 20
                  ? `Showing first 20 of ${sessions.length} sessions to avoid token limits. Use get_qa_session for specific session details.`
                  : 'This is a summary view. Use get_qa_session with a specific sessionId to get full details including complete history and blocks.'
              }, null, 2),
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

  private async handleGetQaSession(params: GetQaSessionParams): Promise<CallToolResult> {
    try {
      const { sessionId } = params;

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
        const session = await this.globalApiClient.getSession(sessionId);
        const sessionDetails = this.createSessionDetails(session);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sessionDetails, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to get session: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
            text: `Failed to get session: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
          }
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
      const { sessionId, autoRespond = true } = params;

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
        const session = await this.globalApiClient.getSession(sessionId);

        const result = {
          sessionId: session.id,
          status: session.data?.status || session.status,
          hasPendingInput: !!session.data?.pending_user_input,
          pendingInput: session.data?.pending_user_input,
          lastDone: session.data?.last_done,
          liveviewUrl: session.data?.liveview_url,
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

  private async handleRespondToQaSession(params: RespondToQaSessionParams): Promise<CallToolResult> {
    try {
      const { sessionId, response } = params;

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
        // Send the user's response to the session
        const result = await this.globalApiClient.sendMessage({
          sessionId,
          action: 'response',
          data: response,
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ Response sent to session ${sessionId}: "${response}"\n\nResult: ${JSON.stringify(result)}\n\n💡 **Tip:** Use monitor_qa_session to check if the session needs more input.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to send response: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
            text: `Failed to respond to session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleSendMessageToQaSession(params: SendMessageToQaSessionParams): Promise<CallToolResult> {
    try {
      const {
        sessionId,
        action,
        data = '',
      } = params;

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
        const result = await this.globalApiClient.sendMessage({
          sessionId,
          action,
          data,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Message sent to session ${sessionId}: ${JSON.stringify(result)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
            text: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleSearchAutomatedTests(params: Record<string, never>): Promise<CallToolResult> {
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
        const tests = await this.globalApiClient.listTests();

        // Limit to first 50 tests to avoid token overflow
        const limitedTests = tests.slice(0, 50);
        const testSummaries = limitedTests.map(test => this.createTestSummary(test));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                tests: testSummaries,
                displayed: limitedTests.length,
                total: tests.length,
                truncated: tests.length > 50,
                note: tests.length > 50
                  ? `Showing first 50 of ${tests.length} tests to avoid token limits. Use get_automated_test for specific test details.`
                  : 'This is a summary view. Use get_automated_test with a specific testId to get full details.'
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to fetch tests: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
            text: `Failed to search tests: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetAutomatedTest(params: GetAutomatedTestParams): Promise<CallToolResult> {
    try {
      const { testId } = params;

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
        const test = await this.globalApiClient.getTest(testId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(test, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to get test: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
            text: `Failed to get test: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('QA-Use MCP Server started');

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
