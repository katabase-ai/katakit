import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTranscriptSession } from '../src/kit.ts';

test('final recognized speech becomes a Katakit turn on stop', () => {
  const session = createTranscriptSession();
  try {
    session.onProvisional('Follow');
    session.onFinal({ id: '1', sourceId: 'mic', text: 'Follow up.' });
    session.onStop();
    assert.deepEqual(
      session.conversationTurns$.get().map(turn => turn.text),
      ['Follow up.']
    );
  } finally {
    session.close();
  }
});
