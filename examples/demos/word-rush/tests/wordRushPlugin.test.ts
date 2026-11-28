import { EventLogPlugin, makeKatakit } from '@katakit/core';
import { expect, test, vi } from 'vitest';
import { WordRushPlugin } from '../src/wordRushPlugin';

test('the plugin owns accepted facts and replays board content without live work', () => {
  const live = makeKatakit({ plugins: [WordRushPlugin.configure({})] }).start();
  const game = live.getMethods(WordRushPlugin);
  const content = live.getObservables(WordRushPlugin).content$;
  game.startRound('round-1', 'animals-01', 60, 1000);
  game.recordSegment('source:segment', 'seal');
  const { accepted } = game.recordJudgments(
    [{ text: 'Seal', evidence: 'seal', probability: 1 }],
    1
  );
  expect(accepted).toBe(1);
  const id = content.get().notes[0]!.id;
  game.removeNote('unknown');
  expect(live.getObservables(EventLogPlugin).events$.getAll()).toHaveLength(3);
  game.removeNote(id);
  game.finishRound(900);
  game.completeRound();

  const history = live.getObservables(EventLogPlugin).events$.getAll();
  expect(history.map(event => event.type)).toEqual([
    'roundStarted',
    'speechSegmentRecorded',
    'judgmentsAccepted',
    'answerRemoved',
    'roundEndingStarted',
    'roundInputSealed',
  ]);
  const random = vi.spyOn(crypto, 'randomUUID');
  const clock = vi.spyOn(globalThis, 'setInterval');
  try {
    const restored = makeKatakit({
      existingEvents: history,
      plugins: [WordRushPlugin.configure({})],
    });
    expect(restored.getObservables(WordRushPlugin).content$.get()).toEqual(content.get());
    expect(restored.getObservables(EventLogPlugin).events$.getAll()).toEqual(history);
    expect(random).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
  } finally {
    random.mockRestore();
    clock.mockRestore();
  }
});

test('a final segment can be recorded while a round is draining', () => {
  const kit = makeKatakit({ plugins: [WordRushPlugin.configure({})] }).start();
  const game = kit.getMethods(WordRushPlugin);
  game.startRound('round-1', 'animals-01', 60, 1000);
  game.finishRound(1000);
  game.recordSegment('late-final', 'dolphin');
  game.completeRound();
  game.recordSegment('after-flush', 'seal');
  expect(kit.getObservables(WordRushPlugin).content$.get().segments).toEqual([
    { id: 'late-final', text: 'dolphin' },
  ]);
});
