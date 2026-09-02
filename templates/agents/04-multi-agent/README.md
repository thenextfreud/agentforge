# Multi-Agent Orchestration

A **coordinator + workers** multi-agent system. A coordinator agent breaks complex tasks into subtasks, dispatches them to specialist worker agents (each with its own MCP tools), and synthesizes the results into a final answer.

## What is the multi-agent pattern?

Instead of one agent doing everything, this pattern uses **role specialization**:

- **Coordinator** — analyzes the task, plans subtasks, assigns to workers, synthesizes results
- **Workers** — specialist agents, each with their own MCP server, tools, and system prompt

```
"Research X, check our code for Y, query database for Z"
                    │
         ┌──────────┴──────────┐
         │    Coordinator       │
         │  (breaks into 3     │
         │   subtasks)          │
         └──┬─────┬─────┬──────┘
            │     │     │
     ┌──────▼┐ ┌──▼───┐ ┌▼──────┐
     │Research│ │Code  │ │Data   │
     │Agent   │ │Agent │ │Agent  │
     │(web    │ │(fs   │ │(db    │
     │ search)│ │tools)│ │tools) │
     └──┬────┘ └──┬───┘ └──┬────┘
        │         │        │
        └────┬────┴────────┘
             │
     ┌───────▼────────┐
     │  Coordinator   │
     │  (synthesizes  │
     │   final answer)│
     └───────┬────────┘
             │
      Final Answer
```

## When to use this pattern

- **Complex tasks** requiring multiple domains of expertise (research + code + data)
- **Parallelizable work** — subtasks can run concurrently across workers
- **Separation of concerns** — each worker has focused tools and instructions
- **Scalability** — add new workers by adding new MCP server configs
- **Tasks where one agent's context window would overflow** — split the work

## When NOT to use

- **Simple tasks** — a single agent is faster and cheaper → use `react-agent` or `tool-use-agent`
- **You need sequential reasoning with visible thoughts** → use `react-agent`
- **You need retrieval-augmented generation** → use `rag-agent`
- **You need human approval gates** → use `human-in-loop`

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — add OPENAI_API_KEY and configure worker MCP servers

# 3. Run the agent (requires at least one worker MCP server configured)
npx tsx src/index.ts "Research the latest Node.js 22 features and check if our codebase uses any deprecated APIs"

# 4. Build and run
npm run build
node dist/index.js "Find documentation about OAuth 2.0 best practices and query our database for users with expired tokens"
```

## How it works

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Multi-Agent Orchestration Flow                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Phase 1: Task Decomposition                                              │
│  ┌──────────┐     ┌──────────────────┐     ┌────────────────────┐       │
│  │  User     │────▶│  Coordinator     │────▶│  Subtask Plan      │       │
│  │  Task     │     │  LLM Call        │     │  (JSON: worker +   │       │
│  └──────────┘     │  (which workers, │     │   task pairs)      │       │
│                   │   what subtasks) │     └─────────┬──────────┘       │
│                   └──────────────────┘               │                   │
│                                                      │                   │
│  Phase 2: Parallel Worker Execution                   ▼                   │
│  ┌───────────────────────────────────────────────────────────────┐       │
│  │                    ┌─────────┬─────────┬─────────┐            │       │
│  │                    │ Worker 1│ Worker 2│ Worker 3│            │       │
│  │                    │ (MCP A) │ (MCP B) │ (MCP C) │            │       │
│  │                    │ tools A │ tools B │ tools C │            │       │
│  │                    │ LLM ses │ LLM ses │ LLM ses │            │       │
│  │                    └────┬────┴────┬────┴────┬────┘            │       │
│  │                         │         │         │                  │       │
│  │                         └────┬────┴─────────┘                  │       │
│  │                              │ (Promise.all)                    │       │
│  │                              ▼                                  │       │
│  │                    ┌──────────────────┐                        │       │
│  │                    │  Collected       │                        │       │
│  │                    │  Results         │                        │       │
│  │                    └──────────────────┘                        │       │
│  └───────────────────────────────────────────────────────────────┘       │
│                                                                           │
│  Phase 3: Synthesis                                                       │
│                    ┌──────────────────┐     ┌────────────────────┐       │
│                    │  Coordinator     │────▶│  Final Answer      │       │
│                    │  LLM Call        │     │  (synthesized from │       │
│                    │  (combine all    │     │   all worker       │       │
│                    │   worker results)│     │   results)         │       │
│                    └──────────────────┘     └────────────────────┘       │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Worker types

The template includes three predefined workers:

| Worker | ID | MCP Server | Role |
|--------|----|-----------|------|
| Research Agent | `RESEARCH` | web-search-fetch | Search the web, fetch URLs, summarize findings |
| Code Agent | `CODE` | filesystem-tools | Read/analyze files, explore code structure |
| Data Agent | `DATA` | database-query-server | Query databases, analyze data, provide insights |

Workers without MCP server configuration are automatically skipped. The coordinator only assigns subtasks to available workers.

### Coordinator decision making

The coordinator uses structured JSON output to assign subtasks:

```json
{
  "subtasks": [
    { "worker": "RESEARCH", "task": "Search for Node.js 22 deprecation notices" },
    { "worker": "CODE", "task": "Check package.json for deprecated dependencies" },
    { "worker": "DATA", "task": "Query the deployments table for recent failures" }
  ]
}
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key |
| `MODEL` | No | `gpt-4o-mini` | OpenAI model for all agents |
| `MCP_SERVER_RESEARCH_COMMAND` | No | — | Command for research worker's MCP server |
| `MCP_SERVER_RESEARCH_ARGS` | No | — | Args for research worker's MCP server |
| `MCP_SERVER_CODE_COMMAND` | No | — | Command for code worker's MCP server |
| `MCP_SERVER_CODE_ARGS` | No | — | Args for code worker's MCP server |
| `MCP_SERVER_DATA_COMMAND` | No | — | Command for data worker's MCP server |
| `MCP_SERVER_DATA_ARGS` | No | — | Args for data worker's MCP server |

At least one worker must be configured for the agent to function.

### Adding a custom worker

1. Add env vars: `MCP_SERVER_MYWORKER_COMMAND` and `MCP_SERVER_MYWORKER_ARGS`
2. Add a worker definition in `loadWorkerConfigs()` in `src/tools.ts`:

```typescript
{
  id: "MYWORKER",
  name: "My Custom Agent",
  systemPrompt: "You are a specialist in...",
}
```

## Project structure

```
04-multi-agent/
├── src/
│   ├── index.ts          # Entry point — parses task, runs orchestration
│   ├── agent.ts          # Coordinator logic + worker execution
│   ├── tools.ts          # MCP connection manager + worker configs
│   └── lib/
│       └── logger.ts     # Structured stderr logger
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## Customization guide

### Add more workers

Add new worker definitions in `loadWorkerConfigs()` in `src/tools.ts`. Each worker needs a unique ID, name, system prompt, and MCP server env vars.

### Change the coordination strategy

Edit `COORDINATOR_SYSTEM_PROMPT` in `src/agent.ts` to change how tasks are decomposed — e.g., sequential dependencies, priority ordering, or worker capacity limits.

### Run workers sequentially instead of in parallel

In `src/agent.ts`, replace `Promise.all(workerPromises)` with a `for...of` loop that awaits each worker sequentially.

### Add inter-worker communication

Extend the coordinator to pass intermediate results between workers — e.g., worker 1's output becomes part of worker 2's task.

### Use different models per worker

Store a `model` field in `WorkerConfig` and use it in `runWorker()` instead of the global `MODEL` env var. This lets you use a stronger model for complex workers and a cheaper one for simple ones.

### Add worker result validation

Before synthesis, validate that each worker's result meets expected criteria. Re-run failed workers or have the coordinator handle gaps.

## Building

```bash
npm run build    # Compile to dist/
npm start        # Run compiled version: node dist/index.js "your task"
```
