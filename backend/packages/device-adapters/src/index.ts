export { BaseAdapter } from './base-adapter.js';
export type { DeviceConnection } from './base-adapter.js';

export { HikvisionAdapter } from './hikvision/adapter.js';
export { ISAPIClient } from './hikvision/isapi-client.js';

export { DahuaAdapter } from './dahua/adapter.js';
export { DahuaRPCClient } from './dahua/rpc-client.js';

export { GenericOnvifAdapter } from './onvif/adapter.js';
export { wsDiscovery } from './onvif/discovery.js';
export { promisifyCam } from './onvif/profiles.js';

export { AdapterFactory } from './factory.js';
export type { FullAdapter } from './factory.js';
