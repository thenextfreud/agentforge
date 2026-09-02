/**
 * HTTP client wrapper for REST API interactions.
 *
 * Provides:
 * - Configurable base URL and auth header
 * - Request timeouts via AbortSignal
 * - Automatic retry with exponential backoff
 * - Rate-limit header tracking (X-RateLimit-Remaining, Retry-After)
 * - Pagination support (cursor and offset)
 */

import { logger } from "./logger.js";
import { withRetry, ApiError } from "./retry.js";

export interface ApiClientConfig {
  baseUrl: string;
  apiKey?: string;
  apiKeyHeader: string;
  timeoutMs: number;
  maxRetries: number;
}

export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  reset?: number;
  retryAfter?: number;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
  rateLimit: RateLimitInfo;
}

export interface PaginationParams {
  /** Cursor-based pagination — pass the cursor returned from the previous response. */
  cursor?: string;
  /** Offset-based pagination — number of records to skip. */
  offset?: number;
  /** Number of records per page. */
  limit?: number;
}

/** Tracks the latest rate-limit info observed across all requests. */
let lastRateLimitInfo: RateLimitInfo = {};

export function getRateLimitInfo(): RateLimitInfo {
  return lastRateLimitInfo;
}

/**
 * Extract rate-limit information from response headers.
 * Supports common conventions: X-RateLimit-Limit, X-RateLimit-Remaining,
 * X-RateLimit-Reset, and Retry-After.
 */
function extractRateLimit(headers: Headers): RateLimitInfo {
  const info: RateLimitInfo = {};

  const limit = headers.get("X-RateLimit-Limit") ?? headers.get("x-ratelimit-limit");
  if (limit) info.limit = parseInt(limit, 10);

  const remaining = headers.get("X-RateLimit-Remaining") ?? headers.get("x-ratelimit-remaining");
  if (remaining) info.remaining = parseInt(remaining, 10);

  const reset = headers.get("X-RateLimit-Reset") ?? headers.get("x-ratelimit-reset");
  if (reset) info.reset = parseInt(reset, 10);

  const retryAfter = headers.get("Retry-After") ?? headers.get("retry-after");
  if (retryAfter) {
    const parsed = parseInt(retryAfter, 10);
    info.retryAfter = isNaN(parsed) ? undefined : parsed;
  }

  return info;
}

/**
 * Build the full URL from base URL and path.
 * Handles paths with or without leading slashes.
 */
function buildUrl(baseUrl: string, path: string, params?: Record<string, string | number | undefined>): string {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  const trimmedPath = path.replace(/^\/+/, "");
  let url = `${trimmedBase}/${trimmedPath}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  return url;
}

/**
 * Core request method. Performs a single HTTP request with timeout,
 * auth, and retry. Returns parsed data, status, headers, and rate-limit info.
 */
async function request<T = unknown>(
  config: ApiClientConfig,
  method: string,
  path: string,
  options?: {
    params?: Record<string, string | number | undefined>;
    body?: unknown;
    extraHeaders?: Record<string, string>;
  }
): Promise<ApiResponse<T>> {
  const url = buildUrl(config.baseUrl, path, options?.params);

  const headers: Record<string, string> = {
    "Accept": "application/json",
    "User-Agent": "AgentForge-MCP/1.0",
    ...options?.extraHeaders,
  };

  // Attach API key if configured
  if (config.apiKey) {
    headers[config.apiKeyHeader] = config.apiKey;
  }

  // Attach JSON body
  let bodyStr: string | undefined;
  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    bodyStr = JSON.stringify(options.body);
  }

  const response = await withRetry(async () => {
    logger.debug("HTTP request", { method, url });

    const res = await fetch(url, {
      method,
      headers,
      body: bodyStr,
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => undefined);
      throw new ApiError(
        `HTTP ${res.status} ${res.statusText}`,
        res.status,
        text
      );
    }

    return res;
  }, { maxRetries: config.maxRetries });

  const rateLimit = extractRateLimit(response.headers);
  lastRateLimitInfo = rateLimit;

  // Parse response — handle empty bodies (204 No Content)
  const text = await response.text();
  let data: T;
  try {
    data = (text ? JSON.parse(text) : null) as T;
  } catch {
    // Not JSON — return raw text
    data = text as unknown as T;
  }

  return { data, status: response.status, headers: response.headers, rateLimit };
}

/**
 * Create an API client bound to the given configuration.
 */
export function createApiClient(config: ApiClientConfig) {
  return {
    /** GET request with optional query params and pagination. */
    get<T = unknown>(
      path: string,
      params?: Record<string, string | number | undefined> & PaginationParams
    ): Promise<ApiResponse<T>> {
      return request<T>(config, "GET", path, { params });
    },

    /** POST request with a JSON body. */
    post<T = unknown>(
      path: string,
      body?: unknown,
      params?: Record<string, string | number | undefined>
    ): Promise<ApiResponse<T>> {
      return request<T>(config, "POST", path, { body, params });
    },

    /** PUT request with a JSON body. */
    put<T = unknown>(
      path: string,
      body?: unknown,
      params?: Record<string, string | number | undefined>
    ): Promise<ApiResponse<T>> {
      return request<T>(config, "PUT", path, { body, params });
    },

    /** PATCH request with a JSON body. */
    patch<T = unknown>(
      path: string,
      body?: unknown,
      params?: Record<string, string | number | undefined>
    ): Promise<ApiResponse<T>> {
      return request<T>(config, "PATCH", path, { body, params });
    },

    /** DELETE request. */
    delete<T = unknown>(
      path: string,
      params?: Record<string, string | number | undefined>
    ): Promise<ApiResponse<T>> {
      return request<T>(config, "DELETE", path, { params });
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Load API client configuration from environment variables.
 */
export function loadConfigFromEnv(): ApiClientConfig {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    throw new Error("API_BASE_URL environment variable is required");
  }

  return {
    baseUrl,
    apiKey: process.env.API_KEY || undefined,
    apiKeyHeader: process.env.API_KEY_HEADER || "Authorization",
    timeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || "10000", 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || "3", 10),
  };
}
