// @agentforge/cli — `agentforge info <template-id>`
// Show detailed info about a specific template.

import { getTemplateById } from "../lib/templates.js";
import { resolveTemplateDir } from "../lib/scaffold.js";
import fs from "node:fs";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";

function color(text, colorCode) {
  if (process.stdout.isTTY) {
    return `${colorCode}${text}${RESET}`;
  }
  return text;
}

/**
 * Run the `info` command.
 * @param {string[]} args - positional args after `info` (e.g. ["ts-hello-world"])
 * @returns {void}
 */
export function runInfo(args) {
  const id = args[0];

  if (!id) {
    process.stdout.write(
      color("\n  ✗ ", RED) +
        `Missing template ID.\n` +
        `  Usage: agentforge info <template-id>\n` +
        `  Run ${color("agentforge list", MAGENTA)} to see available template IDs.\n\n`
    );
    process.exit(1);
  }

  const template = getTemplateById(id);

  if (!template) {
    process.stdout.write(
      color("\n  ✗ ", RED) +
        `Template "${id}" not found.\n` +
        `  Run ${color("agentforge list", MAGENTA)} to see available templates.\n\n`
    );
    process.exit(1);
  }

  const w = 76;
  const sep = color("─".repeat(w), DIM);

  process.stdout.write(`\n${sep}\n`);
  process.stdout.write(color(`  ${template.name}`, BOLD + CYAN));
  process.stdout.write(color(`  (${template.id})`, DIM) + "\n");
  process.stdout.write(`${sep}\n\n`);

  // Description
  process.stdout.write(color("  Description:  ", BOLD));
  process.stdout.write(`${template.description}\n\n`);

  // Metadata table
  const rows = [
    ["Category", template.category],
    ["Language", template.language],
    ["Transport", template.transport],
    ["Path", template.path],
  ];

  for (const [label, value] of rows) {
    process.stdout.write(color(`  ${label.padEnd(14)}`, BOLD));
    process.stdout.write(`${color(value, GREEN)}\n`);
  }

  // Check if the template directory actually exists on disk.
  const templateDir = resolveTemplateDir(template.path);
  const exists = fs.existsSync(templateDir);
  process.stdout.write(color(`  ${"On disk".padEnd(14)}`, BOLD));
  if (exists) {
    process.stdout.write(color("✓ available", GREEN) + "\n");
  } else {
    process.stdout.write(color("⚠ not yet published", YELLOW) + "\n");
  }

  process.stdout.write("\n");

  // Tools
  process.stdout.write(color("  Tools:\n", BOLD));
  if (template.tools.length === 0) {
    process.stdout.write(color("    (none)\n", DIM));
  } else {
    for (const tool of template.tools) {
      process.stdout.write(`    ${color("•", MAGENTA)} ${tool}\n`);
    }
  }
  process.stdout.write("\n");

  // Environment variables
  process.stdout.write(color("  Required env vars:\n", BOLD));
  if (template.envVars.length === 0) {
    process.stdout.write(color("    (none — no configuration needed)\n", DIM));
  } else {
    for (const v of template.envVars) {
      process.stdout.write(`    ${color("•", YELLOW)} ${v}\n`);
    }
  }
  process.stdout.write("\n");

  // Next steps
  process.stdout.write(color("  Next steps after scaffold:\n", BOLD));
  process.stdout.write(color(`    cd <project-name>\n`, DIM));
  for (const step of template.nextSteps) {
    process.stdout.write(`    ${color("$", GREEN)} ${step}\n`);
  }

  process.stdout.write(`\n${sep}\n`);
  process.stdout.write(
    `  Scaffold with: ${color(`agentforge init --template ${template.id}`, MAGENTA)}\n\n`
  );
}
