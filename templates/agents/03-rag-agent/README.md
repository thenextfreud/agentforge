# RAG Agent

A **Retrieval-Augmented Generation** agent that connects to a RAG MCP server, searches a knowledge base for relevant chunks, and generates grounded answers with citations.

## What is the RAG pattern?

RAG combines retrieval (searching a knowledge base) with generation (LLM producing an answer). Instead of relying on the LLM's training data, the agent fetches relevant documents at query time and grounds its answer in them.

```
Question → Search KB → Retrieve Chunks → Generate Answer with Citations
```

This ensures answers are:
- **Grounded** — based on actual retrieved content, not hallucinated
- **Cited** — every claim references a source
- **Current** — the knowledge base can be updated without retraining

## When to use this pattern

- **Knowledge base Q&A** — answer questions from your documentation, wiki, or internal docs
- **Customer support** — ground responses in your help articles and policies
- **Legal/compliance** — answers must cite specific source documents
- **Technical documentation** — query API docs, runbooks, or architecture docs
- **Any scenario where hallucination risk must be minimized**

## When NOT to use

- You need **agentic tool calling** (not just retrieval) → use `react-agent` or `tool-use-agent`
- You need **multiple specialized agents** → use `multi-agent`
- You need **human approval gates** → use `human-in-loop`

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — add your OPENAI_API_KEY and point to a RAG MCP server

# 3. Run the agent
npx tsx src/index.ts "How does the authentication system work?"

# 4. With multi-hop retrieval (searches twice if first round is insufficient)
npx tsx src/index.ts "What are the API rate limits and how do they relate to pricing?" --multi-hop

# 5. Build and run
npm run build
node dist/index.js "Explain the database schema"
```

## How it works

```
┌──────────────────────────────────────────────────────────────────────┐
│                          RAG Agent Flow                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────┐     ┌──────────────┐     ┌──────────────────┐          │
│  │  User     │────▶│  Refine      │────▶│  Search MCP      │          │
│  │  Question │     │  Query (LLM) │     │  RAG Server      │          │
│  └──────────┘     └──────────────┘     └────────┬─────────┘          │
│                                                   │                    │
│                                                   ▼                    │
│                                          ┌──────────────────┐         │
│                                          │  Retrieved       │         │
│                                          │  Chunks + Sources│         │
│                                          └────────┬─────────┘         │
│                                                   │                    │
│                    ┌──────────────────────────────┤                    │
│                    │                              │                    │
│                    ▼                              ▼                    │
│          ┌──────────────────┐          ┌──────────────────┐           │
│          │  Multi-hop?      │─ No ────▶│  Format Context  │           │
│          │  Enough chunks?  │          │  for LLM         │           │
│          └────────┬─────────┘          └────────┬─────────┘           │
│                   │ Yes                         │                      │
│                   ▼                             ▼                      │
│          ┌──────────────────┐          ┌──────────────────┐           │
│          │  Refine Query #2 │          │  Generate Answer │           │
│          │  + Search Again  │          │  (LLM + Context) │           │
│          └────────┬─────────┘          └────────┬─────────┘           │
│                   │                             │                      │
│                   └──────────┬──────────────────┘                      │
│                              ▼                                          │
│                   ┌──────────────────┐                                 │
│                   │  Format Answer   │                                 │
│                   │  + Citations     │                                 │
│                   └──────────────────┘                                 │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Citation format

The agent formats retrieved chunks as numbered context:

```
[1] Source: docs/api.md (relevance: 92%)
The REST API supports GET, POST, PUT, and DELETE methods...

[2] Source: docs/auth.md (relevance: 87%)
All API requests require a bearer token obtained via OAuth 2.0...
```

The LLM is instructed to cite sources inline: `"The API uses OAuth 2.0 [2] and supports REST methods [1]."`

The final output appends a source list:

```
Sources:
[1] docs/api.md — relevance: 92%
[2] docs/auth.md — relevance: 87%
```

### Multi-hop retrieval

When `--multi-hop` is enabled and the first search returns fewer chunks than `MAX_CHUNKS`, the agent:
1. Examines the existing context
2. Generates a refined second query
3. Searches again
4. Deduplicates results
5. Uses all unique chunks for answer generation

## Configuration

| Variable              | Required | Default                          | Description                                      |
|-----------------------|----------|----------------------------------|--------------------------------------------------|
| `OPENAI_API_KEY`      | Yes      | —                                | OpenAI API key                                   |
| `MODEL`               | No       | `gpt-4o-mini`                    | OpenAI model to use                              |
| `MCP_SERVER_COMMAND`  | No       | `python`                         | Command to launch the RAG MCP server             |
| `MCP_SERVER_ARGS`     | No       | `.../06-rag-knowledge-server/...`| Comma-separated args for the MCP server command  |
| `MAX_CHUNKS`          | No       | `5`                              | Maximum chunks to retrieve per search            |

### Connecting to a different RAG server

The agent auto-discovers the search tool by looking for common names (`search`, `query`, `retrieve`, `vector_search`, etc.). If your server uses a non-standard name, it falls back to the first available tool.

```env
# Custom RAG server
MCP_SERVER_COMMAND=node
MCP_SERVER_ARGS=/path/to/my-rag-server/dist/index.js
```

## Project structure

```
03-rag-agent/
├── src/
│   ├── index.ts          # Entry point — parses question, runs agent
│   ├── agent.ts          # RAG logic: query refinement, answer generation
│   ├── tools.ts          # MCP client + chunk parsing + citation formatting
│   └── lib/
│       └── logger.ts     # Structured stderr logger
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## Customization guide

### Change the citation style

Edit `formatCitations()` in `src/tools.ts` to use footnotes, hyperlinks, or academic citation format (APA, MLA, etc.).

### Add chunk preprocessing

In `src/tools.ts`, modify `parseSearchResult()` to clean, truncate, or enrich chunks before they're used as context.

### Adjust the system prompt

Edit `RAG_SYSTEM_PROMPT` in `src/agent.ts` to change how the model uses context — e.g., "always quote the source text" or "answer in bullet points."

### Add conversation memory

Extend `src/agent.ts` to maintain a conversation history and use previous Q&A pairs as additional context for follow-up questions.

### Implement relevance filtering

In `src/agent.ts`, filter out chunks below a minimum relevance score before passing them to the LLM.

### Use a different embedding/search backend

The agent is agnostic to the RAG server implementation. Any MCP server that provides a search tool returning text chunks will work.

## Building

```bash
npm run build    # Compile to dist/
npm start        # Run compiled version: node dist/index.js "your question"
```
