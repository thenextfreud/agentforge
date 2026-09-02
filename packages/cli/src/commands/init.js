// @agentforge/cli — `agentforge init [project-name]`
// Interactive scaffold: prompt for project name, pick a category, pick a
// template, copy files, update manifest, print next steps.

import fs from "node:fs";
import path from "node:path";

import {
  templates,
  getCategoryOptions,
  templatesByCategory,
  getTemplateById,
} from "../lib/templates.js";
import { scaffold, isDirectoryEmpty } from "../lib/scaffold.js";
import { ask, select, confirm, info, success, error } from "../lib/prompts.js";

// ── Validators ────────────────────────────────────────────────

/**
 * Validate a project name: non-empty, valid npm package name characters.
 * @param {string} name
 * @returns {string|null} error message or null if valid
 */
function validateProjectName(name) {
  if (!name) return "Project name is required.";
  if (name.length > 214) return "Name must be 214 characters or fewer.";
  // npm package name rules: lowercase, alphanumeric, hyphens, underscores, dots
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
    return "Name must start with a letter or number and contain only letters, numbers, hyphens, underscores, and dots.";
  }
  return null;
}

// ── Command entry point ───────────────────────────────────────

/**
 * Run the `init` command.
 * @param {string[]} args - positional args after `init` (e.g. ["my-project"])
 * @returns {Promise<void>}
 */
export async function runInit(args) {
  info("AgentForge — Scaffold a new MCP server or AI agent\n");

  // 1. Get project name (from arg or prompt).
  let projectName = args[0];
  if (!projectName) {
    projectName = await ask("Project name", {
      validate: validateProjectName,
      default: "my-mcp-server",
    });
  } else {
    const validationError = validateProjectName(projectName);
    if (validationError) {
      error(validationError);
      process.exit(1);
    }
  }

  const targetDir = path.resolve(projectName);

  // 2. Check if target directory already exists and is non-empty.
  if (fs.existsSync(targetDir) && !isDirectoryEmpty(targetDir)) {
    info(`\n  Directory "${projectName}" already exists and is not empty.`);
    const proceed = await confirm("  Continue and potentially overwrite files?", false);
    if (!proceed) {
      info("\n  Aborted.");
      process.exit(0);
    }
  }

  // 3. Show category options and let user pick.
  const categoryOptions = getCategoryOptions();
  const selected = await select(
    "Choose a template category:",
    categoryOptions.map((opt) => ({
      label: opt.label,
      description: `${templatesByCategory(opt.category, opt.language).length} template(s) available`,
      value: opt,
    }))
  );

  // 4. Show templates in the selected category.
  const categoryTemplates = templatesByCategory(selected.category, selected.language);

  if (categoryTemplates.length === 0) {
    error("No templates found in this category.");
    process.exit(1);
  }

  const chosenTemplateId = await select(
    `Choose a template (${selected.label}):`,
    categoryTemplates.map((t) => ({
      label: t.name,
      description: t.description,
      value: t.id,
    }))
  );

  const template = getTemplateById(chosenTemplateId);
  if (!template) {
    error(`Template "${chosenTemplateId}" not found in registry.`);
    process.exit(1);
  }

  // 5. Scaffold.
  info(`\n  Scaffolding "${template.name}" into ./${projectName}/ ...`);

  try {
    const result = scaffold(template, targetDir, projectName);

    success(`Project created at ${path.relative(process.cwd(), result.targetDir) || "."}`);
    info(`  ${result.filesCopied} file(s) copied.`);

    if (result.manifestUpdated) {
      info(`  Project name set to "${projectName}" in manifest.`);
    }

    // 6. Print next steps.
    info("\n  ── Next steps ──────────────────────────────────────");

    info(`  cd ${projectName}`);

    for (const step of template.nextSteps) {
      info(`  ${step}`);
    }

    // Show env var reminder if the template needs any.
    if (template.envVars.length > 0) {
      info("");
      info("  ── Environment variables ───────────────────────────");
      info("  This template requires the following env vars:");
      for (const v of template.envVars) {
        info(`    • ${v}`);
      }
      info("  Copy .env.example to .env and fill in your values.");
    }

    info("\n  ── Connect to your AI client ───────────────────────");
    info("  See the template's README.md for Claude Desktop, Cursor,");
    info("  and Windsurf integration instructions.");
    info("");

    success("Happy building! 🚀");
    info("");
  } catch (err) {
    error(err.message);
    info("");
    process.exit(1);
  }
}
