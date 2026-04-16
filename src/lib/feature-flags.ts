const DEFAULTS: Record<string, boolean> = {
  LIVE_VIEW_VIRTUALIZATION: false,
  LIVE_VIEW_AI_OVERLAY: false,
  LIVE_VIEW_IMOU_ONDEMAND: false,
  LIVE_VIEW_PTZ_INLINE: false,
  LIVE_VIEW_CONTEXT_PANEL: false,
  LIVE_VIEW_FLOOR_PLAN: false,
  LIVE_VIEW_SCENE_COMPOSER: false,
  LIVE_VIEW_AI_COPILOT: false,
  LIVE_VIEW_RECORDING: false,
  FX_033_CLIP_EXPORT_UI: false,
  FX_042_ALERTS_SEED: false,
  FX_031_DVR_TIME_SYNC: false,
  FX_064_IOT_SCENES_UI: false,
  FX_083_ASTERISK_AMI: false,
  FX_108_DOCUMENTS_CLEANUP: false,
  FX_I18N_BATCH_2026_04: false,
  NOTIFY_WS_BRIDGE: false,
};

function getFlag(name: string): boolean {
  const envKey = `VITE_FF_${name}`;
  const envVal = import.meta.env?.[envKey];
  if (envVal === "true") return true;
  if (envVal === "false") return false;
  return DEFAULTS[name] ?? false;
}

export const FF = new Proxy(DEFAULTS, {
  get: (_target, prop: string) => getFlag(prop),
}) as Readonly<Record<keyof typeof DEFAULTS, boolean>>;
