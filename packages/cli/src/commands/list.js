// @agentforge/cli — `agentforge list`
// List all available templates grouped by category in a table format.

import { templates, getCategories, categoryLabel } from "../lib/templates.js";

// ANSI color codes (used when stdout is a TTY).
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const MAGENTA = "\x1b[35m";

/**
 * Conditionally wrap text in ANSI color codes.
 * @param {string} text
 * @param {string} color
 * @returns {string}
 */
function color(text, colorCode) {
  if (process.stdout.isTTY) {
    return `${colorCode}${text}${RESET}`;
  }
  return text;
}

/**
 * Truncate a string to maxLen, adding "…" if truncated.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

/**
 * Pad a string to a given width (accounting for ANSI codes by measuring
 * the visible text length).
 * @param {string} str
 * @param {number} width
 * @returns {string}
 */
function pad(str, width) {
  // Strip ANSI codes for length measurement.
  const visible = str.replace(/\x1b\[[0-9;]*m/g, "");
  const visibleLen = [...visible].length;
  if (visibleLen >= width) return str;
  return str + " ".repeat(width - visibleLen);
}

/**
 * Run the `list` command.
 * @param {string[]} _args - unused
 * @returns {void}
 */
export function runList(_args) {
  const categories = getCategories();

  process.stdout.write(
    color("\n  AgentForge Templates\n", BOLD) +
      color(`  ${"─".repeat(76)}\n\n`, DIM)
  );

  for (const category of categories) {
    // Group by language within each category.
    const langs = [...new Set(
      templates
        .filter((t) => t.category === category)
        .map((t) => t.language)
    )];

    for (const lang of langs) {
      const label = categoryLabel(category, lang);
      process.stdout.write(color(`  ${label}\n`, CYAN + BOLD));
      process.stdout.write(color(`  ${"─".repeat(76)}\n`, DIM));

      // Table header.
      const idHeader = color("ID", BOLD);
      const nameHeader = color("Name", BOLD);
      const transportHeader = color("Transport", BOLD);
      const descHeader = color("Description", BOLD);

      process.stdout.write(
        `  ${pad(idHeader, 22)}${pad(nameHeader, 26)}${pad(transportHeader, 12)}${descHeader}\n`
      );
      process.stdout.write(color(`  ${"─".repeat(76)}\n`, DIM));

      const catTemplates = templates.filter(
        (t) => t.category === category && t.language === lang
      );

      for (const t of catTemplates) {
        const idCol = color(t.id, GREEN);
        const nameCol = color(truncate(t.name, 24), BOLD);
        const transportCol = color(t.transport, YELLOW);
        const descCol = color(truncate(t.description, 38), DIM);

        process.stdout.write(
          `  ${pad(idCol, 22)}${pad(nameCol, 26)}${pad(transportCol, 12)}${descCol}\n`
        );
      }

      process.stdout.write("\n");
    }
  }

  process.stdout.write(
    color(`  ${"─".repeat(76)}\n`, DIM) +
      `  ${templates.length} templates total — ` +
      color(`${templates.filter((t) => t.category === "MCP Server").length}`, BOLD) +
      ` MCP servers, ` +
      color(`${templates.filter((t) => t.category === "AI Agent").length}`, BOLD) +
      ` AI agents\n\n` +
      `  Run ${color("agentforge info <template-id>", MAGENTA)} for details.\n` +
      `  Run ${color("agentforge init", MAGENTA)} to scaffold a new project.\n\n`
  );
}
