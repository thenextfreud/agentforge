/**
 * Retry utility with exponential backoff.
 *
 * Retries a function up to `maxRetries` times, waiting an exponentially
 * increasing delay between attempts. Only retries on transient errors
 * (network failures, 429, 5xx responses).
 */

import { logger } from "./logger.js";

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/** Default delay parameters for exponential backoff. */
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 10000;

/**
 * Determine whether an error is worth retrying.
 * Retries on network errors, HTTP 429 (rate limit), and 5xx server errors.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 429 || (error.status >= 500 && error.status <= 599);
  }
  // Network errors (fetch failures, timeouts) are retryable
  return true;
}

/** Custom error class carrying HTTP status info. */
export class ApiError extends Error {
  status: number;
  body?: string;

  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute `fn` with retry and exponential backoff.
 *
 * @param fn - async function to execute
 * @param opts - retry configuration
 * @returns the result of `fn` on success
 * @throws the last error if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T> {
  const baseDelay = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelay = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= opts.maxRetries || !isRetryableError(error)) {
        throw error;
      }

      // Exponential backoff: base * 2^attempt, capped at maxDelay
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

      logger.warn("Request failed, retrying", {
        attempt: attempt + 1,
        maxRetries: opts.maxRetries,
        delayMs: delay,
        error: error instanceof Error ? error.message : String(error),
      });

      await sleep(delay);
    }
  }

  throw lastError;
}
