#!/usr/bin/env node

/**
 * Time & Timezone MCP Server
 * 
 * A practical example MCP server that provides:
 * - Get current time in any timezone
 * - Convert times between timezones
 * - Get timezone information
 * - List common timezones
 * 
 * This demonstrates: tool registration, Zod validation, error handling,
 * and clean code structure — all without external API dependencies.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// ── Schemas ───────────────────────────────────────────────────

const GetCurrentTimeSchema = z.object({
  timezone: z
    .string()
    .optional()
    .describe("IANA timezone (e.g. 'America/New_York'). Defaults to UTC."),
});

const ConvertTimeSchema = z.object({
  time: z
    .string()
    .describe("ISO 8601 time string (e.g. '2024-01-15T10:00:00Z')"),
  from: z.string().describe("Source IANA timezone"),
  to: z.string().describe("Target IANA timezone"),
});

const GetTimezoneInfoSchema = z.object({
  timezone: z.string().describe("IANA timezone (e.g. 'Europe/London')"),
});

// ── Helpers ───────────────────────────────────────────────────

function getTimeInTimezone(timezone?: string): string {
  const now = new Date();
  if (!timezone) {
    return now.toISOString();
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "long",
      hour12: false,
    }).format(now);
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
}

function convertTime(time: string, from: string, to: string): string {
  // Parse the input time in the source timezone
  const date = new Date(time);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid time format: ${time}. Use ISO 8601.`);
  }

  // Format in both timezones
  const fromTime = new Intl.DateTimeFormat("en-US", {
    timeZone: from,
    dateStyle: "full",
    timeStyle: "long",
  }).format(date);

  const toTime = new Intl.DateTimeFormat("en-US", {
    timeZone: to,
    dateStyle: "full",
    timeStyle: "long",
  }).format(date);

  return `${fromTime}\n→ ${toTime}`;
}

function getTimezoneInfo(timezone: string) {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "long",
    });
    const parts = formatter.formatToParts(now);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value || timezone;

    // Calculate offset
    const localTime = new Date(
      now.toLocaleString("en-US", { timeZone: timezone })
    );
    const utcTime = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const offsetHours = Math.round(
      (localTime.getTime() - utcTime.getTime()) / 3600000
    );

    return {
      timezone,
      name: tzName,
      utcOffset: `UTC${offsetHours >= 0 ? "+" : ""}${offsetHours}`,
      currentTime: getTimeInTimezone(timezone),
    };
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
}

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];

// ── Server ────────────────────────────────────────────────────

const server = new Server(
  { name: "time-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get-current-time",
      description:
        "Get the current time. Optionally specify a timezone (IANA format like 'America/New_York'). Returns UTC by default.",
      inputSchema: {
        type: "object",
        properties: {
          timezone: {
            type: "string",
            description: "IANA timezone (e.g. 'America/New_York', 'Europe/London')",
          },
        },
      },
    },
    {
      name: "convert-time",
      description:
        "Convert a time from one timezone to another. Provide an ISO 8601 time string and source/target timezones.",
      inputSchema: {
        type: "object",
        properties: {
          time: {
            type: "string",
            description: "ISO 8601 time (e.g. '2024-01-15T10:00:00Z')",
          },
          from: { type: "string", description: "Source IANA timezone" },
          to: { type: "string", description: "Target IANA timezone" },
        },
        required: ["time", "from", "to"],
      },
    },
    {
      name: "get-timezone-info",
      description:
        "Get detailed information about a timezone: its name, UTC offset, and current time.",
      inputSchema: {
        type: "object",
        properties: {
          timezone: { type: "string", description: "IANA timezone" },
        },
        required: ["timezone"],
      },
    },
    {
      name: "list-timezones",
      description: "List common IANA timezones that are supported.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get-current-time": {
        const { timezone } = GetCurrentTimeSchema.parse(args);
        const time = getTimeInTimezone(timezone);
        return {
          content: [{ type: "text", text: time }],
        };
      }

      case "convert-time": {
        const { time, from, to } = ConvertTimeSchema.parse(args);
        const result = convertTime(time, from, to);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "get-timezone-info": {
        const { timezone } = GetTimezoneInfoSchema.parse(args);
        const info = getTimezoneInfo(timezone);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      }

      case "list-timezones": {
        return {
          content: [
            {
              type: "text",
              text: COMMON_TIMEZONES.join("\n"),
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// ── Start ─────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[time-server] Running on stdio");
