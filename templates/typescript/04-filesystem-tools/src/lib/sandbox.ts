/**
 * Sandbox path validation and security checks.
 *
 * All file operations are restricted to a single root directory (SANDBOX_ROOT).
 * This module enforces:
 * - Path traversal prevention (no ../ escapes)
 * - Symlink escape detection (symlinks pointing outside the sandbox are rejected)
 * - File extension allow-lists
 * - File size limits
 * - Read-only mode enforcement
 */

import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { logger } from "./logger.js";

export class SandboxError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SandboxError";
    this.code = code;
  }
}

export interface SandboxConfig {
  root: string;
  allowedExtensions: string[] | "*";
  maxFileSizeBytes: number;
  readOnly: boolean;
}

let _config: SandboxConfig | null = null;

/**
 * Load sandbox configuration from environment variables.
 * Throws if SANDBOX_ROOT is not set.
 */
export function loadSandboxConfig(): SandboxConfig {
  if (_config) return _config;

  const root = process.env.SANDBOX_ROOT;
  if (!root) {
    throw new Error("SANDBOX_ROOT environment variable is required");
  }

  const resolvedRoot = path.resolve(root);

  const extRaw = process.env.ALLOWED_EXTENSIONS;
  const allowedExtensions: string[] | "*" =
    !extRaw || extRaw.trim() === "*"
      ? "*"
      : extRaw.split(",").map((e) => e.trim().toLowerCase().replace(/^\./, "")).filter((e) => e.length > 0);

  const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10);
  const readOnly = process.env.READ_ONLY === "true";

  _config = {
    root: resolvedRoot,
    allowedExtensions,
    maxFileSizeBytes: maxFileSizeMB * 1024 * 1024,
    readOnly,
  };

  logger.info("Sandbox configured", {
    root: resolvedRoot,
    allowedExtensions,
    maxFileSizeMB,
    readOnly,
  });

  return _config;
}

/**
 * Get the file extension (without the dot) from a file path.
 */
function getExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace(/^\./, "");
  return ext;
}

/**
 * Check if a file extension is allowed by the configuration.
 */
export function isExtensionAllowed(filePath: string, config: SandboxConfig): boolean {
  if (config.allowedExtensions === "*") return true;
  const ext = getExtension(filePath);
  if (!ext) return false; // No extension — reject unless wildcard
  return config.allowedExtensions.includes(ext);
}

/**
 * Resolve a user-supplied path relative to the sandbox root and verify
 * it stays within the sandbox. This is the core security check.
 *
 * Checks:
 * 1. Resolves the path relative to the sandbox root
 * 2. Ensures the resolved path is within the sandbox root (no ../ escapes)
 * 3. Detects symlinks that point outside the sandbox
 *
 * @param inputPath - user-supplied path (relative or absolute within sandbox)
 * @param config - sandbox configuration
 * @returns the safe, resolved absolute path
 * @throws SandboxError if the path escapes the sandbox
 */
export function resolveSandboxPath(inputPath: string, config: SandboxConfig): string {
  // Normalize the input — if it's absolute, make it relative to root
  let relativePath = inputPath;
  if (path.isAbsolute(inputPath)) {
    // If the user provides an absolute path, check if it's within the sandbox
    relativePath = path.relative(config.root, inputPath);
  }

  // Resolve the full path
  const resolvedPath = path.resolve(config.root, relativePath);

  // Normalize the root for comparison (ensure trailing separator)
  const normalizedRoot = config.root.endsWith(path.sep)
    ? config.root
    : config.root + path.sep;

  // Check 1: The resolved path must be within the sandbox root
  // It must either equal the root or be a child of the root
  if (resolvedPath !== config.root && !resolvedPath.startsWith(normalizedRoot)) {
    throw new SandboxError(
      "PATH_TRAVERSAL",
      `Path "${inputPath}" escapes the sandbox root. Access denied.`
    );
  }

  return resolvedPath;
}

/**
 * Check if a resolved path is a symlink and whether it points outside the sandbox.
 * If the symlink target is outside the sandbox, throw an error.
 *
 * @param resolvedPath - the already-resolved path within the sandbox
 * @param config - sandbox configuration
 * @throws SandboxError if a symlink points outside the sandbox
 */
export async function checkSymlinkEscape(
  resolvedPath: string,
  config: SandboxConfig
): Promise<void> {
  let stats: fs.Stats;
  try {
    stats = await fsp.lstat(resolvedPath);
  } catch {
    // Path doesn't exist — nothing to check
    return;
  }

  if (!stats.isSymbolicLink()) return;

  // Read the symlink target
  const target = await fsp.readlink(resolvedPath);
  const resolvedTarget = path.resolve(path.dirname(resolvedPath), target);

  const normalizedRoot = config.root.endsWith(path.sep)
    ? config.root
    : config.root + path.sep;

  if (resolvedTarget !== config.root && !resolvedTarget.startsWith(normalizedRoot)) {
    throw new SandboxError(
      "SYMLINK_ESCAPE",
      `Symlink at "${resolvedPath}" points to "${resolvedTarget}" which is outside the sandbox. Access denied.`
    );
  }

  // Recursively check if the target itself is a symlink (chained symlinks)
  await checkSymlinkEscape(resolvedTarget, config);
}

/**
 * Check if a file size is within the allowed limit.
 */
export function checkFileSize(sizeInBytes: number, config: SandboxConfig): void {
  if (sizeInBytes > config.maxFileSizeBytes) {
    const maxMB = config.maxFileSizeBytes / (1024 * 1024);
    const actualMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
    throw new SandboxError(
      "FILE_TOO_LARGE",
      `File size (${actualMB} MB) exceeds the maximum allowed size (${maxMB} MB).`
    );
  }
}

/**
 * Enforce read-only mode. Throws if write operations are attempted
 * when READ_ONLY is enabled.
 */
export function enforceWritable(config: SandboxConfig): void {
  if (config.readOnly) {
    throw new SandboxError(
      "READ_ONLY",
      "Server is in read-only mode. Write operations are disabled."
    );
  }
}

/**
 * Full validation pipeline for a file path. Combines all security checks:
 * 1. Resolve and check path traversal
 * 2. Check symlink escape
 * 3. Check extension allow-list
 *
 * @param inputPath - user-supplied path
 * @param config - sandbox configuration
 * @returns the safe, resolved absolute path
 */
export async function validatePath(
  inputPath: string,
  config: SandboxConfig
): Promise<string> {
  const resolved = resolveSandboxPath(inputPath, config);
  await checkSymlinkEscape(resolved, config);

  if (!isExtensionAllowed(resolved, config)) {
    throw new SandboxError(
      "EXTENSION_NOT_ALLOWED",
      `File extension ".${getExtension(resolved)}" is not in the allowed list. Allowed: ${
        config.allowedExtensions === "*" ? "all" : config.allowedExtensions.join(", ")
      }`
    );
  }

  return resolved;
}

/**
 * Ensure the sandbox root directory exists. Creates it if it doesn't.
 */
export async function ensureSandboxRoot(config: SandboxConfig): Promise<void> {
  try {
    await fsp.mkdir(config.root, { recursive: true });
  } catch (err) {
    throw new SandboxError(
      "SANDBOX_INIT_FAILED",
      `Failed to create sandbox root directory "${config.root}": ${(err as Error).message}`
    );
  }
}
