#!/usr/bin/env node

// @agentforge/cli — entry point
// CLI argument parsing and command dispatch.
// Zero external dependencies — pure Node.js.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { runInit } from "./commands/init.js";
import { runList } from "./commands/list.js";
import { runInfo } from "./commands/info.js";

// ── Version ───────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const VERSION = pkg.version;

// ── Help text ─────────────────────────────────────────────────

const HELP = `
  AgentForge v${VERSION} — Production-ready AI Agent + MCP Server starter kit

  USAGE:
    agentforge <command> [options]
    npx agentforge <command> [options]

  COMMANDS:
    init [project-name]    Scaffold a new project from a template (interactive)
    list                   List all available templates
    info <template-id>     Show detailed info about a specific template
    help                   Show this help message

  OPTIONS:
    --help, -h             Show help
    --version, -v          Show version number

  EXAMPLES:
    agentforge init my-mcp-server
    agentforge init                    # prompts for project name
    agentforge list                    # shows all 15 templates
    agentforge info ts-hello-world     # details about the hello-world template

  TEMPLATES:
    10 MCP Server templates (5 TypeScript + 5 Python)
    5  AI Agent templates (TypeScript)

  For more info: https://github.com/agentforge/agentforge
`;

// ── Argument parsing ──────────────────────────────────────────

/**
 * Parse CLI arguments and dispatch to the appropriate command.
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {Promise<void>}
 */
async function main(argv) {
  // No command provided.
  if (argv.length === 0) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  const command = argv[0];
  const args = argv.slice(1);

  switch (command) {
    case "init":
      await runInit(args);
      break;

    case "list":
    case "ls":
      runList(args);
      break;

    case "info":
      runInfo(args);
      break;

    case "help":
    case "--help":
    case "-h":
      process.stdout.write(HELP);
      process.exit(0);
      break;

    case "--version":
    case "-v":
      process.stdout.write(`agentforge v${VERSION}\n`);
      process.exit(0);
      break;

    default:
      process.stderr.write(
        `\n  ✗ Unknown command: "${command}"\n` +
          `  Run "agentforge --help" to see available commands.\n\n`
      );
      process.exit(1);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────

// Handle unhandled rejections gracefully.
process.on("unhandledRejection", (err) => {
  process.stderr.write(`\n  ✗ Unexpected error: ${err.message}\n\n`);
  process.exit(1);
});

main(process.argv.slice(2));
