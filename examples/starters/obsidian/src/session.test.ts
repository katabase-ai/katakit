import { expect, it } from 'vitest';
import { createTextSession } from './session';

it('ingests recognized speech through Katakit and flushes a conversation turn', () => {
  const session = createTextSession();
  expect(() => session.acceptRecognized('  ', 100)).toThrow('No speech');
  session.acceptRecognized('  sample line  ', 1250);
  expect(session.turns$.get()).toMatchObject([{ text: 'sample line', startMs: 0, endMs: 1250 }]);
  session.acceptRecognized('second line', 920);
  expect(session.turns$.get().map(turn => turn.text)).toEqual(['sample line', 'second line']);
  session.close();
});
