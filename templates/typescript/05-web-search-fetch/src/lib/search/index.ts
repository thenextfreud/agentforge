/**
 * Search provider factory.
 *
 * Creates the appropriate search provider based on the SEARCH_PROVIDER
 * environment variable. Supports: duckduckgo, brave, tavily, serpapi.
 */

import type { SearchProvider } from "./types.js";
import { DuckDuckGoProvider } from "./duckduckgo.js";
import { BraveSearchProvider } from "./brave.js";
import { TavilyProvider } from "./tavily.js";
import { SerpApiProvider } from "./serpapi.js";
import { logger } from "../logger.js";

export type { SearchProvider, SearchResult, SearchOptions } from "./types.js";

let _provider: SearchProvider | null = null;

/**
 * Get the configured search provider, creating it lazily on first use.
 */
export function getSearchProvider(): SearchProvider {
  if (_provider) return _provider;

  const providerName = (process.env.SEARCH_PROVIDER || "duckduckgo").toLowerCase();
  const timeoutMs = parseInt(process.env.REQUEST_TIMEOUT_MS || "15000", 10);

  switch (providerName) {
    case "duckduckgo":
      _provider = new DuckDuckGoProvider(timeoutMs);
      break;
    case "brave":
      _provider = new BraveSearchProvider(process.env.BRAVE_API_KEY || "", timeoutMs);
      break;
    case "tavily":
      _provider = new TavilyProvider(process.env.TAVILY_API_KEY || "", timeoutMs);
      break;
    case "serpapi":
      _provider = new SerpApiProvider(process.env.SERPAPI_KEY || "", timeoutMs);
      break;
    default:
      throw new Error(
        `Unknown search provider: "${providerName}". Supported: duckduckgo, brave, tavily, serpapi`
      );
  }

  logger.info("Search provider initialized", { provider: providerName });
  return _provider;
}
