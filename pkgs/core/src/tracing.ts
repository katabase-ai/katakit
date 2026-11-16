import {
  context,
  SpanStatusCode,
  type Attributes,
  type Context,
  type Span,
  type Tracer,
} from '@opentelemetry/api';
import { type MethodsObj } from './methods';

/** Record execution metadata without copying application payloads or exception messages. */
const finishFailure = (span: Span, error: unknown) => {
  span.setAttribute('error.type', error instanceof Error ? error.name : typeof error);
  span.setStatus({ code: SpanStatusCode.ERROR });
  span.end();
};

const finishPromise = async (span: Span, promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    finishFailure(span, error);
    return;
  }
  span.end();
};

/** Keep synchronous calls synchronous and return the original promise to callers. */
export const traceInvocation = <T>(
  tracer: Tracer,
  name: string,
  attributes: Attributes,
  invoke: () => T,
  parent: Context = context.active()
): T =>
  tracer.startActiveSpan(name, { attributes }, parent, span => {
    // With no SDK or a dropped sampling decision, do not observe returned promises.
    if (!span.isRecording()) {
      try {
        return invoke();
      } finally {
        span.end();
      }
    }
    try {
      const result = invoke();
      if (result instanceof Promise) {
        // Observe settlement without replacing the method's result or swallowing its rejection.
        void finishPromise(span, result);
      } else {
        span.end();
      }
      return result;
    } catch (error) {
      finishFailure(span, error);
      throw error;
    }
  });

/** Wrap the constructed collection once, so effects and external callers share the same methods. */
export const traceMethods = (tracer: Tracer, pluginType: string, methods: MethodsObj) =>
  Object.fromEntries(
    Object.entries(methods).map(([name, method]) => [
      name,
      new Proxy(method, {
        apply: (target, receiver, args) =>
          traceInvocation(
            tracer,
            `${pluginType}.method.${name}`,
            {
              'katakit.plugin.type': pluginType,
              'katakit.invocation.kind': 'method',
              'katakit.method.name': name,
            },
            () => Reflect.apply(target, receiver, args)
          ),
      }),
    ])
  );
