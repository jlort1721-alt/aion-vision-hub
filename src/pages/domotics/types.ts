export interface EwelinkCredentials {
  email: string;
  password?: string;
  countryCode: string;
}

export interface DomoticFilterState {
  search: string;
  sectionId: string;
  type: string;
}

export const TYPE_ICONS = {
  door: 'DoorOpen', lock: 'Shield', siren: 'Siren',
  light: 'Lightbulb', relay: 'CircuitBoard', sensor: 'Activity', switch: 'ToggleLeft',
} as const;

export const TYPE_LABELS: Record<string, string> = {
  door: 'Puerta', lock: 'Chapa', siren: 'Sirena',
  light: 'Luz', relay: 'Relé', sensor: 'Sensor', switch: 'Interruptor',
};
