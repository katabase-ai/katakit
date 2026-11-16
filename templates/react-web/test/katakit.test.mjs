import assert from 'node:assert/strict';
import test from 'node:test';
import { emitText, events$ } from '../src/katakit.ts';

test('typed text is validated, emitted and replayed by Katakit', () => {
  assert.deepEqual(events$.getAll(), []);

  const seen = [];
  const subscription = events$.subscribe(event => seen.push(event));
  try {
    emitText('Hello Katakit');
    const expected = [{ type: 'text', text: 'Hello Katakit' }];
    assert.deepEqual(seen, expected);
    assert.deepEqual(events$.getAll(), expected);

    assert.throws(() => emitText(''), /Invalid event/);
    assert.deepEqual(events$.getAll(), expected);

    const replayed = [];
    const lateSubscription = events$.subscribe(event => replayed.push(event));
    try {
      assert.deepEqual(replayed, expected);
    } finally {
      lateSubscription.unsubscribe();
    }
  } finally {
    subscription.unsubscribe();
  }
});
