import type { AxiosInstance, AxiosResponse } from 'axios';
import axios from 'axios';
import 'dotenv/config';
import type { TestDefinition } from '../../src/types/test-definition.js';
import type {
  IssueReport,
  IssueType,
  Severity,
  TestAgentV2Session,
  TestCreatorDoneIntent,
} from '../../src/types.js';
import type { BlockSummary, EnhancedTestSummary } from '../../src/utils/summary.js';
import {
  categorizeIssues,
  formatEnhancedTestReport,
  generateEnhancedTestSummary,
  generateIssueStatistics,
} from '../../src/utils/summary.js';
import { getEnv } from '../env/index.js';
import { type SSEEvent, streamSSE } from './sse.js';

/**
 * Format API error data to a human-readable message
 * Handles both string errors and Pydantic validation error arrays
 */
function formatApiError(
  errorData: { message?: string; detail?: string | unknown[] } | undefined,
  fallback: string
): string {
  if (!errorData) return fallback;

  if (errorData.message && typeof errorData.message === 'string') {
    return errorData.message;
  }

  if (errorData.detail) {
    if (typeof errorData.detail === 'string') {
      return errorData.detail;
    }
    if (Array.isArray(errorData.detail)) {
      const messages = errorData.detail.map((e: unknown) => {
        const err = e as { msg?: string; loc?: unknown[] };
        const field = Array.isArray(err.loc) ? err.loc.slice(2).join('.') || 'unknown' : 'unknown';
        return `${field}: ${err.msg || 'validation error'}`;
      });
      return `Validation failed:\n  ${messages.join('\n  ')}`;
    }
  }

  return fallback;
}

// Re-export new types for external consumers
export type { IssueType, Severity, IssueReport, TestCreatorDoneIntent };
export type { EnhancedTestSummary, BlockSummary };

// Re-export utility functions for external consumers
export {
  generateEnhancedTestSummary,
  formatEnhancedTestReport,
  generateIssueStatistics,
  categorizeIssues,
};

export interface CreateSessionOptions {
  url?: string;
  task: string;
  wsUrl?: string;
  dependencyId?: string;
  devMode?: boolean;
  region?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  appConfigId: string;
}

export interface SendMessageOptions {
  sessionId: string;
  action: 'pause' | 'response' | 'close';
  data?: any;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  query?: string;
  self_only?: boolean;
}

export interface RunTestsOptions {
  test_ids: string[];
  ws_url?: string;
  app_config_id?: string;
}

export interface RunTestsResponse {
  success: boolean;
  message?: string;
  test_run_id?: string;
  sessions?: any[];
}

export type APIKeyScope = 'admin' | 'recordings' | 'webhooks' | 'api' | 'mcp';

export type APIKeySource = 'app' | 'api' | 'vibe-qa' | 'mcp' | 'other';

export interface APIKey {
  id: string;

  name: string;
  key: string;

  expiration_date?: string | null; // ISO datetime string

  scope: APIKeyScope; // default "admin"

  source?: APIKeySource | null; // optional

  last_used_at?: string | null; // ISO datetime string
  last_used_by?: string | null;
  last_used_ip?: string | null;

  app_config_id?: string | null;
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
  apiKey?: string;
}

export interface AutomatedTest {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  url?: string;
  task?: string;
  status?: string;
  created_at: string;
  updated_at?: string;
  organization_id?: string;
  app_config_id?: string;
  dependency_test_ids?: string[];
  metadata?: any;
}

export interface TestRun {
  id: string;
  rerun_id?: string;
  name: string;
  external_id?: string;
  matrix_option_id?: string;
  test_id: string;
  test_version_hash?: string;
  test_suite_id?: string;
  test_suite_run_id?: string;
  used_variables?: any[];
  run_status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'cancelled' | 'timeout';
  final_run_status?:
    | 'pending'
    | 'running'
    | 'passed'
    | 'failed'
    | 'skipped'
    | 'cancelled'
    | 'timeout';
  final_comment_id?: string;
  allow_fix?: boolean;
  result?: string;
  error_message?: string;
  recording_path?: string;
  har_path?: string;
  live_view_url?: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
  pfs_score?: number;
  pfs_bad_state_prob?: number;
  pfs_confidence_lower?: number;
  pfs_confidence_upper?: number;
  pfs_num_observations?: number;
  created_at: string;
  updated_at?: string;
}

export interface ListTestRunsOptions {
  test_id?: string;
  run_id?: string;
  run_status?: 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'cancelled' | 'timeout';
  limit?: number;
  offset?: number;
}

export type ViewportConfigType = 'big_desktop' | 'desktop' | 'mobile' | 'tablet';
export type AppConfigType = 'production' | 'staging' | 'development' | 'local';

export interface UpdateAppConfigSchema {
  base_url?: string;
  login_url?: string;
  login_username?: string;
  login_password?: string;
  vp_type?: ViewportConfigType;
  cfg_type?: AppConfigType;
}

export interface UpdateAppConfigResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export interface AppConfig {
  id: string;
  name: string;
  base_url: string;
  login_url: string;
  login_username: string;
  login_password: string;
  login_instructions: string;
  login_steps: any[];
  organization_id: string;
  status: string;
  vp_type: ViewportConfigType;
  cfg_type?: AppConfigType | null;
  width?: number;
  height?: number;
  remove_popups: boolean;
  failure_status: string;
  created_at: string;
  updated_at?: string;
  created_by: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  apiKey?: string;
  data?: {
    api_key?: APIKey;
    app_config?: AppConfig;
  };
}

export interface ListAppConfigsOptions {
  limit?: number;
  offset?: number;
  query?: string;
  source?: APIKeySource;
  cfg_type?: AppConfigType;
}

// ==========================================
// CLI Test Definition Types
// ==========================================

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
  vars?: Record<string, string>; // Variable overrides for cloud test (test_id)
  agent_session_id?: string; // Link to agent session for UI grouping
}

export type SSECallback = (event: SSEEvent) => void;

export interface StepResult {
  step_index: number;
  name: string;
  status: 'passed' | 'failed';
  duration: number;
  screenshot_url?: string;
  error?: string;
}

export interface RunCliTestResult {
  run_id: string;
  test_id?: string;
  status: 'passed' | 'failed' | 'error' | 'cancelled' | 'timeout';
  duration_seconds: number;
  steps: StepResult[];
  assets?: {
    recording_url?: string;
    har_url?: string;
  };
  error?: string;
}

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  resolved?: {
    app_config_id?: string;
    total_steps?: number;
    dependencies?: string[];
  };
}

export interface ImportOptions {
  upsert?: boolean;
  dry_run?: boolean;
  force?: boolean; // Override version conflicts
}

export interface ImportedTest {
  name: string;
  id: string;
  action: 'created' | 'updated' | 'skipped' | 'unchanged' | 'conflict';
  message?: string; // Warning/conflict details
  prev_version_hash?: string; // Hash before operation
  version_hash?: string; // Hash after operation
}

export interface ImportResult {
  success: boolean;
  imported: ImportedTest[];
  errors: Array<{
    name: string;
    error: string;
  }>;
}

// Re-export TestDefinition for convenience
export type { TestDefinition };

export class ApiClient {
  private readonly client: AxiosInstance;
  private apiKey: string | null = null;
  private appConfigId: string | null = null;

  constructor(baseUrl?: string) {
    // Use environment variable if available, otherwise use provided baseUrl, finally fall back to production
    const apiUrl = getEnv('QA_USE_API_URL') || baseUrl || 'https://api.desplega.ai';

    this.client = axios.create({
      baseURL: apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Auto-load API key from environment or config file if available
    const envApiKey = getEnv('QA_USE_API_KEY');
    if (envApiKey) {
      this.setApiKey(envApiKey);
    }
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.client.defaults.headers.Authorization = `Bearer ${apiKey}`;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  setAppConfigId(appConfigId: string): void {
    this.appConfigId = appConfigId;
  }

  getAppConfigId(): string | null {
    return this.appConfigId;
  }

  static getAppUrl(): string {
    return getEnv('QA_USE_APP_URL') || 'https://app.desplega.ai';
  }

  getApiUrl(): string {
    return this.client.defaults.baseURL || 'https://api.desplega.ai';
  }

  async validateApiKey(apiKey?: string): Promise<AuthResponse> {
    const keyToValidate = apiKey || this.apiKey;
    if (!keyToValidate) {
      return {
        success: false,
        message: 'No API key provided',
      };
    }

    try {
      const response: AxiosResponse = await this.client.get('/vibe-qa/check', {
        headers: {
          Authorization: `Bearer ${keyToValidate}`,
        },
      });

      // Store app_config.id if available
      if (response.data?.data?.app_config?.id) {
        this.appConfigId = response.data.data.app_config.id;
      }

      return {
        success: true,
        ...response.data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        return {
          success: false,
          message: errorData?.message || `HTTP ${statusCode}: ${error.message}`,
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createSession(options: CreateSessionOptions): Promise<CreateSessionResponse> {
    try {
      // Determine region from options or environment variable or config file
      const region = options.region || getEnv('QA_USE_REGION') || 'auto';

      const sessionData = {
        url: options.url,
        task: options.task,
        ws_url: options.wsUrl,
        dep_id: options.dependencyId,
        source: 'mcp',
        autopilot: true,
        use_storage_path: false,
        persist: true,
        region: region,
      };

      if (options.devMode) {
        sessionData.autopilot = false;
        sessionData.use_storage_path = true;
        sessionData.persist = false;
      }

      const response: AxiosResponse = await this.client.post('/vibe-qa/sessions', sessionData);

      return {
        sessionId: response.data.data.agent_id,
        appConfigId: response.data.data.app_config_id,
      } as CreateSessionResponse;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;
        throw new Error(formatApiError(errorData, `HTTP ${statusCode}: Failed to create session`));
      }
      throw new Error(error instanceof Error ? error.message : 'Unknown error creating session');
    }
  }

  async listSessions(options: ListOptions = {}): Promise<TestAgentV2Session[]> {
    try {
      const params = new URLSearchParams();

      if (options.limit !== undefined) params.append('limit', options.limit.toString());
      if (options.offset !== undefined) params.append('offset', options.offset.toString());
      if (options.query) params.append('query', options.query);

      params.append('self_only', 'true');

      const response: AxiosResponse = await this.client.get(
        `/vibe-qa/sessions?${params.toString()}`
      );
      return response.data as TestAgentV2Session[];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;
        throw new Error(formatApiError(errorData, `HTTP ${statusCode}: Failed to fetch sessions`));
      }
      throw new Error(error instanceof Error ? error.message : 'Unknown error fetching sessions');
    }
  }

  async getSession(sessionId: string, selfOnly: boolean = true): Promise<TestAgentV2Session> {
    try {
      const params = new URLSearchParams();

      if (selfOnly) {
        params.append('self_only', 'true');
      }

      const response: AxiosResponse = await this.client.get(
        `/vibe-qa/sessions/${sessionId}?${params.toString()}`
      );

      return response.data as TestAgentV2Session;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        if (statusCode === 404) {
          throw new Error(`Session not found: ${sessionId}`);
        }

        throw new Error(formatApiError(errorData, `HTTP ${statusCode}: Failed to fetch session`));
      }
      throw new Error(error instanceof Error ? error.message : 'Unknown error fetching session');
    }
  }

  async sendMessage(options: SendMessageOptions): Promise<any> {
    try {
      const eventData = {
        group_key: options.sessionId,
        event_type: 'test_agent_2.event.incoming',
        event_data: {
          type: options.action,
          message: options.data || '',
        },
      };

      const response: AxiosResponse = await this.client.post('/vibe-qa/new-event', eventData);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;
        throw new Error(
          formatApiError(errorData, `HTTP ${statusCode}: Failed to send message to session`)
        );
      }
      throw new Error(
        error instanceof Error ? error.message : 'Unknown error sending message to session'
      );
    }
  }

  async register(email: string): Promise<RegisterResponse> {
    try {
      const response: AxiosResponse = await this.client.post('/vibe-qa/register', {
        email,
        cfg_type: 'local',
        source: 'mcp',
      });

      return {
        success: true,
        message: response.data.message || 'Registration successful',
        apiKey: response.data.apiKey,
        ...response.data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        return {
          success: false,
          message: formatApiError(errorData, `HTTP ${statusCode}: Registration failed`),
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error during registration',
      };
    }
  }

  async listTests(options: ListOptions = {}): Promise<AutomatedTest[]> {
    try {
      const params = new URLSearchParams();
      if (options.limit !== undefined) params.append('limit', options.limit.toString());
      if (options.offset !== undefined) params.append('offset', options.offset.toString());
      if (options.query) params.append('query', options.query);

      if (options.self_only === undefined || options.self_only === true) {
        params.append('self_only', 'true');
      } else {
        params.append('self_only', 'false');
      }

      const response: AxiosResponse = await this.client.get(`/vibe-qa/tests?${params.toString()}`);
      return response.data.items as AutomatedTest[];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;
        throw new Error(formatApiError(errorData, `HTTP ${statusCode}: Failed to fetch tests`));
      }
      throw new Error(error instanceof Error ? error.message : 'Unknown error fetching tests');
    }
  }

  async getTest(testId: string, selfOnly: boolean = true): Promise<AutomatedTest> {
    try {
      const params = new URLSearchParams();

      if (selfOnly) {
        params.append('self_only', 'true');
      }

      const response: AxiosResponse = await this.client.get(
        `/vibe-qa/tests/${testId}?${params.toString()}`
      );

      return response.data as AutomatedTest;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        if (statusCode === 404) {
          throw new Error(`Test not found: ${testId}`);
        }

        throw new Error(formatApiError(errorData, `HTTP ${statusCode}: Failed to fetch test`));
      }
      throw new Error(error instanceof Error ? error.message : 'Unknown error fetching test');
    }
  }

  async runTests(options: RunTestsOptions): Promise<RunTestsResponse> {
    try {
      const requestData = {
        test_ids: options.test_ids,
        ws_url: options.ws_url,
        app_config_id: options.app_config_id,
      };

      const response: AxiosResponse = await this.client.post('/vibe-qa/run-tests', requestData);

      return {
        success: true,
        message: response.data.message || 'Tests started successfully',
        test_run_id: response.data.test_run_id,
        sessions: response.data.sessions,
        ...response.data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        return {
          success: false,
          message: formatApiError(errorData, `HTTP ${statusCode}: Failed to run tests`),
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error running tests',
      };
    }
  }

  async listTestRuns(options: ListTestRunsOptions = {}): Promise<TestRun[]> {
    try {
      const params = new URLSearchParams();
      if (options.test_id) params.append('test_id', options.test_id);
      if (options.run_id) params.append('run_id', options.run_id);
      if (options.run_status) params.append('run_status', options.run_status);
      if (options.limit !== undefined) params.append('limit', options.limit.toString());
      if (options.offset !== undefined) params.append('offset', options.offset.toString());

      // Use /api/v1/test-runs instead of /vibe-qa/tests-runs
      // The v1 endpoint properly supports limit, offset, and run_status filters
      const response: AxiosResponse = await this.client.get(
        `/api/v1/test-runs?${params.toString()}`
      );
      return response.data as TestRun[];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;
        throw new Error(formatApiError(errorData, `HTTP ${statusCode}: Failed to fetch test runs`));
      }
      throw new Error(error instanceof Error ? error.message : 'Unknown error fetching test runs');
    }
  }

  async updateAppConfig(config: UpdateAppConfigSchema): Promise<UpdateAppConfigResponse> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          message: 'API key not configured. Please set an API key first.',
        };
      }

      // Apply default for vp_type if not specified
      const configWithDefaults = {
        ...config,
        vp_type: config.vp_type || 'desktop',
        cfg_type: config.cfg_type || 'local',
      };

      const response: AxiosResponse = await this.client.post(
        '/vibe-qa/app-configs',
        configWithDefaults
      );

      return {
        success: true,
        message: response.data.message || 'App config updated successfully',
        data: response.data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        return {
          success: false,
          message: formatApiError(errorData, `HTTP ${statusCode}: Failed to update app config`),
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error updating app config',
      };
    }
  }

  async listAppConfigs(options: ListAppConfigsOptions = {}): Promise<AppConfig[]> {
    try {
      if (!this.apiKey) {
        throw new Error('API key not configured. Please set an API key first.');
      }

      const params = new URLSearchParams();
      if (options.limit !== undefined) params.append('limit', options.limit.toString());
      if (options.offset !== undefined) params.append('offset', options.offset.toString());
      if (options.query) params.append('query', options.query);
      if (options.source) params.append('source', options.source);
      if (options.cfg_type) params.append('cfg_type', options.cfg_type);

      const response: AxiosResponse = await this.client.get(
        `/vibe-qa/app-configs?${params.toString()}`
      );

      return response.data as AppConfig[];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;
        throw new Error(
          formatApiError(errorData, `HTTP ${statusCode}: Failed to fetch app configs`)
        );
      }
      throw new Error(
        error instanceof Error ? error.message : 'Unknown error fetching app configs'
      );
    }
  }

  async setWsUrl(wsUrl: string): Promise<{ success: boolean; message?: string; data?: any }> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          message: 'API key not configured. Please set an API key first.',
        };
      }

      const response: AxiosResponse = await this.client.post('/vibe-qa/ws-url', {
        ws_url: wsUrl,
      });

      return {
        success: true,
        message: response.data.message || 'WebSocket URL set successfully',
        data: response.data.data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        return {
          success: false,
          message: formatApiError(errorData, `HTTP ${statusCode}: Failed to set WebSocket URL`),
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error setting WebSocket URL',
      };
    }
  }

  // ==========================================
  // CLI Test Definition Methods
  // ==========================================

  /**
   * Run test definitions with SSE streaming progress
   * @param options - Test execution options
   * @param onEvent - Optional callback for SSE events
   * @returns Promise resolving to test result
   */
  async runCliTest(options: RunCliTestOptions, onEvent?: SSECallback): Promise<RunCliTestResult> {
    try {
      const response = await fetch(`${this.getApiUrl()}/vibe-qa/cli/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          message?: string;
          detail?: string | unknown[];
        };
        throw new Error(formatApiError(errorData, `HTTP ${response.status}: Failed to run test`));
      }

      let result: RunCliTestResult | null = null;

      // Stream SSE events
      for await (const event of streamSSE(response)) {
        if (onEvent) onEvent(event);

        // Capture final result
        if (event.event === 'complete' || event.event === 'error') {
          result = event.data;
        }
      }

      if (!result) {
        throw new Error('No result received from test execution');
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error running test');
    }
  }

  /**
   * Export a database test to YAML or JSON format
   * @param testId - UUID of the test to export
   * @param format - Output format ('yaml' or 'json')
   * @param includeDeps - Whether to include dependencies
   * @returns Promise resolving to YAML/JSON string
   */
  async exportTest(
    testId: string,
    format: 'yaml' | 'json' = 'yaml',
    includeDeps: boolean = true
  ): Promise<string> {
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      if (!includeDeps) params.append('no_deps', 'true');

      const response: AxiosResponse = await this.client.get(
        `/vibe-qa/cli/export/${testId}?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        if (statusCode === 404) {
          throw new Error(`Test not found: ${testId}`);
        }

        throw new Error(formatApiError(errorData, `HTTP ${statusCode}: Failed to export test`));
      }
      throw new Error(error instanceof Error ? error.message : 'Unknown error exporting test');
    }
  }

  /**
   * Validate test definitions without running them
   * @param definitions - Array of TestDefinitions to validate
   * @returns Promise resolving to validation result
   */
  async validateTestDefinition(definitions: TestDefinition[]): Promise<ValidationResult> {
    try {
      const response: AxiosResponse = await this.client.post('/vibe-qa/cli/validate', {
        test_definitions: definitions,
      });

      return response.data as ValidationResult;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        throw new Error(
          formatApiError(errorData, `HTTP ${statusCode}: Failed to validate test definition`)
        );
      }
      throw new Error(
        error instanceof Error ? error.message : 'Unknown error validating test definition'
      );
    }
  }

  /**
   * Import (create/update) tests from definitions
   * @param definitions - Array of TestDefinitions to import
   * @param options - Import options (upsert, dry_run)
   * @returns Promise resolving to import result
   */
  async importTestDefinition(
    definitions: TestDefinition[],
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    try {
      const response: AxiosResponse = await this.client.post('/vibe-qa/cli/import', {
        test_definitions: definitions,
        upsert: options.upsert ?? true,
        dry_run: options.dry_run ?? false,
        force: options.force ?? false,
      });

      return response.data as ImportResult;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;
        throw new Error(
          formatApiError(errorData, `HTTP ${statusCode}: Failed to import test definition`)
        );
      }
      throw new Error(
        error instanceof Error ? error.message : 'Unknown error importing test definition'
      );
    }
  }

  /**
   * Get JSON Schema for TestDefinition format
   * @returns Promise resolving to JSON Schema object
   */
  async getTestDefinitionSchema(): Promise<any> {
    try {
      const response: AxiosResponse = await this.client.get('/vibe-qa/cli/schema');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        throw new Error(
          formatApiError(errorData, `HTTP ${statusCode}: Failed to fetch test definition schema`)
        );
      }
      throw new Error(
        error instanceof Error ? error.message : 'Unknown error fetching test definition schema'
      );
    }
  }
}
