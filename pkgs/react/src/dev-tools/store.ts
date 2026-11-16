import { isSpanContextValid, trace } from '@opentelemetry/api';
import type { AliveKatakit } from '@katakit/core';
import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace';
import { formatValue } from './formatValue';

/** Locally retained execution or emission, using observation time for observable values. */
export type ActivityEntry = {
  id: string;
  kind: 'method' | 'effect' | 'emission';
  plugin: string;
  name: string;
  effectIndex?: number;
  start: number;
  end?: number;
  outcome: 'running' | 'returned' | 'failed';
  value?: string;
  errorType?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
};

export type InspectedValue = { value?: string; status: 'waiting' | 'live' | 'complete' | 'failed' };
export type DevToolsSnapshot = {
  activity: ActivityEntry[];
  values: Record<string, InspectedValue>;
  omitted: number;
};

export const observableKey = (plugin: string, name: string) => JSON.stringify([plugin, name]);
const milliseconds = ([seconds, nanos]: readonly [number, number]) => seconds * 1000 + nanos / 1e6;
const spanKey = (span: ReadableSpan) =>
  `${span.spanContext().traceId}:${span.spanContext().spanId}`;

/**
 * Host-owned, bounded capture. Supply spanProcessor to the host's OpenTelemetry SDK.
 * connect() adds observable subscribers; it never starts or shuts down a runtime.
 */
export const createDevToolsStore = ({
  capacity = 500,
  scopeName,
}: { capacity?: number; scopeName?: string } = {}) => {
  if (!Number.isInteger(capacity) || capacity < 1)
    throw new Error('capacity must be a positive integer');
  const listeners = new Set<() => void>();
  const entries = new Map<string, ActivityEntry>();
  let snapshot: DevToolsSnapshot = { activity: [], values: {}, omitted: 0 };
  let sequence = 0;
  let connected: AliveKatakit | undefined;
  let disconnect: (() => void) | undefined;
  const publish = () => {
    snapshot = { ...snapshot, activity: [...entries.values()].toReversed() };
    listeners.forEach(listener => listener());
  };
  const append = (entry: ActivityEntry) => {
    entries.set(entry.id, entry);
    if (entries.size > capacity) {
      entries.delete(entries.keys().next().value!);
      snapshot = { ...snapshot, omitted: snapshot.omitted + 1 };
    }
    publish();
  };
  const updateValue = (key: string, value: InspectedValue) => {
    snapshot = { ...snapshot, values: { ...snapshot.values, [key]: value } };
  };
  const accepts = (span: ReadableSpan) =>
    (scopeName === undefined || span.instrumentationScope.name === scopeName) &&
    typeof span.attributes['katakit.plugin.type'] === 'string' &&
    ['method', 'effect'].includes(String(span.attributes['katakit.invocation.kind']));
  const spanEntry = (span: ReadableSpan, ended: boolean): ActivityEntry => ({
    id: spanKey(span),
    kind: span.attributes['katakit.invocation.kind'] as 'method' | 'effect',
    plugin: String(span.attributes['katakit.plugin.type']),
    name: String(
      span.attributes['katakit.method.name'] ??
        span.attributes['katakit.effect.name'] ??
        `effect ${span.attributes['katakit.effect.index']}`
    ),
    effectIndex:
      typeof span.attributes['katakit.effect.index'] === 'number'
        ? span.attributes['katakit.effect.index']
        : undefined,
    start: milliseconds(span.startTime),
    end: ended ? milliseconds(span.endTime) : undefined,
    outcome: !ended ? 'running' : span.status.code === 2 ? 'failed' : 'returned',
    errorType: span.attributes['error.type']?.toString(),
    spanId: span.spanContext().spanId,
    traceId: span.spanContext().traceId,
    parentSpanId: span.parentSpanContext?.spanId,
  });
  const spanProcessor: SpanProcessor = {
    onStart: span => {
      if (accepts(span)) append(spanEntry(span, false));
    },
    onEnd: span => {
      // Cleared/evicted invocations must not reappear when their pending work finishes.
      if (accepts(span) && entries.has(spanKey(span))) append(spanEntry(span, true));
    },
    forceFlush: async () => {},
    shutdown: async () => {
      disconnect?.();
    },
  };
  return {
    spanProcessor,
    capacity,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear: () => {
      entries.clear();
      snapshot = { ...snapshot, omitted: 0 };
      publish();
    },
    connect: (runtime: AliveKatakit) => {
      if (connected) throw new Error('This capture is already connected to a runtime');
      connected = runtime;
      const subscriptions: { unsubscribe: () => void }[] = [];
      let attached = true;
      const cleanup = () => {
        if (!attached) return;
        attached = false;
        subscriptions.forEach(subscription => subscription.unsubscribe());
        connected = undefined;
        disconnect = undefined;
      };
      disconnect = cleanup;
      for (const plugin of runtime.inspect().plugins) {
        for (const [name, source] of Object.entries(plugin.observables)) {
          const key = observableKey(plugin.type, name);
          updateValue(key, { status: 'waiting' });
          const fail = (error: unknown) => {
            updateValue(key, { status: 'failed', value: formatValue(error) });
            publish();
          };
          try {
            const property = source as typeof source & { get?: () => unknown };
            if (property.get)
              updateValue(key, { status: 'live', value: formatValue(property.get()) });
            subscriptions.push(
              source.subscribe({
                next: value => {
                  const rendered = formatValue(value);
                  updateValue(key, { status: 'live', value: rendered });
                  const active = trace.getActiveSpan()?.spanContext();
                  append({
                    id: `emission:${++sequence}`,
                    kind: 'emission',
                    plugin: plugin.type,
                    name,
                    start: Date.now(),
                    outcome: 'returned',
                    value: rendered,
                    ...(active && isSpanContextValid(active)
                      ? { traceId: active.traceId, parentSpanId: active.spanId }
                      : {}),
                  });
                },
                error: fail,
                complete: () => {
                  const previous = snapshot.values[key];
                  updateValue(key, { ...previous, status: 'complete' });
                  publish();
                },
              })
            );
          } catch (error) {
            fail(error);
          }
        }
      }
      publish();
      return cleanup;
    },
  };
};

export type DevToolsStore = ReturnType<typeof createDevToolsStore>;
