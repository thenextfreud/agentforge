import {
  Boxes,
  Brain,
  Code2,
  Rocket,
  Plug,
  Terminal,
} from "lucide-react";

export const GUMROAD_URL = "https://forgea5.gumroad.com/l/agentforge";

export const features = [
  {
    icon: Boxes,
    title: "10 MCP Server Templates",
    desc: "Real-world patterns: REST wrappers, database queries, filesystem tools, RAG, OAuth, and more.",
  },
  {
    icon: Brain,
    title: "5 AI Agent Patterns",
    desc: "ReAct, tool-use, RAG, multi-agent orchestration, and human-in-the-loop approval.",
  },
  {
    icon: Code2,
    title: "TypeScript + Python",
    desc: "Dual-language templates. Use whichever your team prefers.",
  },
  {
    icon: Terminal,
    title: "CLI Scaffolding",
    desc: "npx agentforge init and you're running in 30 seconds.",
  },
  {
    icon: Rocket,
    title: "Deploy Anywhere",
    desc: "Docker, Cloudflare Workers, Vercel, Railway, Fly.io, or self-host.",
  },
  {
    icon: Plug,
    title: "Client Integration",
    desc: "Claude Desktop, Cursor, Windsurf, VS Code, and Claude Code configs included.",
  },
] as const;

export type Template = {
  name: string;
  desc: string;
  tools: number;
  lang: "TypeScript" | "Python" | "Agent";
};

export const templateGroups: {
  category: string;
  label: string;
  accent: string;
  templates: Template[];
}[] = [
  {
    category: "typescript",
    label: "TypeScript MCP Servers",
    accent: "text-blue-400",
    templates: [
      {
        name: "Hello World (stdio)",
        desc: "Minimum viable MCP server. Two tools, stdio transport, Zod validation, structured stderr logging.",
        tools: 2,
        lang: "TypeScript",
      },
      {
        name: "REST API Wrapper",
        desc: "Wrap any REST API as MCP tools with typed schemas, auth headers, and response mapping.",
        tools: 5,
        lang: "TypeScript",
      },
      {
        name: "Database Query Server",
        desc: "Parameterized SQL queries with read/write guards, connection pooling, and result pagination.",
        tools: 4,
        lang: "TypeScript",
      },
      {
        name: "Filesystem Tools",
        desc: "Sandboxed file read/write/search with path allow-lists and streaming large files.",
        tools: 6,
        lang: "TypeScript",
      },
      {
        name: "Web Search & Fetch",
        desc: "Search the web and fetch pages as clean markdown, with caching and rate limiting.",
        tools: 3,
        lang: "TypeScript",
      },
    ],
  },
  {
    category: "python",
    label: "Python MCP Servers",
    accent: "text-yellow-400",
    templates: [
      {
        name: "RAG Knowledge Server",
        desc: "Chunk, embed, and retrieve from a vector store. Includes ingestion pipeline and citations.",
        tools: 4,
        lang: "Python",
      },
      {
        name: "OAuth Protected Server",
        desc: "OAuth 2.1 resource server with PKCE, token validation, and per-user tool scoping.",
        tools: 3,
        lang: "Python",
      },
      {
        name: "SaaS Integration",
        desc: "Template for connecting SaaS APIs (CRM, tickets, analytics) with credential vaulting.",
        tools: 7,
        lang: "Python",
      },
      {
        name: "Multi-Tool Toolkit",
        desc: "A composable toolkit pattern: register many small tools from a single manifest.",
        tools: 9,
        lang: "Python",
      },
      {
        name: "Streaming Server",
        desc: "Stream tool output with SSE transport for long-running tasks and progress updates.",
        tools: 3,
        lang: "Python",
      },
    ],
  },
  {
    category: "agents",
    label: "AI Agent Patterns",
    accent: "text-forge-400",
    templates: [
      {
        name: "ReAct Agent",
        desc: "Reason-then-act loop with tool selection, scratchpad memory, and stop conditions.",
        tools: 4,
        lang: "Agent",
      },
      {
        name: "Tool-Use Agent",
        desc: "Direct function-calling agent with parallel tool execution and structured outputs.",
        tools: 3,
        lang: "Agent",
      },
      {
        name: "RAG Agent",
        desc: "Retrieval-augmented agent with query rewriting, hybrid search, and answer synthesis.",
        tools: 5,
        lang: "Agent",
      },
      {
        name: "Multi-Agent Orchestration",
        desc: "Coordinator + specialist agents with task routing, shared state, and handoffs.",
        tools: 6,
        lang: "Agent",
      },
      {
        name: "Human-in-the-Loop",
        desc: "Approval gates, async confirmations, and editable tool calls before execution.",
        tools: 4,
        lang: "Agent",
      },
    ],
  },
];

export const faqs = [
  {
    q: "What is MCP?",
    a: "Model Context Protocol is an open standard that lets AI assistants like Claude securely call external tools and access data sources.",
  },
  {
    q: "What's the difference between the free and paid version?",
    a: "There is no free version. AgentForge is a premium kit. The quality and comprehensiveness justify the price — it saves you 40+ hours of boilerplate.",
  },
  {
    q: "Can I use this for client projects?",
    a: "Yes. The commercial license allows unlimited use in personal and client projects.",
  },
  {
    q: "Do I get updates?",
    a: "Yes, lifetime updates are included. As MCP and AI agent patterns evolve, you get the latest templates.",
  },
  {
    q: "What languages are supported?",
    a: "TypeScript and Python. Each MCP server template is available in at least one language, with the most useful patterns available in both.",
  },
  {
    q: "How do I deploy?",
    a: "Each template includes Docker configs and deployment guides for Vercel, Railway, Fly.io, Cloudflare Workers, and self-hosting.",
  },
] as const;
