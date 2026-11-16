import { startEffects } from './effect';
import { GetMethods, makeGetMethods } from './methods';
import { GetObservables, makeGetObservables } from './observables';
import { ConfiguredKatakitPlugin } from './plugin';
import { KatakitLifecyclePlugin } from './plugins/KatakitLifecycle/plugin';
import { assert } from './utils/assert';

export type KatakitConfig<TConfiguredKatakitPlugins extends ConfiguredKatakitPlugin<any, any>[]> = {
  plugins: TConfiguredKatakitPlugins;
};

export type Katakit = {
  start: () => AliveKatakit;
  getObservables: GetObservables;
};

export type AliveKatakit = {
  getObservables: GetObservables;
  getMethods: GetMethods;
  stop: () => void;
};

const INTERNAL_PLUGINS = [KatakitLifecyclePlugin.configure({})] as const;

export const makeKatakit = <TConfiguredKatakitPlugins extends ConfiguredKatakitPlugin<any, any>[]>(
  config: KatakitConfig<TConfiguredKatakitPlugins>
): Katakit => {
  const { plugins: userPlugins } = config;

  const plugins = [...INTERNAL_PLUGINS, ...userPlugins];

  const getObservables = makeGetObservables({ plugins });

  let alive = false;

  const start = (): AliveKatakit => {
    assert(!alive, 'Katakit is already started');
    alive = true;

    const getMethods = makeGetMethods({ plugins, getObservables });
    startEffects({ plugins, getObservables, getMethods });

    const lifecycleMethods = getMethods(KatakitLifecyclePlugin);
    lifecycleMethods.start();
    const stop = lifecycleMethods.stop;

    return { getObservables, getMethods, stop };
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
