import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";
import { loadSandboxConfig, validatePath, checkFileSize, ensureSandboxRoot } from "../lib/sandbox.js";
import fsp from "node:fs/promises";

export const readFileTool = {
  name: "read_file",
  description: "Read the contents of a file within the sandbox. The file path is validated to ensure it stays within the sandbox root (no path traversal). File size is limited by MAX_FILE_SIZE_MB.",
  schema: {
    path: z.string().min(1).describe("Path to the file (relative to sandbox root, or absolute within sandbox)"),
    encoding: z.string().optional().default("utf-8").describe("Text encoding to use (default: utf-8)"),
  },

  handler: wrapHandler(async (args: { path: string; encoding?: string }) => {
    const config = loadSandboxConfig();
    await ensureSandboxRoot(config);
    const safePath = await validatePath(args.path, config);

    // Check file size before reading
    const stats = await fsp.stat(safePath);
    if (!stats.isFile()) {
      throw new Error(`Path "${args.path}" is not a file`);
    }
    checkFileSize(stats.size, config);

    const content = await fsp.readFile(safePath, args.encoding as BufferEncoding || "utf-8");

    const output = {
      path: safePath,
      size: stats.size,
      encoding: args.encoding || "utf-8",
      content,
    };

    return JSON.stringify(output, null, 2);
  }),
};
