import { startEffects } from './effect';
import { GetMethods, makeGetMethods } from './methods';
import { GetObservables, makeGetObservables } from './observables';
import { ConfiguredKatakitPlugin } from './plugin';

export type KatakitConfig<TConfiguredKatakitPlugins extends ConfiguredKatakitPlugin<any, any>[]> = {
  plugins: TConfiguredKatakitPlugins;
};

export type Katakit = {
  getObservables: GetObservables;
  getMethods: GetMethods;
};

export const startKatakit = <TConfiguredKatakitPlugins extends ConfiguredKatakitPlugin<any, any>[]>(
  config: KatakitConfig<TConfiguredKatakitPlugins>
) => {
  const { plugins } = config;

  const getObservables = makeGetObservables({ plugins });
  const getMethods = makeGetMethods({ plugins, getObservables });
  startEffects({ plugins, getObservables, getMethods });

  return {
    getObservables,
    getMethods,
  };
};
