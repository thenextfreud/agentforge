# Contributing to AgentForge

Thanks for your interest in contributing! Here's how to help.

## Adding a new template

1. Create a new directory under `templates/typescript/`, `templates/python/`, or `templates/agents/`
2. Follow the structure of existing templates:
   - `README.md` with setup instructions and usage examples
   - `.env.example` with all required env vars (no real secrets)
   - `Dockerfile` (for server templates)
   - Tests
   - Clean, commented code
3. Register the template in `packages/cli/src/lib/templates.js`
4. Verify it compiles: `npx tsc --noEmit` (TS) or `python -m py_compile` (Python)
5. Open a PR with a description of what the template teaches

## Improving existing templates

- Keep templates focused — one concept per template
- Don't add dependencies unless necessary
- Maintain backwards compatibility with Node 18+ / Python 3.10+
- Update the README if you change behavior

## Reporting issues

Use GitHub Issues. Include:
- What you expected
- What actually happened
- Steps to reproduce
- Your Node/Python version and OS

## Style

- TypeScript: strict mode, Zod for validation, stderr for logging
- Python: type hints, asyncio, structured logging
- No emojis in code or commit messages

## License

By contributing, you agree your contributions are licensed under MIT.
