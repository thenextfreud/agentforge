/**
 * Error handling utilities for MCP tool responses.
 *
 * MCP tools return content arrays. Errors should be structured
 * so the AI client can understand and act on them.
 */

export interface ToolError {
  code: string;
  message: string;
  details?: unknown;
}

export function success(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

export function failure(error: ToolError) {
  return {
    content: [
      {
        type: "text" as const,
        text: `Error [${error.code}]: ${error.message}`,
      },
    ],
    isError: true,
  };
}

export function wrapHandler<TArgs extends Record<string, unknown>>(
  handler: (args: TArgs) => Promise<string>
) {
  return async (args: TArgs) => {
    try {
      const result = await handler(args);
      return success(result);
    } catch (err) {
      const error = err as Error;
      return failure({
        code: "TOOL_ERROR",
        message: error.message,
        details: error.stack,
      });
    }
  };
}
