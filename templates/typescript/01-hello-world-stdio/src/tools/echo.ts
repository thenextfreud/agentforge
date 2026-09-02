import { z } from "zod";
import { wrapHandler } from "../lib/errors.js";

export const echoTool = {
  name: "echo",
  description: "Echo back the provided message. Useful for testing that the MCP server is connected and responding.",
  schema: {
    message: z.string().describe("The message to echo back"),
    uppercase: z.boolean().optional().default(false).describe("If true, convert the message to uppercase"),
  },

  handler: wrapHandler(async (args: { message: string; uppercase?: boolean }) => {
    const text = args.uppercase ? args.message.toUpperCase() : args.message;
    return text;
  }),
};
