import type { AxiosRequestConfig } from 'axios';
import axios from 'axios';

export interface ExecuteApiRequestOptions {
  apiUrl: string;
  apiKey?: string;
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}

export interface ExecuteApiRequestResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
}

function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.replace(/\/$/, '');
}

export function formatApiResponseError(status: number, statusText: string, data: unknown): string {
  if (data && typeof data === 'object') {
    const payload = data as { message?: string; detail?: string };
    if (payload.message && typeof payload.message === 'string') {
      return `HTTP ${status} ${statusText}: ${payload.message}`;
    }
    if (payload.detail && typeof payload.detail === 'string') {
      return `HTTP ${status} ${statusText}: ${payload.detail}`;
    }
  }

  return `HTTP ${status} ${statusText}`;
}

export async function executeApiRequest(
  options: ExecuteApiRequestOptions
): Promise<ExecuteApiRequestResult> {
  const requestConfig: AxiosRequestConfig = {
    method: options.method,
    baseURL: normalizeApiUrl(options.apiUrl),
    url: options.path,
    headers: {
      ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
      ...options.headers,
    },
    params: options.query,
    data: options.body,
    timeout: 25000,
    validateStatus: () => true,
  };

  try {
    const response = await axios.request(requestConfig);
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers || {})) {
      headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      data: response.data,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.message);
    }
    throw error;
  }
}
