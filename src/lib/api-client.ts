// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Unified API Client
// All frontend → backend communication goes through this
// ═══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

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
const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

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

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
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
        const { data } = await supabase.auth.refreshSession();
        if (data.session) {
          // Retry the original request with the refreshed token
          const retryHeaders = {
            ...Object.fromEntries(new Headers(fetchOptions.headers).entries()),
            Authorization: `Bearer ${data.session.access_token}`,
          };
          clearTimeout(timer);
          return fetch(finalUrl, { ...fetchOptions, headers: retryHeaders });
        } else {
          // Session truly expired — redirect to login
          window.location.href = '/login';
          throw new ApiClientError({
            message: 'Session expired. Please log in again.',
            status: 401,
            code: 'SESSION_EXPIRED',
          });
        }
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

    return response.json();
  }

  // ── Public API Methods ─────────────────────────────────

  /**
   * GET request to the Backend API (Fastify)
   */
  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const headers = await this.getAuthHeaders();
    const url = new URL(`${API_BASE_URL}${path}`);

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
    const headers = await this.getAuthHeaders();
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
    const headers = await this.getAuthHeaders();
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
    const headers = await this.getAuthHeaders();
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
    const headers = await this.getAuthHeaders();
    const response = await this.fetchWithRetry(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers,
    });

    return this.parseResponse<T>(response);
  }

  /**
   * Call a Supabase Edge Function (legacy, for functions not yet migrated to Fastify)
   */
  async edgeFunction<T>(functionName: string, params?: Record<string, string>, options?: RequestInit): Promise<T> {
    const headers = await this.getAuthHeaders();
    // Edge functions also need the apikey
    headers['apikey'] = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const url = new URL(`${SUPABASE_FUNCTIONS_URL}/${functionName}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const response = await this.fetchWithRetry(url.toString(), {
      ...options,
      headers: { ...headers, ...(options?.headers || {}) },
    });

    return this.parseResponse<T>(response);
  }
}

// ── Singleton Export ────────────────────────────────────────

export const apiClient = new ApiClient();
