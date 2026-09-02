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

interface JsonPlaceholderUser {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  website: string;
  company: {
    name: string;
    catchPhrase: string;
    bs: string;
  };
  address: {
    street: string;
    suite: string;
    city: string;
    zipcode: string;
    geo: {
      lat: string;
      lng: string;
    };
  };
}

export const getUserTool = {
  name: "get_user",
  description: "Fetch a single user by ID from the JSONPlaceholder API (https://jsonplaceholder.typicode.com).",
  schema: {
    id: z.number().int().positive().describe("The user ID to fetch"),
  },

  handler: wrapHandler(async (args: { id: number }) => {
    const client = getClient();
    const response = await client.get<JsonPlaceholderUser>(`/users/${args.id}`);
    const rateLimit = getRateLimitInfo();

    const output = {
      status: response.status,
      data: response.data,
      rate_limit: rateLimit,
    };

    return JSON.stringify(output, null, 2);
  }),
};
