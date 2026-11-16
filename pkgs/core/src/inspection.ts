import type { ObservablesObj } from './observables';
import type { BackpressureStrategy } from './utils/reactive/backpressure';

/** Declared handler identity, available before its first invocation. Sources remain opaque RxJS streams. */
export type EffectInspection = {
  index: number;
  name?: string;
  backpressure: BackpressureStrategy;
};

/** The existing runtime-owned observable collection and names of its constructed capabilities. */
export type PluginInspection = {
  type: string;
  observables: ObservablesObj;
  methods: string[];
  effects: EffectInspection[];
};

/** Read-only diagnostic inventory of a started runtime; inspection never constructs another plugin instance. */
export type RuntimeInspection = {
  tracing: boolean;
  plugins: PluginInspection[];
};
