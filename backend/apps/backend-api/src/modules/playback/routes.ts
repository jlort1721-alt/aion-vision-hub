import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { db } from '../../db/client.js';
import { sql } from 'drizzle-orm';
import { createLogger } from '@aion/common-utils';
import { z } from 'zod';
import crypto from 'crypto';

const logger = createLogger({ name: 'playback' });

const GO2RTC_BASE = process.env.GO2RTC_URL || 'http://localhost:1984';

const rangesQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
});

type RangesQuery = z.infer<typeof rangesQuerySchema>;

const streamQuerySchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
});

type StreamQuery = z.infer<typeof streamQuerySchema>;

/**
 * Build Hikvision ISAPI search XML for recording ranges on a given date.
 */
function buildIsapiSearchXml(channelId: number, date: string): string {
  const start = `${date}T00:00:00Z`;
  const end = `${date}T23:59:59Z`;
  return `<?xml version="1.0" encoding="utf-8"?>
<CMSearchDescription>
  <searchID>${crypto.randomUUID()}</searchID>
  <trackIDList><trackID>${channelId * 100 + 1}</trackID></trackIDList>
  <timeSpanList>
    <timeSpan>
      <startTime>${start}</startTime>
      <endTime>${end}</endTime>
    </timeSpan>
  </timeSpanList>
  <maxResults>200</maxResults>
  <searchResultPostion>0</searchResultPostion>
  <metadataList>
    <metadataDescriptor>//recordType.meta.std-cgi.com</metadataDescriptor>
  </metadataList>
</CMSearchDescription>`;
}

/**
 * Parse Hikvision ISAPI search response XML for time ranges.
 * Simple regex-based extraction (no external XML parser needed).
 */
function parseIsapiSearchResponse(xml: string): Array<{ start: string; end: string }> {
  const ranges: Array<{ start: string; end: string }> = [];
  const matchBlocks = xml.matchAll(/<searchMatchItem>([\s\S]*?)<\/searchMatchItem>/g);

  for (const block of matchBlocks) {
    const content = block[1];
    const startMatch = content.match(/<startTime>(.*?)<\/startTime>/);
    const endMatch = content.match(/<endTime>(.*?)<\/endTime>/);
    if (startMatch && endMatch) {
      ranges.push({ start: startMatch[1], end: endMatch[1] });
    }
  }

  return ranges;
}

export async function registerPlaybackRoutes(app: FastifyInstance) {
  // ── GET /:deviceId/ranges ── Get available recording ranges ──
  app.get<{ Params: { deviceId: string }; Querystring: RangesQuery }>(
    '/:deviceId/ranges',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Playback'],
        summary: 'Get available recording ranges for a device on a specific date',
        description: 'Queries the device (Hikvision ISAPI) for recording segments on the given date.',
      },
    },
    async (request, reply) => {
      const { deviceId } = request.params;
      const tenantId = request.tenantId;

      const query = rangesQuerySchema.parse(request.query);

      // Look up device with credentials
      const deviceRows = await db.execute(sql`
        SELECT id, brand, ip_address, port, username, password, channels
        FROM devices
        WHERE id = ${deviceId} AND tenant_id = ${tenantId}
        LIMIT 1
      `) as unknown as Array<{
        id: string;
        brand: string;
        ip_address: string;
        port: number;
        username: string | null;
        password: string | null;
        channels: number;
      }>;

      if (!deviceRows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found or not in your tenant' },
        });
      }

      const device = deviceRows[0];
      const brand = (device.brand || '').toLowerCase();

      // Currently only Hikvision ISAPI is supported for recording search
      if (!brand.includes('hikvision') && !brand.includes('hik')) {
        return reply.code(400).send({
          success: false,
          error: {
            code: 'UNSUPPORTED_BRAND',
            message: `Recording range search is currently supported for Hikvision devices. Detected brand: ${device.brand}`,
          },
        });
      }

      const ip = device.ip_address;
      const port = device.port || 80;

      if (!ip) {
        return reply.code(400).send({
          success: false,
          error: { code: 'NO_IP', message: 'Device has no IP address configured' },
        });
      }

      const searchXml = buildIsapiSearchXml(1, query.date);
      const authHeader = device.username
        ? `Basic ${Buffer.from(`${device.username}:${device.password || ''}`).toString('base64')}`
        : undefined;

      try {
        const resp = await fetch(`http://${ip}:${port}/ISAPI/ContentMgmt/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml',
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: searchXml,
          signal: AbortSignal.timeout(15000),
        });

        if (!resp.ok) {
          logger.error({ status: resp.status, deviceId }, 'ISAPI search failed');
          return reply.code(502).send({
            success: false,
            error: { code: 'ISAPI_ERROR', message: `Device returned HTTP ${resp.status}` },
          });
        }

        const responseXml = await resp.text();
        const ranges = parseIsapiSearchResponse(responseXml);

        logger.info({ deviceId, date: query.date, rangeCount: ranges.length }, 'Recording ranges retrieved');

        return reply.send({
          success: true,
          data: { deviceId, date: query.date, ranges },
        });
      } catch (err) {
        logger.error({ err, deviceId }, 'Failed to query recording ranges');
        return reply.code(502).send({
          success: false,
          error: { code: 'CONNECTION_FAILED', message: (err as Error).message },
        });
      }
    },
  );

  // ── GET /:deviceId/stream ── Get playback stream URL ─────────
  app.get<{ Params: { deviceId: string }; Querystring: StreamQuery }>(
    '/:deviceId/stream',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Playback'],
        summary: 'Get playback stream URLs for a device recording',
        description: 'Builds an RTSP playback URL, registers a temporary stream in go2rtc, and returns WebSocket/HLS/MP4 URLs.',
      },
    },
    async (request, reply) => {
      const { deviceId } = request.params;
      const tenantId = request.tenantId;

      const query = streamQuerySchema.parse(request.query);

      // Look up device with credentials
      const deviceRows = await db.execute(sql`
        SELECT id, brand, ip_address, rtsp_port, username, password, device_slug
        FROM devices
        WHERE id = ${deviceId} AND tenant_id = ${tenantId}
        LIMIT 1
      `) as unknown as Array<{
        id: string;
        brand: string;
        ip_address: string;
        rtsp_port: number | null;
        username: string | null;
        password: string | null;
        device_slug: string | null;
      }>;

      if (!deviceRows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found or not in your tenant' },
        });
      }

      const device = deviceRows[0];
      const ip = device.ip_address;
      const rtspPort = device.rtsp_port || 554;
      const brand = (device.brand || '').toLowerCase();

      if (!ip) {
        return reply.code(400).send({
          success: false,
          error: { code: 'NO_IP', message: 'Device has no IP address configured' },
        });
      }

      // Build RTSP playback URL based on brand
      const userInfo = device.username
        ? `${encodeURIComponent(device.username)}:${encodeURIComponent(device.password || '')}@`
        : '';
      const startIso = query.startTime;
      const endIso = query.endTime || new Date().toISOString();

      let rtspUrl: string;

      if (brand.includes('hikvision') || brand.includes('hik')) {
        // Hikvision playback RTSP URL format
        const startFormatted = startIso.replace(/[-:]/g, '').replace('T', 't').split('.')[0] + 'z';
        const endFormatted = endIso.replace(/[-:]/g, '').replace('T', 't').split('.')[0] + 'z';
        rtspUrl = `rtsp://${userInfo}${ip}:${rtspPort}/Streaming/tracks/101?starttime=${startFormatted}&endtime=${endFormatted}`;
      } else if (brand.includes('dahua') || brand.includes('imou')) {
        // Dahua playback RTSP URL format
        const startFmt = startIso.replace('T', ' ').split('.')[0];
        const endFmt = endIso.replace('T', ' ').split('.')[0];
        rtspUrl = `rtsp://${userInfo}${ip}:${rtspPort}/cam/playback?channel=1&starttime=${encodeURIComponent(startFmt)}&endtime=${encodeURIComponent(endFmt)}`;
      } else {
        // Generic ONVIF — attempt Hikvision-style as default
        const startFormatted = startIso.replace(/[-:]/g, '').replace('T', 't').split('.')[0] + 'z';
        const endFormatted = endIso.replace(/[-:]/g, '').replace('T', 't').split('.')[0] + 'z';
        rtspUrl = `rtsp://${userInfo}${ip}:${rtspPort}/Streaming/tracks/101?starttime=${startFormatted}&endtime=${endFormatted}`;
      }

      // Register temporary playback stream in go2rtc
      const playbackStreamId = `playback-${deviceId}-${Date.now()}`;

      try {
        const addResp = await fetch(`${GO2RTC_BASE}/api/streams?src=${encodeURIComponent(rtspUrl)}&name=${encodeURIComponent(playbackStreamId)}`, {
          method: 'PUT',
          signal: AbortSignal.timeout(10000),
        });

        if (!addResp.ok) {
          logger.warn({ status: addResp.status, playbackStreamId }, 'go2rtc stream registration returned non-200');
        }
      } catch (err) {
        logger.error({ err, playbackStreamId }, 'Failed to register playback stream in go2rtc');
        return reply.code(502).send({
          success: false,
          error: { code: 'GO2RTC_ERROR', message: 'Failed to register playback stream in go2rtc' },
        });
      }

      const baseWs = GO2RTC_BASE.replace('http://', 'ws://').replace('https://', 'wss://');

      logger.info({ deviceId, playbackStreamId, startTime: query.startTime }, 'Playback stream registered');

      return reply.send({
        success: true,
        data: {
          deviceId,
          playbackStreamId,
          startTime: query.startTime,
          endTime: query.endTime || null,
          wsUrl: `${baseWs}/api/ws?src=${encodeURIComponent(playbackStreamId)}`,
          hlsUrl: `${GO2RTC_BASE}/api/stream.m3u8?src=${encodeURIComponent(playbackStreamId)}`,
          mp4Url: `${GO2RTC_BASE}/api/stream.mp4?src=${encodeURIComponent(playbackStreamId)}`,
        },
      });
    },
  );
}
