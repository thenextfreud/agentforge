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

export const apiPostTool = {
  name: "api_post",
  description: "Perform a POST request to the configured REST API with a JSON body. Useful for creating resources.",
  schema: {
    path: z.string().describe("API path (e.g. /posts or posts). Leading slash is optional."),
    body: z.record(z.string(), z.unknown()).describe("JSON body to send in the request"),
    params: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe("Query parameters as key-value pairs"),
  },

  handler: wrapHandler(async (args: {
    path: string;
    body: Record<string, unknown>;
    params?: Record<string, string | number>;
  }) => {
    const client = getClient();
    const response = await client.post(args.path, args.body, args.params);
    const rateLimit = getRateLimitInfo();

    const output = {
      status: response.status,
      data: response.data,
      rate_limit: rateLimit,
    };

    return JSON.stringify(output, null, 2);
  }),
};
