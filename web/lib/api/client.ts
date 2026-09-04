import { envConfig } from '../config/env';
import { AppApiError, RequestOptions } from './types';

let globalAuthTokenProvider: (() => string | null) | null = null;
let globalUnauthorizedHandler: (() => void) | null = null;

export function configureApiClient(options: {
  getAuthToken?: () => string | null;
  onUnauthorized?: () => void;
}) {
  if (options.getAuthToken) {
    globalAuthTokenProvider = options.getAuthToken;
  }
  if (options.onUnauthorized) {
    globalUnauthorizedHandler = options.onUnauthorized;
  }
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = envConfig.apiUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private getAuthHeader(overrideToken?: string | null): Record<string, string> {
    const token = overrideToken !== undefined ? overrideToken : (globalAuthTokenProvider ? globalAuthTokenProvider() : null);
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { timeoutMs = 15000, authToken, headers, ...fetchOptions } = options;
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const mergedHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...this.getAuthHeader(authToken),
      ...(headers as Record<string, string>),
    };

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: mergedHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetails: Record<string, unknown> | undefined;
        let errorMessage: string | undefined;

        try {
          const errorJson = await response.json();
          errorMessage = errorJson.message || errorJson.detail;
          errorDetails = errorJson;
        } catch {
          errorMessage = response.statusText;
        }

        const error = AppApiError.fromStatus(response.status, errorMessage, errorDetails);

        if (error.code === 'AUTHENTICATION_ERROR' && globalUnauthorizedHandler) {
          globalUnauthorizedHandler();
        }

        throw error;
      }

      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof AppApiError) {
        throw err;
      }

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new AppApiError(`Request timed out after ${timeoutMs}ms`, 'TIMEOUT_ERROR');
      }

      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new AppApiError('Network request failed. Please check your connection.', 'NETWORK_ERROR');
      }

      throw new AppApiError(
        err instanceof Error ? err.message : 'An unexpected error occurred',
        'UNKNOWN_ERROR'
      );
    }
  }

  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
