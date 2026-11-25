import assert from 'node:assert/strict';
import test from 'node:test';
import { createTranscriptSession } from '../src/katakit.ts';

test('final recognized speech becomes a Katakit turn; stopping flushes the remainder', () => {
  const session = createTranscriptSession();
  try {
    session.onProvisional('hello');
    assert.equal(session.provisional$.get()?.text, 'hello');
    session.onFinal({ id: '1', sourceId: 'mic', text: 'Hello Katakit.' });
    session.onStop();
    assert.deepEqual(
      session.turns$.get().map(turn => turn.text),
      ['Hello Katakit.']
    );
  } finally {
    session.close();
  }
});
