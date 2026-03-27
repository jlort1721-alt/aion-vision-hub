/**
 * Event Normalizer for the Edge Gateway.
 *
 * Translates vendor-specific event types (Hikvision ISAPI, Dahua CGI, ONVIF WS)
 * into a standardized event format before forwarding to the backend API.
 *
 * This module is kept self-contained so the edge-gateway has no dependency
 * on the backend-api package.  An identical normalizer lives in
 * backend-api/src/services/event-normalizer.ts for batch-processing use.
 */

import type pino from 'pino';

// ── Normalized Event Types ──────────────────────────────────
export const NORMALIZED_EVENT_TYPES = [
  'motion',
  'video_loss',
  'tamper',
  'alarm_input',
  'face_detected',
  'plate_detected',
  'access_granted',
  'access_denied',
  'device_offline',
  'device_online',
  'intrusion',
  'line_crossing',
] as const;

export type NormalizedEventType = (typeof NORMALIZED_EVENT_TYPES)[number];

export const SEVERITY_LEVELS = ['info', 'low', 'medium', 'high', 'critical'] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export interface NormalizedEvent {
  type: NormalizedEventType | string;
  severity: SeverityLevel;
  source: {
    vendor: string;
    rawType: string;
    rawCode?: string;
  };
  device_id: string;
  channel?: number;
  site_id?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ── Vendor Mapping Entry ────────────────────────────────────
interface VendorEventMapping {
  type: NormalizedEventType | string;
  severity: SeverityLevel;
}

// ── Hikvision Normalization Map ─────────────────────────────
const HIKVISION_MAP: Record<string, VendorEventMapping> = {
  'VMD':                    { type: 'motion',          severity: 'low' },
  'vmd':                    { type: 'motion',          severity: 'low' },
  'VideoMotion':            { type: 'motion',          severity: 'low' },
  'videomotion':            { type: 'motion',          severity: 'low' },
  'motiondetection':        { type: 'motion',          severity: 'low' },
  'PIR':                    { type: 'motion',          severity: 'medium' },
  'linedetection':          { type: 'line_crossing',   severity: 'medium' },
  'LineDetection':          { type: 'line_crossing',   severity: 'medium' },
  'linecrossingdetection':  { type: 'line_crossing',   severity: 'medium' },
  'fielddetection':         { type: 'intrusion',       severity: 'high' },
  'FieldDetection':         { type: 'intrusion',       severity: 'high' },
  'intrusiondetection':     { type: 'intrusion',       severity: 'high' },
  'regionEntrance':         { type: 'intrusion',       severity: 'high' },
  'regionExiting':          { type: 'intrusion',       severity: 'medium' },
  'shelteralarm':           { type: 'tamper',          severity: 'high' },
  'ShelterAlarm':           { type: 'tamper',          severity: 'high' },
  'videotampering':         { type: 'tamper',          severity: 'high' },
  'VideoTampering':         { type: 'tamper',          severity: 'high' },
  'videoloss':              { type: 'video_loss',      severity: 'critical' },
  'VideoLoss':              { type: 'video_loss',      severity: 'critical' },
  'IO':                     { type: 'alarm_input',     severity: 'high' },
  'io':                     { type: 'alarm_input',     severity: 'high' },
  'alarmInput':             { type: 'alarm_input',     severity: 'high' },
  'AlarmInput':             { type: 'alarm_input',     severity: 'high' },
  'facedetection':          { type: 'face_detected',   severity: 'medium' },
  'FaceDetection':          { type: 'face_detected',   severity: 'medium' },
  'faceSnap':               { type: 'face_detected',   severity: 'medium' },
  'ANPR':                   { type: 'plate_detected',  severity: 'info' },
  'anpr':                   { type: 'plate_detected',  severity: 'info' },
  'vehicledetection':       { type: 'plate_detected',  severity: 'info' },
  'licensePlate':           { type: 'plate_detected',  severity: 'info' },
  'AccessControllerEvent':  { type: 'access_granted',  severity: 'info' },
  'doorbell':               { type: 'access_granted',  severity: 'info' },
  'diskfull':               { type: 'device_offline',  severity: 'critical' },
  'diskerror':              { type: 'device_offline',  severity: 'critical' },
  'nicbroken':              { type: 'device_offline',  severity: 'critical' },
};

// ── Dahua Normalization Map ─────────────────────────────────
const DAHUA_MAP: Record<string, VendorEventMapping> = {
  'VideoMotion':            { type: 'motion',          severity: 'low' },
  'SmartMotionHuman':       { type: 'motion',          severity: 'medium' },
  'SmartMotionVehicle':     { type: 'motion',          severity: 'medium' },
  'VideoLoss':              { type: 'video_loss',      severity: 'critical' },
  'VideoBlind':             { type: 'tamper',          severity: 'high' },
  'VideoAbnormalDetection': { type: 'tamper',          severity: 'high' },
  'AlarmLocal':             { type: 'alarm_input',     severity: 'high' },
  'AlarmOutput':            { type: 'alarm_input',     severity: 'high' },
  'FaceDetection':          { type: 'face_detected',   severity: 'medium' },
  'FaceRecognition':        { type: 'face_detected',   severity: 'medium' },
  'FaceSnapOptimized':      { type: 'face_detected',   severity: 'medium' },
  'TrafficJunction':        { type: 'plate_detected',  severity: 'info' },
  'TrafficParking':         { type: 'plate_detected',  severity: 'info' },
  'NumberStat':             { type: 'plate_detected',  severity: 'info' },
  'CrossLineDetection':     { type: 'line_crossing',   severity: 'medium' },
  'CrossRegionDetection':   { type: 'intrusion',       severity: 'high' },
  'IVS':                    { type: 'intrusion',       severity: 'high' },
  'LeftDetection':          { type: 'intrusion',       severity: 'high' },
  'TakenAwayDetection':     { type: 'intrusion',       severity: 'high' },
  'AccessControl':          { type: 'access_granted',  severity: 'info' },
  'CallNoAnswered':         { type: 'access_denied',   severity: 'low' },
  'StorageNotExist':        { type: 'device_offline',  severity: 'critical' },
  'StorageFailure':         { type: 'device_offline',  severity: 'critical' },
  'NetAbort':               { type: 'device_offline',  severity: 'critical' },
  'IPConflict':             { type: 'device_offline',  severity: 'critical' },
};

// ── ONVIF Normalization Map ─────────────────────────────────
const ONVIF_MAP: Record<string, VendorEventMapping> = {
  'RuleEngine/CellMotionDetector/Motion':     { type: 'motion',          severity: 'low' },
  'RuleEngine/MyMotionDetectorRule':          { type: 'motion',          severity: 'low' },
  'VideoAnalytics/Motion':                    { type: 'motion',          severity: 'low' },
  'VideoSource/MotionAlarm':                  { type: 'motion',          severity: 'low' },
  'RuleEngine/TamperDetector/Tamper':         { type: 'tamper',          severity: 'high' },
  'VideoSource/GlobalSceneChange/ImagingService': { type: 'tamper',      severity: 'high' },
  'Device/Trigger/DigitalInput':              { type: 'alarm_input',     severity: 'high' },
  'Device/IO/DigitalInput':                   { type: 'alarm_input',     severity: 'high' },
  'RuleEngine/LineDetector/Crossed':          { type: 'line_crossing',   severity: 'medium' },
  'RuleEngine/FieldDetector/ObjectsInside':   { type: 'intrusion',       severity: 'high' },
  'VideoSource/SignalLoss':                   { type: 'video_loss',      severity: 'critical' },
  'RuleEngine/FaceDetector':                  { type: 'face_detected',   severity: 'medium' },
  'RuleEngine/LicensePlateDetector':          { type: 'plate_detected',  severity: 'info' },
  'Device/HardwareFailure':                   { type: 'device_offline',  severity: 'critical' },
  'Monitoring/OperatingTime/LastReboot':       { type: 'device_online',   severity: 'info' },
};

// ── Vendor Map Registry ─────────────────────────────────────
const VENDOR_MAPS: Record<string, Record<string, VendorEventMapping>> = {
  hikvision: HIKVISION_MAP,
  dahua: DAHUA_MAP,
  onvif: ONVIF_MAP,
  hik: HIKVISION_MAP,
  generic: ONVIF_MAP,
  generic_onvif: ONVIF_MAP,
};

// ── Default severity by event type ──────────────────────────
const DEFAULT_SEVERITY_BY_TYPE: Record<string, SeverityLevel> = {
  motion: 'low',
  video_loss: 'critical',
  tamper: 'high',
  alarm_input: 'high',
  face_detected: 'medium',
  plate_detected: 'info',
  access_granted: 'info',
  access_denied: 'medium',
  device_offline: 'critical',
  device_online: 'info',
  intrusion: 'high',
  line_crossing: 'medium',
};

/**
 * Flexible key matching: exact, case-insensitive, ONVIF namespace-stripped, suffix.
 */
function findMapping(vendorMap: Record<string, VendorEventMapping>, rawType: string): VendorEventMapping | undefined {
  if (vendorMap[rawType]) return vendorMap[rawType];

  const lower = rawType.toLowerCase();
  for (const [key, value] of Object.entries(vendorMap)) {
    if (key.toLowerCase() === lower) return value;
  }

  const stripped = rawType.replace(/^tns\d?:/, '').replace(/^tt:/, '');
  if (stripped !== rawType) {
    if (vendorMap[stripped]) return vendorMap[stripped];
    for (const [key, value] of Object.entries(vendorMap)) {
      if (key.toLowerCase() === stripped.toLowerCase()) return value;
    }
  }

  for (const [key, value] of Object.entries(vendorMap)) {
    if (rawType.endsWith(key) || rawType.endsWith(`/${key}`)) return value;
  }

  return undefined;
}

/**
 * Extract a channel number from a raw event payload.
 */
function extractChannel(rawEvent: Record<string, unknown>): number | undefined {
  if (typeof rawEvent.channel === 'number') return rawEvent.channel;
  if (typeof rawEvent.channelID === 'number') return rawEvent.channelID;
  if (typeof rawEvent.channelId === 'number') return rawEvent.channelId;

  for (const key of ['channel', 'channelID', 'channelId', 'dynChannelID', 'videoInputChannelID']) {
    const val = rawEvent[key];
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  if (typeof rawEvent.macroChannel === 'number') return rawEvent.macroChannel;
  return undefined;
}

// ── Event title labels ──────────────────────────────────────
const EVENT_TITLE_LABELS: Record<string, string> = {
  motion: 'Motion Detected',
  video_loss: 'Video Signal Lost',
  tamper: 'Camera Tamper Alert',
  alarm_input: 'Alarm Input Triggered',
  face_detected: 'Face Detected',
  plate_detected: 'License Plate Detected',
  access_granted: 'Access Granted',
  access_denied: 'Access Denied',
  device_offline: 'Device Offline',
  device_online: 'Device Online',
  intrusion: 'Intrusion Detected',
  line_crossing: 'Line Crossing Detected',
};

/**
 * Normalize a raw vendor event into a standardized NormalizedEvent.
 */
export function normalizeVendorEvent(
  vendor: string,
  rawEvent: Record<string, unknown>,
  parentLogger?: pino.Logger,
): NormalizedEvent {
  const vendorKey = (vendor ?? 'generic').toLowerCase();
  const vendorMap = VENDOR_MAPS[vendorKey] ?? ONVIF_MAP;

  const rawType = String(rawEvent.eventType ?? rawEvent.type ?? rawEvent.Code ?? rawEvent.code ?? 'unknown');
  const rawCode = rawEvent.eventCode ?? rawEvent.code ?? rawEvent.Code;

  const mapping = findMapping(vendorMap, rawType);

  const normalizedType = mapping?.type ?? rawType;
  const normalizedSeverity: SeverityLevel =
    mapping?.severity ??
    DEFAULT_SEVERITY_BY_TYPE[normalizedType] ??
    (rawEvent.severity as SeverityLevel | undefined) ??
    'info';

  const channel = extractChannel(rawEvent);

  const timestamp =
    rawEvent.timestamp instanceof Date
      ? rawEvent.timestamp
      : typeof rawEvent.timestamp === 'string'
        ? new Date(rawEvent.timestamp)
        : new Date();

  const knownKeys = new Set([
    'eventType', 'type', 'Code', 'code', 'eventCode',
    'deviceId', 'device_id', 'channel', 'channelID', 'channelId',
    'timestamp', 'severity', 'metadata', 'siteId', 'site_id',
    'macroChannel', 'dynChannelID', 'videoInputChannelID',
  ]);

  const extraMetadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawEvent)) {
    if (!knownKeys.has(key) && value !== undefined) {
      extraMetadata[key] = value;
    }
  }

  const metadata = {
    ...(rawEvent.metadata as Record<string, unknown> | undefined),
    ...extraMetadata,
  };

  const normalized: NormalizedEvent = {
    type: normalizedType,
    severity: normalizedSeverity,
    source: {
      vendor: vendorKey,
      rawType,
      rawCode: rawCode != null ? String(rawCode) : undefined,
    },
    device_id: String(rawEvent.deviceId ?? rawEvent.device_id ?? ''),
    channel,
    site_id: rawEvent.siteId != null ? String(rawEvent.siteId) : rawEvent.site_id != null ? String(rawEvent.site_id) : undefined,
    timestamp,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };

  if (parentLogger) {
    parentLogger.debug(
      { vendor: vendorKey, rawType, normalizedType, severity: normalizedSeverity, deviceId: normalized.device_id },
      'Event normalized',
    );
  }

  return normalized;
}

/**
 * Build a human-readable title for a normalized event.
 */
export function buildEventTitle(event: NormalizedEvent): string {
  const label = EVENT_TITLE_LABELS[event.type] ?? `Event: ${event.type}`;
  const channelSuffix = event.channel != null ? ` (CH${event.channel})` : '';
  return `${label}${channelSuffix}`;
}
