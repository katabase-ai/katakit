import { makeKatakit, makeKatakitPlugin } from '@katakit/core';
import { BehaviorSubject } from 'rxjs';

// Replace this tiny plugin with a shared text-processing plugin in your application.
const textPlugin = makeKatakitPlugin({
  type: 'TypedText',
  configure: (_options: {}) => ({ turns: new BehaviorSubject<string[]>([]) }),
  observables: ({ options }) => ({ turns$: options.turns.asObservable() }),
  methods: ({ options }) => ({
    addText: (text: string) => options.turns.next([...options.turns.value, text.trim()]),
    clearText: () => options.turns.next([]),
    close: () => options.turns.complete(),
  }),
});

const kit = makeKatakit({ plugins: [textPlugin.configure({})] });
const methods = kit.start().getMethods(textPlugin);
export const turns$ = kit.getObservables(textPlugin).turns$;
export const addText = methods.addText;
export const clearText = methods.clearText;
export const closeKit = methods.close;
