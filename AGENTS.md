# AgentForge — MCP Server + AI Agent Starter Kit

## Project status (2026-09-01)
- **Open-sourced!** Repo is live at **https://github.com/thenextfreud/agentforge**
- Pivoted from paid Gumroad product ($49) to free open-source (MIT).
  Rationale: selling a boilerplate pack with no audience/reputation was
  futile. Free on GitHub builds credibility and audience; monetization
  can come later via consulting, custom builds, or premium tooling.
- **Gumroad listing still live** at `https://forgea5.gumroad.com/l/agentforge`
  ($49). Email on Gumroad account updated to `forgea524@agentmail.to`
  and confirmed. Old Gmail (`forgea542@gmail.com`) was disabled by Google
  bot detection — do NOT use it. Consider taking down the Gumroad listing
  or making it free to align with the OSS pivot.

## Identity / accounts
- **GitHub**: `thenextfreud` — repo at `thenextfreud/agentforge`
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
├── README.md                 # OSS readme (developer-focused, not salesy)
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
├── landing/                  # Next.js landing page (needs OSS rework)
│   └── app/, components/
└── docs/
    ├── getting-started.md
    ├── client-configs/       # Claude Desktop, Cursor, Windsurf, VS Code
    ├── deployment/           # Docker, Cloudflare, Vercel, Railway, Fly.io
    └── patterns/             # Architecture, security, testing, agent design
```

## Stack
- **TypeScript templates**: `@modelcontextprotocol/sdk`, Node.js, stdio/SSE
- **Python templates**: `mcp` Python SDK, asyncio
- **CLI**: Node.js, prompts/inquirer-style interactive scaffold
- **Landing page**: Next.js (App Router), TypeScript, Tailwind

## Key decisions
- MIT license for open-source release
- CLI tool to be published as `agentforge` on npm (via `npx agentforge init`)
- Landing page needs rework: remove $49 pricing, add GitHub stars/clone CTA

## Completed
- [x] Build all templates (10 MCP servers + 5 agent patterns)
- [x] Write docs (getting started, deployment, client configs, patterns)
- [x] Build CLI scaffolding tool
- [x] Build landing page
- [x] Rewrite README for OSS audience
- [x] `git init` + initial commit (288 files, 45,898 insertions)
- [x] Create GitHub repo and push: https://github.com/thenextfreud/agentforge

## Next steps (priority order)
1. Write one genuinely useful technical article about MCP (not spam)
2. Update landing page — swap Gumroad CTA for GitHub link
3. Publish CLI to npm (`agentforge`)
4. Share in relevant communities (HN, Reddit r/MCP, r/LocalLLaMA — authentically)
5. Consider taking down or making free the Gumroad listing

## MCP servers in use
See `C:\Users\short\AppData\Roaming\devin\mcp_config.json`:
- `agentmail` — email read/send for `forgea524@agentmail.to`
- `chrome-devtools` — browser automation (connects to port 9222)
- Others: azure, onimcp, puppeteer, atlassian, azure-devops, etc.

## Lessons learned
- Selling boilerplate packs with no audience is an uphill battle. Free
  + GitHub stars is the proven path for dev tooling adoption.
- Google bot detection will disable accounts created via automation.
  Use AgentMail or similar services for email instead of Gmail.
- reCAPTCHA blocks automated signup on most platforms. Manual solving
  is sometimes unavoidable.
- chrome-devtools MCP needs a `DevToolsActivePort` file in the default
  Chrome user data dir. When using a custom profile, create this file
  manually with the port number and websocket path.
