/**
 * Intercom Connector Registry
 *
 * Factory that resolves the correct brand-specific connector
 * for intercom device management.
 */

import type { IntercomConnector, IntercomBrand } from '../types.js';
import { FanvilConnector } from './fanvil-connector.js';
import { GrandstreamConnector } from './grandstream-connector.js';
import { GenericSipConnector, HikvisionIntercomConnector, DahuaIntercomConnector } from './generic-sip-connector.js';

const connectorInstances = new Map<IntercomBrand, IntercomConnector>();

export function getConnector(brand: IntercomBrand | string): IntercomConnector {
  const key = brand.toLowerCase() as IntercomBrand;

  if (connectorInstances.has(key)) {
    return connectorInstances.get(key)!;
  }

  let connector: IntercomConnector;

  switch (key) {
    case 'fanvil':
      connector = new FanvilConnector();
      break;
    case 'grandstream':
      connector = new GrandstreamConnector();
      break;
    case 'hikvision':
      connector = new HikvisionIntercomConnector();
      break;
    case 'dahua':
      connector = new DahuaIntercomConnector();
      break;
    case 'akuvox':
    case 'generic_sip':
    default:
      connector = new GenericSipConnector();
      break;
  }

  connectorInstances.set(key, connector);
  return connector;
}

export function listConnectors(): Array<{ brand: IntercomBrand; displayName: string }> {
  return [
    { brand: 'fanvil', displayName: 'Fanvil SIP Intercom' },
    { brand: 'grandstream', displayName: 'Grandstream SIP Intercom' },
    { brand: 'hikvision', displayName: 'Hikvision IP Intercom' },
    { brand: 'dahua', displayName: 'Dahua IP Intercom' },
    { brand: 'akuvox', displayName: 'Akuvox SIP Intercom' },
    { brand: 'generic_sip', displayName: 'Generic SIP Device' },
  ];
}

export { FanvilConnector } from './fanvil-connector.js';
export { GrandstreamConnector } from './grandstream-connector.js';
export { GenericSipConnector, HikvisionIntercomConnector, DahuaIntercomConnector } from './generic-sip-connector.js';
