/**
 * Structured logger that writes to stderr.
 *
 * CRITICAL: MCP servers using stdio transport must NEVER write to stdout.
 * stdout is reserved for JSON-RPC messages. Any log output to stdout
 * will corrupt the protocol stream and break the client connection.
 *
 * This logger writes JSON to stderr, which clients capture and display
 * in their debug/developer consoles.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  process.stderr.write(JSON.stringify(entry) + "\n");
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
