import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT && process.env.OTEL_SDK_DISABLED !== 'true') {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '');
  const sdk = new NodeSDK({ resource: resourceFromAttributes({ 'service.name': 'fullcycle-marketplace', 'deployment.environment.name': process.env.APP_ENV ?? 'development' }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }), });
  await sdk.start();
  globalThis.marketplaceTelemetryShutdown = () => sdk.shutdown();
}
