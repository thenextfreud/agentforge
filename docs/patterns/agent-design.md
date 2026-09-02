# AI Agent Design Patterns

Building effective AI agents requires choosing the right architectural pattern for your use case. This guide covers the most important patterns — ReAct, tool-use, RAG, multi-agent orchestration, and human-in-the-loop — with practical guidance on when to use each.

---

## ReAct Pattern

ReAct (Reasoning + Acting) is a pattern where the AI model interleaves reasoning steps with tool calls in a loop. The model thinks about what to do, takes an action (calls a tool), observes the result, and then reasons again — repeating until it reaches a final answer.

### How it works

```
User: "What's the weather in Tokyo and should I bring an umbrella?"

Step 1 — Reason:
  "I need to check the weather in Tokyo. I'll use the get_weather tool."

Step 2 — Act:
  Call get_weather(city="Tokyo")

Step 3 — Observe:
  "Tokyo: 18°C, 80% chance of rain, overcast"

Step 4 — Reason:
  "There's an 80% chance of rain. I should recommend bringing an umbrella."

Step 5 — Answer:
  "The weather in Tokyo is 18°C with an 80% chance of rain.
   Yes, you should bring an umbrella."
```

### When to use ReAct

- **Multi-step tasks** that require chaining multiple tool calls.
- **Tasks where the next action depends on the result of the previous one.**
- **Exploratory tasks** where the model doesn't know upfront which tools it will need.
- **Tasks requiring reasoning over tool outputs** (analysis, comparison, decision-making).

### Pros

- **Flexible** — The model decides which tools to call and in what order, adapting to the task.
- **Transparent** — The reasoning steps are visible, making it easier to debug and audit.
- **No pre-defined workflows** — Works with arbitrary tool combinations.
- **Self-correcting** — If a tool call fails, the model can reason about the error and try a different approach.

### Cons

- **Higher latency** — Each reasoning step requires an LLM call, which adds up.
- **Higher cost** — More LLM calls mean more tokens consumed.
- **Potential for loops** — The model can get stuck in a reasoning loop, calling the same tool repeatedly.
- **Less predictable** — The model's tool selection may vary between runs.
- **Requires a strong model** — Weaker models may struggle with the reasoning steps.

### Implementation pattern

```typescript
interface ReActStep {
  thought: string;
  action?: { tool: string; args: Record<string, unknown> };
  observation?: string;
}

async function runReActLoop(
  query: string,
  tools: Map<string, (args: Record<string, unknown>) => Promise<string>>,
  maxSteps: number = 10
): Promise<string> {
  const steps: ReActStep[] = [];
  let currentQuery = query;

  for (let i = 0; i < maxSteps; i++) {
    // Step 1: Reason about the current state
    const thought = await llm.generate(`
      Question: ${query}
      Previous steps: ${JSON.stringify(steps)}
      
      Think about what to do next. If you have enough information to answer,
      say "FINAL ANSWER: <your answer>". Otherwise, say which tool to call.
    `);

    // Check if we're done
    if (thought.includes("FINAL ANSWER:")) {
      return thought.split("FINAL ANSWER:")[1].trim();
    }

    // Step 2: Extract and execute the tool call
    const { tool, args } = parseToolCall(thought);
    const toolFn = tools.get(tool);
    if (!toolFn) {
      steps.push({ thought, observation: `Error: tool "${tool}" not found` });
      continue;
    }

    const observation = await toolFn(args);

    // Step 3: Record the observation
    steps.push({ thought, action: { tool, args }, observation });
  }

  return "Max steps reached without a final answer.";
}
```

---

## Tool-Use Pattern

The tool-use pattern leverages native function calling (also known as tool calling or function calling) built into modern LLMs. Instead of parsing text to determine which tool to call, the model outputs a structured tool call directly.

### Native function calling vs ReAct text parsing

| Aspect | Native Function Calling | ReAct Text Parsing |
|---|---|---|
| **How tools are specified** | JSON Schema passed to the API | Text description in the prompt |
| **How calls are identified** | Structured `tool_calls` in the response | Parsed from generated text |
| **Reliability** | High — structured output | Medium — depends on parsing |
| **Model support** | Requires function-calling support | Works with any model |
| **Latency** | Lower — single pass | Higher — multiple reasoning passes |
| **Complexity** | Simpler — no parsing logic | More complex — need robust parsing |
| **Multi-step** | Requires manual loop | Built into the pattern |

### When to use native function calling

- **Single-step tasks** where the model calls one tool and returns the result.
- **When the model supports function calling** (Claude, GPT-4, Gemini, etc.).
- **When you want maximum reliability** for tool selection.
- **When latency matters** — function calling is faster than ReAct.

### When to use ReAct text parsing

- **When using a model that doesn't support function calling.**
- **When you need complex multi-step reasoning** that function calling alone can't handle.
- **When you want full control over the reasoning process.**

### Implementation: Native function calling

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const tools = [
  {
    name: "get_weather",
    description: "Get current weather for a city",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
  },
  {
    name: "get_time",
    description: "Get current time in a timezone",
    input_schema: {
      type: "object",
      properties: {
        timezone: { type: "string", description: "IANA timezone (e.g., America/New_York)" },
      },
      required: ["timezone"],
    },
  },
];

async function runWithTools(userMessage: string) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    tools,
    messages: [{ role: "user", content: userMessage }],
  });

  // Check if the model wants to call a tool
  if (response.stop_reason === "tool_use") {
    const toolUse = response.content.find((c) => c.type === "tool_use");
    
    // Execute the tool
    const result = await executeTool(toolUse.name, toolUse.input);

    // Send the result back to the model
    const finalResponse = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      tools,
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result,
          }],
        },
      ],
    });

    return finalResponse.content;
  }

  return response.content;
}
```

### Implementation: MCP as a tool provider

MCP servers integrate naturally with the tool-use pattern. The MCP client acts as the bridge between the AI model and the MCP server's tools:

```typescript
// The MCP client discovers tools from the server
const tools = await mcpClient.listTools();

// Convert MCP tool definitions to the LLM's function-calling format
const llmTools = tools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.inputSchema,
}));

// When the LLM calls a tool, forward it to the MCP server
async function executeTool(name: string, args: Record<string, unknown>) {
  const result = await mcpClient.callTool(name, args);
  return result.content;
}
```

---

## RAG Agents

Retrieval-Augmented Generation (RAG) agents combine an LLM with a retrieval system. Instead of relying on the model's training data, the agent retrieves relevant information from a knowledge base and uses it to generate answers.

### Retrieval strategies

#### 1. Semantic search (vector embeddings)

The most common RAG approach. Documents are converted to vector embeddings and stored in a vector database. At query time, the query is also embedded, and the most similar documents are retrieved.

```typescript
async function semanticSearch(query: string, topK: number = 5): Promise<Document[]> {
  // Embed the query
  const queryEmbedding = await embedText(query);

  // Search the vector database
  const results = await vectorDB.search(queryEmbedding, { topK });

  return results.map((r) => ({
    content: r.text,
    score: r.score,
    source: r.metadata.source,
  }));
}
```

**Best for:** General knowledge queries, FAQ systems, documentation search.

#### 2. Keyword search (BM25/TF-IDF)

Traditional text search that matches keywords. Complements semantic search by catching exact matches that embeddings might miss.

```typescript
async function keywordSearch(query: string, topK: number = 5): Promise<Document[]> {
  const results = await searchIndex.search(query, { topK });
  return results;
}
```

**Best for:** Code search, exact name lookups, error message matching.

#### 3. Hybrid search

Combine semantic and keyword search for the best of both worlds:

```typescript
async function hybridSearch(query: string, topK: number = 5): Promise<Document[]> {
  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearch(query, topK * 2),
    keywordSearch(query, topK * 2),
  ]);

  // Merge and re-rank
  const merged = mergeAndDedupe(semanticResults, keywordResults);
  const reranked = await rerank(query, merged, topK);

  return reranked;
}
```

**Best for:** Production RAG systems where retrieval quality matters.

#### 4. Multi-query retrieval

Generate multiple variations of the query to improve recall:

```typescript
async function multiQueryRetrieval(query: string): Promise<Document[]> {
  // Ask the LLM to generate query variations
  const variations = await llm.generate(`
    Generate 3 alternative phrasings of this question for search:
    "${query}"
    Return one per line.
  `);

  const queries = [query, ...variations.split("\n").filter(Boolean)];

  // Search with each query and merge results
  const allResults = await Promise.all(queries.map((q) => semanticSearch(q, 3)));
  return mergeAndDedupe(...allResults);
}
```

**Best for:** Complex questions where a single embedding might miss relevant documents.

### Citation formatting

RAG agents should cite their sources so users can verify the information:

```typescript
async function ragAnswer(query: string): Promise<{ answer: string; citations: Citation[] }> {
  const documents = await hybridSearch(query, 5);

  const prompt = `
    Answer the question based on the following sources.
    Cite sources using [1], [2], etc. format.
    
    Sources:
    ${documents.map((doc, i) => `[${i + 1}] ${doc.content}`).join("\n\n")}
    
    Question: ${query}
  `;

  const answer = await llm.generate(prompt);

  return {
    answer,
    citations: documents.map((doc, i) => ({
      index: i + 1,
      source: doc.source,
      snippet: doc.content.slice(0, 200),
    })),
  };
}
```

### RAG as an MCP server

AgentForge's `rag-knowledge` template exposes RAG as MCP tools:

```typescript
server.tool(
  "search_knowledge",
  "Search the knowledge base for relevant information",
  { query: z.string().describe("Natural language search query") },
  async ({ query }) => {
    const documents = await hybridSearch(query, 5);
    return {
      content: [{
        type: "text",
        text: documents.map((d, i) => 
          `[${i + 1}] (Source: ${d.source})\n${d.content}`
        ).join("\n\n---\n\n"),
      }],
    };
  }
);

server.tool(
  "ask_knowledge",
  "Ask a question and get an answer with citations from the knowledge base",
  { question: z.string() },
  async ({ question }) => {
    const { answer, citations } = await ragAnswer(question);
    return {
      content: [{
        type: "text",
        text: `${answer}\n\nSources:\n${citations.map(c => `[${c.index}] ${c.source}`).join("\n")}`,
      }],
    };
  }
);
```

---

## Multi-Agent Orchestration

For complex tasks, a single agent may not be sufficient. Multi-agent orchestration coordinates multiple specialized agents to solve problems collaboratively.

### Coordinator-Worker pattern

A central coordinator agent receives the task, decomposes it into subtasks, and assigns each subtask to a specialized worker agent. The coordinator collects the results and synthesizes a final answer.

```
         ┌──────────────┐
         │  Coordinator  │
         │   Agent       │
         └──────┬───────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌───────┐ ┌───────┐ ┌───────┐
│Worker │ │Worker │ │Worker │
│  (FS) │ │  (DB) │ │ (RAG) │
└───────┘ └───────┘ └───────┘
```

```typescript
async function coordinator(task: string): Promise<string> {
  // Step 1: Decompose the task
  const plan = await llm.generate(`
    Break down this task into subtasks. For each subtask,
    specify which worker should handle it:
    - filesystem: file operations
    - database: SQL queries
    - rag: knowledge base search
    
    Task: ${task}
  `);

  const subtasks = parsePlan(plan);

  // Step 2: Execute subtasks (potentially in parallel)
  const results = await Promise.all(
    subtasks.map((subtask) => executeWorker(subtask.worker, subtask.task))
  );

  // Step 3: Synthesize the final answer
  const finalAnswer = await llm.generate(`
    Task: ${task}
    Subtask results: ${JSON.stringify(results)}
    
    Synthesize a final answer from these results.
  `);

  return finalAnswer;
}
```

**When to use:** Complex tasks that span multiple domains (e.g., "Analyze the sales data, cross-reference with customer feedback documents, and generate a report saved to disk").

### Peer-to-peer pattern

Agents communicate directly with each other without a central coordinator. Each agent can call other agents as tools.

```
┌───────┐         ┌───────┐
│ Agent │◄───────►│ Agent │
│   A   │         │   B   │
└───┬───┘         └───┬───┘
    │                   │
    └───────┬───────────┘
            │
        ┌───────┐
        │ Agent │
        │   C   │
        └───────┘
```

```typescript
// Agent A can call Agent B as a tool
const agentATools = [
  {
    name: "ask_agent_b",
    description: "Ask Agent B for database information",
    input_schema: { type: "object", properties: { query: { type: "string" } } },
  },
];

// Agent B can call Agent C as a tool
const agentBTools = [
  {
    name: "ask_agent_c",
    description: "Ask Agent C for RAG-based answers",
    input_schema: { type: "object", properties: { question: { type: "string" } } },
  },
];
```

**When to use:** Tasks where agents need dynamic, ad-hoc collaboration without a predetermined workflow.

### Choosing an orchestration pattern

| Pattern | Best For | Complexity |
|---|---|---|
| **Coordinator-Worker** | Structured, multi-domain tasks | Medium |
| **Peer-to-peer** | Dynamic, exploratory collaboration | High |
| **Single agent + MCP** | Most tasks (start here) | Low |

> **Best practice:** Start with a single agent and MCP tools. Only move to multi-agent orchestration when a single agent genuinely can't handle the complexity. Multi-agent systems are harder to debug, more expensive, and more unpredictable.

---

## Human-in-the-Loop

Human-in-the-loop (HITL) patterns add human oversight to AI agent workflows. This is critical for tasks where errors are costly, irreversible, or involve sensitive data.

### Approval gates

The agent pauses before executing certain actions and asks for human approval:

```typescript
async function executeWithApproval(
  tool: string,
  args: Record<string, unknown>,
  riskLevel: "low" | "medium" | "high"
): Promise<string> {
  // Low-risk tools execute automatically
  if (riskLevel === "low") {
    return await executeTool(tool, args);
  }

  // Medium and high-risk tools require approval
  const description = formatToolCall(tool, args);
  const approved = await requestHumanApproval(description, riskLevel);

  if (!approved) {
    return "Action was rejected by the user.";
  }

  return await executeTool(tool, args);
}
```

### Risk classification

Classify tools by risk level to determine when approval is needed:

```typescript
const TOOL_RISK: Record<string, "low" | "medium" | "high"> = {
  // Low risk: read-only, no side effects
  read_file: "low",
  list_files: "low",
  search_knowledge: "low",
  query_database: "low",

  // Medium risk: modifications, but reversible
  write_file: "medium",
  create_record: "medium",
  update_record: "medium",

  // High risk: irreversible or external effects
  delete_file: "high",
  delete_record: "high",
  send_email: "high",
  execute_command: "high",
  make_payment: "high",
};

function getRiskLevel(tool: string): "low" | "medium" | "high" {
  return TOOL_RISK[tool] || "high"; // Default to high for unknown tools
}
```

### Approval UI integration

With MCP, approval can be handled by the client (Claude Desktop, Cursor, etc.):

```typescript
server.tool(
  "delete_file",
  "Delete a file (requires approval)",
  { path: z.string().describe("Absolute path of the file to delete") },
  async ({ path }) => {
    // The MCP client handles the approval prompt
    // The tool only executes if the user approves
    await fs.unlink(path);
    return {
      content: [{ type: "text", text: `Deleted: ${path}` }],
    };
  }
);
```

> **Note:** MCP clients like Claude Desktop have built-in approval prompts for tool calls. The user sees the tool name and arguments before approving. You can configure auto-approval for low-risk tools in the client settings.

### Progressive autonomy

Start with full human oversight and gradually reduce it as trust is established:

```typescript
class ProgressiveAutonomy {
  private executionCounts: Map<string, number> = new Map();
  private approvalRates: Map<string, number> = new Map();

  async execute(tool: string, args: Record<string, unknown>) {
    const count = this.executionCounts.get(tool) || 0;
    const rate = this.approvalRates.get(tool) || 0;

    // Auto-approve after 10 successful executions with >90% approval rate
    if (count > 10 && rate > 0.9) {
      return await executeTool(tool, args);
    }

    const approved = await requestHumanApproval(tool, args);
    
    this.executionCounts.set(tool, count + 1);
    if (approved) {
      this.approvalRates.set(tool, (rate * count + 1) / (count + 1));
    } else {
      this.approvalRates.set(tool, (rate * count) / (count + 1));
    }

    return approved ? await executeTool(tool, args) : "Action rejected.";
  }
}
```

---

## Choosing the Right Pattern for Your Use Case

| Use Case | Recommended Pattern |
|---|---|
| Simple Q&A with external data | Single agent + MCP tools (native function calling) |
| Multi-step research task | ReAct |
| Knowledge base assistant | RAG agent (hybrid search + citations) |
| Code analysis and modification | Single agent + filesystem MCP tools |
| Complex workflow spanning multiple domains | Coordinator-Worker multi-agent |
| Task with irreversible actions | Single agent + human-in-the-loop approval gates |
| Customer support with knowledge base | RAG + human escalation for complex cases |
| Data pipeline (extract, transform, load) | Coordinator-Worker with specialized workers |
| Ad-hoc collaboration between specialists | Peer-to-peer multi-agent |

### Decision framework

1. **Start simple.** Begin with a single agent and MCP tools. This handles 80% of use cases.
2. **Add ReAct if** the task requires multi-step reasoning with intermediate observations.
3. **Add RAG if** the agent needs to answer questions using a specific knowledge base.
4. **Add multi-agent orchestration if** the task genuinely requires multiple specialized agents that a single agent can't emulate.
5. **Add human-in-the-loop if** any tool call could cause irreversible damage or involves sensitive operations.

> **Golden rule:** The simplest pattern that solves your problem is the right one. Complexity should be added only when necessary, not preemptively.
