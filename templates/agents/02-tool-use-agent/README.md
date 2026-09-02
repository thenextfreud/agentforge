# Tool-Use Agent

A **structured tool calling** agent that uses OpenAI's native function/tool calling API with **parallel execution** support. When the model requests multiple tool calls in a single response, they're executed concurrently for faster results.

## What is the tool-use pattern?

Unlike the ReAct pattern (which parses text like "Thought: ... Action: ..."), this agent uses OpenAI's structured tool-calling API. The model returns structured JSON tool calls, and the agent executes them — potentially several at once.

```
User: "Echo 'hello' and echo 'world'"

Model → [tool_call: echo({message: "hello"}), tool_call: echo({message: "world"})]
                    ↓                          ↓
              Executed in parallel
                    ↓                          ↓
              "hello"                     "world"

Model → "I echoed both messages: 'hello' and 'world'"
```

## When to use this pattern

- **You want reliability** — structured API calls are more robust than text parsing
- **Parallel execution matters** — multiple independent tool calls should run at once
- **Production agents** — less prompt engineering, fewer parsing edge cases
- **Complex tool schemas** — OpenAI's API handles JSON Schema natively
- **When you don't need step-by-step reasoning transparency** — the model just calls tools

## When NOT to use

- You need **visible reasoning traces** for debugging → use `react-agent`
- You need **retrieval-augmented generation** → use `rag-agent`
- You need **human approval before tool calls** → use `human-in-loop`

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 3. Run the agent
npx tsx src/index.ts "Echo 'hello' and echo 'world' at the same time"

# 4. Or build and run
npm run build
node dist/index.js "Fetch the content of https://example.com"
```

## How it works

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Tool-Use Agent Loop                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────┐     ┌──────────────────┐     ┌───────────────────┐     │
│  │  User     │────▶│  OpenAI API Call │────▶│  Tool Calls in   │     │
│  │  Task     │     │  (with tools)    │     │  Response?       │     │
│  └──────────┘     └──────────────────┘     └────────┬──────────┘     │
│                                                      │                │
│                                              ┌───────┴───────┐        │
│                                              │               │        │
│                                           No tools        Has tools   │
│                                              │               │        │
│                                              ▼               ▼        │
│                                       ┌──────────┐   ┌────────────┐  │
│                                       │  Return  │   │  Execute   │  │
│                                       │  Answer  │   │  Tools     │  │
│                                       └──────────┘   │  (parallel)│  │
│                                                      └─────┬──────┘  │
│                                                            │         │
│                                                            ▼         │
│                                              ┌────────────────────┐  │
│                                              │  Format Results    │  │
│                                              │  as Tool Messages  │  │
│                                              └─────────┬──────────┘  │
│                                                        │             │
│                                                        ▼             │
│                                              ┌────────────────────┐  │
│                                              │  Append to History │  │
│                                              │  & Loop Back      │──┘
│                                              └────────────────────┘     │
│                                                                       │
│  Parallel execution: multiple tool calls in one response             │
│  are executed with Promise.all() for concurrency                     │
└───────────────────────────────────────────────────────────────────────┘
```

### MCP → OpenAI tool mapping

The agent automatically converts MCP tool definitions to OpenAI function definitions:

```
MCP Tool                          OpenAI Function
─────────                         ───────────────
name: "echo"               →      function.name: "echo"
description: "Echo back..."  →    function.description: "Echo back..."
inputSchema: {                   function.parameters: {
  type: "object",          →       type: "object",
  properties: {                    properties: {
    message: {                       message: {
      type: "string"          →       type: "string"
    }                               }
  }                               }
}                                 }
```

### Parallel execution example

When the model returns multiple tool calls in one response:

```json
{
  "tool_calls": [
    { "id": "call_1", "function": { "name": "echo", "arguments": "{\"message\": \"hello\"}" } },
    { "id": "call_2", "function": { "name": "echo", "arguments": "{\"message\": \"world\"}" } }
  ]
}
```

Both are executed concurrently via `Promise.all()`, and results are fed back as separate `tool` messages.

## Configuration

| Variable              | Required | Default                          | Description                                      |
|-----------------------|----------|----------------------------------|--------------------------------------------------|
| `OPENAI_API_KEY`      | Yes      | —                                | OpenAI API key                                   |
| `MODEL`               | No       | `gpt-4o-mini`                    | OpenAI model to use                              |
| `MCP_SERVER_COMMAND`  | No       | `npx`                            | Command to launch the MCP server                 |
| `MCP_SERVER_ARGS`     | No       | `tsx,.../01-hello-world-stdio/...`| Comma-separated args for the MCP server command  |

## Project structure

```
02-tool-use-agent/
├── src/
│   ├── index.ts          # Entry point — parses task, runs agent
│   ├── agent.ts          # Tool-use loop with parallel execution
│   ├── tools.ts          # MCP client + OpenAI tool definition mapping
│   └── lib/
│       └── logger.ts     # Structured stderr logger
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## Customization guide

### Force tool selection

In `src/agent.ts`, change `tool_choice: "auto"` to `tool_choice: "required"` to force the model to always call a tool, or specify a specific tool: `tool_choice: { type: "function", function: { name: "echo" } }`.

### Add result formatting

Modify `formatToolResultForOpenAI()` in `src/tools.ts` to transform tool outputs before feeding them back to the model (e.g., truncating long responses, adding metadata).

### Limit parallel calls

In `callToolsParallel()` in `src/tools.ts`, add a concurrency limiter (e.g., process in batches of N) to control how many tools run simultaneously.

### Add retry logic

In `src/tools.ts`, wrap `client.callTool()` with retry logic for transient failures (network errors, timeouts).

### Use a different LLM provider

The tool-calling API is supported by Anthropic, Google, and others. Replace the `openai` package and adjust the message format in `src/agent.ts`.

## Building

```bash
npm run build    # Compile to dist/
npm start        # Run compiled version: node dist/index.js "your task"
```
