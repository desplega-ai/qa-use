import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import 'dotenv/config';

export interface QASession {
  id: string;
  status: string;
  createdAt: string;
  data?: {
    status?: string;
    wsUrl?: string;
    url?: string;
    task?: string;
    pending_user_input?: {
      question?: string;
      priority?: string;
      reasoning?: string;
      memory?: any;
      confidence?: string;
      description?: string;
      tasks_pending?: boolean;
      previous_step_analysis?: string;
    };
    last_done?: any;
    liveview_url?: string;
    test_id?: string;
    agent_id?: string;
    blocks?: any[];
    history?: any[];
    model_name?: string;
    recording_path?: string;
    app_config_id?: string;
    organization_id?: string;
    dependency_test_ids?: any[];
  };
  source?: string;
}

export interface CreateSessionOptions {
  url: string;
  task: string;
  mode?: 'fast' | 'normal' | 'max';
  wsUrl?: string;
  dependencyId?: string;
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
}

export interface RunTestsOptions {
  test_ids: string[];
  ws_url?: string;
}

export interface RunTestsResponse {
  success: boolean;
  message?: string;
  test_run_id?: string;
  sessions?: any[];
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  apiKey?: string;
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
  limit?: number;
  offset?: number;
}

export class ApiClient {
  private readonly client: AxiosInstance;
  private apiKey: string | null = null;

  constructor(baseUrl?: string) {
    // Use environment variable if available, otherwise use provided baseUrl, finally fall back to production
    const apiUrl = process.env.QA_USE_API_URL || baseUrl || 'https://api.desplega.ai';

    this.client = axios.create({
      baseURL: apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Auto-load API key from environment if available
    const envApiKey = process.env.QA_USE_API_KEY;
    if (envApiKey) {
      this.setApiKey(envApiKey);
    }
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.client.defaults.headers['Authorization'] = `Bearer ${apiKey}`;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  static getAppUrl(): string {
    return process.env.QA_USE_APP_URL || 'https://app.desplega.ai';
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

  async createSession(options: CreateSessionOptions): Promise<QASession> {
    try {
      const sessionData = {
        url: options.url,
        task: options.task,
        mode: options.mode,
        ws_url: options.wsUrl,
        dep_id: options.dependencyId,
      };

      const response: AxiosResponse = await this.client.post('/vibe-qa/sessions', sessionData);

      return {
        id: response.data.data.id,
        status: response.data.data.status,
        createdAt: response.data.data.created_at,
        data: response.data.data,
        source: response.data.data.source,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;
        throw new Error(
          errorData?.message || errorData?.detail || `HTTP ${statusCode}: Failed to create session`
        );
      }
      throw new Error(error instanceof Error ? error.message : 'Unknown error creating session');
    }
  }

  async listSessions(options: ListOptions = {}): Promise<QASession[]> {
    try {
      const params = new URLSearchParams();
      if (options.limit !== undefined) params.append('limit', options.limit.toString());
      if (options.offset !== undefined) params.append('offset', options.offset.toString());
      if (options.query) params.append('query', options.query);

      const response: AxiosResponse = await this.client.get(
        `/vibe-qa/sessions?${params.toString()}`
      );
      return response.data.map((session: any) => ({
        id: session.id,
        status: session.status,
        createdAt: session.created_at,
        data: session.data,
        source: session.source,
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;
        throw new Error(
          errorData?.message || errorData?.detail || `HTTP ${statusCode}: Failed to fetch sessions`
        );
      }
      throw new Error(error instanceof Error ? error.message : 'Unknown error fetching sessions');
    }
  }

  async getSession(sessionId: string): Promise<QASession> {
    try {
      const response: AxiosResponse = await this.client.get(`/vibe-qa/sessions/${sessionId}`);
      return {
        id: response.data.id,
        status: response.data.status,
        createdAt: response.data.created_at,
        data: response.data.data,
        source: response.data.source,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        if (statusCode === 404) {
          throw new Error(`Session not found: ${sessionId}`);
        }

        throw new Error(
          errorData?.message || errorData?.detail || `HTTP ${statusCode}: Failed to fetch session`
        );
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
          errorData?.message ||
            errorData?.detail ||
            `HTTP ${statusCode}: Failed to send message to session`
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
          message:
            errorData?.message || errorData?.detail || `HTTP ${statusCode}: Registration failed`,
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

      const response: AxiosResponse = await this.client.get(`/vibe-qa/tests?${params.toString()}`);
      return response.data.map((test: any) => ({
        id: test.id,
        name: test.name,
        description: test.description,
        url: test.url,
        task: test.task,
        status: test.status,
        created_at: test.created_at,
        updated_at: test.updated_at,
        organization_id: test.organization_id,
        app_config_id: test.app_config_id,
        dependency_test_ids: test.dependency_test_ids,
        metadata: test.metadata,
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;
        throw new Error(
          errorData?.message || errorData?.detail || `HTTP ${statusCode}: Failed to fetch tests`
        );
      }
      throw new Error(error instanceof Error ? error.message : 'Unknown error fetching tests');
    }
  }

  async getTest(testId: string): Promise<AutomatedTest> {
    try {
      const response: AxiosResponse = await this.client.get(`/vibe-qa/tests/${testId}`);
      return {
        id: response.data.id,
        name: response.data.name,
        description: response.data.description,
        url: response.data.url,
        task: response.data.task,
        status: response.data.status,
        created_at: response.data.created_at,
        updated_at: response.data.updated_at,
        organization_id: response.data.organization_id,
        app_config_id: response.data.app_config_id,
        dependency_test_ids: response.data.dependency_test_ids,
        metadata: response.data.metadata,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        if (statusCode === 404) {
          throw new Error(`Test not found: ${testId}`);
        }

        throw new Error(
          errorData?.message || errorData?.detail || `HTTP ${statusCode}: Failed to fetch test`
        );
      }
      throw new Error(error instanceof Error ? error.message : 'Unknown error fetching test');
    }
  }

  async runTests(options: RunTestsOptions): Promise<RunTestsResponse> {
    try {
      const requestData = {
        test_ids: options.test_ids,
        ws_url: options.ws_url,
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
          message:
            errorData?.message || errorData?.detail || `HTTP ${statusCode}: Failed to run tests`,
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
      if (options.limit !== undefined) params.append('limit', options.limit.toString());
      if (options.offset !== undefined) params.append('offset', options.offset.toString());

      const response: AxiosResponse = await this.client.get(
        `/vibe-qa/tests-runs?${params.toString()}`
      );
      return response.data.map((testRun: any) => ({
        id: testRun.id,
        rerun_id: testRun.rerun_id,
        name: testRun.name,
        external_id: testRun.external_id,
        matrix_option_id: testRun.matrix_option_id,
        test_id: testRun.test_id,
        test_version_hash: testRun.test_version_hash,
        test_suite_id: testRun.test_suite_id,
        test_suite_run_id: testRun.test_suite_run_id,
        used_variables: testRun.used_variables,
        run_status: testRun.run_status,
        final_run_status: testRun.final_run_status,
        final_comment_id: testRun.final_comment_id,
        allow_fix: testRun.allow_fix,
        result: testRun.result,
        error_message: testRun.error_message,
        recording_path: testRun.recording_path,
        har_path: testRun.har_path,
        live_view_url: testRun.live_view_url,
        start_time: testRun.start_time,
        end_time: testRun.end_time,
        duration_seconds: testRun.duration_seconds,
        pfs_score: testRun.pfs_score,
        pfs_bad_state_prob: testRun.pfs_bad_state_prob,
        pfs_confidence_lower: testRun.pfs_confidence_lower,
        pfs_confidence_upper: testRun.pfs_confidence_upper,
        pfs_num_observations: testRun.pfs_num_observations,
        created_at: testRun.created_at,
        updated_at: testRun.updated_at,
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;
        throw new Error(
          errorData?.message || errorData?.detail || `HTTP ${statusCode}: Failed to fetch test runs`
        );
      }
      throw new Error(error instanceof Error ? error.message : 'Unknown error fetching test runs');
    }
  }
}
