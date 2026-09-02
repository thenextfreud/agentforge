import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";
import {
  loadSandboxConfig,
  validatePath,
  checkFileSize,
  enforceWritable,
  ensureSandboxRoot,
} from "../lib/sandbox.js";
import fsp from "node:fs/promises";
import path from "node:path";

export const writeFileTool = {
  name: "write_file",
  description: "Write content to a file within the sandbox. Creates parent directories if needed. Respects READ_ONLY mode and MAX_FILE_SIZE_MB limits. The file path is validated to ensure it stays within the sandbox root.",
  schema: {
    path: z.string().min(1).describe("Path to the file (relative to sandbox root, or absolute within sandbox)"),
    content: z.string().describe("Content to write to the file"),
    append: z.boolean().optional().default(false).describe("If true, append to the file instead of overwriting"),
  },

  handler: wrapHandler(async (args: { path: string; content: string; append?: boolean }) => {
    const config = loadSandboxConfig();
    enforceWritable(config);
    await ensureSandboxRoot(config);

    // Validate the path — but allow non-existent files (we're creating them)
    // validatePath checks extension and path traversal
    const safePath = await validatePath(args.path, config);

    // Check content size
    const contentBytes = Buffer.byteLength(args.content, "utf-8");
    checkFileSize(contentBytes, config);

    // Create parent directories if needed
    const parentDir = path.dirname(safePath);
    await fsp.mkdir(parentDir, { recursive: true });

    if (args.append) {
      await fsp.appendFile(safePath, args.content, "utf-8");
    } else {
      await fsp.writeFile(safePath, args.content, "utf-8");
    }

    const stats = await fsp.stat(safePath);

    const output = {
      path: safePath,
      size: stats.size,
      appended: args.append ?? false,
      message: `File ${args.append ? "appended to" : "written"} successfully`,
    };

    return JSON.stringify(output, null, 2);
  }),
};
