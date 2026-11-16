import { makeKatakit } from '@katakit/core';
import { makeEventLogPlugin } from '@katakit/event-log';
import * as v from 'valibot';

// This is the application boundary: replace the schema/plugin and input wiring
// to adapt the starter. No microphone, network provider, or persistence is used.
const TextEventLog = makeEventLogPlugin({
  validateEvent: v.strictObject({
    type: v.literal('text'),
    text: v.pipe(v.string(), v.minLength(1)),
  }),
});
const textLog = TextEventLog.configure({ initialEvents: [] });
const katakit = makeKatakit({ plugins: [textLog] }).start();

export const events$ = katakit.getObservables(TextEventLog).events$;
export const emitText = (text: string) =>
  katakit.getMethods(TextEventLog).emitEvent({ type: 'text', text });
