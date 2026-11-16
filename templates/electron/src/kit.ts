import { makeKatakit } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import * as v from 'valibot';

// Replace this schema and plugin configuration with your application's events.
const NoteLog = makeEventLogPlugin({
  validateEvent: v.strictObject({
    type: v.literal('note'),
    text: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300)),
  }),
});

const kit = makeKatakit({ plugins: [NoteLog.configure({ initialEvents: [] })] });
const alive = kit.start();

export const { emitEvent } = alive.getMethods(NoteLog);
export const events$ = alive.getObservables(NoteLog).events$;
