import { expect, test } from 'vitest';
import { createTranscriptSession } from './kit';

test('recognized segments become Katakit turns and reset clears them', () => {
  const session = createTranscriptSession();
  try {
    session.onFinal({ id: '1', sourceId: 'tab', text: 'Hello from the tab.' });
    session.onStop();
    expect(session.conversationTurns$.get().map(turn => turn.text)).toEqual([
      'Hello from the tab.',
    ]);
    session.clear();
    expect(session.conversationTurns$.get()).toEqual([]);
  } finally {
    session.close();
  }
});
