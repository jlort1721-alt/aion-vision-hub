// Hikvision ISAPI endpoint constants

export const ISAPI = {
  DEVICE_INFO: '/ISAPI/System/deviceInfo',
  SYSTEM_STATUS: '/ISAPI/System/status',
  STORAGE: '/ISAPI/ContentMgmt/Storage',
  TIME: '/ISAPI/System/time',
  NETWORK: '/ISAPI/System/Network/interfaces',

  // Streaming
  STREAMING_CHANNELS: '/ISAPI/Streaming/channels',
  STREAMING_STATUS: '/ISAPI/Streaming/status',

  // PTZ
  PTZ_CHANNELS: '/ISAPI/PTZCtrl/channels',
  PTZ_CONTINUOUS: (ch: number) => `/ISAPI/PTZCtrl/channels/${ch}/continuous`,
  PTZ_PRESETS: (ch: number) => `/ISAPI/PTZCtrl/channels/${ch}/presets`,
  PTZ_GOTO_PRESET: (ch: number, id: number) => `/ISAPI/PTZCtrl/channels/${ch}/presets/${id}/goto`,

  // Playback
  SEARCH_MEDIA: '/ISAPI/ContentMgmt/search',
  PLAYBACK_URI: '/ISAPI/ContentMgmt/StreamingProxy',

  // Events
  EVENT_NOTIFICATION: '/ISAPI/Event/notification/alertStream',
  EVENT_TRIGGERS: '/ISAPI/Event/triggers',

  // Capabilities
  CAPABILITIES: '/ISAPI/System/capabilities',
} as const;

// RTSP URL patterns
export const RTSP = {
  CHANNEL_URL: (ip: string, port: number | string, user: string, pass: string, ch: string) =>
    `rtsp://${user}:${pass}@${ip}:${port}/Streaming/Channels/${ch}`,
  MAIN_CHANNEL: (channel: number) => `${channel}01`,
  SUB_CHANNEL: (channel: number) => `${channel}02`,
  THIRD_CHANNEL: (channel: number) => `${channel}03`,
} as const;

// SADP discovery port
export const SADP_PORT = 37020;
