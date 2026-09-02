import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";
import { createApiClient, getRateLimitInfo, type ApiClientConfig } from "../lib/api-client.js";

let _config: ApiClientConfig | null = null;
let _client: ReturnType<typeof createApiClient> | null = null;

function getClient() {
  if (!_config) {
    const baseUrl = process.env.API_BASE_URL;
    if (!baseUrl) {
      throw new Error("API_BASE_URL environment variable is required");
    }
    _config = {
      baseUrl,
      apiKey: process.env.API_KEY || undefined,
      apiKeyHeader: process.env.API_KEY_HEADER || "Authorization",
      timeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || "10000", 10),
      maxRetries: parseInt(process.env.MAX_RETRIES || "3", 10),
    };
    _client = createApiClient(_config);
  }
  return _client!;
}

export const apiListTool = {
  name: "api_list",
  description: "List resources from the configured REST API with pagination support. Automatically handles cursor and offset pagination, returning pagination metadata for the next page.",
  schema: {
    path: z.string().describe("API path to list (e.g. /posts or posts). Leading slash is optional."),
    limit: z.number().int().positive().max(100).optional().describe("Number of items per page (max 100)"),
    cursor: z.string().optional().describe("Pagination cursor from a previous response's next_cursor field"),
    offset: z.number().int().min(0).optional().describe("Offset for offset-based pagination"),
    params: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe("Additional query parameters"),
  },

  handler: wrapHandler(async (args: {
    path: string;
    limit?: number;
    cursor?: string;
    offset?: number;
    params?: Record<string, string | number>;
  }) => {
    const client = getClient();
    const params: Record<string, string | number | undefined> = { ...args.params };
    if (args.limit !== undefined) params.limit = args.limit;
    if (args.cursor) params.cursor = args.cursor;
    if (args.offset !== undefined) params.offset = args.offset;

    const response = await client.get<unknown[]>(args.path, params);
    const rateLimit = getRateLimitInfo();

    // Determine pagination metadata
    const data = Array.isArray(response.data) ? response.data : [response.data];
    const count = data.length;
    const requestedLimit = args.limit ?? 0;

    // Compute next cursor/offset if applicable
    let nextCursor: string | undefined;
    let nextOffset: number | undefined;

    // Check for cursor in response headers or data
    const cursorHeader = response.headers.get("X-Next-Cursor") ?? response.headers.get("x-next-cursor");
    if (cursorHeader) {
      nextCursor = cursorHeader;
    }

    // If using offset pagination and we got a full page, suggest next offset
    if (args.offset !== undefined && requestedLimit > 0 && count >= requestedLimit) {
      nextOffset = args.offset + count;
    }

    const output = {
      status: response.status,
      count,
      data,
      pagination: {
        cursor: args.cursor,
        offset: args.offset,
        limit: args.limit,
        next_cursor: nextCursor,
        next_offset: nextOffset,
        has_more: count >= (requestedLimit || count),
      },
      rate_limit: rateLimit,
    };

    return JSON.stringify(output, null, 2);
  }),
};
