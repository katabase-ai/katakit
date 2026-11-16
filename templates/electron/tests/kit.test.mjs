import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emitEvent, events$ } from '../src/kit.ts';

test('Katakit validates input and publishes a note', () => {
  const received = [];
  const subscription = events$.subscribe(event => received.push(event));
  try {
    emitEvent({ type: 'note', text: '  Follow up  ' });
    assert.deepEqual(received, [{ type: 'note', text: 'Follow up' }]);
    assert.throws(() => emitEvent({ type: 'note', text: '   ' }), /Invalid event/);
    assert.equal(received.length, 1);
  } finally {
    subscription.unsubscribe();
  }
});
