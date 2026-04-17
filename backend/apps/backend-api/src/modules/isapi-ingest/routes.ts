import type { FastifyInstance, FastifyRequest } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";

interface HikEvent {
  ipAddress?: string;
  eventType?: string;
  channelID?: number;
  dateTime?: string;
  activePostCount?: number;
  [k: string]: unknown;
}

function parseXmlEvent(xml: string): HikEvent {
  const pick = (tag: string) => {
    const m = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, "i"));
    return m ? m[1]!.trim() : undefined;
  };
  return {
    ipAddress: pick("ipAddress"),
    eventType: pick("eventType") ?? pick("eventState"),
    channelID: pick("channelID") ? Number(pick("channelID")) : undefined,
    dateTime: pick("dateTime"),
    activePostCount: pick("activePostCount")
      ? Number(pick("activePostCount"))
      : undefined,
  };
}

function parseJsonEvent(body: unknown): HikEvent {
  if (!body || typeof body !== "object") return {};
  const b = body as Record<string, unknown>;
  return {
    ipAddress: b.ipAddress as string | undefined,
    eventType: (b.eventType ?? b.eventState) as string | undefined,
    channelID: typeof b.channelID === "number" ? b.channelID : undefined,
    dateTime: b.dateTime as string | undefined,
  };
}

export async function registerIsapiIngestRoutes(app: FastifyInstance) {
  // Hikvision DVRs POST events as application/xml or multipart. Register parsers.
  app.addContentTypeParser(
    ["application/xml", "text/xml", "application/octet-stream"],
    { parseAs: "string" },
    (_req, body, done) => done(null, body),
  );
  // Hikvision DVRs push events here via HTTP Host Notification.
  // Path fixed: /isapi/event (must also be allowed publicly with basic/digest auth).
  app.post("/event", async (request: FastifyRequest, reply) => {
    const contentType = request.headers["content-type"] ?? "";
    let parsed: HikEvent = {};
    let rawXml: string | null = null;
    let rawJson: unknown = null;

    if (contentType.includes("xml")) {
      rawXml = (request.body as string) ?? "";
      parsed = parseXmlEvent(rawXml);
    } else if (contentType.includes("json")) {
      rawJson = request.body;
      parsed = parseJsonEvent(request.body);
    } else if (contentType.includes("multipart")) {
      // Multipart: XML part + snapshot
      // Fastify @fastify/multipart would be needed for full parsing
      rawJson = { note: "multipart_received", headers: request.headers };
    } else {
      rawJson = { raw: String(request.body ?? "").slice(0, 500) };
    }

    const sourceIp =
      (request.headers["x-forwarded-for"] as string | undefined)
        ?.split(",")[0]
        ?.trim() ?? request.ip;

    // Correlate to device by source IP
    const deviceRow = parsed.ipAddress
      ? await db.execute(sql`
          SELECT id FROM devices
          WHERE ip_address = ${parsed.ipAddress} OR ip_address = ${sourceIp}
          ORDER BY (ip_address = ${parsed.ipAddress})::int DESC
          LIMIT 1
        `)
      : await db.execute(sql`
          SELECT id FROM devices WHERE ip_address = ${sourceIp} LIMIT 1
        `);
    const deviceId = (deviceRow as unknown as { id: string }[])[0]?.id ?? null;

    const eventType = parsed.eventType ?? "unknown";
    const severity = /motion|field|line/i.test(eventType)
      ? "medium"
      : /tamper|forced/i.test(eventType)
        ? "high"
        : "low";

    const defaultTenant = "a0000000-0000-0000-0000-000000000001";
    await db.execute(
      sql`SELECT set_config('app.tenant_id', ${defaultTenant}, true)`,
    );
    await db.execute(sql`
      INSERT INTO isapi_events (
        id, tenant_id, device_id, event_type, channel_id, severity,
        occurred_at, source_ip, raw_xml, raw_json
      ) VALUES (
        gen_random_uuid(),
        ${defaultTenant}::uuid,
        ${deviceId}::uuid,
        ${eventType},
        ${parsed.channelID ?? null},
        ${severity},
        ${parsed.dateTime ?? new Date().toISOString()}::timestamptz,
        ${sourceIp}::inet,
        ${rawXml},
        ${rawJson ? JSON.stringify(rawJson) : null}::jsonb
      )
    `);

    return reply.code(200).send({ ok: true });
  });

  // Health probe for DVRs (Hik sends HEAD before first POST)
  app.head("/event", async (_request, reply) => reply.code(200).send());
  app.get("/health", async () => ({ status: "ok", module: "isapi-ingest" }));
}
