import { config } from './env.js';

export const platformConfig = {
  // Network ports
  ports: {
    // External (published through reverse proxy)
    external: {
      https: 443,
      http: 80,
      rtsp: 8554,
      webrtc: 8889,
      hls: 8888,
      sip: parseInt(String(config.SIP_PORT || '5080'), 10),
      autoRegister: 9500,
    },
    // Internal (Docker network only)
    internal: {
      api: config.PORT || 3000,
      gateway: 3100,
      database: 5432,
      redis: 6379,
      mediamtx: 9997,
      mediaLive: 9100,
      mediaPlayback: 9320,
      metadata: 9900,
    },
  },

  // Device onboarding
  deviceOnboarding: {
    supportedModes: ['ip', 'domain', 'serial', 'auto_register', 'p2p'] as const,
    vendors: {
      HIKVISION: {
        defaultHttpPort: 80,
        defaultHttpsPort: 443,
        defaultSdkPort: 8000,
        defaultRtspPort: 554,
        preferredModes: ['ip', 'domain', 'p2p', 'serial'],
      },
      DAHUA: {
        defaultHttpPort: 80,
        defaultHttpsPort: 443,
        defaultRtspPort: 554,
        autoRegisterPort: 9500,
        preferredModes: ['auto_register', 'ip', 'domain', 'p2p'],
      },
      ONVIF: {
        defaultHttpPort: 80,
        defaultRtspPort: 554,
        preferredModes: ['ip', 'domain'],
      },
    },
  },

  // Health check intervals (milliseconds)
  healthCheck: {
    tcpProbeMs: 30_000,
    authProbeMs: 120_000,
    snapshotProbeMs: 300_000,
    streamProbeMs: 300_000,
    channelReconcileMs: 86_400_000,
  },

  // Recording
  recording: {
    mode: 'device_nvr' as const,  // 'device_nvr' | 'backend' | 'hybrid'
    playbackProxyPort: 9320,
  },

  // Events
  events: {
    normalizeVendorEvents: true,
    retainDays: 180,
    batchFlushMs: 5000,
  },

  // Intercom
  intercom: {
    enabled: !!config.SIP_HOST,
    sipPort: parseInt(String(config.SIP_PORT || '5080'), 10),
    rtpRange: { start: 20000, end: 22000 },
  },
};
