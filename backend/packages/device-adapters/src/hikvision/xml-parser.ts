import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (_tagName, _jpath, isLeaf) => !isLeaf,
});

export function parseXml<T = Record<string, unknown>>(xml: string): T {
  return parser.parse(xml) as T;
}

export interface DeviceInfoXml {
  DeviceInfo?: {
    deviceName?: string;
    deviceID?: string;
    model?: string;
    serialNumber?: string;
    firmwareVersion?: string;
    firmwareReleasedDate?: string;
    macAddress?: string;
    deviceType?: string;
    telecontrolID?: string;
  };
}

export interface SystemStatusXml {
  DeviceStatus?: {
    CPUList?: { CPU?: Array<{ cpuUtilization?: string }> };
    MemoryList?: { Memory?: Array<{ memoryUsage?: string }> };
    deviceUpTime?: string;
  };
}

export interface StreamingChannelXml {
  StreamingChannelList?: {
    StreamingChannel?: Array<{
      id?: string;
      channelName?: string;
      Video?: {
        videoCodecType?: string;
        videoResolutionWidth?: string;
        videoResolutionHeight?: string;
        maxFrameRate?: string;
        constantBitRate?: string;
      };
    }>;
  };
}

export interface SearchResultXml {
  CMSearchResult?: {
    responseStatus?: string;
    numOfMatches?: string;
    matchList?: {
      searchMatchItem?: Array<{
        timeSpan?: {
          startTime?: string;
          endTime?: string;
        };
        mediaSegmentDescriptor?: {
          contentType?: string;
        };
      }>;
    };
  };
}

export function extractDeviceInfo(xml: string): DeviceInfoXml {
  return parseXml<DeviceInfoXml>(xml);
}

export function extractSystemStatus(xml: string): SystemStatusXml {
  return parseXml<SystemStatusXml>(xml);
}

export function extractStreamingChannels(xml: string): StreamingChannelXml {
  return parseXml<StreamingChannelXml>(xml);
}
