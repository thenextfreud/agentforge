# Human-in-the-Loop Agent

An AI agent with **human approval gates** for sensitive operations. The agent runs normally but pauses before executing risky or dangerous tools, asking a human operator to approve, deny, or modify the proposed action.

## What is the human-in-the-loop pattern?

When agents have access to tools that can modify data, delete files, or execute commands, you need a safety mechanism. This pattern classifies every MCP tool by risk level and requires human approval before executing anything that isn't safe.

```
Agent: "I need to delete the file temp.txt"
       ↓
  ┌─────────────────────────────────────┐
  │  TOOL APPROVAL REQUIRED             │
  │  Tool: delete_file                  │
  │  Risk: ⚠️  DANGEROUS                │
  │  Args: {"path": "temp.txt"}         │
  │  Approve? [y/n/JSON]:               │
  └─────────────────────────────────────┘
       ↓
  Human: "y"  →  Agent executes the tool
  Human: "n"  →  Agent skips and adjusts
  Human: '{"path":"temp_backup.txt"}'  →  Agent uses modified args
```

## Tool risk classification

| Risk Level | Description | Behavior |
|------------|-------------|----------|
| **SAFE** | Read-only operations (search, query, read, list, echo) | Auto-approved (configurable) |
| **RISKY** | State-modifying operations (write, create, update, insert) | Requires human approval |
| **DANGEROUS** | Irreversible operations (delete, drop, execute, remove) | Requires approval + confirmation |

Classification is automatic based on tool name and description pattern matching:

- **Dangerous patterns**: `delete`, `drop`, `remove`, `destroy`, `execute`, `rm`, `purge`, `wipe`, `truncate`, `reset`, `force`, `overwrite`
- **Risky patterns**: `write`, `create`, `update`, `insert`, `modify`, `set`, `put`, `post`, `patch`, `move`, `rename`, `copy`, `upload`, `publish`, `deploy`, `send`, `grant`, `revoke`
- **Safe patterns**: `read`, `get`, `list`, `search`, `query`, `fetch`, `find`, `show`, `describe`, `inspect`, `view`, `check`, `count`, `stats`, `info`, `status`, `health`, `echo`, `ping`

Unknown tools default to **risky** (better safe than sorry).

## When to use this pattern

- **Agents with write/delete capabilities** — filesystem, database, or API tools that modify state
- **Production environments** — prevent accidental data loss or unauthorized actions
- **Compliance requirements** — audit trail of who approved what and when
- **High-stakes operations** — deployments, financial transactions, data migrations
- **Learning/training agents** — catch mistakes before they cause damage

## When NOT to use

- **Read-only agents** — if no tool can modify state, approval gates add friction → use `tool-use-agent`
- **Fully autonomous pipelines** — if human latency is unacceptable
- **You need retrieval-augmented generation** → use `rag-agent`

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — add your OPENAI_API_KEY

# 3. Run the agent (safe tools auto-approved)
npx tsx src/index.ts "Echo the message 'hello world'"

# 4. Run with a task that triggers approval gates
npx tsx src/index.ts "Write 'hello' to a file called output.txt"

# 5. Require approval for ALL tools (including safe ones)
AUTO_APPROVE_SAFE=false npx tsx src/index.ts "Echo hello"

# 6. Build and run
npm run build
node dist/index.js "Your task here"
```

## How it works

```
┌──────────────────────────────────────────────────────────────────────┐
│                   Human-in-the-Loop Agent Flow                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────┐     ┌──────────────────┐     ┌───────────────────┐     │
│  │  User     │────▶│  LLM Call        │────▶│  Tool Calls in   │     │
│  │  Task     │     │  (with tools)    │     │  Response?       │     │
│  └──────────┘     └──────────────────┘     └────────┬──────────┘     │
│                                                      │                │
│                                               No tools?              │
│                                                      │ Yes            │
│                                                      ▼               │
│                                               ┌──────────┐          │
│                                               │  Return  │          │
│                                               │  Answer  │          │
│                                               └──────────┘          │
│                                                      │ No            │
│                                                      ▼               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Approval Gate (per tool call)                    │   │
│  │                                                               │   │
│  │  ┌─────────────┐     ┌──────────────────┐     ┌────────────┐  │   │
│  │  │ Classify    │────▶│ Risk = SAFE?     │────▶│ Auto-approve│  │   │
│  │  │ Tool Risk   │     │ & auto-approve?  │     │ & Execute  │  │   │
│  │  └─────────────┘     └────────┬─────────┘     └────────────┘  │   │
│  │                               │ No                             │   │
│  │                               ▼                                │   │
│  │                    ┌──────────────────┐                        │   │
│  │                    │ Ask Human:       │                        │   │
│  │                    │  y/n/modified    │                        │   │
│  │                    └────────┬─────────┘                        │   │
│  │                             │                                  │   │
│  │                    ┌────────┴────────┐                         │   │
│  │                    │                 │                         │   │
│  │                   Approved          Denied                     │   │
│  │                    │                 │                         │   │
│  │                    ▼                 ▼                         │   │
│  │     ┌──────────────────────┐  ┌──────────────────┐            │   │
│  │     │ Risk = DANGEROUS?    │  │ Skip tool, tell  │            │   │
│  │     │ Ask for CONFIRMATION │  │ model it was     │            │   │
│  │     └─────────┬────────────┘  │ denied           │            │   │
│  │               │               └──────────────────┘            │   │
│  │               ▼                                               │   │
│  │     ┌──────────────────────┐                                  │   │
│  │     │ Execute Tool via MCP │                                  │   │
│  │     └──────────┬───────────┘                                  │   │
│  │                │                                               │   │
│  └────────────────┼───────────────────────────────────────────────┘   │
│                   │                                                   │
│                   ▼                                                   │
│            ┌──────────────┐                                           │
│            │ Feed result  │──── loop back to LLM ────────────────────▶│
│            │ to model     │                                           │
│            └──────────────┘                                           │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Approval prompt example

```
┌─────────────────────────────────────────────────────────────────┐
│  TOOL APPROVAL REQUIRED                                         │
│                                                                 │
│  Tool: write_file                                              │
│  Risk: ⚡ RISKY                                                │
│  Description: Write content to a file                          │
│                                                                 │
│  Arguments:                                                     │
│  {                                                              │
│    "path": "output.txt",                                        │
│    "content": "hello world"                                     │
│  }                                                              │
│                                                                 │
│  Options:                                                       │
│    y / yes   — Approve and execute                              │
│    n / no    — Deny (skip this tool call)                       │
│    {"key":"value"} — Modify args (provide new JSON)             │
└─────────────────────────────────────────────────────────────────┘
Approve? [y/n/JSON]:
```

### Dangerous tool double confirmation

For tools classified as **dangerous**, the agent asks twice:

1. First prompt: "Approve? [y/n/JSON]"
2. If approved: "CONFIRM: Are you sure? [y/n/JSON]"

This prevents accidental approval of irreversible operations.

## Configuration

| Variable              | Required | Default                          | Description                                      |
|-----------------------|----------|----------------------------------|--------------------------------------------------|
| `OPENAI_API_KEY`      | Yes      | —                                | OpenAI API key                                   |
| `MODEL`               | No       | `gpt-4o-mini`                    | OpenAI model to use                              |
| `MCP_SERVER_COMMAND`  | No       | `npx`                            | Command to launch the MCP server                 |
| `MCP_SERVER_ARGS`     | No       | `tsx,.../01-hello-world-stdio/...`| Comma-separated args for the MCP server command  |
| `AUTO_APPROVE_SAFE`   | No       | `true`                           | Auto-approve safe (read-only) tools              |

### Disabling auto-approval

Set `AUTO_APPROVE_SAFE=false` to require human approval for every tool call, including read-only ones. This is useful for auditing or when you don't trust the tool classification.

## Project structure

```
05-human-in-loop/
├── src/
│   ├── index.ts          # Entry point — parses task, runs agent
│   ├── agent.ts          # Agent loop with approval gate integration
│   ├── tools.ts          # MCP client + tool classification + approval UI
│   └── lib/
│       └── logger.ts     # Structured stderr logger
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## Customization guide

### Add custom risk patterns

In `src/tools.ts`, add patterns to `DANGEROUS_PATTERNS`, `RISKY_PATTERNS`, or `SAFE_PATTERNS` arrays to customize classification for your specific tools.

### Override classification per tool

In `src/tools.ts`, add a manual override map before the pattern-based classification:

```typescript
const MANUAL_OVERRIDES: Record<string, RiskLevel> = {
  "my_safe_tool": "safe",
  "my_dangerous_tool": "dangerous",
};

export function classifyTool(name: string, description: string): RiskLevel {
  if (MANUAL_OVERRIDES[name]) return MANUAL_OVERRIDES[name];
  // ... existing pattern matching
}
```

### Change the approval UI

Modify `requestApproval()` in `src/tools.ts` to use a web UI, Slack approval, or any other approval mechanism instead of stdin.

### Add approval logging/audit trail

In `src/tools.ts`, log every approval decision to a file or database for compliance auditing:

```typescript
// After each approval/denial
fs.appendFileSync("approval_log.jsonl", JSON.stringify({
  timestamp: new Date().toISOString(),
  tool: name,
  risk,
  args,
  approved,
  user: process.env.USER,
}) + "\n");
```

### Add timeout for approval

In `requestApproval()`, add a timeout that auto-denies if no response is received within N seconds:

```typescript
const timeout = setTimeout(() => rl.close(), 30000);
rl.on("close", () => { clearTimeout(timeout); resolve({ approved: false }); });
```

### Add role-based approval levels

Different risk levels could require different approvers — e.g., "risky" needs any operator, "dangerous" needs an admin. Implement this by checking `process.env.USER` or integrating with an approval service.

## Building

```bash
npm run build    # Compile to dist/
npm start        # Run compiled version: node dist/index.js "your task"
```
