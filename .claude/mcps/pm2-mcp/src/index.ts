#!/usr/bin/env node
import { spawn } from "node:child_process";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const SSH_HOST = process.env.PM2_MCP_SSH_HOST ?? "aion-vps";
const MAX_LOG_LINES = 500;

// Allowlist of PM2 actions. "start" and "restart" only permit names matching
// a strict regex, preventing injection of arbitrary paths or JSON configs.
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

const ALLOWLIST: Record<string, (args: Record<string, unknown>) => string[]> = {
  list: () => ["pm2", "jlist"],
  status: () => ["pm2", "status", "--no-colors"],
  logs: (args) => {
    const name = z.string().regex(NAME_RE).parse(args.name);
    const lines = z
      .number()
      .int()
      .positive()
      .max(MAX_LOG_LINES)
      .default(100)
      .parse(args.lines ?? 100);
    return [
      "pm2",
      "logs",
      name,
      "--lines",
      String(lines),
      "--nostream",
      "--no-colors",
    ];
  },
  restart: (args) => {
    const name = z.string().regex(NAME_RE).parse(args.name);
    return ["pm2", "restart", name];
  },
  stop: (args) => {
    const name = z.string().regex(NAME_RE).parse(args.name);
    return ["pm2", "stop", name];
  },
  start: (args) => {
    const name = z.string().regex(NAME_RE).parse(args.name);
    return ["pm2", "start", name];
  },
  describe: (args) => {
    const name = z.string().regex(NAME_RE).parse(args.name);
    return ["pm2", "describe", name, "--no-colors"];
  },
};

const DESCRIPTIONS: Record<string, string> = {
  list: "JSON list of all PM2 processes (jlist).",
  status: "Human-readable pm2 status table.",
  logs: "Tail logs for one process. args: {name, lines<=500}.",
  restart: "Restart one process by name. Name must match [a-z0-9_-].",
  stop: "Stop one process by name.",
  start: "Start a previously-registered process by name.",
  describe: "Detailed description of one process (memory, restarts, env).",
};

async function sshRun(
  argv: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("ssh", [SSH_HOST, "--", ...argv], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? -1 }));
    setTimeout(() => child.kill("SIGKILL"), 20_000);
  });
}

const server = new Server(
  { name: "pm2-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.keys(ALLOWLIST).map((name) => ({
    name,
    description: DESCRIPTIONS[name],
    inputSchema: {
      type: "object",
      properties:
        name === "logs"
          ? { name: { type: "string" }, lines: { type: "number" } }
          : name === "list" || name === "status"
            ? {}
            : { name: { type: "string" } },
      required: name === "list" || name === "status" ? [] : ["name"],
      additionalProperties: false,
    },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const builder = ALLOWLIST[req.params.name];
  if (!builder) throw new Error(`Unknown/blocked tool: ${req.params.name}`);
  try {
    const argv = builder(req.params.arguments ?? {});
    const { stdout, stderr, code } = await sshRun(argv);
    return {
      isError: code !== 0,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              argv,
              code,
              stdout: stdout.slice(0, 20_000),
              stderr: stderr.slice(0, 4_000),
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${message}` }],
    };
  }
});

await server.connect(new StdioServerTransport());
process.stderr.write(`[pm2-mcp] ready (ssh host=${SSH_HOST})\n`);
