/**
 * Search provider interface.
 *
 * All search providers implement this interface, allowing the server
 * to switch between providers via the SEARCH_PROVIDER env variable.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchOptions {
  maxResults?: number;
}

export interface SearchProvider {
  name: string;
  /** Search the web and return results. */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

/**
 * Shared HTTP fetch helper used by all providers.
 */
export async function fetchJson(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs: number;
  }
): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(options.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Search API returned HTTP ${response.status} ${response.statusText}`);
  }

  return response.json();
}
