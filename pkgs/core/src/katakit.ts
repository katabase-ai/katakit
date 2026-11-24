import { startEffects } from './effect';
import { EventLogPlugin } from './EventLog/plugin';
import { GetMethods, makeGetMethods } from './methods';
import { GetObservables, makeGetObservables } from './observables';
import { ConfiguredKatakitPlugin } from './plugin';
import { assert } from './utils/assert';

export type KatakitConfig<TConfiguredKatakitPlugins extends ConfiguredKatakitPlugin<any, any>[]> = {
  /** Seed the built-in log with host-validated history. Defaults to an empty log. */
  existingEvents?: readonly unknown[];
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

export const makeKatakit = <TConfiguredKatakitPlugins extends ConfiguredKatakitPlugin<any, any>[]>(
  config: KatakitConfig<TConfiguredKatakitPlugins>
): Katakit => {
  const { plugins: userPlugins, existingEvents } = config;

  // Lookups use the plugin type, so a configured (e.g. schema-validating)
  // EventLog must serve both handles rather than being shadowed by the default.
  const hasEventLog = userPlugins.some(plugin => plugin.type === EventLogPlugin.type);
  assert(
    !hasEventLog || existingEvents === undefined,
    'Supply history on the configured EventLog plugin instead of passing existingEvents'
  );
  const plugins = hasEventLog
    ? userPlugins
    : [EventLogPlugin.configure({ existingEvents: existingEvents ?? [] }), ...userPlugins];

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
