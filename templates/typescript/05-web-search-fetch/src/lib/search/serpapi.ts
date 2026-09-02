/**
 * SerpAPI search provider.
 *
 * Uses the SerpAPI Google Search API. Requires SERPAPI_KEY.
 * API docs: https://serpapi.com/
 */

import type { SearchProvider, SearchResult, SearchOptions } from "./types.js";
import { fetchJson } from "./types.js";
import { logger } from "../logger.js";

interface SerpApiResponse {
  organic_results?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
  }>;
}

export class SerpApiProvider implements SearchProvider {
  name = "serpapi";
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey: string, timeoutMs: number = 15000) {
    if (!apiKey) {
      throw new Error("SerpAPI requires SERPAPI_KEY environment variable");
    }
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const maxResults = options?.maxResults ?? 10;
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=${maxResults}&api_key=${this.apiKey}`;

    logger.debug("SerpAPI search", { query, url: url.replace(this.apiKey, "***") });
    const data = (await fetchJson(url, { timeoutMs: this.timeoutMs })) as SerpApiResponse;

    const results: SearchResult[] = (data.organic_results ?? []).map((r) => ({
      title: r.title || "",
      url: r.link || "",
      snippet: r.snippet || "",
    }));

    return results.slice(0, maxResults);
  }
}
