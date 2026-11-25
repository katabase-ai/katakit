import { expect, test } from 'vitest';
import { createTranscriptSession } from './kit';

test('a saved segment and its queued delivery produce one turn; a new source can reuse its ID', () => {
  const session = createTranscriptSession();
  try {
    const segment = { id: '1', sourceId: 'tab', text: 'Hello from the tab.' };
    session.onFinal(segment);
    session.onFinal(segment);
    session.onFinal({ ...segment, sourceId: 'next-tab', text: 'Another tab.' });
    session.onStop();
    expect(session.turns$.get().map(turn => turn.text)).toEqual([
      'Hello from the tab.',
      'Another tab.',
    ]);
  } finally {
    session.close();
  }
});
