// Dahua CGI/RPC API endpoint constants

export const CGI = {
  SYSTEM_INFO: '/cgi-bin/magicBox.cgi?action=getSystemInfo',
  DEVICE_TYPE: '/cgi-bin/magicBox.cgi?action=getDeviceType',
  SERIAL_NUMBER: '/cgi-bin/magicBox.cgi?action=getSerialNo',
  SOFTWARE_VERSION: '/cgi-bin/magicBox.cgi?action=getSoftwareVersion',
  MACHINE_NAME: '/cgi-bin/magicBox.cgi?action=getMachineName',

  // Storage
  STORAGE_INFO: '/cgi-bin/storageDevice.cgi?action=getDeviceAllInfo',

  // Streaming
  MEDIA_CAPS: '/cgi-bin/encode.cgi?action=getConfigCaps',
  ENCODE_CONFIG: '/cgi-bin/configManager.cgi?action=getConfig&name=Encode',

  // PTZ
  PTZ_CONTROL: (channel: number, action: string, arg1 = 0, arg2 = 0, arg3 = 0) =>
    `/cgi-bin/ptz.cgi?action=start&channel=${channel}&code=${action}&arg1=${arg1}&arg2=${arg2}&arg3=${arg3}`,
  PTZ_STOP: (channel: number, action: string) =>
    `/cgi-bin/ptz.cgi?action=stop&channel=${channel}&code=${action}`,
  PTZ_PRESETS: (channel: number) =>
    `/cgi-bin/ptz.cgi?action=getPresets&channel=${channel}`,
  PTZ_GOTO_PRESET: (channel: number, presetId: number) =>
    `/cgi-bin/ptz.cgi?action=start&channel=${channel}&code=GotoPreset&arg1=0&arg2=${presetId}&arg3=0`,

  // Playback / Search
  MEDIA_SEARCH: '/cgi-bin/mediaFileFind.cgi',

  // Events
  EVENT_MANAGER: '/cgi-bin/eventManager.cgi',
  ALARM_SUBSCRIBE: '/cgi-bin/snapManager.cgi',
} as const;

// RTSP URL patterns
export const RTSP = {
  REALMONITOR: (ip: string, user: string, pass: string, channel: number, subtype: number) =>
    `rtsp://${user}:${pass}@${ip}:554/cam/realmonitor?channel=${channel}&subtype=${subtype}`,
  PLAYBACK: (ip: string, user: string, pass: string, channel: number, start: string, end: string) =>
    `rtsp://${user}:${pass}@${ip}:554/cam/playback?channel=${channel}&starttime=${start}&endtime=${end}`,
} as const;

// DH-Discovery port
export const DH_DISCOVERY_PORT = 37810;
