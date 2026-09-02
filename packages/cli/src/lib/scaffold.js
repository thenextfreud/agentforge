// @agentforge/cli — scaffold (copy) a template's files into a target directory.
// Pure Node.js: fs, path. No external dependencies.

import fs from "node:fs";
import path from "node:path";

// Directories and files that should never be copied from a template.
const EXCLUDE_DIRS = new Set(["node_modules", "dist", ".git", "__pycache__", ".venv", "venv"]);
const EXCLUDE_FILES = new Set([".env", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"]);

/**
 * Resolve the absolute path to the project root (the AgentForge repo root).
 * The CLI lives at <root>/packages/cli/src/lib/scaffold.js, so the root is
 * four levels up from this file.
 * @returns {string}
 */
export function getProjectRoot() {
  // packages/cli/src/lib/scaffold.js → up 4 = repo root
  return path.resolve(
    path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")),
    "..",
    "..",
    "..",
    ".."
  );
}

/**
 * Resolve the absolute path to a template directory.
 * @param {string} templatePath - relative path from project root
 * @returns {string}
 */
export function resolveTemplateDir(templatePath) {
  return path.resolve(getProjectRoot(), templatePath);
}

/**
 * Check whether a directory is empty (ignoring excluded items).
 * @param {string} dir
 * @returns {boolean}
 */
export function isDirectoryEmpty(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name) || EXCLUDE_FILES.has(entry.name)) continue;
    return false;
  }
  return true;
}

/**
 * Recursively copy a directory, excluding unwanted files/dirs.
 * @param {string} src - absolute source dir
 * @param {string} dest - absolute destination dir
 * @param {Set<string>} [excludeDirs]
 * @param {Set<string>} [excludeFiles]
 */
function copyDirRecursive(src, dest, excludeDirs = EXCLUDE_DIRS, excludeFiles = EXCLUDE_FILES) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      copyDirRecursive(srcPath, destPath, excludeDirs, excludeFiles);
    } else if (entry.isFile()) {
      if (excludeFiles.has(entry.name)) continue;
      fs.copyFileSync(srcPath, destPath);
    }
    // Skip symlinks and other special types for safety.
  }
}

/**
 * Update the `name` field in a package.json file.
 * @param {string} filePath - absolute path to package.json
 * @param {string} newName
 */
function updatePackageJsonName(filePath, newName) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const pkg = JSON.parse(raw);
  pkg.name = newName;
  fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
}

/**
 * Update the `name` field in a pyproject.toml file.
 * Handles both `name = "..."` under [project] and [tool.poetry] sections.
 * @param {string} filePath - absolute path to pyproject.toml
 * @param {string} newName
 */
function updatePyprojectName(filePath, newName) {
  let content = fs.readFileSync(filePath, "utf-8");
  // Match: name = "old-name"  (with optional surrounding whitespace)
  // Only replace the first occurrence, which is the project name.
  const nameRegex = /^(\s*name\s*=\s*)"[^"]*"/m;
  if (nameRegex.test(content)) {
    content = content.replace(nameRegex, `$1"${newName}"`);
    fs.writeFileSync(filePath, content, "utf-8");
  }
}

/**
 * Main scaffold function: copy a template into a target directory and
 * update the project name in its manifest file.
 *
 * @param {object} template - template object from the registry
 * @param {string} targetDir - absolute or relative path to the target directory
 * @param {string} projectName - the new project name
 * @returns {{targetDir: string, filesCopied: number, manifestUpdated: boolean}}
 * @throws {Error} if the template directory doesn't exist or copying fails
 */
export function scaffold(template, targetDir, projectName) {
  const templateDir = resolveTemplateDir(template.path);

  if (!fs.existsSync(templateDir)) {
    throw new Error(
      `Template directory not found: ${templateDir}\n` +
        `This template may not have been published yet. ` +
        `Check available templates with: agentforge list`
    );
  }

  const absTarget = path.resolve(targetDir);

  // Create the target directory if it doesn't exist.
  fs.mkdirSync(absTarget, { recursive: true });

  // Copy all files.
  copyDirRecursive(templateDir, absTarget);

  // Count files copied (for reporting).
  const filesCopied = countFiles(absTarget);

  // Update the project name in the manifest file.
  let manifestUpdated = false;

  const pkgJsonPath = path.join(absTarget, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    updatePackageJsonName(pkgJsonPath, projectName);
    manifestUpdated = true;
  }

  const pyprojectPath = path.join(absTarget, "pyproject.toml");
  if (fs.existsSync(pyprojectPath)) {
    updatePyprojectName(pyprojectPath, projectName);
    manifestUpdated = true;
  }

  return { targetDir: absTarget, filesCopied, manifestUpdated };
}

/**
 * Count the number of files in a directory tree (excluding excluded items).
 * @param {string} dir
 * @returns {number}
 */
function countFiles(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      count += countFiles(path.join(dir, entry.name));
    } else if (entry.isFile()) {
      if (EXCLUDE_FILES.has(entry.name)) continue;
      count++;
    }
  }
  return count;
}
