/**
 * BrowserApiClient - Client for the desplega.ai Browser API (/browsers/v1/)
 */

import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { getEnv } from '../env/index.js';
import type {
  BrowserSession,
  BrowserAction,
  ActionResult,
  SnapshotResult,
  UrlResult,
  BlocksResult,
  CreateBrowserSessionOptions,
  BrowserSessionStatus,
} from './browser-types.js';
import type { ExtendedStep } from '../../src/types/test-definition.js';

export class BrowserApiClient {
  private readonly client: AxiosInstance;
  private apiKey: string | null = null;

  constructor(baseUrl?: string) {
    // Use environment variable if available, otherwise use provided baseUrl, finally fall back to production
    const apiUrl = getEnv('QA_USE_API_URL') || baseUrl || 'https://api.desplega.ai';

    this.client = axios.create({
      baseURL: `${apiUrl}/browsers/v1`,
      timeout: 60000, // Longer timeout for browser operations
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
    this.client.defaults.headers['Authorization'] = `Bearer ${apiKey}`;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  getBaseUrl(): string {
    return this.client.defaults.baseURL || 'https://api.desplega.ai/browsers/v1';
  }

  // ==========================================
  // Session Management
  // ==========================================

  /**
   * Create a new browser session
   */
  async createSession(options: CreateBrowserSessionOptions = {}): Promise<BrowserSession> {
    try {
      const response = await this.client.post('/sessions', {
        headless: options.headless ?? true,
        viewport: options.viewport ?? 'desktop',
        timeout: options.timeout ?? 300,
      });

      return response.data as BrowserSession;
    } catch (error) {
      throw this.handleError(error, 'create session');
    }
  }

  /**
   * List all sessions for the organization
   */
  async listSessions(): Promise<BrowserSession[]> {
    try {
      const response = await this.client.get('/sessions');
      // API may return { sessions: [...] } or just [...]
      return Array.isArray(response.data) ? response.data : response.data.sessions || [];
    } catch (error) {
      throw this.handleError(error, 'list sessions');
    }
  }

  /**
   * Get a specific session by ID
   */
  async getSession(sessionId: string): Promise<BrowserSession> {
    try {
      const response = await this.client.get(`/sessions/${sessionId}`);
      return response.data as BrowserSession;
    } catch (error) {
      throw this.handleError(error, 'get session');
    }
  }

  /**
   * Delete/close a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.client.delete(`/sessions/${sessionId}`);
    } catch (error) {
      throw this.handleError(error, 'delete session');
    }
  }

  /**
   * Wait for a session to reach a specific status
   * @param sessionId - The session ID to wait for
   * @param targetStatus - The status to wait for (default: 'active')
   * @param timeoutMs - Maximum time to wait in milliseconds (default: 30000)
   * @param pollIntervalMs - Polling interval in milliseconds (default: 1000)
   */
  async waitForStatus(
    sessionId: string,
    targetStatus: BrowserSessionStatus = 'active',
    timeoutMs: number = 30000,
    pollIntervalMs: number = 1000
  ): Promise<BrowserSession> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const session = await this.getSession(sessionId);

      if (session.status === targetStatus) {
        return session;
      }

      // If session is closed or failed, throw error
      if (session.status === 'closed') {
        throw new Error(`Session ${sessionId} is closed`);
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Timeout waiting for session ${sessionId} to reach status "${targetStatus}"`);
  }

  // ==========================================
  // Actions
  // ==========================================

  /**
   * Execute a browser action
   */
  async executeAction(sessionId: string, action: BrowserAction): Promise<ActionResult> {
    try {
      const response = await this.client.post(`/sessions/${sessionId}/action`, action);
      return response.data as ActionResult;
    } catch (error) {
      throw this.handleError(error, `execute action "${action.type}"`);
    }
  }

  // ==========================================
  // Inspection
  // ==========================================

  /**
   * Get the ARIA accessibility tree snapshot
   */
  async getSnapshot(sessionId: string): Promise<SnapshotResult> {
    try {
      const response = await this.client.get(`/sessions/${sessionId}/snapshot`);
      return response.data as SnapshotResult;
    } catch (error) {
      throw this.handleError(error, 'get snapshot');
    }
  }

  /**
   * Get a screenshot of the current page
   * @returns Buffer containing PNG image data
   */
  async getScreenshot(sessionId: string): Promise<Buffer> {
    try {
      const response = await this.client.get(`/sessions/${sessionId}/screenshot`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error) {
      throw this.handleError(error, 'get screenshot');
    }
  }

  /**
   * Get the current page URL
   */
  async getUrl(sessionId: string): Promise<string> {
    try {
      const response = await this.client.get(`/sessions/${sessionId}/url`);
      const result = response.data as UrlResult;
      return result.url;
    } catch (error) {
      throw this.handleError(error, 'get URL');
    }
  }

  /**
   * Get recorded blocks (test steps) from the session
   * @returns Array of ExtendedStep objects
   */
  async getBlocks(sessionId: string): Promise<ExtendedStep[]> {
    try {
      const response = await this.client.get(`/sessions/${sessionId}/blocks`);
      const result = response.data as BlocksResult;
      return (result.blocks || []) as ExtendedStep[];
    } catch (error) {
      throw this.handleError(error, 'get blocks');
    }
  }

  // ==========================================
  // WebSocket Streaming
  // ==========================================

  /**
   * Get the WebSocket URL for streaming events
   */
  getStreamUrl(sessionId: string): string {
    // Convert HTTP URL to WebSocket URL
    const baseUrl = this.getBaseUrl();
    const wsUrl = baseUrl.replace(/^http/, 'ws');
    return `${wsUrl}/sessions/${sessionId}/stream`;
  }

  // ==========================================
  // Error Handling
  // ==========================================

  private handleError(error: unknown, operation: string): Error {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const errorData = error.response?.data as { message?: string; detail?: string } | undefined;

      if (statusCode === 404) {
        return new Error(`Session not found`);
      }

      if (statusCode === 401) {
        return new Error(`Unauthorized. Please check your API key.`);
      }

      if (statusCode === 403) {
        return new Error(`Forbidden. You don't have permission for this operation.`);
      }

      const message =
        errorData?.message || errorData?.detail || `HTTP ${statusCode}: Failed to ${operation}`;
      return new Error(message);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error(`Unknown error during ${operation}`);
  }
}

// Re-export types for convenience
export type {
  BrowserSession,
  BrowserAction,
  ActionResult,
  SnapshotResult,
  UrlResult,
  CreateBrowserSessionOptions,
  BrowserSessionStatus,
} from './browser-types.js';
