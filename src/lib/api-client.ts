// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Unified API Client
// All frontend → backend communication goes through this
// ═══════════════════════════════════════════════════════════

// ── Types ──────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    hasMore?: boolean;
  };
}

export interface ApiError {
  message: string;
  code?: string;
  status: number;
  details?: Record<string, unknown>;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiClientError';
    this.status = error.status;
    this.code = error.code;
    this.details = error.details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }

  get isRateLimit(): boolean {
    return this.status === 429;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

// ── Configuration ──────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

type RequestInterceptor = (config: RequestInit & { url: string }) => RequestInit & { url: string };
type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

// ── Client ─────────────────────────────────────────────────

class ApiClient {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  addRequestInterceptor(fn: RequestInterceptor): () => void {
    this.requestInterceptors.push(fn);
    return () => {
      this.requestInterceptors = this.requestInterceptors.filter((i) => i !== fn);
    };
  }

  addResponseInterceptor(fn: ResponseInterceptor): () => void {
    this.responseInterceptors.push(fn);
    return () => {
      this.responseInterceptors = this.responseInterceptors.filter((i) => i !== fn);
    };
  }

  // ── Auth Headers ───────────────────────────────────────

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('aion_token');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  // ── Core Fetch ─────────────────────────────────────────

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries: number = MAX_RETRIES,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<Response> {
    // Apply request interceptors
    let config = { ...options, url };
    for (const interceptor of this.requestInterceptors) {
      config = interceptor(config);
    }

    const { url: finalUrl, ...fetchOptions } = config;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response = await fetch(finalUrl, {
        ...fetchOptions,
        signal: controller.signal,
      });

      // Apply response interceptors
      for (const interceptor of this.responseInterceptors) {
        response = await interceptor(response);
      }

      // 401 Interceptor — attempt token refresh and retry once
      if (response.status === 401) {
        const refreshToken = localStorage.getItem('aion_refresh_token');
        if (refreshToken) {
          const refreshResp = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshResp.ok) {
            const json = await refreshResp.json();
            const data = json.data ?? json;
            localStorage.setItem('aion_token', data.token);
            localStorage.setItem('aion_refresh_token', data.refreshToken);

            // Retry the original request with the refreshed token
            const retryHeaders = {
              ...Object.fromEntries(new Headers(fetchOptions.headers).entries()),
              Authorization: `Bearer ${data.token}`,
            };
            clearTimeout(timer);
            return fetch(finalUrl, { ...fetchOptions, headers: retryHeaders });
          }
        }

        // Session truly expired — redirect to login
        localStorage.removeItem('aion_token');
        localStorage.removeItem('aion_refresh_token');
        window.location.href = '/login';
        throw new ApiClientError({
          message: 'Session expired. Please log in again.',
          status: 401,
          code: 'SESSION_EXPIRED',
        });
      }

      // Retry on 5xx or network error
      if (response.status >= 500 && retries > 0) {
        await this.delay(RETRY_DELAY_MS * (MAX_RETRIES - retries + 1));
        return this.fetchWithRetry(url, options, retries - 1, timeoutMs);
      }

      return response;
    } catch (error) {
      if (retries > 0 && this.isRetryableError(error)) {
        await this.delay(RETRY_DELAY_MS * (MAX_RETRIES - retries + 1));
        return this.fetchWithRetry(url, options, retries - 1, timeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    if (error instanceof TypeError && error.message.includes('fetch')) return true;
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ── Parse Response ─────────────────────────────────────

  private async parseResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorBody: Record<string, unknown> = {};
      try {
        errorBody = await response.json();
      } catch {
        // Response is not JSON
      }

      throw new ApiClientError({
        message: (errorBody.error as string) || (errorBody.message as string) || `API error ${response.status}`,
        code: errorBody.code as string | undefined,
        status: response.status,
        details: errorBody,
      });
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    const json = await response.json();

    // Unwrap backend envelope: { success: true, data: ... }
    if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
      return json.data as T;
    }

    return json as T;
  }

  // ── Public API Methods ─────────────────────────────────

  /**
   * GET request to the Backend API (Fastify)
   */
  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const headers = this.getAuthHeaders();
    const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const response = await this.fetchWithRetry(url.toString(), {
      method: 'GET',
      headers,
    });

    return this.parseResponse<T>(response);
  }

  /**
   * POST request to the Backend API (Fastify)
   */
  async post<T>(path: string, body?: unknown): Promise<T> {
    const headers = this.getAuthHeaders();
    const response = await this.fetchWithRetry(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.parseResponse<T>(response);
  }

  /**
   * PUT request to the Backend API (Fastify)
   */
  async put<T>(path: string, body?: unknown): Promise<T> {
    const headers = this.getAuthHeaders();
    const response = await this.fetchWithRetry(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.parseResponse<T>(response);
  }

  /**
   * PATCH request to the Backend API (Fastify)
   */
  async patch<T>(path: string, body?: unknown): Promise<T> {
    const headers = this.getAuthHeaders();
    const response = await this.fetchWithRetry(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.parseResponse<T>(response);
  }

  /**
   * DELETE request to the Backend API (Fastify)
   */
  async delete<T = void>(path: string): Promise<T> {
    const headers = this.getAuthHeaders();
    const response = await this.fetchWithRetry(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers,
    });

    return this.parseResponse<T>(response);
  }

  /**
   * Route legacy edge function calls through the local backend API.
   */
  async edgeFunction<T>(functionName: string, params?: Record<string, string>, options?: RequestInit): Promise<T> {
    const routeMap: Record<string, string> = {
      'whatsapp-api': '/whatsapp',
      'email-api': '/email',
      'health-api': '/health/detailed',
      'events-api': '/events',
      'incidents-api': '/incidents',
      'integrations-api': '/integrations',
      'mcp-api': '/mcp',
      'operations-api': '/operations',
      'cloud-accounts-api': '/cloud-accounts',
      'analytics-api': '/analytics',
    };

    const basePath = routeMap[functionName] || `/${functionName.replace(/-api$/, '')}`;

    // Build path from params
    let path = basePath;
    const queryParams: Record<string, string> = {};

    if (params) {
      const { id, action, ...rest } = params;
      if (id) path += `/${id}`;
      if (action) path += `/${action}`;
      Object.assign(queryParams, rest);
    }

    const method = options?.method?.toUpperCase() || 'GET';

    if (method === 'GET') {
      return this.get<T>(path, queryParams);
    } else if (method === 'POST') {
      const body = options?.body ? JSON.parse(options.body as string) : undefined;
      return this.post<T>(path, body);
    } else if (method === 'PUT') {
      const body = options?.body ? JSON.parse(options.body as string) : undefined;
      return this.put<T>(path, body);
    } else if (method === 'DELETE') {
      return this.delete<T>(path);
    }

    return this.get<T>(path, queryParams);
  }
}

// ── Singleton Export ────────────────────────────────────────

export const apiClient = new ApiClient();
