/**
 * Stream Bridge Service
 *
 * Bridges device credentials to MediaMTX stream registration.
 * When a device is added/updated with valid RTSP credentials,
 * this service auto-registers the stream in MediaMTX so it's
 * immediately available for live view via WebRTC/HLS.
 */

const MEDIAMTX_API = process.env.MEDIAMTX_API_URL || 'http://clave-mediamtx:9997/v3';

/**
 * Build RTSP URL from device info and brand.
 * Each brand has a different RTSP path convention.
 */
export function buildRtspUrl(params: {
  brand: string;
  ip: string;
  port?: number;
  username?: string;
  password?: string;
  channel?: number;
  substream?: boolean;
}): string {
  const { brand, ip, username, password, channel = 1, substream = false } = params;
  const port = params.port || 554;
  const auth = username && password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';

  switch (brand?.toLowerCase()) {
    case 'hikvision': {
      // Hikvision: /Streaming/Channels/XY where X=channel, Y=1(main)|2(sub)
      const streamType = substream ? '02' : '01';
      const ch = String(channel).padStart(1, '0');
      return `rtsp://${auth}${ip}:${port}/Streaming/Channels/${ch}${streamType}`;
    }

    case 'dahua': {
      // Dahua: /cam/realmonitor?channel=X&subtype=Y
      const subtype = substream ? 1 : 0;
      return `rtsp://${auth}${ip}:${port}/cam/realmonitor?channel=${channel}&subtype=${subtype}`;
    }

    case 'axis': {
      // Axis: /axis-media/media.amp
      return `rtsp://${auth}${ip}:${port}/axis-media/media.amp?camera=${channel}`;
    }

    case 'uniview': {
      // Uniview: /media/video1 or /media/video2
      const stream = substream ? 'video2' : 'video1';
      return `rtsp://${auth}${ip}:${port}/media/${stream}`;
    }

    case 'vivotek': {
      // Vivotek: /live.sdp
      return `rtsp://${auth}${ip}:${port}/live.sdp`;
    }

    case 'samsung':
    case 'hanwha': {
      // Samsung/Hanwha: /profile1/media.smp or /profile2/media.smp
      const profile = substream ? 'profile2' : 'profile1';
      return `rtsp://${auth}${ip}:${port}/${profile}/media.smp`;
    }

    case 'bosch': {
      // Bosch: /rtsp_tunnel or /video?inst=1
      return `rtsp://${auth}${ip}:${port}/video?inst=${channel}`;
    }

    case 'grandstream': {
      // Grandstream: /0 or /1
      const stream = substream ? 1 : 0;
      return `rtsp://${auth}${ip}:${port}/${stream}`;
    }

    case 'generic_onvif':
    default: {
      // Generic: try common patterns
      // Most ONVIF cameras: /stream1 or /h264Preview_01_main
      return `rtsp://${auth}${ip}:${port}/stream${channel}`;
    }
  }
}

/**
 * Register a device stream in MediaMTX.
 * Creates an on-demand proxy path: streamId → RTSP source.
 */
export async function registerStreamInMediaMTX(
  streamId: string,
  rtspUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${MEDIAMTX_API}/config/paths/add/${streamId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: rtspUrl,
        sourceOnDemand: true,
        sourceOnDemandStartTimeout: '10s',
        sourceOnDemandCloseAfter: '30s',
      }),
    });

    if (!response.ok) {
      // Path might already exist — try edit instead
      if (response.status === 400) {
        const editResponse = await fetch(`${MEDIAMTX_API}/config/paths/edit/${streamId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: rtspUrl,
            sourceOnDemand: true,
            sourceOnDemandStartTimeout: '10s',
            sourceOnDemandCloseAfter: '30s',
          }),
        });
        if (!editResponse.ok) {
          const err = await editResponse.text();
          return { success: false, error: `MediaMTX edit failed: ${err}` };
        }
        return { success: true };
      }
      const err = await response.text();
      return { success: false, error: `MediaMTX add failed: ${err}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: `MediaMTX unreachable: ${(error as Error).message}` };
  }
}

/**
 * Remove a stream from MediaMTX.
 */
export async function removeStreamFromMediaMTX(streamId: string): Promise<void> {
  try {
    await fetch(`${MEDIAMTX_API}/config/paths/delete/${streamId}`, {
      method: 'POST',
    });
  } catch {
    // Best effort — don't fail if MediaMTX is down
  }
}

/**
 * Register all channels of a device in MediaMTX.
 * For NVR/DVR with multiple channels, registers each channel as a separate stream.
 */
export async function registerDeviceStreams(device: {
  id: string;
  brand: string;
  ipAddress: string | null;
  port: number | null;
  rtspPort: number | null;
  username: string | null;
  password: string | null;
  channels: number;
  type: string;
  connectionType: string | null;
}): Promise<{ registered: number; errors: string[] }> {
  const errors: string[] = [];
  let registered = 0;

  // Skip non-streamable device types
  if (['sensor', 'relay', 'switch', 'access_panel'].includes(device.type)) {
    return { registered: 0, errors: [] };
  }

  // Skip cloud-only devices without IP
  if (!device.ipAddress) {
    return { registered: 0, errors: ['No IP address configured'] };
  }

  const rtspPort = device.rtspPort || 554;
  const totalChannels = device.channels || 1;

  for (let ch = 1; ch <= totalChannels; ch++) {
    // Main stream
    const mainUrl = buildRtspUrl({
      brand: device.brand,
      ip: device.ipAddress,
      port: rtspPort,
      username: device.username || undefined,
      password: device.password || undefined,
      channel: ch,
      substream: false,
    });

    const streamId = totalChannels > 1 ? `${device.id}-ch${ch}` : device.id;
    const result = await registerStreamInMediaMTX(streamId, mainUrl);

    if (result.success) {
      registered++;
    } else {
      errors.push(`Channel ${ch}: ${result.error}`);
    }

    // Sub stream (for mosaic/grid view — lower quality, less bandwidth)
    const subUrl = buildRtspUrl({
      brand: device.brand,
      ip: device.ipAddress,
      port: rtspPort,
      username: device.username || undefined,
      password: device.password || undefined,
      channel: ch,
      substream: true,
    });

    const subStreamId = totalChannels > 1 ? `${device.id}-ch${ch}-sub` : `${device.id}-sub`;
    await registerStreamInMediaMTX(subStreamId, subUrl);
    // Don't count sub-streams in registered count or report errors for them
  }

  return { registered, errors };
}

/**
 * List all active streams from MediaMTX.
 */
export async function listMediaMTXStreams(): Promise<{
  active: number;
  streams: Array<{ name: string; ready: boolean; source?: string }>;
}> {
  try {
    const response = await fetch(`${MEDIAMTX_API}/paths/list`);
    if (!response.ok) {
      return { active: 0, streams: [] };
    }
    const data = await response.json() as { items?: Array<{ name: string; ready: boolean; source?: any }> };
    const items = data.items || [];
    return {
      active: items.filter(i => i.ready).length,
      streams: items.map(i => ({ name: i.name, ready: i.ready })),
    };
  } catch {
    return { active: 0, streams: [] };
  }
}
