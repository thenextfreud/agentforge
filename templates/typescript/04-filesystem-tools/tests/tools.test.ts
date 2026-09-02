import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { success, failure, wrapHandler } from "../src/lib/errors.js";
import {
  resolveSandboxPath,
  checkSymlinkEscape,
  isExtensionAllowed,
  checkFileSize,
  enforceWritable,
  SandboxError,
  type SandboxConfig,
} from "../src/lib/sandbox.js";

describe("error utilities", () => {
  test("success returns content array with text", () => {
    const result = success("hello");
    assert.equal(result.content[0].type, "text");
    assert.equal(result.content[0].text, "hello");
    assert.equal(result.isError, undefined);
  });

  test("failure returns isError flag", () => {
    const result = failure({ code: "TEST", message: "failed" });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /TEST/);
  });

  test("wrapHandler catches errors and returns failure", async () => {
    const handler = wrapHandler(async () => {
      throw new Error("boom");
    });
    const result = await handler({});
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /boom/);
  });

  test("wrapHandler passes through success", async () => {
    const handler = wrapHandler(async () => "ok");
    const result = await handler({});
    assert.equal(result.content[0].text, "ok");
    assert.equal(result.isError, undefined);
  });
});

describe("sandbox: path traversal prevention", () => {
  let sandboxDir: string;
  let config: SandboxConfig;

  beforeEach(async () => {
    sandboxDir = await fsp.mkdtemp(path.join(os.tmpdir(), "sandbox-test-"));
    config = {
      root: sandboxDir,
      allowedExtensions: "*",
      maxFileSizeBytes: 10 * 1024 * 1024,
      readOnly: false,
    };
    // Create some test files
    await fsp.writeFile(path.join(sandboxDir, "test.txt"), "hello");
    await fsp.mkdir(path.join(sandboxDir, "subdir"));
    await fsp.writeFile(path.join(sandboxDir, "subdir", "nested.txt"), "nested");
  });

  afterEach(async () => {
    await fsp.rm(sandboxDir, { recursive: true, force: true });
  });

  test("allows paths within the sandbox", () => {
    const resolved = resolveSandboxPath("test.txt", config);
    assert.equal(resolved, path.join(sandboxDir, "test.txt"));
  });

  test("allows nested paths within the sandbox", () => {
    const resolved = resolveSandboxPath("subdir/nested.txt", config);
    assert.equal(resolved, path.join(sandboxDir, "subdir", "nested.txt"));
  });

  test("allows absolute paths within the sandbox", () => {
    const absPath = path.join(sandboxDir, "test.txt");
    const resolved = resolveSandboxPath(absPath, config);
    assert.equal(resolved, absPath);
  });

  test("blocks path traversal with ../", () => {
    assert.throws(
      () => resolveSandboxPath("../etc/passwd", config),
      { code: "PATH_TRAVERSAL" }
    );
  });

  test("blocks path traversal with multiple ../", () => {
    assert.throws(
      () => resolveSandboxPath("../../../../etc/passwd", config),
      { code: "PATH_TRAVERSAL" }
    );
  });

  test("blocks path traversal with encoded ../", () => {
    assert.throws(
      () => resolveSandboxPath("subdir/../../../etc/passwd", config),
      { code: "PATH_TRAVERSAL" }
    );
  });

  test("blocks absolute paths outside the sandbox", () => {
    assert.throws(
      () => resolveSandboxPath("/etc/passwd", config),
      { code: "PATH_TRAVERSAL" }
    );
  });

  test("allows the sandbox root itself", () => {
    const resolved = resolveSandboxPath(".", config);
    assert.equal(resolved, sandboxDir);
  });
});

describe("sandbox: symlink escape detection", () => {
  let sandboxDir: string;
  let outsideDir: string;
  let config: SandboxConfig;

  beforeEach(async () => {
    sandboxDir = await fsp.mkdtemp(path.join(os.tmpdir(), "sandbox-sym-"));
    outsideDir = await fsp.mkdtemp(path.join(os.tmpdir(), "outside-"));
    config = {
      root: sandboxDir,
      allowedExtensions: "*",
      maxFileSizeBytes: 10 * 1024 * 1024,
      readOnly: false,
    };
  });

  afterEach(async () => {
    await fsp.rm(sandboxDir, { recursive: true, force: true });
    await fsp.rm(outsideDir, { recursive: true, force: true });
  });

  test("allows symlinks pointing inside the sandbox", async () => {
    await fsp.writeFile(path.join(sandboxDir, "real.txt"), "content");
    await fsp.symlink(path.join(sandboxDir, "real.txt"), path.join(sandboxDir, "link.txt"));
    await assert.doesNotReject(() => checkSymlinkEscape(path.join(sandboxDir, "link.txt"), config));
  });

  test("blocks symlinks pointing outside the sandbox", async () => {
    await fsp.writeFile(path.join(outsideDir, "secret.txt"), "secret");
    await fsp.symlink(path.join(outsideDir, "secret.txt"), path.join(sandboxDir, "escape.txt"));
    await assert.rejects(
      () => checkSymlinkEscape(path.join(sandboxDir, "escape.txt"), config),
      { code: "SYMLINK_ESCAPE" }
    );
  });

  test("blocks directory symlinks pointing outside", async () => {
    await fsp.symlink(outsideDir, path.join(sandboxDir, "escape-dir"));
    await assert.rejects(
      () => checkSymlinkEscape(path.join(sandboxDir, "escape-dir"), config),
      { code: "SYMLINK_ESCAPE" }
    );
  });

  test("does not throw for non-existent paths", async () => {
    await assert.doesNotReject(() =>
      checkSymlinkEscape(path.join(sandboxDir, "nonexistent"), config)
    );
  });

  test("does not throw for regular files", async () => {
    await fsp.writeFile(path.join(sandboxDir, "regular.txt"), "content");
    await assert.doesNotReject(() =>
      checkSymlinkEscape(path.join(sandboxDir, "regular.txt"), config)
    );
  });
});

describe("sandbox: extension allow-list", () => {
  const config: SandboxConfig = {
    root: "/tmp/sandbox",
    allowedExtensions: ["txt", "md", "json"],
    maxFileSizeBytes: 10 * 1024 * 1024,
    readOnly: false,
  };

  test("allows listed extensions", () => {
    assert.equal(isExtensionAllowed("file.txt", config), true);
    assert.equal(isExtensionAllowed("file.md", config), true);
    assert.equal(isExtensionAllowed("file.json", config), true);
  });

  test("rejects unlisted extensions", () => {
    assert.equal(isExtensionAllowed("file.exe", config), false);
    assert.equal(isExtensionAllowed("file.sh", config), false);
    assert.equal(isExtensionAllowed("file.js", config), false);
  });

  test("rejects files with no extension", () => {
    assert.equal(isExtensionAllowed("README", config), false);
  });

  test("allows all extensions when wildcard", () => {
    const wildcardConfig: SandboxConfig = { ...config, allowedExtensions: "*" };
    assert.equal(isExtensionAllowed("file.exe", wildcardConfig), true);
    assert.equal(isExtensionAllowed("file.txt", wildcardConfig), true);
    assert.equal(isExtensionAllowed("README", wildcardConfig), true);
  });

  test("case-insensitive matching", () => {
    assert.equal(isExtensionAllowed("file.TXT", config), true);
    assert.equal(isExtensionAllowed("file.JSON", config), true);
  });
});

describe("sandbox: file size limits", () => {
  const config: SandboxConfig = {
    root: "/tmp/sandbox",
    allowedExtensions: "*",
    maxFileSizeBytes: 1024,
    readOnly: false,
  };

  test("allows files under the limit", () => {
    assert.doesNotThrow(() => checkFileSize(512, config));
    assert.doesNotThrow(() => checkFileSize(1024, config));
  });

  test("rejects files over the limit", () => {
    assert.throws(() => checkFileSize(1025, config), { code: "FILE_TOO_LARGE" });
    assert.throws(() => checkFileSize(10 * 1024 * 1024, config), { code: "FILE_TOO_LARGE" });
  });
});

describe("sandbox: read-only mode", () => {
  test("allows operations in writable mode", () => {
    const writableConfig: SandboxConfig = {
      root: "/tmp/sandbox",
      allowedExtensions: "*",
      maxFileSizeBytes: 1024,
      readOnly: false,
    };
    assert.doesNotThrow(() => enforceWritable(writableConfig));
  });

  test("blocks write operations in read-only mode", () => {
    const readOnlyConfig: SandboxConfig = {
      root: "/tmp/sandbox",
      allowedExtensions: "*",
      maxFileSizeBytes: 1024,
      readOnly: true,
    };
    assert.throws(() => enforceWritable(readOnlyConfig), { code: "READ_ONLY" });
  });
});
