let started = false;

/**
 * Tracing is opt-in: it only starts when OTEL_EXPORTER_OTLP_ENDPOINT is set.
 * Loading the auto-instrumentations costs ~1-2s of startup and memory per service,
 * and without a collector every span export just fails, so local dev skips it.
 */
export async function setupOtel(serviceName: string): Promise<void> {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (started || !endpoint) {
    return;
  }
  started = true;

  const [{ NodeSDK }, { OTLPTraceExporter }, { getNodeAutoInstrumentations }] = await Promise.all([
    import('@opentelemetry/sdk-node'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/auto-instrumentations-node'),
  ]);

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    instrumentations: [getNodeAutoInstrumentations()],
    serviceName: process.env.OTEL_SERVICE_NAME ?? serviceName,
  });
  sdk.start();
}
