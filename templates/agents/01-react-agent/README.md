# ReAct Agent

A **ReAct (Reasoning + Acting)** agent that connects to MCP servers for tool access. The agent reasons about a task in natural language, decides which tool to call, observes the result, and iterates until it reaches a final answer.

## What is the ReAct pattern?

ReAct is a paradigm where an LLM interleaves **reasoning** (thinking about what to do) with **acting** (calling tools to gather information or take action). This creates a transparent, traceable loop:

```
Thought → Action → Observation → Thought → Action → Observation → ... → Final Answer
```

Unlike black-box tool-calling, ReAct exposes the model's reasoning at every step, making it easier to debug, audit, and understand.

## When to use this pattern

- **Multi-step tasks** that require chaining tool calls (e.g., "search for X, then fetch Y, then summarize")
- **Debugging and observability** — you need to see the agent's reasoning at each step
- **Educational contexts** — teaching how agents reason and act
- **Tasks where transparency matters** — regulated industries, audit trails
- **When you need a simple, reliable loop** without complex orchestration

## When NOT to use

- You need **parallel tool execution** → use the `tool-use-agent` pattern instead
- You need **retrieval-augmented generation** → use the `rag-agent` pattern
- You need **multiple specialized agents** → use the `multi-agent` pattern
- You need **human approval gates** → use the `human-in-loop` pattern

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 3. Run the agent with a task
npx tsx src/index.ts "Echo the message 'hello world' in uppercase"

# 4. Or build and run
npm run build
node dist/index.js "What tools are available and what do they do?"
```

## How it works

```
┌─────────────────────────────────────────────────────────────────┐
│                         ReAct Agent Loop                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐     ┌──────────────┐     ┌──────────────────┐     │
│  │  Task     │────▶│  LLM Reason  │────▶│  Parse Response  │     │
│  │  Input    │     │  (Thought)   │     │  (Action/Input)  │     │
│  └──────────┘     └──────────────┘     └────────┬─────────┘     │
│                                                   │               │
│                          ┌────────────────────────┘               │
│                          ▼                                        │
│                   ┌──────────────┐                                │
│                   │ Final Answer?│─── Yes ──▶ ┌──────────┐       │
│                   │   parsed?    │            │  Output   │       │
│                   └──────┬───────┘            │  Answer   │       │
│                          │ No                  └──────────┘       │
│                          ▼                                        │
│                   ┌──────────────┐                                │
│                   │  Call MCP    │                                │
│                   │  Tool        │                                │
│                   └──────┬───────┘                                │
│                          │                                        │
│                          ▼                                        │
│                   ┌──────────────┐                                │
│                   │  Observation │                                │
│                   │  (Result)    │                                │
│                   └──────┬───────┘                                │
│                          │                                        │
│                          ▼                                        │
│                   ┌──────────────┐                                │
│                   │  Append to   │                                │
│                   │  History     │───── loop back to LLM ───────▶│
│                   └──────────────┘                                │
│                                                                  │
│  Max iterations guard prevents infinite loops                    │
└──────────────────────────────────────────────────────────────────┘
```

### The ReAct prompt format

The agent instructs the LLM to use this format:

```
Thought: I need to find out what tools are available...
Action: echo
Action Input: {"message": "test"}

Observation: test

Thought: The echo tool works. Now I can answer the question.
Final Answer: The available tool is "echo" which echoes back messages.
```

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable              | Required | Default                          | Description                                      |
|-----------------------|----------|----------------------------------|--------------------------------------------------|
| `OPENAI_API_KEY`      | Yes      | —                                | OpenAI API key for LLM reasoning                 |
| `MODEL`               | No       | `gpt-4o-mini`                    | OpenAI model to use                              |
| `MCP_SERVER_COMMAND`  | No       | `npx`                            | Command to launch the MCP server                 |
| `MCP_SERVER_ARGS`     | No       | `tsx,.../01-hello-world-stdio/...`| Comma-separated args for the MCP server command  |
| `MAX_ITERATIONS`      | No       | `10`                             | Maximum reasoning steps before forcing an answer |

### Connecting to a different MCP server

Point the agent at any MCP server by changing the command and args:

```env
# Connect to a filesystem MCP server
MCP_SERVER_COMMAND=node
MCP_SERVER_ARGS=/path/to/filesystem-server/dist/index.js

# Connect to a web search MCP server
MCP_SERVER_COMMAND=npx
MCP_SERVER_ARGS=tsx,/path/to/web-search-server/src/index.ts
```

## Project structure

```
01-react-agent/
├── src/
│   ├── index.ts          # Entry point — parses task, runs agent
│   ├── agent.ts          # ReAct loop implementation
│   ├── tools.ts          # MCP client setup and tool management
│   └── lib/
│       └── logger.ts     # Structured stderr logger
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## Customization guide

### Change the system prompt

Edit `REACT_SYSTEM_PROMPT` in `src/agent.ts` to customize the agent's behavior, persona, or constraints.

### Add a custom observation formatter

In `src/agent.ts`, modify how observations are appended to the conversation history to truncate long results, add metadata, or reformat output.

### Use a different LLM provider

Replace the `openai` package with Anthropic, Cohere, or a local model. The ReAct loop logic in `src/agent.ts` is provider-agnostic — only the API call changes.

### Add tool call validation

In `src/tools.ts`, add argument validation against the tool's `inputSchema` before calling `client.callTool()`.

### Stream the reasoning

Replace `openai.chat.completions.create()` with the streaming version to show thoughts in real-time as they're generated.

## Building

```bash
npm run build    # Compile to dist/
npm start        # Run compiled version: node dist/index.js "your task"
```
