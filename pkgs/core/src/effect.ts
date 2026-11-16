import { map, type Observable } from 'rxjs';
import { context, type Tracer } from '@opentelemetry/api';
import { traceInvocation } from './tracing';
import { type GetMethods } from './methods';
import { type GetObservables } from './observables';
import { type ConfiguredKatakitPlugin } from './plugin';
import {
  subscribeWithBackpressure,
  type BackpressureStrategy,
} from './utils/reactive/backpressure';

/**
 * Brand symbol on `Effect<T>` --
 * you need to use the factory function for better type safety.
 */
const MUST_USE_EFFECT_FACTORY = Symbol('MUST_USE_EFFECT_FACTORY');

export type Effect<T> = {
  /** Stable handler name used in tracing. Unnamed effects use their position in the plugin's effect array. */
  name?: string;
  on: Observable<T>;
  backpressure: BackpressureStrategy;
  handler: (value: T) => void | Promise<void>;
  readonly [MUST_USE_EFFECT_FACTORY]: true;
};

export const makeEffect = <T>(
  effect: Omit<Effect<T>, typeof MUST_USE_EFFECT_FACTORY>
): Effect<T> => {
  return {
    ...effect,
    [MUST_USE_EFFECT_FACTORY]: true,
  };
};

export const startEffects = ({
  plugins,
  getObservables,
  getMethods,
  tracer,
}: {
  plugins: ConfiguredKatakitPlugin<any, any>[];
  getObservables: GetObservables;
  getMethods: GetMethods;
  tracer?: Tracer;
}) => {
  for (const plugin of plugins) {
    const effects = plugin.effects({
      observables: getObservables(plugin),
      methods: getMethods(plugin),
      getObservables,
      getMethods,
    });
    for (const [index, effect] of effects.entries()) {
      if (!tracer) {
        subscribeWithBackpressure(effect.backpressure, effect.on, effect.handler);
        continue;
      }
      // Capture the producer's context before the async iterator queues or coalesces its value.
      // A span starts only for a handler that actually runs, after backpressure selection.
      const source = effect.on.pipe(map(value => ({ value, parent: context.active() })));
      subscribeWithBackpressure(effect.backpressure, source, ({ value, parent }) =>
        traceInvocation(
          tracer,
          `${plugin.type}.effect.${effect.name ?? index}`,
          {
            'katakit.plugin.type': plugin.type,
            'katakit.invocation.kind': 'effect',
            'katakit.effect.index': index,
            ...(effect.name === undefined ? {} : { 'katakit.effect.name': effect.name }),
            'katakit.effect.backpressure': effect.backpressure,
          },
          () => effect.handler(value),
          parent
        )
      );
    }
  }
};
