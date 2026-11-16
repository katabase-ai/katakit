import { type GetObservables } from './observables';
import { type ConfiguredKatakitPlugin, type KatakitPlugin } from './plugin';
import { assert } from './utils/assert';
import { type Tracer } from '@opentelemetry/api';
import { traceMethods } from './tracing';

export type MethodsObj = Record<string, (...args: any[]) => unknown>;

export type GetMethods = <TMethods extends MethodsObj>(
  plugin: KatakitPlugin<any, any, TMethods> | ConfiguredKatakitPlugin<any, TMethods>
) => TMethods;

export const makeGetMethods = ({
  plugins,
  getObservables,
  tracer,
}: {
  plugins: ConfiguredKatakitPlugin<any, any>[];
  getObservables: GetObservables;
  tracer?: Tracer;
}) => {
  // Effects and callers must share method-owned resources such as an in-flight write.
  const methodsByPlugin = new Map<ConfiguredKatakitPlugin<any, any>, MethodsObj>();
  const getMethods = <TMethods extends MethodsObj>(
    plugin: KatakitPlugin<any, any, TMethods> | ConfiguredKatakitPlugin<any, TMethods>
  ): TMethods => {
    const found = plugins.find(p => p.type === plugin.type);
    assert(found, `Plugin not found: ${plugin.type}`);
    const cached = methodsByPlugin.get(found);
    if (cached) return cached as TMethods;

    const methods = found.methods({
      observables: getObservables(found),
      getObservables,
      getMethods,
    });
    const instrumented = tracer ? traceMethods(tracer, found.type, methods) : methods;
    methodsByPlugin.set(found, instrumented);
    return instrumented as TMethods;
  };
  return getMethods;
};
