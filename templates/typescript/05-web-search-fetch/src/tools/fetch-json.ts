import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";

function getTimeoutMs(): number {
  return parseInt(process.env.REQUEST_TIMEOUT_MS || "15000", 10);
}

function getUserAgent(): string {
  return process.env.USER_AGENT || "AgentForge-MCP/1.0";
}

export const fetchJsonTool = {
  name: "fetch_json",
  description: "Fetch a URL and parse the response as JSON. Useful for interacting with REST APIs and fetching structured data. Returns the parsed JSON data along with status and content-type information.",
  schema: {
    url: z.string().url().describe("The URL to fetch"),
    headers: z.record(z.string(), z.string()).optional().describe("Additional HTTP headers to send"),
  },

  handler: wrapHandler(async (args: { url: string; headers?: Record<string, string> }) => {
    const timeoutMs = getTimeoutMs();
    const userAgent = getUserAgent();

    const response = await fetch(args.url, {
      headers: {
        "User-Agent": userAgent,
        "Accept": "application/json, */*",
        ...args.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} ${response.statusText}${body ? `: ${body.slice(0, 500)}` : ""}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const data = await response.json();

    const output = {
      url: args.url,
      status: response.status,
      content_type: contentType,
      data,
    };

    return JSON.stringify(output, null, 2);
  }),
};
