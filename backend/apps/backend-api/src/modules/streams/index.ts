import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "../../plugins/auth.js";
import { db } from "../../db/client.js";

const GO2RTC_API = process.env.GO2RTC_API_URL ?? "http://127.0.0.1:1984/api";
const PUBLIC_HOST = process.env.PUBLIC_HOST ?? "aionseg.co";

interface Go2RtcStream {
  producers?: Array<{ url: string; state?: string }>;
  consumers?: Array<{ url: string; state?: string }>;
}

const listStreamsQuery = z.object({
  device_id: z.string().uuid().optional(),
  site_id: z.string().uuid().optional(),
});
type ListStreamsQuery = z.infer<typeof listStreamsQuery>;

const playbackQuery = z.object({
  format: z.enum(["hls", "mse", "webrtc", "rtsp"]).optional().default("hls"),
  quality: z.enum(["main", "sub", "third", "auto"]).optional().default("main"),
});
type PlaybackQuery = z.infer<typeof playbackQuery>;

const ptzSchema = z.object({
  action: z.enum([
    "up",
    "down",
    "left",
    "right",
    "zoom_in",
    "zoom_out",
    "stop",
    "preset",
  ]),
  speed: z.number().int().min(1).max(7).optional().default(4),
  preset_id: z.number().int().min(1).max(256).optional(),
  duration_ms: z.number().int().min(100).max(5000).optional().default(500),
});

async function fetchGo2rtcStreams(): Promise<Record<string, Go2RtcStream>> {
  const r = await fetch(`${GO2RTC_API}/streams`);
  if (!r.ok) throw new Error(`go2rtc /streams HTTP ${r.status}`);
  return (await r.json()) as Record<string, Go2RtcStream>;
}

function resolveStreamKey(
  deviceName: string,
  brand: string,
  channel: number,
): string[] {
  const name = deviceName.toLowerCase();
  const candidates: string[] = [];

  if (brand === "dahua") {
    candidates.push(`dh-${name.replace(/\s+/g, "-")}-ch${channel}`);
    candidates.push(`da-${name.replace(/\s+/g, "-")}-ch${channel}`);
    // Imou Cloud sometimes uses double-z terrazzino vs terrazino in inventory
    candidates.push(
      `da-${name.replace(/\s+/g, "-").replace(/z/g, "zz")}-ch${channel}`,
    );
    candidates.push(
      `da-${name.replace(/\s+/g, "-").replace(/zz/g, "z")}-ch${channel}`,
    );
  }

  if (brand === "hikvision") {
    // Nuevos streams exec: hk-<slug>-ch<n>
    const slug = name
      .replace(/^(nvr|dvr|ac|lpr|cam)\s+/i, "")
      .replace(/\s+/g, "-");
    const typePrefix = /^(nvr|dvr|ac|lpr|cam)/i.exec(name)?.[1]?.toLowerCase();
    if (typePrefix === "nvr" || typePrefix === "dvr") {
      candidates.push(`hk-${slug}-${typePrefix}-ch${channel}`);
      candidates.push(`hk-${slug}-ch${channel}`);
    } else if (typePrefix === "lpr") {
      candidates.push(`hk-lpr-${slug}-ch${channel}`);
    } else if (typePrefix === "cam") {
      candidates.push(`hk-cam-${slug}-ch${channel}`);
    } else {
      candidates.push(`hk-${slug}-ch${channel}`);
    }
    // Fallback name original
    candidates.push(`hk-${name.replace(/\s+/g, "-")}-ch${channel}`);
  }

  // Legacy aion_XXXDVR001 format
  const compact = deviceName.replace(/\s+/g, "").toUpperCase();
  candidates.push(`aion_${compact}${channel.toString().padStart(3, "0")}`);

  return [...new Set(candidates)];
}

function buildPlaybackUrl(
  streamKey: string,
  format: string,
  publicHost: string,
): string {
  const enc = encodeURIComponent(streamKey);
  switch (format) {
    case "mse":
      return `wss://${publicHost}/go2rtc/api/ws?src=${enc}`;
    case "webrtc":
      return `https://${publicHost}/go2rtc/api/webrtc?src=${enc}`;
    case "rtsp":
      return `rtsp://${publicHost}:8554/${streamKey}`;
    case "hls":
    default:
      return `https://${publicHost}/go2rtc/api/stream.m3u8?src=${enc}`;
  }
}

type DeviceRow = {
  id: string;
  name: string;
  brand: string;
  channels: number;
  status: string;
  last_seen: string | null;
  site_id: string | null;
  site_name: string | null;
};

export async function registerStreamsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ListStreamsQuery }>(
    "/list",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request, reply) => {
      const q = listStreamsQuery.parse(request.query);
      const streams = await fetchGo2rtcStreams().catch(() => ({}));
      const streamKeys = Object.keys(streams);

      const deviceFilter = q.device_id
        ? sql`AND d.id = ${q.device_id}::uuid`
        : q.site_id
          ? sql`AND d.site_id = ${q.site_id}::uuid`
          : sql``;

      const devices = await db.execute(sql`
        SELECT d.id, d.name, d.brand, d.channels, d.status, d.last_seen,
               s.id AS site_id, s.name AS site_name
        FROM devices d
        LEFT JOIN sites s ON s.id = d.site_id
        WHERE d.brand IN ('hikvision','dahua')
        ${deviceFilter}
        ORDER BY s.name NULLS LAST, d.name
      `);

      const data = (devices as unknown as DeviceRow[]).map((d) => {
        const activeStreams: Array<{ channel: number; stream_key: string }> =
          [];
        for (let ch = 1; ch <= Math.min(d.channels || 16, 32); ch++) {
          const candidates = resolveStreamKey(d.name, d.brand, ch);
          const found = candidates.find((k) => streamKeys.includes(k));
          if (found) activeStreams.push({ channel: ch, stream_key: found });
        }
        return {
          device_id: d.id,
          device_name: d.name,
          brand: d.brand,
          site_id: d.site_id,
          site_name: d.site_name,
          status: d.status,
          last_seen: d.last_seen,
          total_channels: d.channels,
          active_channels: activeStreams.length,
          streams: activeStreams,
        };
      });

      return reply.send({
        success: true,
        data,
        meta: { total_streams: streamKeys.length, devices: data.length },
      });
    },
  );

  app.get<{
    Params: { device_id: string; channel: string };
    Querystring: PlaybackQuery;
  }>(
    "/:device_id/channel/:channel/playback",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request, reply) => {
      const q = playbackQuery.parse(request.query);
      const ch = parseInt(request.params.channel, 10);

      const rows = await db.execute(sql`
        SELECT id, name, brand FROM devices WHERE id = ${request.params.device_id}::uuid LIMIT 1
      `);
      const device = (
        rows as unknown as Array<{ id: string; name: string; brand: string }>
      )[0];
      if (!device)
        return reply
          .code(404)
          .send({ success: false, error: "Device not found" });

      const streams = await fetchGo2rtcStreams().catch(() => ({}));
      const streamKeys = Object.keys(streams);
      const candidates = resolveStreamKey(device.name, device.brand, ch);
      const found = candidates.find((k) => streamKeys.includes(k));

      if (!found) {
        return reply.code(404).send({
          success: false,
          error: "Stream not available",
          candidates,
        });
      }

      return reply.send({
        success: true,
        data: {
          device_id: device.id,
          device_name: device.name,
          channel: ch,
          quality: q.quality,
          format: q.format,
          stream_key: found,
          playback_url: buildPlaybackUrl(found, q.format, PUBLIC_HOST),
        },
      });
    },
  );

  app.post<{
    Params: { device_id: string; channel: string };
    Body: z.infer<typeof ptzSchema>;
  }>(
    "/:device_id/channel/:channel/ptz",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request, reply) => {
      const body = ptzSchema.parse(request.body);
      const ch = parseInt(request.params.channel, 10);

      const rows = await db.execute(sql`
        SELECT id, name FROM devices WHERE id = ${request.params.device_id}::uuid LIMIT 1
      `);
      const device = (
        rows as unknown as Array<{ id: string; name: string }>
      )[0];
      if (!device)
        return reply
          .code(404)
          .send({ success: false, error: "Device not found" });

      await request.audit("stream.ptz.command", "devices", device.id, {
        channel: ch,
        action: body.action,
        speed: body.speed,
      });

      return reply.send({
        success: true,
        data: {
          command_id: `ptz_${device.id.slice(0, 8)}_${Date.now()}`,
          device: device.name,
          queued: true,
        },
      });
    },
  );
}
