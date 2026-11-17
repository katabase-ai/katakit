import { makeKatakit, makeKatakitPlugin, property } from '@katakit/core';
import { BehaviorSubject } from 'rxjs';

// Template-owned plugin: replace this with a reusable plugin as your app grows.
const Notes = makeKatakitPlugin({
  type: 'Notes',
  configure: () => ({ state: new BehaviorSubject<string[]>([]) }),
  observables: ({ options }) => ({ notes$: property(options.state.asObservable()) }),
  methods: ({ options, observables }) => ({
    add: (text: string) => {
      const note = text.trim();
      if (!note || note.length > 160) throw new Error('Enter a note of 1–160 characters.');
      options.state.next([...observables.notes$.get(), note]);
    },
    close: () => options.state.complete(),
  }),
});

export const createNotes = () => {
  const kit = makeKatakit({ plugins: [Notes.configure({})] });
  const running = kit.start();
  return {
    notes$: running.getObservables(Notes).notes$,
    ...running.getMethods(Notes),
  };
};
