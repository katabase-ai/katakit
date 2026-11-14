import { type Observable } from 'rxjs';
import { type ConfiguredKatakitPlugin, type KatakitPlugin } from './plugin';
import { assert } from './utils/assert';

export type ObservablesObj = Record<`${string}$`, Observable<unknown>>;

export type GetObservables = <TObservables extends ObservablesObj>(
  plugin: KatakitPlugin<any, TObservables, any>
) => TObservables;

export const makeGetObservables = ({
  plugins,
}: {
  plugins: ConfiguredKatakitPlugin<any, any>[];
}) => {
  const getObservables = <TObservables extends ObservablesObj>(
    plugin: KatakitPlugin<any, TObservables, any> | ConfiguredKatakitPlugin<TObservables, any>
  ): TObservables => {
    const found = plugins.find(p => p.type === plugin.type);
    assert(found, `Plugin not found: ${plugin.type}`);
    return found.observables({ getObservables });
  };
  return getObservables;
};
