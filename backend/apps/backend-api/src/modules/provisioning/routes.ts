/**
 * Fanvil Auto-Provisioning Routes
 *
 * Serves device configuration files for Fanvil phones and intercoms.
 * Devices fetch their config via HTTP using DHCP Option 66 or manual Auto-Provision URL.
 *
 * URL patterns:
 *   GET /provisioning/fanvil/{mac}.cfg  — Config by MAC address
 *   GET /provisioning/{mac}.cfg         — Legacy fallback
 *   GET /provisioning/status            — Service status (auth required)
 *
 * Config format: Fanvil P-code key=value pairs
 * NO authentication required for device endpoints — Fanvil phones fetch at boot.
 */
import type { FastifyInstance } from "fastify";
import { requireRole } from "../../plugins/auth.js";
import { db } from "../../db/client.js";
import { sql } from "drizzle-orm";
import { createLogger } from "@aion/common-utils";

const logger = createLogger({ name: "fanvil-provisioning" });

const SIP_SERVER = process.env.SIP_HOST || "18.230.40.6";
const SIP_PORT = process.env.SIP_PORT || "5060";
const SIP_TRANSPORT = process.env.SIP_TRANSPORT || "udp";

/** Map transport string to Fanvil numeric code */
function mapTransport(transport: string): string {
  const map: Record<string, string> = {
    udp: "0",
    tcp: "1",
    tls: "2",
    wss: "3",
  };
  return map[transport] || "0";
}

/** Generate Fanvil .cfg provisioning file */
function generateConfig(opts: {
  extension: string;
  password: string;
  displayName: string;
  isIntercom: boolean;
  relayDuration?: number;
  speedDial1?: string;
  speedDial2?: string;
}): string {
  const lines = [
    `# AION Vision Hub — Auto Provisioning`,
    `# Device: ${opts.displayName}`,
    `# Extension: ${opts.extension}`,
    `# Generated: ${new Date().toISOString()}`,
    "",
    "## SIP Account 1",
    `<<P-SIPServerAddr1>>=${SIP_SERVER}`,
    `<<P-SIPServerPort1>>=${SIP_PORT}`,
    `<<P-SIPTransport1>>=${mapTransport(SIP_TRANSPORT)}`,
    `<<P-SIPUser1>>=${opts.extension}`,
    `<<P-SIPAuthUser1>>=${opts.extension}`,
    `<<P-SIPAuthPwd1>>=${opts.password}`,
    `<<P-SIPDisplayName1>>=${opts.displayName}`,
    `<<P-SIPDomain1>>=${SIP_SERVER}`,
    "",
    "## Audio Codecs (G.711u, G.711a, G.722)",
    "<<P-Audio-Codec1>>=0",
    "<<P-Audio-Codec2>>=8",
    "<<P-Audio-Codec3>>=9",
    "",
    "## Auto Answer (intercoms answer immediately)",
    `<<P-AutoAnswerEnable>>=${opts.isIntercom ? "1" : "0"}`,
    "<<P-AutoAnswerDelay>>=0",
    "",
    "## Time",
    "<<P-NTPEnable>>=1",
    "<<P-NTPServer>>=pool.ntp.org",
    "<<P-TimeZone>>=GMT-5",
    "<<P-Language>>=es",
  ];

  if (opts.isIntercom) {
    lines.push(
      "",
      "## Door Relay",
      "<<P-DoorRelay1Enable>>=1",
      `<<P3292>>=${(opts.relayDuration ?? 5) * 1000}`,
      "<<P-DoorRelay1Type>>=0",
      "",
      "## Intercom Mode",
      "<<P-IntercomEnable>>=1",
      "<<P-IntercomMuteEnable>>=0",
      "<<P-IntercomToneEnable>>=1",
      "<<P-IntercomBargeEnable>>=1",
    );

    if (opts.speedDial1) {
      lines.push(
        "",
        "## Speed Dial Keys",
        "<<P-DSSKey1Type>>=0",
        `<<P-DSSKey1Value>>=${opts.speedDial1}`,
        "<<P-DSSKey1Label>>=Central AION",
      );
    }
    if (opts.speedDial2) {
      lines.push(
        "<<P-DSSKey2Type>>=0",
        `<<P-DSSKey2Value>>=${opts.speedDial2}`,
        "<<P-DSSKey2Label>>=Todos Operadores",
      );
    }
  }

  return lines.join("\n");
}

/** Normalize MAC: remove colons/dashes, lowercase, validate 12 hex chars */
function normalizeMac(raw: string): string | null {
  const clean = raw
    .replace(/\.cfg$/i, "")
    .replace(/[:\-. ]/g, "")
    .toLowerCase();
  return /^[0-9a-f]{12}$/.test(clean) ? clean : null;
}

/** Look up a device by MAC address across both tables */
async function findDeviceByMac(
  mac: string,
): Promise<Record<string, unknown> | null> {
  // Try intercom_devices first (config JSON may contain macAddress)
  const intercomResult = await db.execute(sql`
    SELECT name, sip_uri, config, brand
    FROM intercom_devices
    WHERE LOWER(REPLACE(COALESCE(config->>'macAddress', ''), ':', '')) = ${mac}
    LIMIT 1
  `);
  const intercomRows = intercomResult as unknown as Record<string, unknown>[];
  if (intercomRows.length > 0) return intercomRows[0];

  // Try devices table
  const deviceResult = await db.execute(sql`
    SELECT name, extension, mac_address, type
    FROM devices
    WHERE LOWER(REPLACE(COALESCE(mac_address, ''), ':', '')) = ${mac}
      AND type = 'intercom'
    LIMIT 1
  `);
  const deviceRows = deviceResult as unknown as Record<string, unknown>[];
  if (deviceRows.length > 0) return deviceRows[0];

  return null;
}

export async function registerProvisioningRoutes(app: FastifyInstance) {
  // ── Fanvil config by MAC (with /fanvil/ prefix) ────────────
  app.get<{ Params: { mac: string } }>(
    "/fanvil/:mac",
    async (request, reply) => {
      return serveFanvilConfig(request.params.mac, request.ip, reply);
    },
  );

  // ── Legacy: config by MAC (direct under /provisioning/) ────
  app.get<{ Params: { filename: string } }>(
    "/:filename",
    async (request, reply) => {
      // Skip if it's /status or other named routes
      if (request.params.filename === "status") return;
      return serveFanvilConfig(request.params.filename, request.ip, reply);
    },
  );

  // ── Status (auth required) ─────────────────────────────────
  app.get(
    "/status",
    {
      preHandler: [requireRole("operator", "tenant_admin", "super_admin")],
    },
    async (_request, reply) => {
      const countResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM intercom_devices`,
      );
      const count =
        (countResult as unknown as Array<{ count: string }>)[0]?.count || "0";

      return reply.send({
        success: true,
        data: {
          service: "fanvil-auto-provisioning",
          sipServer: SIP_SERVER,
          sipPort: SIP_PORT,
          transport: SIP_TRANSPORT,
          registeredDevices: parseInt(count, 10),
          provisioningUrl: `https://aionseg.co/provisioning/fanvil/{MAC}.cfg`,
          dhcpOption66: `https://aionseg.co/provisioning/fanvil/`,
        },
      });
    },
  );
}

/** Core handler shared by both routes */
async function serveFanvilConfig(
  rawParam: string,
  clientIp: string,
  reply: {
    code: (n: number) => any;
    type: (t: string) => any;
    header: (k: string, v: string) => any;
    send: (d: any) => any;
  },
) {
  const mac = normalizeMac(rawParam);
  if (!mac) {
    return reply.code(400).send("Invalid MAC address format");
  }

  logger.info({ mac, ip: clientIp }, "Fanvil provisioning request");

  const device = await findDeviceByMac(mac);

  if (!device) {
    logger.warn({ mac }, "Unknown device — returning default config");
    const cfg = generateConfig({
      extension: "299",
      password: "changeme",
      displayName: `AION Unknown (${mac})`,
      isIntercom: false,
    });
    return reply
      .type("text/plain")
      .header("Content-Disposition", `attachment; filename="${mac}.cfg"`)
      .send(cfg);
  }

  // Parse config and extension
  const configJson = (
    typeof device.config === "string"
      ? JSON.parse(device.config as string)
      : device.config || {}
  ) as Record<string, unknown>;

  const sipUri = (device.sip_uri as string) || "";
  const extension =
    (configJson.extension as string) ||
    (device.extension as string) ||
    sipUri.match(/sip:(\d+)@/)?.[1] ||
    "299";

  const isIntercom =
    configJson.deviceType === "intercom" || parseInt(extension, 10) >= 300;
  const doorConfig = configJson.doorRelay as
    | Record<string, unknown>
    | undefined;
  const speedDial = configJson.speedDial as Record<string, string> | undefined;

  const cfg = generateConfig({
    extension,
    password: `Ext.${extension}!`,
    displayName: (device.name as string) || `AION ${extension}`,
    isIntercom,
    relayDuration: (doorConfig?.duration as number) || 5,
    speedDial1: speedDial?.key1 || (isIntercom ? "099" : undefined),
    speedDial2: speedDial?.key2 || (isIntercom ? "199" : undefined),
  });

  logger.info({ mac, extension, name: device.name }, "Fanvil config served");

  return reply
    .type("text/plain")
    .header("Content-Disposition", `attachment; filename="${mac}.cfg"`)
    .send(cfg);
}
