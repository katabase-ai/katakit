import { type GetObservables } from './observables';
import { type ConfiguredKatakitPlugin, type KatakitPlugin } from './plugin';
import { assert } from './utils/assert';

export type MethodsObj = Record<string, (...args: any[]) => unknown>;

export type GetMethods = <TMethods extends MethodsObj>(
  plugin: KatakitPlugin<any, any, TMethods>
) => TMethods;

export const makeGetMethods = ({
  plugins,
  getObservables,
}: {
  plugins: ConfiguredKatakitPlugin<any, any>[];
  getObservables: GetObservables;
}) => {
  const getMethods = <TMethods extends MethodsObj>(
    plugin: KatakitPlugin<any, any, TMethods> | ConfiguredKatakitPlugin<any, TMethods>
  ): TMethods => {
    const found = plugins.find(p => p.type === plugin.type);
    assert(found, `Plugin not found: ${plugin.type}`);
    return found.methods({ getObservables, getMethods });
  };
  return getMethods;
};
