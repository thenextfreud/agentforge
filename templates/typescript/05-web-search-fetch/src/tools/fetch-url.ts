import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";
import { extractTextFromHtml, extractTitleFromHtml, extractMetaDescription } from "../lib/html-extractor.js";

function getTimeoutMs(): number {
  return parseInt(process.env.REQUEST_TIMEOUT_MS || "15000", 10);
}

function getMaxContentLength(): number {
  return parseInt(process.env.MAX_CONTENT_LENGTH || "50000", 10);
}

function getUserAgent(): string {
  return process.env.USER_AGENT || "AgentForge-MCP/1.0";
}

export const fetchUrlTool = {
  name: "fetch_url",
  description: "Fetch a URL and extract readable text content. Strips HTML tags, scripts, styles, and other non-content elements. Returns the page title, meta description, and extracted text. Content is truncated to MAX_CONTENT_LENGTH characters.",
  schema: {
    url: z.string().url().describe("The URL to fetch"),
    max_length: z.number().int().positive().max(500000).optional().describe("Maximum content length in characters (overrides MAX_CONTENT_LENGTH env)"),
  },

  handler: wrapHandler(async (args: { url: string; max_length?: number }) => {
    const timeoutMs = getTimeoutMs();
    const maxContentLength = args.max_length ?? getMaxContentLength();
    const userAgent = getUserAgent();

    const response = await fetch(args.url, {
      headers: {
        "User-Agent": userAgent,
        "Accept": "text/html, text/plain, */*",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const html = await response.text();

    // Extract metadata
    const title = extractTitleFromHtml(html);
    const metaDescription = extractMetaDescription(html);

    // Extract text content
    const text = extractTextFromHtml(html, maxContentLength);

    const output = {
      url: args.url,
      status: response.status,
      content_type: contentType,
      title,
      meta_description: metaDescription,
      content_length: text.length,
      truncated: text.length >= maxContentLength,
      content: text,
    };

    return JSON.stringify(output, null, 2);
  }),
};
