import { expect, it } from 'vitest';
import { createTextSession } from './session';

it('ingests recognized speech through Katakit and flushes a conversation turn', () => {
  const session = createTextSession();
  expect(() => session.acceptRecognized('  ')).toThrow('No speech');
  session.acceptRecognized('  sample line  ');
  expect(session.conversationTurns$.get().map(turn => turn.text)).toEqual(['sample line']);
  session.acceptRecognized('second line');
  expect(session.conversationTurns$.get().map(turn => turn.text)).toEqual([
    'sample line',
    'second line',
  ]);
  session.close();
});
