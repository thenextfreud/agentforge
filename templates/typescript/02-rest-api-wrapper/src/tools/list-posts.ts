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

interface JsonPlaceholderPost {
  id: number;
  userId: number;
  title: string;
  body: string;
}

export const listPostsTool = {
  name: "list_posts",
  description: "List blog posts from the JSONPlaceholder API with offset-based pagination. Returns posts and pagination metadata for fetching the next page.",
  schema: {
    limit: z.number().int().positive().max(100).optional().default(10).describe("Number of posts per page (max 100, default 10)"),
    offset: z.number().int().min(0).optional().default(0).describe("Offset for pagination (default 0)"),
    user_id: z.number().int().positive().optional().describe("Filter posts by user ID"),
  },

  handler: wrapHandler(async (args: {
    limit?: number;
    offset?: number;
    user_id?: number;
  }) => {
    const client = getClient();
    const limit = args.limit ?? 10;
    const offset = args.offset ?? 0;

    const params: Record<string, string | number | undefined> = {
      _limit: limit,
      _start: offset,
    };
    if (args.user_id) params.userId = args.user_id;

    const response = await client.get<JsonPlaceholderPost[]>("/posts", params);
    const rateLimit = getRateLimitInfo();

    const posts = Array.isArray(response.data) ? response.data : [];
    const count = posts.length;
    const hasMore = count >= limit;

    const output = {
      status: response.status,
      count,
      data: posts,
      pagination: {
        limit,
        offset,
        next_offset: hasMore ? offset + count : undefined,
        has_more: hasMore,
      },
      rate_limit: rateLimit,
    };

    return JSON.stringify(output, null, 2);
  }),
};
