import { takeUntil, type Observable } from 'rxjs';
import { type ConfiguredKatakitPlugin, type KatakitPlugin } from './plugin';
import { assert } from './utils/assert';

export type ObservablesObj = Record<`${string}$`, Observable<unknown>>;

export type GetObservables = <TObservables extends ObservablesObj>(
  plugin: KatakitPlugin<any, TObservables, any> | ConfiguredKatakitPlugin<TObservables, any>
) => TObservables;

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

    const observablesWithLifecycle =
      found.type === 'KatakitLifecycle'
        ? Object.fromEntries(
            Object.entries(observables).map(([key, observable]) => [
              key,
              (observable as Observable<unknown>).pipe(
                takeUntil(
                  getObservables(found as ConfiguredKatakitPlugin<{ stop$: Observable<void> }, {}>)
                    .stop$
                )
              ),
            ])
          )
        : observables;

    observablesByPlugin.set(found, observablesWithLifecycle);
    return observablesWithLifecycle;
  };
  return getObservables;
};
