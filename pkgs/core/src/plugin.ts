import { type Effect } from './effect';
import { type GetMethods, type MethodsObj } from './methods';
import { type GetObservables, type ObservablesObj } from './observables';
import { type EmptyObj } from './utils/EmptyObj';

export type OptionsObj = Record<string, unknown>;

export type MakeKatakitPluginConfigObservablesCtx<TOptions extends OptionsObj> = {
  options: TOptions;
  getObservables: GetObservables;
};
export type MakeKatakitPluginConfigMethodsCtx<
  TOptions extends OptionsObj,
  TObservables extends ObservablesObj,
> = {
  options: TOptions;
  observables: TObservables;
  getObservables: GetObservables;
  getMethods: GetMethods;
};
export type MakeKatakitPluginConfigEffectsCtx<
  TOptions extends OptionsObj,
  TObservables extends ObservablesObj,
  TMethods extends MethodsObj,
> = {
  options: TOptions;
  observables: TObservables;
  methods: TMethods;
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
  observables?: (ctx: MakeKatakitPluginConfigObservablesCtx<NoInfer<TOutOptions>>) => TObservables;
  methods?: (
    ctx: MakeKatakitPluginConfigMethodsCtx<NoInfer<TOutOptions>, NoInfer<TObservables>>
  ) => TMethods;
  effects?: (
    ctx: MakeKatakitPluginConfigEffectsCtx<
      NoInfer<TOutOptions>,
      NoInfer<TObservables>,
      NoInfer<TMethods>
    >
  ) => Effect<any>[];
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
    observables,
    getObservables,
    getMethods,
  }: {
    observables: TObservables;
    getObservables: GetObservables;
    getMethods: GetMethods;
  }) => TMethods;
  effects: ({
    observables,
    methods,
    getObservables,
    getMethods,
  }: {
    observables: TObservables;
    methods: TMethods;
    getObservables: GetObservables;
    getMethods: GetMethods;
  }) => Effect<any>[];
};

export const makeKatakitPlugin = <
  TInOptions extends OptionsObj,
  TOutOptions extends OptionsObj,
  TObservables extends ObservablesObj = EmptyObj,
  TMethods extends MethodsObj = EmptyObj,
>(
  config: MakeKatakitPluginConfig<TInOptions, TOutOptions, TObservables, TMethods>
): KatakitPlugin<TInOptions, TObservables, TMethods> => {
  const configure = (
    options: NoInfer<TInOptions>
  ): ConfiguredKatakitPlugin<TObservables, TMethods> => {
    const outOptions = config.configure(options);
    return {
      type: config.type,
      observables: ({ getObservables }: { getObservables: GetObservables }) =>
        config.observables?.({ options: outOptions, getObservables }) ?? ({} as TObservables),
      methods: ({
        observables,
        getObservables,
        getMethods,
      }: {
        observables: TObservables;
        getObservables: GetObservables;
        getMethods: GetMethods;
      }) =>
        config.methods?.({ options: outOptions, observables, getObservables, getMethods }) ??
        ({} as TMethods),
      effects: ({
        observables,
        methods,
        getObservables,
        getMethods,
      }: {
        observables: TObservables;
        methods: TMethods;
        getObservables: GetObservables;
        getMethods: GetMethods;
      }) =>
        config.effects?.({
          options: outOptions,
          observables,
          methods,
          getObservables,
          getMethods,
        }) ?? [],
    };
  };

  return {
    type: config.type,
    configure,
  };
};
