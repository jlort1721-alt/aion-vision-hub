import { config } from '../config/env.js';
import pino from 'pino';

const logger = pino({ name: 'mqtt-client' });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mqtt: any = null;
try {
  // @ts-ignore — package may not be installed locally
  mqtt = await import('mqtt');
} catch {
  logger.info('mqtt package not installed — MQTT client disabled');
}

type MqttClientInstance = {
  connected: boolean;
  on(event: string, cb: (...args: unknown[]) => void): void;
  subscribe(topic: string, opts: Record<string, unknown>, cb: (err: Error | null) => void): void;
  publish(topic: string, payload: string | Buffer, opts: Record<string, unknown>, cb: (err?: Error) => void): void;
  end(force: boolean, opts: Record<string, unknown>, cb: () => void): void;
};

class MqttClientService {
  private client: MqttClientInstance | null = null;
  private handlers = new Map<string, ((topic: string, payload: Buffer) => void)[]>();
  private reconnectDelay = 5000;
  private maxReconnectDelay = 60000;

  get isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  connect(): void {
    if (!mqtt) {
      logger.info('mqtt package not available — MQTT client disabled');
      return;
    }

    const brokerUrl = config.MQTT_BROKER_URL;
    if (!brokerUrl) {
      logger.info('MQTT_BROKER_URL not configured — MQTT client disabled');
      return;
    }

    const options: Record<string, unknown> = {
      reconnectPeriod: this.reconnectDelay,
      connectTimeout: 10000,
      clean: true,
      clientId: `aion-api-${process.pid}`,
    };

    if (config.MQTT_USERNAME) options.username = config.MQTT_USERNAME;
    if (config.MQTT_PASSWORD) options.password = config.MQTT_PASSWORD;

    this.client = mqtt.connect(brokerUrl, options) as unknown as MqttClientInstance;

    this.client.on('connect', () => {
      logger.info({ brokerUrl }, 'MQTT connected');
      this.reconnectDelay = 5000;
      this.client?.subscribe('aion/#', { qos: 1 }, (err: Error | null) => {
        if (err) logger.error({ err }, 'MQTT subscribe failed');
        else logger.info('Subscribed to aion/#');
      });
    });

    this.client.on('message', (topic: unknown, payload: unknown) => {
      for (const [pattern, fns] of this.handlers) {
        if (this.matchTopic(pattern, topic as string)) {
          for (const fn of fns) {
            try { fn(topic as string, payload as Buffer); } catch (err: unknown) { logger.error({ err, topic }, 'MQTT handler error'); }
          }
        }
      }
    });

    this.client.on('error', (err: unknown) => logger.error({ err }, 'MQTT error'));
    this.client.on('reconnect', () => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      logger.info({ delay: this.reconnectDelay }, 'MQTT reconnecting');
    });
    this.client.on('close', () => logger.info('MQTT connection closed'));
  }

  subscribe(pattern: string, handler: (topic: string, payload: Buffer) => void): void {
    const existing = this.handlers.get(pattern) ?? [];
    this.handlers.set(pattern, [...existing, handler]);
  }

  async publish(topic: string, payload: string | Buffer): Promise<void> {
    if (!this.client?.connected) {
      logger.warn({ topic }, 'MQTT not connected — cannot publish');
      return;
    }
    return new Promise((resolve, reject) => {
      this.client!.publish(topic, payload, { qos: 1 }, (err?: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async publishCommand(siteId: string, deviceId: string, command: Record<string, unknown>): Promise<void> {
    const topic = `aion/${siteId}/actuators/${deviceId}/cmd`;
    await this.publish(topic, JSON.stringify(command));
  }

  healthCheck(): { status: string; connected: boolean; broker: string | undefined } {
    return {
      status: this.isConnected ? 'healthy' : 'disconnected',
      connected: this.isConnected,
      broker: config.MQTT_BROKER_URL,
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await new Promise<void>((resolve) => this.client!.end(false, {}, () => resolve()));
      this.client = null;
      logger.info('MQTT disconnected');
    }
  }

  private matchTopic(pattern: string, topic: string): boolean {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true;
      if (patternParts[i] === '+') continue;
      if (patternParts[i] !== topicParts[i]) return false;
    }
    return patternParts.length === topicParts.length;
  }
}

export const mqttClient = new MqttClientService();
