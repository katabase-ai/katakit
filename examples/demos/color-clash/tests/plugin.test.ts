import { EventLogPlugin, makeKatakit, type KatakitEvent } from '@katakit/core';
import { expect, test, vi } from 'vitest';
import { ColorClashPlugin } from '../src/color-clash/plugin';
import type { Target } from '../src/color-clash/events';

const first: Target = { sequence: 0, ink: 'red', word: 'blue', left: 40, top: 45 };
const next: Target = { sequence: 1, ink: 'green', word: 'yellow', left: 55, top: 50 };
const another: Target = { sequence: 2, ink: 'red', word: 'blue', left: 40, top: 45 };
const create = (existingEvents: KatakitEvent[] = []) => {
  const kit = makeKatakit({ existingEvents, plugins: [ColorClashPlugin.configure({})] }).start();
  return {
    game: kit.getMethods(ColorClashPlugin),
    content: kit.getObservables(ColorClashPlugin).game$,
    history: kit.getObservables(EventLogPlugin).events$,
  };
};

test('a round records separate match and miss facts and replays the exact targets and score', () => {
  const { game, content, history } = create();
  expect(content.get()).toBeNull();
  game.startRound(first, 20000);
  game.acceptAnswer('blue', () => next);
  const choose = vi.fn(() => next);
  game.acceptAnswer('red', choose);
  expect(choose).toHaveBeenCalledOnce();
  game.endRound('deadlineReached');
  expect(history.getAll().map(event => event.type)).toEqual([
    'roundStarted',
    'targetMissed',
    'targetMatched',
    'roundEnded',
  ]);
  expect(content.get()).toMatchObject({
    phase: 'finished',
    score: 1,
    mistake: 0,
    target: next,
    popped: first,
  });
  const replay = create(history.getAll());
  expect(replay.content.get()).toEqual(content.get());
  expect(replay.history.getAll()).toEqual(history.getAll());
  expect(choose).toHaveBeenCalledOnce();
});

test('ignores answers outside a round and starts a fresh projection on the next round', () => {
  const { game, content, history } = create();
  const choose = vi.fn(() => next);
  game.acceptAnswer('red', choose);
  game.endRound('captureStopped');
  expect(history.getAll()).toHaveLength(0);
  game.startRound(first, 20000);
  expect(() => game.startRound(first, 30000)).toThrow('already playing');
  game.acceptAnswer('red', choose);
  game.endRound('captureStopped');
  game.acceptAnswer('red', choose);
  game.endRound('captureStopped');
  expect(choose).toHaveBeenCalledOnce();
  game.startRound(another, 50000);
  expect(content.get()).toMatchObject({ phase: 'playing', score: 0, mistake: 0, target: another });
  expect(history.getAll().map(event => event.type)).toEqual([
    'roundStarted',
    'targetMatched',
    'roundEnded',
    'roundStarted',
  ]);
});

test('rejects invalid commands without recording facts or retaining caller-owned targets', () => {
  const { game, history } = create();
  expect(() => game.startRound({ ...first, word: 'red' }, 20000)).toThrow('Invalid');
  expect(() => game.startRound({ ...first, left: NaN }, 20000)).toThrow('Invalid');
  expect(() => game.startRound(first, Infinity)).toThrow('Invalid');
  expect(history.getAll()).toHaveLength(0);
  const deal = { ...first };
  game.startRound(deal, 20000);
  deal.ink = 'blue';
  expect(history.getAll()[0]).toMatchObject({ target: first });
  expect(() => game.acceptAnswer('pink' as Target['ink'], () => next)).toThrow('Invalid');
  expect(() => game.acceptAnswer('red', () => ({ ...next, sequence: 8 }))).toThrow('Invalid');
  expect(() => game.acceptAnswer('red', () => ({ ...next, ink: 'red' }))).toThrow('Invalid');
  expect(history.getAll()).toHaveLength(1);
});
