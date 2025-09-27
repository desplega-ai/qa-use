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
        data: response.data.data.data,
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

  async listSessions(): Promise<QASession[]> {
    try {
      const response: AxiosResponse = await this.client.get('/vibe-qa/sessions');
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
}
