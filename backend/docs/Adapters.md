# Device Adapters

The `@aion/device-adapters` package implements the strategy pattern for communicating with IP cameras from different manufacturers. Each adapter encapsulates the vendor-specific protocol (ISAPI, CGI, ONVIF) behind a set of unified interfaces defined in `@aion/shared-contracts`.

---

## Table of Contents

- [Strategy Pattern Overview](#strategy-pattern-overview)
- [Adapter Interfaces](#adapter-interfaces)
- [BaseAdapter Abstract Class](#baseadapter-abstract-class)
- [HikvisionAdapter](#hikvisionadapter)
- [DahuaAdapter](#dahuaadapter)
- [GenericOnvifAdapter](#genericonvifadapter)
- [AdapterFactory](#adapterfactory)
- [Adding a New Brand Adapter](#adding-a-new-brand-adapter)

---

## Strategy Pattern Overview

```
  +------------------+         +---------------------+
  |  AdapterFactory  |         | IFullDeviceAdapter  |
  |  (brand routing) |-------->| (8 interfaces)      |
  +--------+---------+         +----------+----------+
           |                              |
   +-------+-------+           +----------+----------+
   |               |           |                     |
  "hikvision"   "dahua"     BaseAdapter (abstract)
   |               |           |
   v               v           |
  +---+          +---+    +----+----+----+
  |Hik|          |Dah|    |Hik|Dah |ONVIF|
  +---+          +---+    +---+----+-----+
```

The factory resolves the correct adapter at runtime based on the `brand` field in the device configuration. All adapters share common connection tracking and state management through `BaseAdapter`. Unknown brands fall back to the `GenericOnvifAdapter`.

---

## Adapter Interfaces

Eight interfaces define the complete device interaction contract. All are defined in `@aion/shared-contracts/src/adapters.ts`.

| # | Interface           | Methods                                        | Purpose                         |
|---|--------------------|-------------------------------------------------|----------------------------------|
| 1 | `IDeviceAdapter`   | `connect`, `disconnect`, `testConnection`       | Connection lifecycle             |
| 2 | `IStreamAdapter`   | `getStreams`, `getStreamUrl`, `registerStream`, `getStreamState` | Stream URL retrieval  |
| 3 | `IDiscoveryAdapter`| `discover`, `identify`                          | Network scanning                 |
| 4 | `IPlaybackAdapter` | `search`, `startPlayback`, `stopPlayback`, `exportClip`, `getSnapshot` | Recorded video |
| 5 | `IEventAdapter`    | `subscribe`, `getEventTypes`                    | Camera event ingestion           |
| 6 | `IPTZAdapter`      | `sendCommand`, `getPresets`, `setPreset`, `startPatrol`, `stopPatrol` | PTZ control |
| 7 | `IConfigAdapter`   | `getCapabilities`, `getSystemInfo`, `setConfig` | Device configuration             |
| 8 | `IHealthAdapter`   | `getHealth`, `ping`                             | Health monitoring                |

The composite `IFullDeviceAdapter` extends all eight interfaces:

```typescript
interface IFullDeviceAdapter extends
  IDeviceAdapter,
  IStreamAdapter,
  IDiscoveryAdapter,
  IPlaybackAdapter,
  IEventAdapter,
  IPTZAdapter,
  IConfigAdapter,
  IHealthAdapter {}
```

---

## BaseAdapter Abstract Class

**File:** `packages/device-adapters/src/base-adapter.ts`

The `BaseAdapter` provides shared implementation for `IDeviceAdapter`, `IStreamAdapter`, `IHealthAdapter`, and `IConfigAdapter`. Concrete adapters extend this class and implement template methods.

### Responsibilities

- **Connection tracking:** Maintains a `Map<string, DeviceConnection>` of active connections
- **State management:** Tracks per-device `StreamState` (idle, live, failed, etc.)
- **Error handling:** Wraps connect/disconnect in try-catch with structured logging
- **Device ID generation:** Creates deterministic IDs from brand prefix + IP:port
- **Ping:** HTTP HEAD request with 3-second timeout for reachability checks

### Template Methods (must be implemented by subclasses)

```typescript
protected abstract doConnect(config: DeviceConnectionConfig, deviceId: string): Promise<ConnectionResult>;
protected abstract doDisconnect(deviceId: string): Promise<void>;
protected abstract doTestConnection(config: DeviceConnectionConfig): Promise<ConnectionTestResult>;
```

### Abstract Methods (must be implemented by subclasses)

```typescript
abstract getStreams(deviceId: string): Promise<StreamProfile[]>;
abstract getStreamUrl(deviceId: string, type: 'main' | 'sub', channel?: number): string;
abstract getHealth(deviceId: string): Promise<DeviceHealthReport>;
abstract getCapabilities(deviceId: string): Promise<DeviceCapabilities>;
abstract getSystemInfo(deviceId: string): Promise<DeviceSystemInfo>;
```

### Shared Helper Methods

| Method                     | Description                                         |
|---------------------------|-----------------------------------------------------|
| `getConnection(id)`       | Get connection metadata (nullable)                  |
| `requireConnection(id)`   | Get connection or throw Error                       |
| `updateState(id, state)`  | Update device stream state with logging             |
| `generateDeviceId(config)`| Create `{prefix}-{ip}:{port}` identifier            |
| `getConnectedDevices()`   | List all connected device IDs                       |
| `isConnected(id)`         | Boolean connection check                            |

---

## HikvisionAdapter

**File:** `packages/device-adapters/src/hikvision/adapter.ts`

Communicates with Hikvision cameras, NVRs, and encoders via the ISAPI (Internet Services Application Programming Interface) protocol over HTTP/HTTPS.

### Protocol Details

| Aspect            | Details                                           |
|------------------|---------------------------------------------------|
| Protocol         | ISAPI over HTTP/HTTPS                             |
| Authentication   | Basic/Digest (via `node-digest-auth-client`)      |
| Data format      | XML request/response (parsed with `fast-xml-parser`) |
| RTSP URL pattern | `rtsp://{user}:{pass}@{ip}:{port}/Streaming/Channels/{ch}` |
| Discovery        | SADP protocol (UDP port 37020)                    |
| Event stream     | Long-polling on `/ISAPI/Event/notification/alertStream` |

### Key ISAPI Endpoints Used

| Endpoint                                    | Method | Purpose                    |
|---------------------------------------------|--------|----------------------------|
| `/ISAPI/System/deviceInfo`                 | GET    | Device info (model, serial)|
| `/ISAPI/System/status`                     | GET    | CPU, memory, storage usage |
| `/ISAPI/System/capabilities`               | GET    | Feature capabilities       |
| `/ISAPI/PTZCtrl/channels/{ch}/continuous`   | PUT    | Continuous PTZ movement    |
| `/ISAPI/PTZCtrl/channels/{ch}/presets/{id}` | PUT    | Go to PTZ preset           |
| `/ISAPI/PTZCtrl/channels/{ch}/presets`      | GET    | List PTZ presets           |
| `/ISAPI/ContentMgmt/search`                | POST   | Search recorded media      |
| `/ISAPI/Streaming/channels/{ch}/picture`    | GET    | Get snapshot               |
| `/ISAPI/Event/notification/alertStream`     | GET    | Event notification stream  |

### Supported Capabilities

- PTZ control (continuous, presets)
- Audio (two-way)
- Smart events (motion, line crossing, intrusion, face detection, ANPR)
- Playback (search, playback session, clip export, snapshots)
- Health monitoring (CPU, memory via system status)
- Codecs: H.264, H.265
- Max resolution: 4K

### Internal Components

| File              | Purpose                                          |
|------------------|--------------------------------------------------|
| `isapi-client.ts` | HTTP client with digest authentication           |
| `xml-parser.ts`   | XML response parsing and data extraction         |
| `constants.ts`    | ISAPI paths, RTSP URL templates, port constants  |

---

## DahuaAdapter

**File:** `packages/device-adapters/src/dahua/adapter.ts`

Communicates with Dahua cameras, NVRs, and XVRs via the CGI/RPC API over HTTP/HTTPS.

### Protocol Details

| Aspect            | Details                                           |
|------------------|---------------------------------------------------|
| Protocol         | HTTP CGI/RPC API                                  |
| Authentication   | Basic/Digest                                      |
| Data format      | `key=value` response pairs                        |
| RTSP URL pattern | `rtsp://{user}:{pass}@{ip}:554/cam/realmonitor?channel={ch}&subtype={st}` |
| Discovery        | DH-Discovery protocol                            |
| Event stream     | Long-polling on `/cgi-bin/eventManager.cgi`       |

### Key CGI Endpoints Used

| Endpoint                          | Method | Purpose                         |
|----------------------------------|--------|---------------------------------|
| `/cgi-bin/magicBox.cgi?action=getSystemInfo` | GET | System info (model, serial) |
| `/cgi-bin/ptz.cgi?action=...`    | GET    | PTZ control commands            |
| `/cgi-bin/snapshot.cgi?channel=N` | GET    | Get snapshot image              |
| `/cgi-bin/configManager.cgi`     | GET    | Configuration and presets       |
| `/cgi-bin/mediaFileFind.cgi`     | GET    | Playback file search            |

### Supported Capabilities

- PTZ control (directional, zoom, presets)
- Audio (two-way)
- Smart events (motion, line crossing, intrusion)
- Playback (search, playback session, clip export, snapshots)
- Health monitoring (basic reachability)
- Codecs: H.264, H.265
- Max resolution: 4K

### Internal Components

| File              | Purpose                                          |
|------------------|--------------------------------------------------|
| `rpc-client.ts`   | HTTP client with key=value response parsing      |
| `constants.ts`    | CGI paths, RTSP URL templates, port constants    |

---

## GenericOnvifAdapter

**File:** `packages/device-adapters/src/onvif/adapter.ts`

Universal fallback adapter for any ONVIF-compliant device. Uses the standardized ONVIF protocol for device control, streaming, and PTZ operations.

### Protocol Details

| Aspect            | Details                                           |
|------------------|---------------------------------------------------|
| Protocol         | ONVIF (SOAP/XML over HTTP)                        |
| Authentication   | WS-UsernameToken                                  |
| Discovery        | WS-Discovery (multicast probe)                    |
| Profiles         | Profile S (streaming), Profile T (analytics)      |
| RTSP URL pattern | `rtsp://{user}:{pass}@{ip}:554/onvif/Profile_{n}/media.smp` |
| Library          | `onvif` npm package                               |

### ONVIF Operations Used

| Operation              | Method             | Purpose                      |
|-----------------------|--------------------|-----------------------------|
| `getDeviceInformation` | SOAP GET           | Device identity and firmware |
| `getProfiles`          | SOAP GET           | Media stream profiles        |
| `getStreamUri`         | SOAP GET           | RTSP URL for a profile       |
| `continuousMove`       | SOAP PUT           | PTZ continuous movement      |
| `stop`                 | SOAP PUT           | Stop PTZ movement            |
| `gotoPreset`           | SOAP PUT           | Move to PTZ preset           |
| `getPresets`           | SOAP GET           | List PTZ presets             |
| `setPreset`            | SOAP PUT           | Save PTZ preset              |

### Supported Capabilities

- PTZ control (if device has PTZ service)
- Audio (basic)
- Smart events: limited (motion, tamper, video loss)
- Playback: not supported (ONVIF Profile G varies widely)
- Health monitoring (device information query)
- Codecs: H.264, H.265
- Max resolution: 1080p (conservative default)

### Internal Components

| File              | Purpose                                          |
|------------------|--------------------------------------------------|
| `discovery.ts`    | WS-Discovery multicast implementation            |
| `profiles.ts`     | ONVIF Cam method promisification helpers          |

---

## AdapterFactory

**File:** `packages/device-adapters/src/factory.ts`

The `AdapterFactory` is the primary entry point for obtaining adapter instances. It routes device connections to the correct adapter based on the `brand` field.

### Default Registrations

| Brand Key     | Adapter Class         | Notes                          |
|--------------|----------------------|--------------------------------|
| `hikvision`  | `HikvisionAdapter`   | ISAPI protocol                 |
| `dahua`      | `DahuaAdapter`       | CGI/RPC protocol               |
| `onvif`      | `GenericOnvifAdapter` | ONVIF standard                 |
| `generic`    | `GenericOnvifAdapter` | Fallback for unknown brands    |

### API

```typescript
class AdapterFactory {
  constructor(logger: pino.Logger);

  // Register a custom adapter for a brand
  register(brand: string, adapter: FullAdapter): void;

  // Get adapter by brand (falls back to ONVIF if not found)
  get(brand: string): FullAdapter;

  // Check if a brand has a registered adapter
  has(brand: string): boolean;

  // List all registered brand keys
  getSupportedBrands(): string[];

  // Get all adapters
  getAll(): Map<string, FullAdapter>;
}
```

### Usage

```typescript
import { AdapterFactory } from '@aion/device-adapters';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'my-service' });
const factory = new AdapterFactory(logger);

// Get adapter for a specific brand
const adapter = factory.get('hikvision');

// Connect to a device
const result = await adapter.connect({
  ip: '192.168.1.100',
  port: 80,
  username: 'admin',
  password: 'password123',
  brand: 'hikvision',
  channels: 4,
});

// Get available streams
const streams = await adapter.getStreams(result.sessionId);

// Get device health
const health = await adapter.getHealth(result.sessionId);
```

---

## Adding a New Brand Adapter

To add support for a new camera brand (e.g., Axis), follow these steps:

### Step 1: Create the adapter directory

```
packages/device-adapters/src/
  axis/
    adapter.ts      # Main adapter class
    client.ts       # HTTP/API client
    constants.ts    # API paths, URL patterns
```

### Step 2: Implement the adapter class

Extend `BaseAdapter` and implement all required interfaces:

```typescript
// packages/device-adapters/src/axis/adapter.ts
import type pino from 'pino';
import type {
  DeviceConnectionConfig,
  ConnectionResult,
  ConnectionTestResult,
  StreamProfile,
  DeviceHealthReport,
  DeviceCapabilities,
  DeviceSystemInfo,
  IDiscoveryAdapter,
  IPTZAdapter,
  IPlaybackAdapter,
  IEventAdapter,
  // ... all needed types
} from '@aion/shared-contracts';
import { BaseAdapter } from '../base-adapter.js';

export class AxisAdapter
  extends BaseAdapter
  implements IDiscoveryAdapter, IPTZAdapter, IPlaybackAdapter, IEventAdapter
{
  readonly brand = 'axis';
  readonly supportedProtocols = ['vapix', 'rtsp', 'onvif'];

  constructor(logger: pino.Logger) {
    super(logger);
  }

  // Implement template methods
  protected async doConnect(config: DeviceConnectionConfig, deviceId: string): Promise<ConnectionResult> {
    // Use VAPIX API to verify connection
    // Store client reference
    return { success: true, message: 'Connected to Axis device' };
  }

  protected async doDisconnect(deviceId: string): Promise<void> {
    // Clean up client
  }

  protected async doTestConnection(config: DeviceConnectionConfig): Promise<ConnectionTestResult> {
    // Test VAPIX reachability
    return { success: true, message: 'Axis device reachable', latencyMs: 0 };
  }

  // Implement all abstract and interface methods...
  async getStreams(deviceId: string): Promise<StreamProfile[]> { /* ... */ }
  getStreamUrl(deviceId: string, type: 'main' | 'sub', channel?: number): string { /* ... */ }
  async getHealth(deviceId: string): Promise<DeviceHealthReport> { /* ... */ }
  async getCapabilities(deviceId: string): Promise<DeviceCapabilities> { /* ... */ }
  async getSystemInfo(deviceId: string): Promise<DeviceSystemInfo> { /* ... */ }
  // ... remaining interface implementations
}
```

### Step 3: Register in the factory

Add the adapter to `AdapterFactory.registerDefaults()`:

```typescript
// packages/device-adapters/src/factory.ts
import { AxisAdapter } from './axis/adapter.js';

private registerDefaults(): void {
  this.register('hikvision', new HikvisionAdapter(this.logger) as FullAdapter);
  this.register('dahua', new DahuaAdapter(this.logger) as FullAdapter);
  this.register('onvif', new GenericOnvifAdapter(this.logger) as FullAdapter);
  this.register('generic', new GenericOnvifAdapter(this.logger) as FullAdapter);
  this.register('axis', new AxisAdapter(this.logger) as FullAdapter);  // Add here
}
```

### Step 4: Export from package index

```typescript
// packages/device-adapters/src/index.ts
export { AxisAdapter } from './axis/adapter.js';
```

### Step 5: Add the brand type

Update the `DeviceBrand` union in `@aion/shared-contracts`:

```typescript
// packages/shared-contracts/src/domain.ts
export type DeviceBrand = 'hikvision' | 'dahua' | 'onvif' | 'axis' | 'generic';
```

### Step 6: Runtime registration (alternative)

Adapters can also be registered at runtime without modifying factory defaults:

```typescript
const factory = new AdapterFactory(logger);
factory.register('axis', new AxisAdapter(logger) as FullAdapter);
```

This is useful for plugin-based architectures where adapters are loaded dynamically.
