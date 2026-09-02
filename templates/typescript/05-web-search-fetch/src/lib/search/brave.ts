/**
 * Brave Search provider.
 *
 * Uses the Brave Search API. Requires BRAVE_API_KEY.
 * API docs: https://api.search.brave.com/
 */

import type { SearchProvider, SearchResult, SearchOptions } from "./types.js";
import { fetchJson } from "./types.js";
import { logger } from "../logger.js";

interface BraveSearchResponse {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      snippet?: string;
    }>;
  };
}

export class BraveSearchProvider implements SearchProvider {
  name = "brave";
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey: string, timeoutMs: number = 15000) {
    if (!apiKey) {
      throw new Error("Brave Search requires BRAVE_API_KEY environment variable");
    }
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const maxResults = options?.maxResults ?? 10;
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;

    logger.debug("Brave search", { query, url });
    const data = (await fetchJson(url, {
      timeoutMs: this.timeoutMs,
      headers: {
        "X-Subscription-Token": this.apiKey,
      },
    })) as BraveSearchResponse;

    const results: SearchResult[] = (data.web?.results ?? []).map((r) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.description || r.snippet || "",
    }));

    return results.slice(0, maxResults);
  }
}
