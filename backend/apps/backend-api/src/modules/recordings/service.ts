import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";

export interface RecordingItem {
  track_id: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  size_bytes: number | null;
  download_url: string | null;
}

export interface PlaybackSession {
  session_id: string;
  playback_url: string;
  mode: "hls" | "mp4" | "unavailable";
  expires_at: string;
  message?: string;
}

interface DeviceMeta {
  id: string;
  brand: string | null;
  ip_address: string | null;
  port: number | null;
  rtsp_port: number | null;
  serial_number: string | null;
}

async function loadDevice(deviceId: string): Promise<DeviceMeta | null> {
  const rows = await db.execute(sql`
    SELECT id, brand, ip_address, port, rtsp_port, serial_number
    FROM devices
    WHERE id = ${deviceId}
      AND deleted_at IS NULL
    LIMIT 1
  `);
  return (rows as unknown as DeviceMeta[])[0] ?? null;
}

function isoToHik(iso: string): string {
  return iso
    .replace(/[-:]/g, "")
    .replace(/\.\d+/, "")
    .replace("T", "T")
    .replace("Z", "Z");
}

export const recordingsService = {
  async search(
    deviceId: string,
    channel: number,
    from: string,
    to: string,
  ): Promise<RecordingItem[]> {
    const device = await loadDevice(deviceId);
    if (!device) return [];

    if (device.brand === "hikvision" && device.ip_address) {
      return this.searchHikvision(device, channel, from, to);
    }
    if (device.brand === "dahua" && device.serial_number) {
      return this.searchDahuaP2P(device, channel, from, to);
    }
    return [];
  },

  async searchHikvision(
    _device: DeviceMeta,
    channel: number,
    from: string,
    to: string,
  ): Promise<RecordingItem[]> {
    // Hikvision ISAPI compact time fmt (reserved for future ContentMgmt/search query)
    void isoToHik(from);
    void isoToHik(to);
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    return [
      {
        track_id: `${channel}01`,
        start_time: from,
        end_time: to,
        duration_seconds: Math.max(0, Math.round((toMs - fromMs) / 1000)),
        size_bytes: null,
        download_url: null,
      },
    ];
  },

  async searchDahuaP2P(
    _device: DeviceMeta,
    _channel: number,
    _from: string,
    _to: string,
  ): Promise<RecordingItem[]> {
    return [];
  },

  async startPlayback(
    deviceId: string,
    channel: number,
    from: string,
    to: string,
    format: "hls" | "mp4",
    tenantId: string,
    operatorId: string,
  ): Promise<PlaybackSession> {
    const device = await loadDevice(deviceId);
    if (!device) {
      return {
        session_id: "",
        playback_url: "",
        mode: "unavailable",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        message: "Device not found",
      };
    }

    const sessionId = `${deviceId.slice(0, 8)}-${Date.now().toString(36)}`;
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

    if (device.brand === "hikvision" && device.ip_address && device.rtsp_port) {
      // Hikvision playback RTSP URL (requires go2rtc relay to serve HLS to the browser).
      // Format: rtsp://user:pass@host:554/Streaming/tracks/{channel}01?starttime=...&endtime=...
      const playbackRtsp = `rtsp://${device.ip_address}:${device.rtsp_port}/Streaming/tracks/${channel}01`;
      const playbackUrl =
        format === "hls"
          ? `/api/recordings/hls/${sessionId}.m3u8?start=${encodeURIComponent(from)}&end=${encodeURIComponent(to)}&src=${encodeURIComponent(playbackRtsp)}`
          : `/api/recordings/download/${sessionId}.mp4?start=${encodeURIComponent(from)}&end=${encodeURIComponent(to)}&src=${encodeURIComponent(playbackRtsp)}`;
      // Audit the playback creation
      await db.execute(sql`
        INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, metadata, created_at)
        VALUES (
          gen_random_uuid(), ${tenantId}, ${operatorId}::uuid,
          'recording.playback.request',
          'devices', ${deviceId},
          ${JSON.stringify({ channel, from, to, format, session_id: sessionId })}::jsonb,
          NOW()
        )
      `);
      return {
        session_id: sessionId,
        playback_url: playbackUrl,
        mode: format,
        expires_at: expiresAt,
      };
    }

    return {
      session_id: sessionId,
      playback_url: "",
      mode: "unavailable",
      expires_at: expiresAt,
      message: `Playback not yet implemented for brand='${device.brand ?? "unknown"}'`,
    };
  },
};
