import { takeUntil, type Observable } from 'rxjs';
import { type GetMethods } from './methods';
import { type GetObservables } from './observables';
import { type ConfiguredKatakitPlugin } from './plugin';
import {
  subscribeWithBackpressure,
  type BackpressureStrategy,
} from './utils/reactive/backpressure';
import { KatakitLifecyclePlugin } from './plugins/KatakitLifecycle/plugin';

/**
 * Brand symbol on `Effect<T>` --
 * you need to use the factory function for better type safety.
 */
const MUST_USE_EFFECT_FACTORY = Symbol('MUST_USE_EFFECT_FACTORY');

export type Effect<T> = {
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
}: {
  plugins: ConfiguredKatakitPlugin<any, any>[];
  getObservables: GetObservables;
  getMethods: GetMethods;
}) => {
  const stop$ = getObservables(KatakitLifecyclePlugin).stop$;
  for (const plugin of plugins) {
    for (const effect of plugin.effects({
      observables: getObservables(plugin),
      methods: getMethods(plugin),
      getObservables,
      getMethods,
    })) {
      subscribeWithBackpressure(
        effect.backpressure,
        effect.on.pipe(takeUntil(stop$)),
        effect.handler
      );
    }
  }
};
