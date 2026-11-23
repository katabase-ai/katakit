import { type Observable } from 'rxjs';
import { type ConfiguredKatakitPlugin, type KatakitPlugin } from './plugin';
import { assert } from './utils/assert';

export type ObservablesObj = Record<`${string}$`, Observable<unknown>>;

export type GetObservables = <TObservables extends ObservablesObj>(
  plugin: KatakitPlugin<any, TObservables, any> | ConfiguredKatakitPlugin<TObservables, any>
) => TObservables;

// Private, versioned handshake with the optional browser recorder. A recorder
// failure must not prevent construction or cause a plugin factory to run twice.
const inspectObservables = (
  runtime: object,
  plugin: string,
  streams: ObservablesObj
): ObservablesObj => {
  try {
    const inspect = Reflect.get(globalThis, Symbol.for('katakit.devtools.observables.v1')) as
      | ((runtime: object, plugin: string, streams: ObservablesObj) => ObservablesObj)
      | undefined;
    return typeof inspect === 'function' ? (inspect(runtime, plugin, streams) ?? streams) : streams;
  } catch {
    return streams;
  }
};

export const makeGetObservables = ({
  plugins,
}: {
  plugins: ConfiguredKatakitPlugin<any, any>[];
}) => {
  // Every consumer in one runtime must read the same plugin state.
  const observablesByPlugin = new Map<ConfiguredKatakitPlugin<any, any>, ObservablesObj>();
  const getObservables = <TObservables extends ObservablesObj>(
    plugin: KatakitPlugin<any, TObservables, any> | ConfiguredKatakitPlugin<TObservables, any>
  ): TObservables => {
    const found = plugins.find(p => p.type === plugin.type);
    assert(found, `Plugin not found: ${plugin.type}`);
    const cached = observablesByPlugin.get(found);
    if (cached) return cached as TObservables;

    const observables = found.observables({ getObservables });
    const exposed = inspectObservables(getObservables, found.type, observables);
    observablesByPlugin.set(found, exposed);
    return exposed as TObservables;
  };
  return getObservables;
};
