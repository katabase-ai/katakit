import { expect, it } from 'vitest';
import { createTextSession } from './session';

it('ingests supplied text through Katakit and flushes a conversation turn', () => {
  const session = createTextSession();
  expect(() => session.submit('  ')).toThrow('Enter text');
  session.submit('  sample line  ');
  expect(session.conversationTurns$.get().map(turn => turn.text)).toEqual(['sample line']);
  session.submit('second line');
  expect(session.conversationTurns$.get().map(turn => turn.text)).toEqual([
    'sample line',
    'second line',
  ]);
  session.close();
});
