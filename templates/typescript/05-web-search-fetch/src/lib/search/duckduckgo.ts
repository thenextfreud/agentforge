/**
 * DuckDuckGo search provider (free, no API key required).
 *
 * Uses the DuckDuckGo Instant Answer API. Note: this API provides
 * instant answer results, not full search results. For full web
 * search, consider using Brave, Tavily, or SerpAPI.
 */

import type { SearchProvider, SearchResult, SearchOptions } from "./types.js";
import { fetchJson } from "./types.js";
import { logger } from "../logger.js";

interface DuckDuckGoResponse {
  Abstract?: string;
  AbstractURL?: string;
  Heading?: string;
  Answer?: string;
  Definition?: string;
  DefinitionURL?: string;
  RelatedTopics?: Array<
    | { Text?: string; FirstURL?: string }
    | { Topics?: Array<{ Text?: string; FirstURL?: string }> }
  >;
}

export class DuckDuckGoProvider implements SearchProvider {
  name = "duckduckgo";
  private timeoutMs: number;

  constructor(timeoutMs: number = 15000) {
    this.timeoutMs = timeoutMs;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const maxResults = options?.maxResults ?? 10;
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

    logger.debug("DuckDuckGo search", { query, url });
    const data = (await fetchJson(url, { timeoutMs: this.timeoutMs })) as DuckDuckGoResponse;

    const results: SearchResult[] = [];

    // Primary result from abstract
    if (data.Abstract && data.AbstractURL) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.Abstract,
      });
    }

    // Instant answer
    if (data.Answer) {
      results.push({
        title: query,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: data.Answer,
      });
    }

    // Definition
    if (data.Definition && data.DefinitionURL) {
      results.push({
        title: `Definition: ${query}`,
        url: data.DefinitionURL,
        snippet: data.Definition,
      });
    }

    // Related topics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics) {
        if (results.length >= maxResults) break;

        if ("Text" in topic && topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(" - ")[0] || topic.Text.slice(0, 80),
            url: topic.FirstURL,
            snippet: topic.Text,
          });
        } else if ("Topics" in topic && topic.Topics) {
          for (const subTopic of topic.Topics) {
            if (results.length >= maxResults) break;
            if (subTopic.Text && subTopic.FirstURL) {
              results.push({
                title: subTopic.Text.split(" - ")[0] || subTopic.Text.slice(0, 80),
                url: subTopic.FirstURL,
                snippet: subTopic.Text,
              });
            }
          }
        }
      }
    }

    return results.slice(0, maxResults);
  }
}
