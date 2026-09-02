import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";

export const fetchUrlTool = {
  name: "fetch_url",
  description: "Fetch the content of a URL and return it as plain text. Useful for reading web pages, API responses, and documentation.",
  schema: {
    url: z.string().url().describe("The URL to fetch"),
    max_length: z.number().int().positive().max(50000).optional().default(10000).describe("Maximum response length in characters"),
  },

  handler: wrapHandler(async (args: { url: string; max_length?: number }) => {
    const response = await fetch(args.url, {
      headers: {
        "User-Agent": "AgentForge-MCP/1.0",
        "Accept": "text/plain, text/html, application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const truncated = text.length > args.max_length!
      ? text.slice(0, args.max_length) + "\n... [truncated]"
      : text;

    return truncated;
  }),
};
