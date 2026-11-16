import { startEffects } from './effect';
import { GetMethods, makeGetMethods } from './methods';
import { GetObservables, makeGetObservables } from './observables';
import { ConfiguredKatakitPlugin } from './plugin';
import { assert } from './utils/assert';
import { trace, type Tracer } from '@opentelemetry/api';
import type { RuntimeInspection } from './inspection';

export type KatakitConfig<TConfiguredKatakitPlugins extends ConfiguredKatakitPlugin<any, any>[]> = {
  plugins: TConfiguredKatakitPlugins;
  /** Defaults to the global OpenTelemetry tracer for `@katakit/core`. Set false to disable instrumentation. */
  tracer?: Tracer | false;
};

export type Katakit = {
  start: () => AliveKatakit;
  getObservables: GetObservables;
};

export type AliveKatakit = {
  getObservables: GetObservables;
  getMethods: GetMethods;
  /** Inspect capabilities constructed by start(), without calling factories or invoking methods again. */
  inspect: () => RuntimeInspection;
};

export const makeKatakit = <TConfiguredKatakitPlugins extends ConfiguredKatakitPlugin<any, any>[]>(
  config: KatakitConfig<TConfiguredKatakitPlugins>
): Katakit => {
  const { plugins } = config;
  const tracer =
    config.tracer === false ? undefined : (config.tracer ?? trace.getTracer('@katakit/core'));

  const getObservables = makeGetObservables({ plugins });

  let alive = false;

  const start = (): AliveKatakit => {
    assert(!alive, 'Katakit is already started');
    alive = true;

    const getMethods = makeGetMethods({ plugins, getObservables, tracer });
    const effects = startEffects({ plugins, getObservables, getMethods, tracer });

    return {
      getObservables,
      getMethods,
      inspect: () => ({
        tracing: tracer !== undefined,
        plugins: plugins.map(plugin => ({
          type: plugin.type,
          observables: getObservables(plugin),
          methods: Object.keys(getMethods(plugin)),
          effects: (effects.get(plugin.type) ?? []).map(effect => ({ ...effect })),
        })),
      }),
    };
  };

  return {
    start,
    /**
     * Use this if you just want to run the observable logic
     * without starting the full katakit instance, and subscribing effects.
     */
    getObservables,
  };
};
