#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const API = (process.env.GO2RTC_API_URL ?? "http://127.0.0.1:1984").replace(
  /\/$/,
  "",
);

async function api(path: string, init: RequestInit = {}): Promise<unknown> {
  const url = `${API}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(6000),
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`go2rtc ${res.status}: ${text.slice(0, 240)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const tools = [
  {
    name: "list_streams",
    description:
      "List all configured go2rtc streams. Returns keys + producer URLs.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => ({ streams: await api("/api/streams") }),
  },
  {
    name: "get_stream",
    description:
      "Get detail of a single stream, including producer status and consumer count.",
    inputSchema: {
      type: "object",
      properties: { src: { type: "string", description: "Stream key" } },
      required: ["src"],
      additionalProperties: false,
    },
    handler: async (args: Record<string, unknown>) => {
      const src = z.string().min(1).parse(args.src);
      return await api(`/api/streams?src=${encodeURIComponent(src)}&probe=1`);
    },
  },
  {
    name: "probe_hls",
    description:
      "Make a HEAD request to the stream's HLS endpoint and return HTTP status + ttfb ms.",
    inputSchema: {
      type: "object",
      properties: { src: { type: "string" } },
      required: ["src"],
      additionalProperties: false,
    },
    handler: async (args: Record<string, unknown>) => {
      const src = z.string().min(1).parse(args.src);
      const url = `${API}/api/stream.m3u8?src=${encodeURIComponent(src)}`;
      const start = performance.now();
      const res = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(4000),
      });
      return {
        status: res.status,
        ttfb_ms: Math.round(performance.now() - start),
        url,
      };
    },
  },
  {
    name: "reload_config",
    description:
      "Trigger go2rtc to re-read its yaml. Use after imou-refresh or yaml edits.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async () => ({
      ok: true,
      body: await api("/api/config", { method: "POST", body: "{}" }),
    }),
  },
];

const server = new Server(
  { name: "go2rtc-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = tools.find((t) => t.name === req.params.name);
  if (!tool) throw new Error(`Unknown tool: ${req.params.name}`);
  try {
    const result = await tool.handler(req.params.arguments ?? {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
process.stderr.write(`[go2rtc-mcp] ready (API=${API})\n`);
