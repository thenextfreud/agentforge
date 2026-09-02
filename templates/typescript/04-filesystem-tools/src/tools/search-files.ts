import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";
import { loadSandboxConfig, resolveSandboxPath, checkSymlinkEscape, ensureSandboxRoot } from "../lib/sandbox.js";
import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";

interface SearchResult {
  path: string;
  relativePath: string;
  name: string;
  type: "file" | "directory";
  size: number;
}

/**
 * Recursively search for files matching a pattern within a directory.
 * Respects the sandbox boundary — never traverses outside the sandbox root.
 */
async function searchRecursive(
  dirPath: string,
  sandboxRoot: string,
  pattern: string,
  results: SearchResult[],
  maxResults: number
): Promise<void> {
  if (results.length >= maxResults) return;

  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(dirPath, { withFileTypes: true });
  } catch {
    return; // Skip directories we can't read
  }

  for (const entry of entries) {
    if (results.length >= maxResults) return;

    const entryPath = path.join(dirPath, entry.name);

    // Check for symlink escape
    try {
      await checkSymlinkEscape(entryPath, { root: sandboxRoot, allowedExtensions: "*", maxFileSizeBytes: 0, readOnly: false });
    } catch {
      continue; // Skip symlinks that escape the sandbox
    }

    const relativePath = path.relative(sandboxRoot, entryPath);

    // Check if the name matches the pattern (case-insensitive)
    const nameMatches = entry.name.toLowerCase().includes(pattern.toLowerCase());
    const pathMatches = relativePath.toLowerCase().includes(pattern.toLowerCase());

    if (nameMatches || pathMatches) {
      try {
        const stats = await fsp.stat(entryPath);
        results.push({
          path: entryPath,
          relativePath,
          name: entry.name,
          type: entry.isDirectory() ? "directory" : "file",
          size: entry.isDirectory() ? 0 : stats.size,
        });
      } catch {
        results.push({
          path: entryPath,
          relativePath,
          name: entry.name,
          type: entry.isDirectory() ? "directory" : "file",
          size: 0,
        });
      }
    }

    // Recurse into subdirectories
    if (entry.isDirectory()) {
      await searchRecursive(entryPath, sandboxRoot, pattern, results, maxResults);
    }
  }
}

export const searchFilesTool = {
  name: "search_files",
  description: "Search for files and directories by name pattern within the sandbox. Performs a recursive search from the specified directory (default: sandbox root). Returns matching paths with file metadata. Results are limited to 100 entries.",
  schema: {
    pattern: z.string().min(1).describe("Search pattern — matches against file/directory names (case-insensitive substring match)"),
    directory: z.string().optional().default(".").describe("Directory to search in (relative to sandbox root, default: root)"),
  },

  handler: wrapHandler(async (args: { pattern: string; directory?: string }) => {
    const config = loadSandboxConfig();
    await ensureSandboxRoot(config);
    const dirPath = args.directory || ".";
    const safePath = resolveSandboxPath(dirPath, config);
    await checkSymlinkEscape(safePath, config);

    const stats = await fsp.stat(safePath);
    if (!stats.isDirectory()) {
      throw new Error(`Path "${dirPath}" is not a directory`);
    }

    const results: SearchResult[] = [];
    const maxResults = 100;
    await searchRecursive(safePath, config.root, args.pattern, results, maxResults);

    const output = {
      pattern: args.pattern,
      search_root: safePath,
      match_count: results.length,
      truncated: results.length >= maxResults,
      results,
    };

    return JSON.stringify(output, null, 2);
  }),
};
