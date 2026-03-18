/**
 * OpenTelemetry Instrumentation for AION Vision Hub.
 *
 * Must be imported BEFORE any other modules (especially http/fastify)
 * to correctly instrument all libraries.
 *
 * Exports:
 *   - initTelemetry(): sets up tracing + metrics exporters
 *   - shutdownTelemetry(): flushes and shuts down gracefully
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { config } from '../config/env.js';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'telemetry' });

let sdk: NodeSDK | null = null;

export function initTelemetry(): void {
  // Only initialize in non-test environments
  if (config.NODE_ENV === 'test') return;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'aion-backend-api',
    [ATTR_SERVICE_VERSION]: '1.0.0',
    'deployment.environment': config.NODE_ENV,
  });

  // Prometheus metrics exporter on port 9464 (can be disabled via env)
  const prometheusEnabled = config.PROMETHEUS_ENABLED;
  const prometheusExporter = prometheusEnabled
    ? new PrometheusExporter({ port: 9464, preventServerStart: false })
    : undefined;

  // OTLP trace exporter (Jaeger/Tempo/Grafana)
  const otlpEndpoint = config.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';
  const traceExporter = new OTLPTraceExporter({ url: otlpEndpoint });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    ...(prometheusExporter ? { metricReader: prometheusExporter } : {}),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();
  logger.info(
    `OpenTelemetry initialized — traces → ${otlpEndpoint}${prometheusEnabled ? ', Prometheus metrics on :9464/metrics' : ''}`,
  );
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
    logger.info('OpenTelemetry shut down gracefully');
  } catch (err) {
    logger.error({ err }, 'Error shutting down OpenTelemetry');
  }
}
