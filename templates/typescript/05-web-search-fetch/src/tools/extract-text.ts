import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";
import { extractTextFromHtml, extractTitleFromHtml } from "../lib/html-extractor.js";

function getTimeoutMs(): number {
  return parseInt(process.env.REQUEST_TIMEOUT_MS || "15000", 10);
}

function getMaxContentLength(): number {
  return parseInt(process.env.MAX_CONTENT_LENGTH || "50000", 10);
}

function getUserAgent(): string {
  return process.env.USER_AGENT || "AgentForge-MCP/1.0";
}

export const extractTextTool = {
  name: "extract_text",
  description: "Extract readable text from an HTML string. Useful when you already have the raw HTML and want to convert it to plain text. Strips scripts, styles, and HTML tags while preserving line breaks.",
  schema: {
    html: z.string().describe("The HTML string to extract text from"),
    max_length: z.number().int().positive().max(500000).optional().describe("Maximum content length in characters (overrides MAX_CONTENT_LENGTH env)"),
  },

  handler: wrapHandler(async (args: { html: string; max_length?: number }) => {
    const maxContentLength = args.max_length ?? getMaxContentLength();

    const title = extractTitleFromHtml(args.html);
    const text = extractTextFromHtml(args.html, maxContentLength);

    const output = {
      title,
      content_length: text.length,
      truncated: text.length >= maxContentLength,
      content: text,
    };

    return JSON.stringify(output, null, 2);
  }),
};
