import { Effect } from './effect';
import { type GetMethods, type MethodsObj } from './methods';
import { type GetObservables, type ObservablesObj } from './observables';

export type OptionsObj = Record<string, unknown>;

export type MakeKatakitPluginConfigObservablesCtx<TOptions extends OptionsObj> = {
  options: TOptions;
  getObservables: GetObservables;
};
export type MakeKatakitPluginConfigMethodsCtx<TOptions extends OptionsObj> = {
  options: TOptions;
  getObservables: GetObservables;
  getMethods: GetMethods;
};
export type MakeKatakitPluginConfigEffectsCtx<TOptions extends OptionsObj> = {
  options: TOptions;
  getObservables: GetObservables;
  getMethods: GetMethods;
};
export type MakeKatakitPluginConfig<
  TInOptions extends OptionsObj,
  TOutOptions extends OptionsObj,
  TObservables extends ObservablesObj,
  TMethods extends MethodsObj,
> = {
  type: string;
  configure: (options: TInOptions) => TOutOptions;
  observables: (ctx: MakeKatakitPluginConfigObservablesCtx<NoInfer<TOutOptions>>) => TObservables;
  methods: (ctx: MakeKatakitPluginConfigMethodsCtx<NoInfer<TOutOptions>>) => TMethods;
  effects: (ctx: MakeKatakitPluginConfigEffectsCtx<NoInfer<TOutOptions>>) => Effect<any>[];
};

export type KatakitPlugin<
  TOptions extends OptionsObj,
  TObservables extends ObservablesObj,
  TMethods extends MethodsObj,
> = {
  type: string;
  configure: (options: TOptions) => ConfiguredKatakitPlugin<TObservables, TMethods>;
};

export type ConfiguredKatakitPlugin<
  TObservables extends ObservablesObj,
  TMethods extends MethodsObj,
> = {
  type: string;
  observables: ({ getObservables }: { getObservables: GetObservables }) => TObservables;
  methods: ({
    getObservables,
    getMethods,
  }: {
    getObservables: GetObservables;
    getMethods: GetMethods;
  }) => TMethods;
  effects: ({
    getObservables,
    getMethods,
  }: {
    getObservables: GetObservables;
    getMethods: GetMethods;
  }) => Effect<any>[];
};

export const makeKatakitPlugin = <
  TInOptions extends OptionsObj,
  TOutOptions extends OptionsObj,
  TObservables extends ObservablesObj,
  TMethods extends MethodsObj,
>(
  config: MakeKatakitPluginConfig<TInOptions, TOutOptions, TObservables, TMethods>
): KatakitPlugin<TInOptions, TObservables, TMethods> => {
  const configure = (options: NoInfer<TInOptions>) => {
    const outOptions = config.configure(options);
    return {
      type: config.type,
      observables: ({ getObservables }: { getObservables: GetObservables }) =>
        config.observables({ options: outOptions, getObservables }),
      methods: ({
        getObservables,
        getMethods,
      }: {
        getObservables: GetObservables;
        getMethods: GetMethods;
      }) => config.methods({ options: outOptions, getObservables, getMethods }),
      effects: ({
        getObservables,
        getMethods,
      }: {
        getObservables: GetObservables;
        getMethods: GetMethods;
      }) => config.effects({ options: outOptions, getObservables, getMethods }),
    };
  };

  return {
    type: config.type,
    configure,
  };
};
