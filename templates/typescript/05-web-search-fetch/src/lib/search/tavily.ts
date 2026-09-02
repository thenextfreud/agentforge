/**
 * Tavily Search provider.
 *
 * Uses the Tavily Search API. Requires TAVILY_API_KEY.
 * API docs: https://docs.tavily.com/
 */

import type { SearchProvider, SearchResult, SearchOptions } from "./types.js";
import { logger } from "../logger.js";

interface TavilySearchResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>;
}

export class TavilyProvider implements SearchProvider {
  name = "tavily";
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey: string, timeoutMs: number = 15000) {
    if (!apiKey) {
      throw new Error("Tavily Search requires TAVILY_API_KEY environment variable");
    }
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const maxResults = options?.maxResults ?? 10;

    logger.debug("Tavily search", { query });
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        max_results: maxResults,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Tavily API returned HTTP ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as TavilySearchResponse;

    const results: SearchResult[] = (data.results ?? []).map((r) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.content || "",
    }));

    return results.slice(0, maxResults);
  }
}
