// @agentforge/cli — template registry
// All 15 templates: 5 TypeScript MCP servers, 5 Python MCP servers, 5 AI agents.
// The `path` field is relative to the project root (the AgentForge repo root).

export const templates = [
  // ──────────────────────────────────────────────────────────
  // TypeScript MCP Servers (5)
  // ──────────────────────────────────────────────────────────
  {
    id: "ts-hello-world",
    name: "Hello World (stdio)",
    category: "MCP Server",
    language: "TypeScript",
    transport: "stdio",
    description:
      "Minimum viable MCP server with stdio transport, Zod validation, and structured logging",
    tools: ["echo", "fetch_url"],
    path: "templates/typescript/01-hello-world-stdio",
    envVars: [],
    nextSteps: [
      "npm install",
      "npm run dev      # start in dev mode with tsx watch",
      "npm run build    # compile to dist/",
      "npm start        # run compiled server",
    ],
  },
  {
    id: "ts-rest-api-wrapper",
    name: "REST API Wrapper",
    category: "MCP Server",
    language: "TypeScript",
    transport: "stdio",
    description:
      "Wrap any REST API as MCP tools with auth, retries, and pagination support",
    tools: ["api_get", "api_post", "api_list"],
    path: "templates/typescript/02-rest-api-wrapper",
    envVars: ["API_BASE_URL", "API_KEY"],
    nextSteps: [
      "npm install",
      "cp .env.example .env   # then edit with your API credentials",
      "npm run dev",
    ],
  },
  {
    id: "ts-database-query",
    name: "Database Query Server",
    category: "MCP Server",
    language: "TypeScript",
    transport: "stdio",
    description:
      "Safe read-only SQL queries with table allow-lists and result limiting",
    tools: ["query", "list_tables", "describe_table"],
    path: "templates/typescript/03-database-query-server",
    envVars: ["DATABASE_URL"],
    nextSteps: [
      "npm install",
      "cp .env.example .env   # then edit with your DATABASE_URL",
      "npm run dev",
    ],
  },
  {
    id: "ts-filesystem-tools",
    name: "Filesystem Tools",
    category: "MCP Server",
    language: "TypeScript",
    transport: "stdio",
    description:
      "Sandboxed file operations with path traversal prevention and allow-lists",
    tools: ["read_file", "write_file", "list_directory", "search_files"],
    path: "templates/typescript/04-filesystem-tools",
    envVars: ["ALLOWED_ROOTS"],
    nextSteps: [
      "npm install",
      "cp .env.example .env   # then edit with your allowed root paths",
      "npm run dev",
    ],
  },
  {
    id: "ts-web-search-fetch",
    name: "Web Search & Fetch",
    category: "MCP Server",
    language: "TypeScript",
    transport: "stdio",
    description:
      "Web search and URL fetching with readable text extraction and caching",
    tools: ["web_search", "fetch_url", "extract_text"],
    path: "templates/typescript/05-web-search-fetch",
    envVars: ["SEARCH_API_KEY"],
    nextSteps: [
      "npm install",
      "cp .env.example .env   # then edit with your search API key",
      "npm run dev",
    ],
  },

  // ──────────────────────────────────────────────────────────
  // Python MCP Servers (5)
  // ──────────────────────────────────────────────────────────
  {
    id: "py-rag-knowledge",
    name: "RAG Knowledge Server",
    category: "MCP Server",
    language: "Python",
    transport: "stdio",
    description:
      "Chunk, embed, and vector search with cited results over your knowledge base",
    tools: ["ingest", "search", "list_sources"],
    path: "templates/python/06-rag-knowledge-server",
    envVars: ["OPENAI_API_KEY", "VECTOR_STORE_PATH"],
    nextSteps: [
      "pip install -e .      # or: pip install -r requirements.txt",
      "cp .env.example .env  # then edit with your API keys",
      "python -m mcp_server  # or: uvicorn mcp_server:app",
    ],
  },
  {
    id: "py-oauth-protected",
    name: "OAuth Protected Server",
    category: "MCP Server",
    language: "Python",
    transport: "http",
    description:
      "Remote MCP server gated by OAuth 2.0 via JWKS validation",
    tools: ["authenticated_call", "user_info"],
    path: "templates/python/07-oauth-protected-server",
    envVars: ["JWKS_URL", "ISSUER", "AUDIENCE"],
    nextSteps: [
      "pip install -e .",
      "cp .env.example .env  # then edit with your OAuth config",
      "uvicorn mcp_server:app --reload",
    ],
  },
  {
    id: "py-saas-integration",
    name: "SaaS Integration Template",
    category: "MCP Server",
    language: "Python",
    transport: "stdio",
    description:
      "SaaS-wrapping patterns: retries, webhooks, pagination, and rate limiting",
    tools: ["list_resources", "get_resource", "create_resource", "webhook_status"],
    path: "templates/python/08-saas-integration-template",
    envVars: ["SAAS_API_KEY", "SAAS_API_URL", "WEBHOOK_SECRET"],
    nextSteps: [
      "pip install -e .",
      "cp .env.example .env  # then edit with your SaaS credentials",
      "python -m mcp_server",
    ],
  },
  {
    id: "py-multi-tool-toolkit",
    name: "Multi-Tool Toolkit",
    category: "MCP Server",
    language: "Python",
    transport: "stdio",
    description:
      "Modular multi-tool server with shared state and plugin-style tool registration",
    tools: ["tool_registry", "run_tool", "list_tools", "get_state"],
    path: "templates/python/09-multi-tool-toolkit",
    envVars: [],
    nextSteps: [
      "pip install -e .",
      "python -m mcp_server",
    ],
  },
  {
    id: "py-streaming-server",
    name: "Streaming Server",
    category: "MCP Server",
    language: "Python",
    transport: "sse",
    description:
      "SSE / Streamable HTTP transport for web deployments with live progress updates",
    tools: ["stream_response", "subscribe", "unsubscribe"],
    path: "templates/python/10-streaming-server",
    envVars: ["PORT", "CORS_ORIGIN"],
    nextSteps: [
      "pip install -e .",
      "cp .env.example .env  # then edit with your port and CORS settings",
      "uvicorn mcp_server:app --port 8080",
    ],
  },

  // ──────────────────────────────────────────────────────────
  // AI Agent Patterns (5)
  // ──────────────────────────────────────────────────────────
  {
    id: "agent-react",
    name: "ReAct Agent",
    category: "AI Agent",
    language: "TypeScript",
    transport: "stdio",
    description:
      "ReAct loop: reason, act, observe, repeat — the classic agent reasoning pattern",
    tools: ["reason", "act", "observe"],
    path: "templates/agents/01-react-agent",
    envVars: ["OPENAI_API_KEY", "MODEL"],
    nextSteps: [
      "npm install",
      "cp .env.example .env   # then edit with your OPENAI_API_KEY",
      "npm run dev",
    ],
  },
  {
    id: "agent-tool-use",
    name: "Tool Use Agent",
    category: "AI Agent",
    language: "TypeScript",
    transport: "stdio",
    description:
      "Structured tool calling with parallel execution and result aggregation",
    tools: ["call_tool", "parallel_call", "aggregate_results"],
    path: "templates/agents/02-tool-use-agent",
    envVars: ["OPENAI_API_KEY", "MODEL"],
    nextSteps: [
      "npm install",
      "cp .env.example .env   # then edit with your OPENAI_API_KEY",
      "npm run dev",
    ],
  },
  {
    id: "agent-rag",
    name: "RAG Agent",
    category: "AI Agent",
    language: "TypeScript",
    transport: "stdio",
    description:
      "Retrieval-augmented generation with citation and source tracking",
    tools: ["retrieve", "generate", "cite_sources"],
    path: "templates/agents/03-rag-agent",
    envVars: ["OPENAI_API_KEY", "EMBEDDING_MODEL", "VECTOR_STORE_PATH"],
    nextSteps: [
      "npm install",
      "cp .env.example .env   # then edit with your API keys",
      "npm run dev",
    ],
  },
  {
    id: "agent-multi-agent",
    name: "Multi-Agent Orchestrator",
    category: "AI Agent",
    language: "TypeScript",
    transport: "stdio",
    description:
      "Coordinator + worker agent orchestration with task delegation and synthesis",
    tools: ["delegate_task", "collect_results", "synthesize"],
    path: "templates/agents/04-multi-agent",
    envVars: ["OPENAI_API_KEY", "MODEL"],
    nextSteps: [
      "npm install",
      "cp .env.example .env   # then edit with your OPENAI_API_KEY",
      "npm run dev",
    ],
  },
  {
    id: "agent-human-in-loop",
    name: "Human-in-the-Loop Agent",
    category: "AI Agent",
    language: "TypeScript",
    transport: "stdio",
    description:
      "Approval gates for sensitive operations with configurable auto-approve rules",
    tools: ["request_approval", "execute_approved", "log_audit"],
    path: "templates/agents/05-human-in-loop",
    envVars: ["OPENAI_API_KEY", "MODEL", "APPROVAL_TIMEOUT_MS"],
    nextSteps: [
      "npm install",
      "cp .env.example .env   # then edit with your API keys",
      "npm run dev",
    ],
  },
];

// ── Helper functions ──────────────────────────────────────────

/**
 * Get all unique category names in display order.
 * @returns {string[]}
 */
export function getCategories() {
  const seen = new Set();
  const categories = [];
  for (const t of templates) {
    if (!seen.has(t.category)) {
      seen.add(t.category);
      categories.push(t.category);
    }
  }
  return categories;
}

/**
 * Get a human-readable label for a category + language combo.
 * @param {string} category
 * @param {string} language
 * @returns {string}
 */
export function categoryLabel(category, language) {
  if (category === "MCP Server") {
    return `MCP Server (${language})`;
  }
  return category;
}

/**
 * Get all unique (category, language) pairs for menu display.
 * Returns array of { category, language, label }
 * @returns {{category: string, language: string, label: string}[]}
 */
export function getCategoryOptions() {
  const seen = new Set();
  const options = [];
  for (const t of templates) {
    const key = `${t.category}|${t.language}`;
    if (!seen.has(key)) {
      seen.add(key);
      options.push({
        category: t.category,
        language: t.language,
        label: categoryLabel(t.category, t.language),
      });
    }
  }
  return options;
}

/**
 * Filter templates by category (and optionally language).
 * @param {string} category
 * @param {string=} language
 * @returns {object[]}
 */
export function templatesByCategory(category, language) {
  return templates.filter(
    (t) =>
      t.category === category &&
      (language === undefined || t.language === language)
  );
}

/**
 * Find a single template by its id.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getTemplateById(id) {
  return templates.find((t) => t.id === id);
}
