export type ApiErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'VALIDATION_ERROR'
  | 'API_ERROR'
  | 'UNKNOWN_ERROR';

export class AppApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ApiErrorCode = 'API_ERROR',
    status?: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, AppApiError.prototype);
  }

  static fromStatus(status: number, message?: string, details?: Record<string, unknown>): AppApiError {
    if (status === 401) {
      return new AppApiError(message || 'Session expired or unauthenticated.', 'AUTHENTICATION_ERROR', status, details);
    }
    if (status === 403) {
      return new AppApiError(message || 'You do not have permission to perform this action.', 'AUTHORIZATION_ERROR', status, details);
    }
    if (status === 422 || status === 400) {
      return new AppApiError(message || 'Invalid request payload.', 'VALIDATION_ERROR', status, details);
    }
    if (status >= 500) {
      return new AppApiError(message || 'Internal server error encountered.', 'API_ERROR', status, details);
    }
    return new AppApiError(message || `API error with status ${status}`, 'API_ERROR', status, details);
  }
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    requestId?: string;
    timestamp?: string;
    totalCount?: number;
  };
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  authToken?: string | null;
}
