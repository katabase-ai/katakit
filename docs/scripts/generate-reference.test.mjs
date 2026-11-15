import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateReference, renderReference } from './generate-reference.mjs';

test('reference is compiled from the public event-log export and its inferred plugin API', () => {
  const page = renderReference();
  assert.match(page, /## makeEventLogPlugin/);
  assert.match(page, /validateEvent: StandardSchemaV1<unknown, TEvent>/);
  assert.match(page, /initialEvents: TEvent\[\]/);
  assert.match(page, /events\$: WithEager<Observable<TEvent>>/);
  assert.match(page, /emitEvent: \(event: TEvent\) => void/);
});

test('generated event-log reference matches its sources', () => {
  assert.doesNotThrow(() => generateReference({ check: true }));
});
