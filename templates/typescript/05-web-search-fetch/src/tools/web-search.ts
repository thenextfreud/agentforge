import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";
import { getSearchProvider } from "../lib/search/index.js";

export const webSearchTool = {
  name: "web_search",
  description: "Search the web using the configured search provider (DuckDuckGo by default, also supports Brave, Tavily, and SerpAPI). Returns titles, URLs, and snippets for each result.",
  schema: {
    query: z.string().min(1).describe("The search query"),
    max_results: z.number().int().positive().max(20).optional().default(10).describe("Maximum number of results to return (max 20, default 10)"),
  },

  handler: wrapHandler(async (args: { query: string; max_results?: number }) => {
    const provider = getSearchProvider();
    const results = await provider.search(args.query, { maxResults: args.max_results });

    const output = {
      provider: provider.name,
      query: args.query,
      result_count: results.length,
      results,
    };

    return JSON.stringify(output, null, 2);
  }),
};
