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
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { BrowserManager } from '../lib/browser/index.js';
import { TunnelManager } from '../lib/tunnel/index.js';
import { ApiClient } from '../lib/api/index.js';
import { getName, getVersion } from './utils/package.js';
import type { TestAgentV2Session, UserInputIntent } from './types.js';
import { isTestCreatorDoneIntent } from './types.js';
import {
  generateEnhancedTestSummary,
  formatEnhancedTestReport,
  generateIssueStatistics,
  categorizeIssues,
} from './utils/summary.js';

interface EnsureInstalledParams {
  apiKey?: string;
}

interface RegisterUserParams {
  email: string;
}

interface SearchSessionsParams {
  limit?: number;
  offset?: number;
  query?: string;
}

interface StartAutomatedSessionParams {
  url?: string;
  task: string;
  dependencyId?: string;
  headless?: boolean;
}

interface StartDevSessionParams {
  url?: string;
  task: string;
  headless?: boolean;
}

interface MonitorSessionParams {
  sessionId: string;
  wait?: boolean;
  timeout?: number;
}

interface InteractWithSessionParams {
  sessionId: string;
  action: 'respond' | 'pause' | 'close';
  message?: string;
}

interface SearchAutomatedTestsParams {
  testId?: string;
  query?: string;
  limit?: number;
  offset?: number;
  self_only?: boolean;
}

interface RunAutomatedTestsParams {
  test_ids: string[];
  app_config_id?: string;
}

interface SearchAutomatedTestRunsParams {
  test_id?: string;
  run_id?: string;
  limit?: number;
  offset?: number;
}

type ViewportConfigType = 'big_desktop' | 'desktop' | 'mobile' | 'tablet';

interface UpdateConfigurationParams {
  base_url?: string;
  login_url?: string;
  login_username?: string;
  login_password?: string;
  vp_type?: ViewportConfigType;
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

type SessionType = 'dev' | 'automated' | 'test_run';

class BrowserSession {
  session_id: string;
  created_at: number;
  browser: BrowserManager;
  tunnel: TunnelManager;
  ttl: number;
  deadline: number;
  session_type: SessionType;

  constructor(
    sessionId: string,
    browser: BrowserManager,
    tunnel: TunnelManager,
    sessionType: SessionType,
    ttl: number = 30 * 60 * 1000 // 30 minutes default
  ) {
    this.session_id = sessionId;
    this.created_at = Date.now();
    this.browser = browser;
    this.tunnel = tunnel;
    this.ttl = ttl;
    this.deadline = this.created_at + ttl;
    this.session_type = sessionType;
  }

  refreshDeadline(): void {
    this.deadline = Date.now() + this.ttl;
  }

  isExpired(): boolean {
    return Date.now() > this.deadline;
  }

  async cleanup(): Promise<void> {
    try {
      await this.tunnel.stopTunnel();
    } catch (error) {
      // Ignore cleanup errors
    }
    try {
      await this.browser.stopBrowser();
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

class QAUseMcpServer {
  private server: Server;
  private globalApiClient: ApiClient;

  private browserSessions: BrowserSession[] = [];
  private readonly MAX_SESSIONS = 10;
  private readonly DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

  private cleanupInterval: NodeJS.Timeout | null = null;

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
    this.startCleanupTask();
  }

  private createSessionSummary(session: TestAgentV2Session) {
    let task = '<Not specified>';

    if (session.data.history?.length > 0) {
      task = session.data.history[0].task;
    }

    return {
      id: session.id,
      status: session.status,
      createdAt: session.created_at,
      data: {
        status: session.data?.status,
        url: session.data?.liveview_url,
        task,
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
    } as SessionSummary;
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

  private formatSessionProgress(session: any, elapsed?: number, iterations?: number): string {
    const status = session.data?.status || session.status;
    const sessionId = session.id;
    const liveviewUrl = session.data?.liveview_url;
    const lastDone = session.data?.last_done;
    const task = session.data?.task;
    const history = session.data?.history || [];
    const blocks = session.data?.blocks || [];

    // Build rich progress context from last_done and recent history
    let outcomeMessage = '';
    let progressSummary = '';
    let recentSteps = '';

    // Extract outcome from last_done
    if (lastDone) {
      if (lastDone.message) {
        outcomeMessage = lastDone.message;
      }
      if (lastDone.status) {
        const statusEmoji =
          lastDone.status === 'failure' ? '❌' : lastDone.status === 'success' ? '✅' : '📋';
        outcomeMessage = `${statusEmoji} ${lastDone.status.toUpperCase()}: ${outcomeMessage || 'Session completed'}`;
      }
      if (lastDone.reasoning) {
        progressSummary =
          lastDone.reasoning.length > 150
            ? lastDone.reasoning.substring(0, 150) + '...'
            : lastDone.reasoning;
      }
    }

    // Get recent steps from history
    if (history.length > 0) {
      const latestTask = history[history.length - 1];
      if (latestTask.intents && latestTask.intents.length > 0) {
        const recentIntents = latestTask.intents.slice(-3); // Last 3 actions
        const stepNames = recentIntents.map(
          (intent: any) => intent.intent?.short_name || intent.intent?.type || 'Action'
        );
        recentSteps = stepNames.join(' → ');
      }
    }

    // Execution stats
    const totalBlocks = blocks.length;
    const completedTasks = history.filter((h: any) => h.status === 'completed').length;
    const failedTasks = history.filter((h: any) => h.status === 'failed').length;

    // Check for enhanced test results
    let enhancedTestInfo = '';
    if (lastDone && isTestCreatorDoneIntent(lastDone)) {
      const testType = lastDone.is_positive ? 'Positive' : 'Negative';
      const resultIcon = lastDone.status === 'success' ? '✅' : '❌';
      enhancedTestInfo = `\n${resultIcon} **${testType} Test**: ${lastDone.status.toUpperCase()}`;
      if (lastDone.issues && lastDone.issues.length > 0) {
        const categorized = categorizeIssues(lastDone.issues);
        const criticalCount = categorized.critical.length;
        const highCount = categorized.high.length;
        enhancedTestInfo += `\n🔍 **Issues Found**: ${lastDone.issues.length} total`;
        if (criticalCount > 0) enhancedTestInfo += ` (${criticalCount} critical)`;
        if (highCount > 0) enhancedTestInfo += ` (${highCount} high)`;
      }
      if (lastDone.explanation) {
        const shortExplanation =
          lastDone.explanation.length > 100
            ? lastDone.explanation.substring(0, 100) + '...'
            : lastDone.explanation;
        enhancedTestInfo += `\n📝 **Explanation**: ${shortExplanation}`;
      }
    }

    // Format based on whether this is a timeout scenario or instant check
    if (elapsed !== undefined && iterations !== undefined) {
      // This is a timeout scenario - session still running
      return `⏳ **Session Still Running** (${elapsed}s elapsed)

🎯 **Task**: ${task || 'QA Testing Session'}

📍 **Current Status**: ${status}

${outcomeMessage ? `🎯 **Latest Outcome**: ${outcomeMessage}` : ''}

${recentSteps ? `🔄 **Recent Steps**: ${recentSteps}` : ''}

${progressSummary ? `📋 **Progress Details**: ${progressSummary}` : ''}
${enhancedTestInfo}

📊 **Execution Stats**: ${totalBlocks} blocks generated, ${completedTasks} tasks completed${failedTasks > 0 ? `, ${failedTasks} tasks failed` : ''}

${liveviewUrl ? `👀 **Watch Live**: ${liveviewUrl}` : ''}

⏰ **Monitoring Info**: Checked ${iterations} times over ${elapsed}s

🎯 **Next step**: monitor_qa_session({sessionId: "${sessionId}", wait_for_completion: true}) to continue monitoring`;
    } else {
      // This is an instant status check
      return `📊 **Session Status**: ${status}

🎯 **Task**: ${task || 'QA Testing Session'}

${outcomeMessage ? `🎯 **Latest Outcome**: ${outcomeMessage}` : ''}

${recentSteps ? `🔄 **Recent Steps**: ${recentSteps}` : ''}

${progressSummary ? `📋 **Progress Details**: ${progressSummary}` : ''}
${enhancedTestInfo}

📊 **Execution Stats**: ${totalBlocks} blocks generated, ${completedTasks} tasks completed${failedTasks > 0 ? `, ${failedTasks} tasks failed` : ''}

${liveviewUrl ? `👀 **Watch Live**: ${liveviewUrl}` : ''}

${status === 'active' ? '🎯 **Next step**: monitor_qa_session({sessionId: "' + sessionId + '", wait_for_completion: true}) to wait for completion' : ''}
${status === 'pending' ? '❓ **Needs Input**: Check for pending_user_input and use interact_with_qa_session to respond' : ''}
${status === 'closed' ? '✅ **Completed**: Session finished successfully' : ''}
${status === 'idle' ? '⏸️ **Paused**: Session is idle, may need intervention' : ''}`;
    }
  }

  private formatSessionCompletion(session: any, elapsed: number, iterations: number): string {
    const status = session.data?.status || session.status;
    const sessionId = session.id;
    const liveviewUrl = session.data?.liveview_url;
    const lastDone = session.data?.last_done;
    const task = session.data?.task;

    // Build final result context
    let resultContext = '';
    if (lastDone) {
      if (typeof lastDone === 'string') {
        resultContext = lastDone.length > 150 ? lastDone.substring(0, 150) + '...' : lastDone;
      } else if (lastDone.action || lastDone.description) {
        resultContext = lastDone.action || lastDone.description || 'Session completed';
        if (resultContext.length > 150) {
          resultContext = resultContext.substring(0, 150) + '...';
        }
      }
    }

    const statusEmoji = status === 'closed' ? '✅' : '⏸️';
    const statusText = status === 'closed' ? 'Completed Successfully' : 'Paused';

    let baseReport = `${statusEmoji} **Session ${statusText}** (${elapsed}s total)

🎯 **Task**: ${task || 'QA Testing Session'}

📍 **Final Status**: ${status}

${resultContext ? `📋 **Final Result**: ${resultContext}` : '✅ **Status**: Session completed'}

${liveviewUrl ? `👀 **Recording**: ${liveviewUrl}` : ''}

⏰ **Session Info**: Monitored for ${elapsed}s with ${iterations} status checks

🎯 **Next step**: Session complete! You can now start a new session or view results${liveviewUrl ? ' in the recording' : ''}`;

    // Add enhanced summary if TestCreatorDoneIntent is available
    if (lastDone && isTestCreatorDoneIntent(lastDone)) {
      try {
        const enhancedSummary = generateEnhancedTestSummary(session.data);
        const enhancedReport = formatEnhancedTestReport(enhancedSummary);
        baseReport += '\n\n---\n\n' + enhancedReport;

        // Add issue statistics if issues were found
        if (enhancedSummary.discoveredIssues.length > 0) {
          const stats = generateIssueStatistics(enhancedSummary.discoveredIssues);
          baseReport += `\n\n## Issue Statistics\n`;
          baseReport += `- Total Issues: ${stats.totalIssues}\n`;
          baseReport += `- Critical/Blocker: ${stats.criticalCount}\n`;
          baseReport += `- Most Common Type: ${stats.mostCommonType || 'N/A'}\n`;
        }
      } catch (error) {
        // Silently fail if enhanced summary generation fails
        console.error('Failed to generate enhanced summary:', error);
      }
    }

    return baseReport;
  }

  private startCleanupTask(): void {
    // Check for expired sessions every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 1000);
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const expiredSessions = this.browserSessions.filter((session) => session.isExpired());

    for (const session of expiredSessions) {
      try {
        // For dev/automated sessions, try to close gracefully via API
        if (session.session_type === 'dev' || session.session_type === 'automated') {
          try {
            await this.globalApiClient.sendMessage({
              sessionId: session.session_id,
              action: 'close',
              data: 'Session expired due to inactivity',
            });
          } catch (error) {
            // If API call fails, continue with cleanup
          }
        }

        // Always cleanup browser and tunnel
        await session.cleanup();

        // Remove from array
        this.browserSessions = this.browserSessions.filter(
          (s) => s.session_id !== session.session_id
        );
      } catch (error) {
        // Silent cleanup - continue with next session
      }
    }
  }

  private getBrowserSession(sessionId: string): BrowserSession | null {
    return this.browserSessions.find((s) => s.session_id === sessionId) || null;
  }

  private async createBrowserAndTunnel(
    headless: boolean = false
  ): Promise<{ browser: BrowserManager; tunnel: TunnelManager; wsUrl: string }> {
    // Check session limit
    if (this.browserSessions.length >= this.MAX_SESSIONS) {
      throw new Error(
        `Maximum number of browser sessions (${this.MAX_SESSIONS}) reached. Please use reset_browser_sessions tool to clean up old sessions before creating new ones.`
      );
    }

    // Create new browser and tunnel
    const browser = new BrowserManager();
    const browserResult = await browser.startBrowser({ headless });
    const wsEndpoint = browserResult.wsEndpoint;

    const tunnel = new TunnelManager();
    const wsUrl = new URL(wsEndpoint);
    const browserPort = parseInt(wsUrl.port);
    await tunnel.startTunnel(browserPort);

    const localWsUrl = browser.getWebSocketEndpoint();
    if (!localWsUrl) {
      await tunnel.stopTunnel();
      await browser.stopBrowser();
      throw new Error('Failed to get browser WebSocket endpoint');
    }

    const tunneledWsUrl = tunnel.getWebSocketUrl(localWsUrl);
    if (!tunneledWsUrl) {
      await tunnel.stopTunnel();
      await browser.stopBrowser();
      throw new Error('Failed to create tunneled WebSocket URL');
    }

    return { browser, tunnel, wsUrl: tunneledWsUrl };
  }

  private addBrowserSession(
    sessionId: string,
    browser: BrowserManager,
    tunnel: TunnelManager,
    sessionType: SessionType
  ): BrowserSession {
    const session = new BrowserSession(
      sessionId,
      browser,
      tunnel,
      sessionType,
      this.DEFAULT_TTL_MS
    );
    this.browserSessions.push(session);
    return session;
  }

  private async resetAllBrowserSessions(): Promise<void> {
    for (const session of this.browserSessions) {
      try {
        await session.cleanup();
      } catch (error) {
        // Silent cleanup
      }
    }
    this.browserSessions = [];
  }

  private setupTools(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'ensure_installed',
            description:
              'Ensure API key is set, validate authentication, and install Playwright browsers. Does not start browsers (lazy initialization on session start).',
            inputSchema: {
              type: 'object',
              properties: {
                apiKey: {
                  type: 'string',
                  description:
                    'API key for desplega.ai (optional if QA_USE_API_KEY env var is set)',
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
            name: 'search_sessions',
            description:
              'Search and list all sessions (automated tests and development sessions) with pagination and filtering',
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
            name: 'start_automated_session',
            description:
              'Start an automated E2E test session for QA flows and automated testing. Returns sessionId (data.agent_id) for monitoring. URL is optional - uses app config base_url if not provided.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'Optional URL to test (overrides app config base_url if provided)',
                },
                task: {
                  type: 'string',
                  description: 'The testing task or scenario to execute',
                },
                dependencyId: {
                  type: 'string',
                  description:
                    'Optional test ID that this session depends on (must be a self test ID created by your app configuration)',
                },
                headless: {
                  type: 'boolean',
                  description:
                    'Run browser in headless mode (default: false for better visibility)',
                },
              },
              required: ['task'],
            },
          },
          {
            name: 'start_dev_session',
            description:
              'Start an interactive development session for debugging and exploration. Session will not auto-pilot and allows manual browser interaction.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description:
                    'Optional URL to start from (overrides app config base_url if provided)',
                },
                task: {
                  type: 'string',
                  description:
                    'Description of what you want to explore or debug. Generally you can leave it blank or with a placeholder like "Waiting for user input" if you just want to start a blank session.',
                },
                headless: {
                  type: 'boolean',
                  description:
                    'Run browser in headless mode (default: false for development visibility)',
                },
              },
              required: ['task'],
            },
          },
          {
            name: 'monitor_session',
            description:
              'Monitor a session status. Keep calling until status is "closed". Will alert if session needs user input, is idle, or pending.',
            inputSchema: {
              type: 'object',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'The session ID to monitor',
                },
                wait: {
                  type: 'boolean',
                  description:
                    'Wait for session to reach any non-running state (closed, idle, needs_user_input, pending) with MCP timeout protection (max 25s per call)',
                },
                timeout: {
                  type: 'number',
                  description:
                    'User timeout in seconds for wait mode (default: 60). Note: MCP timeout protection limits each call to 25s max.',
                  minimum: 1,
                },
              },
              required: ['sessionId'],
            },
          },
          {
            name: 'interact_with_session',
            description:
              'Interact with a session - respond to questions, pause, or close the session',
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
            name: 'search_automated_tests',
            description:
              'Search for automated tests by ID or query. If testId provided, returns detailed info for that test. Otherwise searches with optional query/pagination.',
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
                self_only: {
                  type: 'boolean',
                  description:
                    'Filter tests by app configuration. When true, only returns tests created by your application configuration. Default: false to allow running tests from other configs locally.',
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
            name: 'search_automated_test_runs',
            description: 'Search automated test runs with optional filtering by test ID or run ID',
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
            name: 'update_configuration',
            description:
              'Update application configuration settings including base URL, login credentials, and viewport type',
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
            name: 'get_configuration',
            description:
              'Get the current application configuration details including base URL, login settings, and viewport',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'reset_browser_sessions',
            description:
              'Reset and cleanup all active browser sessions. This will kill all browsers and tunnels. Use this when you hit the maximum session limit or need to free up resources.',
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

      if (name === 'ensure_installed') {
        return this.handleEnsureInstalled(params as unknown as EnsureInstalledParams);
      }

      if (name === 'register_user') {
        return this.handleRegisterUser(params as unknown as RegisterUserParams);
      }

      if (name === 'search_sessions') {
        return this.handleSearchSessions(params as unknown as SearchSessionsParams);
      }

      if (name === 'start_automated_session') {
        return this.handleStartAutomatedSession(params as unknown as StartAutomatedSessionParams);
      }

      if (name === 'start_dev_session') {
        return this.handleStartDevSession(params as unknown as StartDevSessionParams);
      }

      if (name === 'monitor_session') {
        return this.handleMonitorSession(params as unknown as MonitorSessionParams);
      }

      if (name === 'interact_with_session') {
        return this.handleInteractWithSession(params as unknown as InteractWithSessionParams);
      }

      if (name === 'search_automated_tests') {
        return this.handleSearchAutomatedTests(params as unknown as SearchAutomatedTestsParams);
      }

      if (name === 'run_automated_tests') {
        return this.handleRunAutomatedTests(params as unknown as RunAutomatedTestsParams);
      }

      if (name === 'search_automated_test_runs') {
        return this.handleSearchAutomatedTestRuns(
          params as unknown as SearchAutomatedTestRunsParams
        );
      }

      if (name === 'update_configuration') {
        return this.handleUpdateConfiguration(params as unknown as UpdateConfigurationParams);
      }

      if (name === 'get_configuration') {
        return this.handleGetConfiguration();
      }

      if (name === 'reset_browser_sessions') {
        return this.handleResetBrowserSessions();
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

  private async handleEnsureInstalled(params: EnsureInstalledParams): Promise<CallToolResult> {
    try {
      const { apiKey } = params;

      // Use provided API key or fall back to environment variable
      if (apiKey) {
        this.globalApiClient.setApiKey(apiKey);
      } else if (!this.globalApiClient.getApiKey()) {
        return {
          content: [
            {
              type: 'text',
              text: 'No API key provided and QA_USE_API_KEY environment variable not set. Please provide an API key or set the environment variable.',
            },
          ],
          isError: true,
        };
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

      // Always install Playwright browsers (no-op if already installed)
      const browserManager = new BrowserManager();
      await browserManager.installPlaywrightBrowsers();

      const apiUrl = this.globalApiClient.getApiUrl();
      const appUrl = ApiClient.getAppUrl();
      const appConfigId = this.globalApiClient.getAppConfigId();

      let message = `✅ Environment ready!\nAPI Key: Valid\nAPI URL: ${apiUrl}\nApp URL: ${appUrl}\nBrowsers: Installed`;

      if (appConfigId) {
        message += `\nApp Config ID: ${appConfigId}`;
      }

      // Include app config details if available
      if (authResult.data?.app_config) {
        const appConfig = authResult.data.app_config;
        message += `\nApp Config: ${appConfig.name} (${appConfig.base_url})`;
        if (appConfig.login_url) {
          message += `\nLogin URL: ${appConfig.login_url}`;
        }

        // Check if app config needs setup
        if (!appConfig.base_url || appConfig.base_url.trim() === '') {
          message += `\n\n🔧 **Setup Required**: Your app config needs a base URL. Run update_configuration to configure.`;
        }
      } else {
        message += `\n\n🔧 **First Time Setup**: Run update_configuration to set your base URL and login credentials.`;
      }

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Environment check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  private async ensureInitialized(): Promise<CallToolResult> {
    // Check for API key
    if (!this.globalApiClient.getApiKey()) {
      return {
        content: [
          {
            type: 'text',
            text: 'API key not configured. Please set QA_USE_API_KEY environment variable or run ensure_installed with an API key.',
          },
        ],
        isError: true,
      };
    }

    // Validate API key if not already validated
    try {
      const authResult = await this.globalApiClient.validateApiKey();
      if (!authResult.success) {
        return {
          content: [
            {
              type: 'text',
              text: `API key validation failed: ${authResult.message}. Please run ensure_installed with a valid API key.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: 'Initialized' }],
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

  private async handleSearchSessions(params: SearchSessionsParams): Promise<CallToolResult> {
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

  private async handleStartAutomatedSession(
    params: StartAutomatedSessionParams
  ): Promise<CallToolResult> {
    try {
      const { url, task, dependencyId, headless = false } = params;

      // Ensure API key is set
      const initResult = await this.ensureInitialized();
      if (initResult.isError) {
        return initResult;
      }

      try {
        // Create browser and tunnel first
        const { browser, tunnel, wsUrl } = await this.createBrowserAndTunnel(headless);

        // Create session via API with the actual wsUrl
        const { sessionId, appConfigId } = await this.globalApiClient.createSession({
          url,
          task,
          wsUrl,
          dependencyId,
          devMode: false, // Automated session
        });

        // Wrap browser and tunnel in a BrowserSession
        this.addBrowserSession(sessionId, browser, tunnel, 'automated');

        const result = {
          success: true,
          message: 'Automated test session started successfully',
          sessionId: sessionId,
          sessionType: 'automated',
          // TODO(1): For automated test sessions, use monitor_session to track progress.
          // For test runs created via run_automated_tests, use search_automated_test_runs instead.
          note: `Use sessionId "${sessionId}" for monitoring and interaction. This automated session uses App Config ID: ${appConfigId}. Monitor with monitor_session tool.`,
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
        // Check if it's the session limit error
        if (
          error instanceof Error &&
          error.message.includes('Maximum number of browser sessions')
        ) {
          return {
            content: [
              {
                type: 'text',
                text: error.message,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Failed to start automated session: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
            text: `Failed to start automated session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleStartDevSession(params: StartDevSessionParams): Promise<CallToolResult> {
    try {
      const { url, task, headless = false } = params;

      // Ensure API key is set
      const initResult = await this.ensureInitialized();

      if (initResult.isError) {
        return initResult;
      }

      try {
        // Create browser and tunnel first
        const { browser, tunnel, wsUrl } = await this.createBrowserAndTunnel(headless);

        // Create session via API with the actual wsUrl
        const { sessionId, appConfigId } = await this.globalApiClient.createSession({
          url,
          task,
          wsUrl,
          devMode: true, // Development session
        });

        // Wrap browser and tunnel in a BrowserSession
        this.addBrowserSession(sessionId, browser, tunnel, 'dev');

        const result = {
          success: true,
          message: 'Development session started successfully',
          sessionId: sessionId,
          sessionType: 'development',
          note: `Use sessionId "${sessionId}" for monitoring and interaction. This dev session allows manual browser control and uses App Config ID: ${appConfigId}.`,
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
        // Check if it's the session limit error
        if (
          error instanceof Error &&
          error.message.includes('Maximum number of browser sessions')
        ) {
          return {
            content: [
              {
                type: 'text',
                text: error.message,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Failed to start dev session: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
            text: `Failed to start dev session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleMonitorSession(params: MonitorSessionParams): Promise<CallToolResult> {
    try {
      const { sessionId, wait = false, timeout = 60 } = params;

      if (!this.globalApiClient.getApiKey()) {
        return {
          content: [
            {
              type: 'text',
              text: 'API key not configured. Please run ensure_installed first with an API key.',
            },
          ],
          isError: true,
        };
      }

      if (wait) {
        return this.handleWaitForNonRunningState(sessionId, timeout);
      }

      try {
        const session = await this.globalApiClient.getSession(sessionId);

        const status = session.data?.status || session.status;

        // Refresh deadline if session is not closed
        if (status !== 'closed') {
          const browserSession = this.getBrowserSession(sessionId);
          if (browserSession) {
            browserSession.refreshDeadline();
          }
        } else {
          // Session is closed, clean it up
          const browserSession = this.getBrowserSession(sessionId);
          if (browserSession) {
            await browserSession.cleanup();
            this.browserSessions = this.browserSessions.filter((s) => s.session_id !== sessionId);
          }
        }

        const result = {
          sessionId: session.id,
          status: status,
          hasPendingInput: !!session.data?.pending_user_input,
          pendingInput: session.data?.pending_user_input,
          lastDone: session.data?.last_done,
          liveviewUrl: session.data?.liveview_url,
          note: 'Keep calling monitor_session until status is "closed".',
        };

        // Alert on specific statuses
        if (status === 'idle' || status === 'pending' || status === 'need_user_input') {
          let alertMessage = `⚠️ Session ${sessionId} is in "${status}" state`;

          if (status === 'need_user_input' && session.data?.pending_user_input) {
            const pendingInput = session.data.pending_user_input;
            alertMessage += `\n\n**Input Required:**\n`;
            alertMessage += `Context: ${pendingInput.reasoning || 'Session needs input'}\n`;
            alertMessage += `Question: ${pendingInput.question || 'Please provide response'}\n`;
            alertMessage += `Priority: ${pendingInput.priority || 'normal'}\n\n`;
            alertMessage += `Use interact_with_session to respond.`;
          } else if (status === 'idle') {
            alertMessage += `\nSession is waiting but not actively processing.`;
          } else if (status === 'pending') {
            alertMessage += `\nSession is pending and may need attention.`;
          }

          return {
            content: [
              {
                type: 'text',
                text: alertMessage,
              },
            ],
            isError: false,
          };
        }

        // Create conversational status with context
        const statusText = this.formatSessionProgress(session);

        return {
          content: [
            {
              type: 'text',
              text: statusText,
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

  private async handleWaitForNonRunningState(
    sessionId: string,
    timeout: number
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

          // Check if session is in non-running state
          if (status !== 'running') {
            let message = `Session ${sessionId} reached "${status}" state after ${elapsed} seconds`;

            if (status === 'closed') {
              message = `✅ Session ${sessionId} completed and closed after ${elapsed} seconds`;
            } else if (status === 'idle') {
              message = `⚠️ Session ${sessionId} is idle after ${elapsed} seconds`;
            } else if (status === 'need_user_input' && session.data?.pending_user_input) {
              const pendingInput = session.data.pending_user_input;
              message = `⚠️ Session ${sessionId} needs user input after ${elapsed} seconds\n\n`;
              message += `**Input Required:**\n`;
              message += `Context: ${pendingInput.reasoning || 'Session needs input'}\n`;
              message += `Question: ${pendingInput.question || 'Please provide response'}\n`;
              message += `Priority: ${pendingInput.priority || 'normal'}\n\n`;
              message += `Use interact_with_session to respond.`;
            } else if (status === 'pending') {
              message = `⚠️ Session ${sessionId} is pending after ${elapsed} seconds`;
            }

            return {
              content: [
                {
                  type: 'text',
                  text: message,
                },
              ],
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

        // Create conversational timeout message with context
        const timeoutText = this.formatSessionProgress(session, elapsed, iteration);

        return {
          content: [
            {
              type: 'text',
              text: timeoutText,
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

  private async handleInteractWithSession(
    params: InteractWithSessionParams
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

        await this.globalApiClient.sendMessage({
          sessionId,
          action: apiAction,
          data: message,
        });

        // Refresh deadline on interaction (always)
        const browserSession = this.getBrowserSession(sessionId);
        if (browserSession) {
          browserSession.refreshDeadline();
        }

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

  private async handleSearchAutomatedTests(
    params: SearchAutomatedTestsParams
  ): Promise<CallToolResult> {
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

      const { testId, query, limit = 10, offset = 0, self_only = false } = params;

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
        const options = { limit, offset, query: query || '', self_only };
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
      const { test_ids, app_config_id } = params;

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
        // Create browser and tunnel for test runs
        const { browser, tunnel, wsUrl } = await this.createBrowserAndTunnel(true); // headless for test runs

        // Run tests with the wsUrl
        const result = await this.globalApiClient.runTests({
          test_ids,
          ws_url: wsUrl,
          app_config_id,
        });

        // For test runs, we store the browser/tunnel with a generic test_run session type
        // We'll use the test_run_id as the session identifier
        if (result.success && result.test_run_id) {
          this.addBrowserSession(result.test_run_id, browser, tunnel, 'test_run');
        }

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
                    app_config_id: app_config_id || 'Using API key default config',
                    sessions: result.sessions,
                    note: 'Tests are now running. Use search_automated_test_runs with the test_run_id or test_id to monitor progress.',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } else {
          // Cleanup browser/tunnel if test run failed
          await tunnel.stopTunnel();
          await browser.stopBrowser();

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: false,
                    message: result.message || 'Failed to start tests',
                    test_ids: test_ids,
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
        // Check if it's the session limit error
        if (
          error instanceof Error &&
          error.message.includes('Maximum number of browser sessions')
        ) {
          return {
            content: [
              {
                type: 'text',
                text: error.message,
              },
            ],
            isError: true,
          };
        }

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

  private async handleSearchAutomatedTestRuns(
    params: SearchAutomatedTestRunsParams
  ): Promise<CallToolResult> {
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

  private async handleUpdateConfiguration(
    params: UpdateConfigurationParams
  ): Promise<CallToolResult> {
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

  private async handleGetConfiguration(): Promise<CallToolResult> {
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

  private async handleResetBrowserSessions(): Promise<CallToolResult> {
    try {
      const sessionCount = this.browserSessions.length;
      await this.resetAllBrowserSessions();

      return {
        content: [
          {
            type: 'text',
            text: `✅ Successfully reset ${sessionCount} browser session(s). All browsers and tunnels have been cleaned up.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to reset browser sessions: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
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
            uri: 'qa-use://guides/tools',
            name: 'Tool Reference',
            description: 'Detailed documentation for all available MCP tools',
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

        case 'qa-use://guides/tools':
          return {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: this.getToolsGuide(),
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
            name: 'aaa_test',
            description:
              'Generate a structured test scenario using the AAA (Arrange-Act-Assert) framework',
            arguments: [
              {
                name: 'test_type',
                description:
                  'Type of test (login, form, navigation, e-commerce, accessibility, etc.)',
                required: true,
              },
              {
                name: 'url',
                description: 'Target URL for testing',
                required: true,
              },
              {
                name: 'feature',
                description: 'Specific feature or functionality to test',
                required: false,
              },
              {
                name: 'expected_outcome',
                description: 'Expected outcome or success criteria',
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
        case 'aaa_test':
          return {
            description: 'AAA framework test',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: this.generateAAATestPrompt(args),
                },
              },
            ],
          };

        default:
          throw new Error(`Prompt not found: ${name}`);
      }
    });
  }

  private generateAAATestPrompt(args: Record<string, unknown> = {}): string {
    const testType = String(args.test_type || 'general');
    const url = String(args.url || 'https://example.com');
    const feature = String(args.feature || 'core functionality');
    const expectedOutcome = String(args.expected_outcome || 'successful completion');

    return `Create a ${testType} test using the AAA (Arrange-Act-Assert) framework for QA-Use MCP server.

**Test Type:** ${testType}
**Target URL:** ${url}
**Feature:** ${feature}
**Expected Outcome:** ${expectedOutcome}

**ARRANGE:**
Navigate to ${url} and prepare the testing environment. Verify the page loads correctly and the "${feature}" is visible and accessible. Set up any necessary preconditions for testing.

**ACT:**
Execute the primary ${testType} workflow for "${feature}". Interact with the feature following the expected user flow.

**ASSERT:**
Verify that the expected outcome is achieved: ${expectedOutcome}
- Check that the feature works as expected
- Verify no errors are displayed
- Confirm the UI state is correct
- Validate any expected changes (URL, content, state)

**QA-Use Implementation Tips:**
- Use specific, descriptive selectors (button text, labels, headings)
- Wait for page loads and state changes before acting
- Verify multiple aspects: functionality, UI state, and user feedback
- Handle async operations and loading states appropriately
- Test edge cases and error conditions

**Success Criteria:**
- The ${testType} test completes successfully
- All assertions pass
- The feature "${feature}" works as expected
- Expected outcome "${expectedOutcome}" is achieved

Write the task description for start_automated_session following this AAA structure.`;
  }

  private getGettingStartedGuide(): string {
    return `# QA-Use MCP Server - Getting Started Guide

## Quick Setup

### 1. Initialize the Server
\`\`\`json
{
  "tool": "ensure_installed",
  "params": {
    "apiKey": "your-api-key"
  }
}
\`\`\`

### 2. Configure Your App (One-time setup)
\`\`\`json
{
  "tool": "update_configuration",
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
  "tool": "start_automated_session",
  "params": {
    "task": "Test login functionality using configured credentials"
  }
}
\`\`\`

### 4. Monitor Progress
\`\`\`json
{
  "tool": "monitor_session",
  "params": {
    "sessionId": "session-id-from-start-response",
    "wait": true,
    "timeout": 120
  }
}
\`\`\`

## Workflow Benefits

- **One-time Setup**: Configure your app once, test repeatedly
- **User Isolation**: Each user has their own app config
- **Simplified Testing**: No need to pass URL/credentials every time
- **Flexible Overrides**: Can still specify URL for specific tests
- **Session Types**: Automated (hands-off) or Dev (interactive)

## Core Concepts

- **App Configuration**: Centralized configuration for your testing environment
- **Automated Sessions**: QA testing that runs without user interaction
- **Dev Sessions**: Interactive sessions for manual testing and debugging
- **Monitoring**: Real-time session progress tracking
- **Batch Testing**: Execute multiple automated tests simultaneously

## User Journey

1. **Register** → Get API key with \`register_user\` (if needed)
2. **Initialize** → \`ensure_installed\` with API key
3. **Configure** → \`update_configuration\` with your app settings
4. **Test** → \`start_automated_session\` or \`start_dev_session\`
5. **Monitor** → \`monitor_session\` to track progress
6. **Batch** → \`run_automated_tests\` to run multiple tests

## Next Steps

1. Read the Workflows guide for testing patterns
2. Check out the Tools Reference for detailed documentation
3. Use the AAA prompt template for structured test scenarios
4. Use \`get_configuration\` to view your current setup
`;
  }

  private getWorkflowsGuide(): string {
    return `# QA-Use Testing Workflows

## Workflow 1: Automated Testing
*Recommended for repeatable QA tests*

1. **Initialize** → \`ensure_installed\` with API key
2. **Configure** → \`update_configuration\` (one-time setup)
3. **Test** → \`start_automated_session\` (URL optional)
4. **Monitor** → \`monitor_session\` with wait=true
5. **Explore** → \`get_configuration\` to see your setup

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

  private getToolsGuide(): string {
    return `# MCP Tools Reference

This guide provides detailed documentation for all available QA-Use MCP tools.

## Setup & Configuration

### ensure_installed
Ensure API key is set, validate authentication, and install Playwright browsers.
- **Parameters**: apiKey (optional)
- **Usage**: Run this first to set up your environment

### register_user
Register a new user account with desplega.ai and receive an API key.
- **Parameters**: email (required)
- **Usage**: For new users who need an API key

### update_configuration
Update application configuration settings including base URL, login credentials, and viewport type.
- **Parameters**: base_url, login_url, login_username, login_password, vp_type (all optional)
- **Usage**: One-time setup for your application under test

### get_configuration
Get the current application configuration details.
- **Parameters**: None
- **Usage**: View your current app configuration

## Session Management

### search_sessions
Search and list all sessions (automated tests and development sessions) with pagination and filtering.
- **Parameters**: limit, offset, query (all optional)
- **Usage**: View all your testing sessions

### start_automated_session
Start an automated E2E test session for QA flows. Returns sessionId for monitoring.
- **Parameters**: task (required), url, dependencyId, headless (optional)
- **Usage**: Run automated tests that execute without user interaction

### start_dev_session
Start an interactive development session for debugging and exploration.
- **Parameters**: task (required), url, headless (optional)
- **Usage**: Manual testing and debugging with browser control

### monitor_session
Monitor a session status. Keep calling until status is "closed".
- **Parameters**: sessionId (required), wait, timeout (optional)
- **Usage**: Track test execution progress

### interact_with_session
Interact with a session - respond to questions, pause, or close.
- **Parameters**: sessionId, action (required), message (optional)
- **Actions**: respond, pause, close
- **Usage**: Provide input when session asks questions

## Test Management

### search_automated_tests
Search for automated tests by ID or query.
- **Parameters**: testId, query, limit, offset (all optional)
- **Usage**: Find existing automated tests

### run_automated_tests
Execute multiple automated tests simultaneously.
- **Parameters**: test_ids (required), app_config_id, ws_url (optional)
- **Usage**: Run batch tests in parallel

### search_automated_test_runs
Search automated test runs with optional filtering.
- **Parameters**: test_id, run_id, limit, offset (all optional)
- **Usage**: View test execution history and results

## Common Usage Patterns

### Pattern 1: First-Time Setup
\`\`\`
1. ensure_installed
2. update_configuration (set base_url, login credentials)
3. start_automated_session (begin testing)
4. monitor_session (track progress)
\`\`\`

### Pattern 2: Development Testing
\`\`\`
1. start_dev_session (with task and url)
2. monitor_session (watch execution)
3. interact_with_session (provide input if needed)
\`\`\`

### Pattern 3: Batch Testing
\`\`\`
1. search_automated_tests (find tests to run)
2. run_automated_tests (execute multiple tests)
3. search_sessions (monitor all running sessions)
4. search_automated_test_runs (view results)
\`\`\`

## Session Status Guide

| Status | Meaning | Next Action |
|--------|---------|------------|
| running | Test executing | Continue monitoring |
| needs_user_input | Waiting for input | Use interact_with_session |
| closed | Completed | Review results |
| idle | Paused | Check status or close |
| pending | Queued | Wait or monitor |

## Best Practices

1. **Always set up configuration first** using update_configuration
2. **Use wait=true** for monitor_session in automated workflows
3. **Set appropriate timeouts** based on test complexity
4. **Handle user input promptly** when sessions need it
5. **Use dev sessions** for exploration and debugging
6. **Use automated sessions** for repeatable QA tests
7. **Search test runs** to analyze test history and flakiness

For more detailed examples, see the Getting Started and Workflows guides.
`;
  }

  getServer(): Server {
    return this.server;
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    // console.debug(`${getName()} running (PID: ${process.pid}, Version: ${getVersion()})`);

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
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Cleanup all browser sessions
    await this.resetAllBrowserSessions();
  }
}

// Export the server class for use in different transport modes
export { QAUseMcpServer };
