import { startEffects } from './effect';
import { KatakitEvent } from './EventLog/event';
import { EventLogPlugin } from './EventLog/plugin';
import { GetMethods, makeGetMethods } from './methods';
import { GetObservables, makeGetObservables } from './observables';
import { ConfiguredKatakitPlugin } from './plugin';
import { assert } from './utils/assert';

export type KatakitConfig<TConfiguredKatakitPlugins extends ConfiguredKatakitPlugin<any, any>[]> = {
  /** Seed the built-in log with host-validated history. Defaults to an empty log. */
  existingEvents?: KatakitEvent[];
  plugins: TConfiguredKatakitPlugins;
};

export type Katakit = {
  start: () => AliveKatakit;
  getObservables: GetObservables;
};

export type AliveKatakit = {
  getObservables: GetObservables;
  getMethods: GetMethods;
};

const assertNoDuplicatePlugins = (plugins: readonly { type: string }[]) => {
  const seen = new Set<string>();
  for (const plugin of plugins) {
    assert(!seen.has(plugin.type), `Duplicate plugin type: ${plugin.type}`);
    seen.add(plugin.type);
  }
};

export const makeKatakit = <TConfiguredKatakitPlugins extends ConfiguredKatakitPlugin<any, any>[]>(
  config: KatakitConfig<TConfiguredKatakitPlugins>
): Katakit => {
  const { plugins: userPlugins, existingEvents = [] } = config;
  const plugins = [EventLogPlugin.configure({ existingEvents }), ...userPlugins];
  assertNoDuplicatePlugins(plugins);

  const getObservables = makeGetObservables({ plugins });

  let alive = false;

  const start = (): AliveKatakit => {
    assert(!alive, 'Katakit is already started');
    alive = true;

    const getMethods = makeGetMethods({ plugins, getObservables });
    startEffects({ plugins, getObservables, getMethods });

    return { getObservables, getMethods };
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
