import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";
import { loadSandboxConfig, resolveSandboxPath, checkSymlinkEscape, ensureSandboxRoot } from "../lib/sandbox.js";
import fsp from "node:fs/promises";
import path from "node:path";

export const listDirectoryTool = {
  name: "list_directory",
  description: "List the contents of a directory within the sandbox. Returns file names, types, sizes, and modification times. The directory path is validated to ensure it stays within the sandbox root.",
  schema: {
    path: z.string().optional().default(".").describe("Directory path (relative to sandbox root, default: root)"),
  },

  handler: wrapHandler(async (args: { path?: string }) => {
    const config = loadSandboxConfig();
    await ensureSandboxRoot(config);
    const dirPath = args.path || ".";
    const safePath = resolveSandboxPath(dirPath, config);
    await checkSymlinkEscape(safePath, config);

    const stats = await fsp.stat(safePath);
    if (!stats.isDirectory()) {
      throw new Error(`Path "${dirPath}" is not a directory`);
    }

    const entries = await fsp.readdir(safePath, { withFileTypes: true });

    const items = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(safePath, entry.name);
        try {
          const entryStats = await fsp.stat(entryPath);
          return {
            name: entry.name,
            type: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file",
            size: entry.isDirectory() ? null : entryStats.size,
            modified: entryStats.mtime.toISOString(),
          };
        } catch {
          return {
            name: entry.name,
            type: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file",
            size: null,
            modified: null,
          };
        }
      })
    );

    const output = {
      path: safePath,
      entry_count: items.length,
      entries: items,
    };

    return JSON.stringify(output, null, 2);
  }),
};
