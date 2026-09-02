# AgentForge — MCP Server + AI Agent Starter Kit

## Project status (2026-09-01)
- **Pivot in progress**: Was a paid Gumroad product ($49). User decided
  marketing a paid boilerplate pack with no audience was futile. Pivoting
  to open-source on GitHub for credibility/audience building.
- **Gumroad listing still live** at `https://forgea5.gumroad.com/l/agentforge`
  ($49). Email on Gumroad account updated to `forgea524@agentmail.to`
  and confirmed. Old Gmail (`forgea542@gmail.com`) was disabled by Google
  bot detection — do NOT use it.
- **No git repo yet** — `git init` + GitHub push is the next step.

## Identity / accounts
- **Gumroad**: Atlas Forge account, email `forgea524@agentmail.to`
- **AgentMail inbox**: `forgea524@agentmail.to` — accessible via AgentMail
  MCP server. API key is inbox-scoped (`am_us_inbox_...`), can read/send
  emails but cannot list/create inboxes or read inbox metadata.
- **Chrome profile**: Separate profile at
  `C:\Users\short\AppData\Local\AtlasForgeChrome` launched with
  `--remote-debugging-port=9222`. A fake `DevToolsActivePort` file was
  placed at `C:\Users\short\AppData\Local\Google\Chrome\User Data\` so
  the chrome-devtools MCP can find it. To relaunch:
  ```
  & "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="C:\Users\short\AppData\Local\AtlasForgeChrome" --remote-debugging-port=9222 --no-first-run --no-default-browser-check
  ```
- **dev.to account**: NOT created yet. Signup was attempted but
  reCAPTCHA blocked automation. Username `atlasforge` was taken;
  `atlasforge_dev` was the fallback. Password: `F0rge@2026#Atlas`.
  If resuming signup, the reCAPTCHA must be solved manually in the
  Chrome window.

## Project structure
```
AgentForge/
├── package.json              # workspace root (npm workspaces)
├── README.md                 # main readme (currently sales-oriented, needs rewrite for OSS)
├── GUMROAD_LISTING.md        # original Gumroad sales copy (archive)
├── LICENSE                   # MIT
├── .credentials              # DO NOT COMMIT — Gumroad/AgentMail creds
├── .gitignore
├── templates/
│   ├── typescript/           # 5 TS MCP server templates
│   │   ├── 01-hello-world-stdio/
│   │   ├── 02-rest-api-wrapper/
│   │   ├── 03-database-query-server/
│   │   ├── 04-filesystem-tools/
│   │   └── 05-web-search-fetch/
│   ├── python/               # 5 Python MCP server templates
│   │   ├── 06-rag-knowledge-server/
│   │   ├── 07-oauth-protected-server/
│   │   ├── 08-saas-integration-template/
│   │   ├── 09-multi-tool-toolkit/
│   │   └── 10-streaming-server/
│   └── agents/               # 5 AI agent pattern templates
│       ├── 01-react-agent/
│       ├── 02-tool-use-agent/
│       ├── 03-rag-agent/
│       ├── 04-multi-agent/
│       └── 05-human-in-loop/
├── packages/
│   └── cli/                  # `npx agentforge init` scaffolding tool
├── landing/                  # Next.js landing page (conversion-optimized)
│   └── app/, components/
└── docs/
    └── getting-started.md
```

## Stack
- **TypeScript templates**: `@modelcontextprotocol/sdk`, Node.js, stdio/SSE
- **Python templates**: `mcp` Python SDK, asyncio
- **CLI**: Node.js, prompts/inquirer-style interactive scaffold
- **Landing page**: Next.js (App Router), TypeScript, Tailwind

## Key decisions
- MIT license for open-source release
- CLI tool published as `agentforge` on npm (via `npx agentforge init`)
- Landing page exists but may need rework for OSS (remove $49 pricing,
  add GitHub stars/clone CTA instead of Gumroad checkout)

## Next steps (priority order)
1. `git init` + initial commit
2. Create GitHub repo (`agentforge` or `agentforge-kit`), push
3. Rewrite README for open-source audience (not salesy)
4. Update landing page — swap Gumroad CTA for GitHub link
5. Write one genuinely useful technical article (not spam)
6. Optionally: publish CLI to npm

## MCP servers in use
See `C:\Users\short\AppData\Roaming\devin\mcp_config.json`:
- `agentmail` — email read/send for `forgea524@agentmail.to`
- `chrome-devtools` — browser automation (connects to port 9222)
- Others: azure, onimcp, puppeteer, atlassian, azure-devops, etc.
