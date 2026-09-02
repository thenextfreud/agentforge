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

export const getPostTool = {
  name: "get_post",
  description: "Fetch a single blog post by ID from the JSONPlaceholder API (https://jsonplaceholder.typicode.com).",
  schema: {
    id: z.number().int().positive().describe("The post ID to fetch"),
  },

  handler: wrapHandler(async (args: { id: number }) => {
    const client = getClient();
    const response = await client.get<JsonPlaceholderPost>(`/posts/${args.id}`);
    const rateLimit = getRateLimitInfo();

    const output = {
      status: response.status,
      data: response.data,
      rate_limit: rateLimit,
    };

    return JSON.stringify(output, null, 2);
  }),
};
