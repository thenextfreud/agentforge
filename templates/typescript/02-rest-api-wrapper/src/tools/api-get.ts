import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";
import { createApiClient, getRateLimitInfo, type ApiClientConfig } from "../lib/api-client.js";

let _config: ApiClientConfig | null = null;
let _client: ReturnType<typeof createApiClient> | null = null;

/**
 * Lazily create the API client from environment configuration.
 * Cached after first call.
 */
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

export const apiGetTool = {
  name: "api_get",
  description: "Perform a GET request to the configured REST API. Supports query parameters and pagination (cursor or offset).",
  schema: {
    path: z.string().describe("API path (e.g. /posts/1 or posts). Leading slash is optional."),
    params: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe("Query parameters as key-value pairs"),
    cursor: z.string().optional().describe("Pagination cursor from a previous response"),
    offset: z.number().int().min(0).optional().describe("Offset for offset-based pagination"),
    limit: z.number().int().positive().optional().describe("Maximum number of results to return"),
  },

  handler: wrapHandler(async (args: {
    path: string;
    params?: Record<string, string | number>;
    cursor?: string;
    offset?: number;
    limit?: number;
  }) => {
    const client = getClient();
    const params: Record<string, string | number | undefined> = { ...args.params };
    if (args.cursor) params.cursor = args.cursor;
    if (args.offset !== undefined) params.offset = args.offset;
    if (args.limit !== undefined) params.limit = args.limit;

    const response = await client.get(args.path, params);
    const rateLimit = getRateLimitInfo();

    const output = {
      status: response.status,
      data: response.data,
      rate_limit: rateLimit,
    };

    return JSON.stringify(output, null, 2);
  }),
};
