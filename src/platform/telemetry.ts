import { context, propagation, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
export type TraceCarrier = Record<string, string>;
export function carrier(): TraceCarrier { const value = {}; propagation.inject(context.active(), value); return value; }
export function activeTraceId(): string { return trace.getActiveSpan()?.spanContext().traceId ?? ''; }
export async function traced<T>(name: string, work: () => Promise<T>, incoming?: TraceCarrier, kind = SpanKind.INTERNAL): Promise<T> {
  const parent = incoming ? propagation.extract(context.active(), incoming) : context.active();
  return trace.getTracer('fullcycle-marketplace').startActiveSpan(name, { kind }, parent, async span => {
    try { return await work(); }
    catch (error) { span.setStatus({ code: SpanStatusCode.ERROR }); throw error; }
    finally { span.end(); }
  });
}
