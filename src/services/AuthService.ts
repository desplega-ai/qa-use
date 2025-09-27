import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

interface AuthResponse {
  success: boolean;
  message?: string;
  apiKey?: string;
}

export class AuthService {
  private readonly client: AxiosInstance;
  private apiKey: string | null = null;

  constructor(baseUrl?: string) {
    const url = baseUrl || process.env.QA_USE_API_URL || 'https://api.desplega.ai';

    this.client = axios.create({
      baseURL: url,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST',
    data?: unknown,
    apiKey?: string
  ): Promise<AuthResponse> {
    try {
      const config = {
        method,
        url: endpoint,
        ...(data ? { data } : {}),
        ...(apiKey && {
          headers: {
            Authorization: apiKey,
          },
        }),
      };

      const response: AxiosResponse = await this.client.request(config);

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

  async register(email: string): Promise<AuthResponse> {
    return this.makeRequest('/vibe-qa/register', 'POST', { email });
  }

  async check(apiKey: string): Promise<AuthResponse> {
    return this.makeRequest('/vibe-qa/check', 'GET', undefined, apiKey);
  }

  /**
   * Set the API key for this instance
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Get the current API key
   */
  getApiKey(): string | null {
    return this.apiKey;
  }

  /**
   * Check if the current API key is valid
   */
  async checkApiKey(): Promise<AuthResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        message: 'No API key set',
      };
    }
    return this.check(this.apiKey);
  }
}
