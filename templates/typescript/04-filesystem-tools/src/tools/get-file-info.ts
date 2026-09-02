import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";
import { loadSandboxConfig, validatePath, ensureSandboxRoot } from "../lib/sandbox.js";
import fsp from "node:fs/promises";

export const getFileInfoTool = {
  name: "get_file_info",
  description: "Get detailed metadata about a file or directory within the sandbox. Returns size, timestamps, permissions, and type. The path is validated to ensure it stays within the sandbox root.",
  schema: {
    path: z.string().min(1).describe("Path to the file or directory (relative to sandbox root, or absolute within sandbox)"),
  },

  handler: wrapHandler(async (args: { path: string }) => {
    const config = loadSandboxConfig();
    await ensureSandboxRoot(config);
    const safePath = await validatePath(args.path, config);

    const stats = await fsp.stat(safePath);

    const output = {
      path: safePath,
      type: stats.isDirectory() ? "directory" : stats.isFile() ? "file" : stats.isSymbolicLink() ? "symlink" : "other",
      size: stats.size,
      size_human: formatSize(stats.size),
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      accessed: stats.atime.toISOString(),
      permissions: {
        owner: {
          read: !!(stats.mode & 0o400),
          write: !!(stats.mode & 0o200),
          execute: !!(stats.mode & 0o100),
        },
        group: {
          read: !!(stats.mode & 0o040),
          write: !!(stats.mode & 0o020),
          execute: !!(stats.mode & 0o010),
        },
        others: {
          read: !!(stats.mode & 0o004),
          write: !!(stats.mode & 0o002),
          execute: !!(stats.mode & 0o001),
        },
      },
      mode: stats.mode.toString(8),
    };

    return JSON.stringify(output, null, 2);
  }),
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
