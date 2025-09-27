import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import dotenv from 'dotenv';
import type {
  NewSessionRequest,
  NewSessionResponse,
  TestAgentV2Session,
  SessionListResponse,
  SessionDetailResponse,
  SuccessResponse,
  AppConfig,
  EventCreateSchema,
  UserResponseEvent,
} from '../types/session.js';

// Load environment variables
dotenv.config({ quiet: true });

export class SessionService {
  private readonly client: AxiosInstance;

  constructor(baseUrl?: string, apiKey?: string) {
    const url = baseUrl || process.env.QA_USE_API_URL || 'https://api.desplega.ai';

    this.client = axios.create({
      baseURL: url,
      timeout: 30000, // 30 seconds for session operations
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      },
    });
  }

  /**
   * Set the API key for requests
   */
  setApiKey(apiKey: string): void {
    this.client.defaults.headers['Authorization'] = `Bearer ${apiKey}`;
  }

  /**
   * Create a new QA session
   */
  async createSession(sessionData: NewSessionRequest): Promise<NewSessionResponse> {
    try {
      const response: AxiosResponse<SuccessResponse<NewSessionResponse['data']>> =
        await this.client.post('/vibe-qa/sessions', sessionData);

      return {
        message: response.data.message,
        data: response.data.data!,
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

  /**
   * Get all sessions for the authenticated user
   */
  async getSessions(): Promise<TestAgentV2Session[]> {
    try {
      const response: AxiosResponse<TestAgentV2Session[]> =
        await this.client.get('/vibe-qa/sessions');

      return response.data;
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

  /**
   * Get a specific session by ID
   */
  async getSession(sessionId: string): Promise<TestAgentV2Session> {
    try {
      const response: AxiosResponse<TestAgentV2Session> = await this.client.get(
        `/vibe-qa/sessions/${sessionId}`
      );

      return response.data;
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

  /**
   * Get app configurations for the authenticated user
   */
  async getAppConfigs(): Promise<AppConfig[]> {
    try {
      const response: AxiosResponse<AppConfig[]> = await this.client.get('/vibe-qa/app-configs');

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        throw new Error(
          errorData?.message ||
            errorData?.detail ||
            `HTTP ${statusCode}: Failed to fetch app configs`
        );
      }

      throw new Error(
        error instanceof Error ? error.message : 'Unknown error fetching app configs'
      );
    }
  }

  /**
   * Create a new session with enhanced options
   */
  async createSessionWithBrowser(options: {
    url: string;
    task: string;
    mode?: 'fast' | 'normal' | 'max';
    wsUrl?: string;
    dependencyId?: string;
  }): Promise<NewSessionResponse> {
    const sessionData: NewSessionRequest = {
      url: options.url,
      task: options.task,
      mode: options.mode,
      ws_url: options.wsUrl,
      dep_id: options.dependencyId,
    };

    return this.createSession(sessionData);
  }

  /**
   * Get sessions with filtering and pagination
   */
  async getSessionsFiltered(options?: {
    source?: string;
    limit?: number;
    status?: 'active' | 'deleted';
  }): Promise<TestAgentV2Session[]> {
    // Note: Backend API doesn't seem to support filtering yet,
    // but we can add it here for future compatibility
    const sessions = await this.getSessions();

    let filtered = sessions;

    if (options?.source) {
      filtered = filtered.filter((s) => s.source === options.source);
    }

    if (options?.status) {
      filtered = filtered.filter((s) => s.status === options.status);
    }

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Format session for display
   */
  formatSessionSummary(session: TestAgentV2Session): string {
    const date = new Date(session.created_at).toLocaleDateString();
    const source = session.source || 'unknown';
    const auditStatus = session.status; // audit status (active/deleted)
    const sessionStatus = session.data?.status || 'unknown'; // session status (running/paused/etc)

    return `[${session.id.slice(0, 8)}] ${source} - ${sessionStatus} | ${auditStatus} (${date})`;
  }

  /**
   * Get session status for display with colors
   */
  getSessionStatusColor(session: TestAgentV2Session, chalk: any): string {
    const sessionStatus = session.data?.status || 'unknown';

    switch (sessionStatus) {
      case 'running':
        return chalk.green('●');
      case 'paused':
        return chalk.yellow('●');
      case 'need_user_input':
        return chalk.blue('●');
      case 'closed':
        return chalk.red('●');
      case 'idle':
        return chalk.gray('●');
      default:
        return chalk.gray('○');
    }
  }

  /**
   * Check if session is active
   */
  isSessionActive(session: TestAgentV2Session): boolean {
    return session.status === 'active';
  }

  /**
   * Send user response to a session that needs user input
   */
  async sendUserResponse(sessionId: string, message: string): Promise<SuccessResponse> {
    try {
      const eventData: EventCreateSchema = {
        group_key: sessionId,
        event_type: 'test_agent_2.event.incoming',
        event_data: {
          type: 'response',
          message: message.trim(),
        },
      };

      const response: AxiosResponse<SuccessResponse> = await this.client.post(
        '/vibe-qa/new-event',
        eventData
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data;

        throw new Error(
          errorData?.message ||
            errorData?.detail ||
            `HTTP ${statusCode}: Failed to send user response`
        );
      }

      throw new Error(
        error instanceof Error ? error.message : 'Unknown error sending user response'
      );
    }
  }
}
