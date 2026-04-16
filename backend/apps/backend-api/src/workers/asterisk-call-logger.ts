/**
 * Asterisk Call Logger — Standalone PM2 process
 *
 * Connects to Asterisk Manager Interface (AMI) via raw TCP, listens for
 * call events, and persists completed calls to `intercom_calls` table.
 *
 * Run via:
 *   pm2 start dist/workers/asterisk-call-logger.js --name asterisk-call-logger
 *
 * Environment:
 *   DATABASE_URL       — PostgreSQL connection string (required)
 *   AMI_HOST           — Asterisk AMI host (default: 127.0.0.1)
 *   AMI_PORT           — Asterisk AMI port (default: 5038)
 *   AMI_USER           — AMI manager user (default: aionapi)
 *   AMI_SECRET         — AMI manager secret (required)
 *   TENANT_ID          — Default tenant (default: a0000000-...)
 *   ENABLE_CALL_LOGGER — Set to 'true' to enable (default: false)
 */
import "dotenv/config";
import net from "net";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql as dsql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
const AMI_HOST = process.env.AMI_HOST || "127.0.0.1";
const AMI_PORT = parseInt(process.env.AMI_PORT || "5038", 10);
const AMI_USER = process.env.AMI_USER || "aionapi";
const AMI_SECRET = process.env.AMI_SECRET || "";
const TENANT_ID =
  process.env.TENANT_ID || "a0000000-0000-0000-0000-000000000001";
const ENABLED = process.env.ENABLE_CALL_LOGGER === "true";

const log = {
  info: (...args: unknown[]) =>
    console.log("[call-logger]", new Date().toISOString(), ...args),
  warn: (...args: unknown[]) =>
    console.warn("[call-logger]", new Date().toISOString(), ...args),
  error: (...args: unknown[]) =>
    console.error("[call-logger]", new Date().toISOString(), ...args),
};

if (!ENABLED) {
  log.info(
    "ENABLE_CALL_LOGGER is not 'true'. Worker idle. Set ENABLE_CALL_LOGGER=true to activate.",
  );
  setInterval(() => {}, 60_000);
  // eslint-disable-next-line unicorn/no-process-exit
  process.exitCode = 0;
}

if (!DATABASE_URL) {
  log.error("DATABASE_URL is required");
  process.exit(1);
}

if (!AMI_SECRET) {
  log.warn("AMI_SECRET is empty — AMI login will likely fail");
}

const pgClient = postgres(DATABASE_URL, { max: 3 });
const db = drizzle(pgClient);

interface ActiveCall {
  uniqueId: string;
  channel: string;
  callerIdNum: string;
  callerIdName: string;
  connectedLineNum: string;
  startedAt: Date;
  direction: "inbound" | "outbound";
}

const activeCalls = new Map<string, ActiveCall>();
let reconnectDelay = 1000;

function parseAmiMessage(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split("\r\n")) {
    const idx = line.indexOf(": ");
    if (idx > 0) {
      result[line.slice(0, idx)] = line.slice(idx + 2);
    }
  }
  return result;
}

function inferDirection(channel: string): "inbound" | "outbound" {
  if (channel.includes("from-trunk") || channel.includes("from-pstn")) {
    return "inbound";
  }
  return "outbound";
}

async function resolveDeviceId(sipUri: string): Promise<string | null> {
  try {
    const rows = await db.execute(dsql`
      SELECT id FROM intercom_devices
      WHERE sip_uri ILIKE ${"%" + sipUri + "%"}
      LIMIT 1
    `);
    const row = (rows as unknown as Array<{ id: string }>)[0];
    return row?.id ?? null;
  } catch {
    return null;
  }
}

async function persistCall(call: ActiveCall, endedAt: Date): Promise<void> {
  const durationSec = Math.round(
    (endedAt.getTime() - call.startedAt.getTime()) / 1000,
  );
  const deviceId = await resolveDeviceId(
    call.callerIdNum || call.connectedLineNum,
  );

  try {
    await db.execute(dsql`
      INSERT INTO intercom_calls (tenant_id, device_id, direction, duration_seconds, attended_by, status, notes, created_at)
      VALUES (
        ${TENANT_ID},
        ${deviceId},
        ${call.direction},
        ${durationSec},
        'system',
        'completed',
        ${`AMI: ${call.channel} ${call.callerIdNum} → ${call.connectedLineNum}`},
        ${call.startedAt.toISOString()}
      )
    `);
    log.info(
      `Persisted call: ${call.callerIdNum} → ${call.connectedLineNum} (${durationSec}s, ${call.direction})`,
    );
  } catch (err) {
    log.error("Failed to persist call:", (err as Error).message);
  }
}

function handleAmiEvent(msg: Record<string, string>): void {
  const event = msg.Event;
  if (!event) return;

  if (event === "Newchannel" || event === "DialBegin") {
    const uid = msg.Uniqueid || msg.DestUniqueid;
    if (!uid || activeCalls.has(uid)) return;

    activeCalls.set(uid, {
      uniqueId: uid,
      channel: msg.Channel || "",
      callerIdNum: msg.CallerIDNum || "",
      callerIdName: msg.CallerIDName || "",
      connectedLineNum: msg.ConnectedLineNum || msg.DestCallerIDNum || "",
      startedAt: new Date(),
      direction: inferDirection(msg.Channel || ""),
    });
  }

  if (event === "Hangup") {
    const uid = msg.Uniqueid;
    if (!uid) return;
    const call = activeCalls.get(uid);
    if (call) {
      activeCalls.delete(uid);
      persistCall(call, new Date()).catch((e) =>
        log.error("persistCall error:", e),
      );
    }
  }
}

function connect(): void {
  log.info(`Connecting to AMI ${AMI_HOST}:${AMI_PORT}...`);

  const socket = new net.Socket();
  let buffer = "";
  let loggedIn = false;

  socket.connect(AMI_PORT, AMI_HOST, () => {
    log.info("TCP connected, sending login...");
    socket.write(
      `Action: Login\r\nUsername: ${AMI_USER}\r\nSecret: ${AMI_SECRET}\r\nEvents: call\r\n\r\n`,
    );
  });

  socket.on("data", (data) => {
    buffer += data.toString();
    const messages = buffer.split("\r\n\r\n");
    buffer = messages.pop() || "";

    for (const raw of messages) {
      if (!raw.trim()) continue;
      const msg = parseAmiMessage(raw);

      if (msg.Response === "Success" && !loggedIn) {
        loggedIn = true;
        reconnectDelay = 1000;
        log.info("AMI login successful. Listening for call events...");
      }

      if (msg.Response === "Error") {
        log.error("AMI login failed:", msg.Message);
      }

      if (msg.Event) {
        handleAmiEvent(msg);
      }
    }
  });

  socket.on("error", (err) => {
    log.error("AMI socket error:", err.message);
  });

  socket.on("close", () => {
    loggedIn = false;
    log.warn(`AMI disconnected. Reconnecting in ${reconnectDelay / 1000}s...`);
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
  });
}

if (ENABLED) {
  log.info("Asterisk Call Logger starting...");
  connect();
}
