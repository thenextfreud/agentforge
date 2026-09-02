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

interface CreatedPost {
  id: number;
  userId: number;
  title: string;
  body: string;
}

export const createPostTool = {
  name: "create_post",
  description: "Create a new blog post via the JSONPlaceholder API. Note: JSONPlaceholder is a mock API — the post is not actually persisted but the response simulates a successful creation.",
  schema: {
    title: z.string().min(1).max(200).describe("Title of the post"),
    body: z.string().min(1).describe("Body content of the post"),
    user_id: z.number().int().positive().describe("ID of the authoring user"),
  },

  handler: wrapHandler(async (args: {
    title: string;
    body: string;
    user_id: number;
  }) => {
    const client = getClient();
    const response = await client.post<CreatedPost>("/posts", {
      title: args.title,
      body: args.body,
      userId: args.user_id,
    });
    const rateLimit = getRateLimitInfo();

    const output = {
      status: response.status,
      data: response.data,
      rate_limit: rateLimit,
    };

    return JSON.stringify(output, null, 2);
  }),
};
