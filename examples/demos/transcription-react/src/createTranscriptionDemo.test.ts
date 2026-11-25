import { afterEach, expect, it, vi } from 'vitest';
import { createTranscriptionDemo } from './createTranscriptionDemo';

afterEach(() => vi.useRealTimers());
it('shows each segment immediately and restores exactly before continuing, resetting and closing', () => {
  vi.useFakeTimers();
  const live = createTranscriptionDemo();
  live.ingestSegment({
    id: '1',
    sourceId: 'meeting',
    speaker: 'Ada',
    text: 'Hello',
    startMs: 0,
    endMs: 100,
  });
  expect(live.state$.get().currentTurn?.text).toBe('Hello');
  live.updateProvisional('not saved');
  const history = live.getHistory();
  const restored = createTranscriptionDemo({ initialEvents: history });
  expect(restored.state$.get().currentTurn).toEqual(live.state$.get().currentTurn);
  expect(restored.state$.get().provisional).toBeUndefined();
  restored.ingestSegment({ id: '1', sourceId: 'meeting', text: 'duplicate' });
  expect(restored.getHistory()).toEqual(history);
  restored.ingestSegment({
    id: '2',
    sourceId: 'meeting',
    speaker: 'Ada',
    text: 'world',
    startMs: 101,
    endMs: 200,
  });
  expect(restored.state$.get().currentTurn).toMatchObject({
    id: 'meeting\0' + '1',
    text: 'Hello world',
    startMs: 0,
    endMs: 200,
    speaker: 'Ada',
  });
  restored.close();
  restored.close();
  restored.flush();
  const replay = createTranscriptionDemo({ initialEvents: restored.getHistory() });
  expect(replay.state$.get()).toEqual(restored.state$.get());
  replay.reset();
  replay.ingestSegment({ id: '1', sourceId: 'meeting', text: 'fresh' });
  replay.close();
  expect(replay.state$.get().completedTurns.map(turn => turn.text)).toEqual(['fresh']);
  expect(replay.getHistory().filter(event => event.type === 'reset')).toHaveLength(1);
  live.close();
  expect(vi.getTimerCount()).toBe(0);
});

it('validates hydration, preserves legacy IDs and never writes or schedules on replay-only close', () => {
  vi.useFakeTimers();
  const initialEvents = [
    { type: 'turn', turn: { id: 'original', sourceId: 'import', text: 'Existing' } },
    { type: 'segment', segment: { id: 'pending', sourceId: 'import', text: 'Pending' } },
  ];
  const runtime = createTranscriptionDemo({ initialEvents });
  const restoredHistory = runtime.getHistory();
  expect(runtime.state$.get().completedTurns[0]?.id).toBe('original');
  expect(vi.getTimerCount()).toBe(0);
  runtime.close();
  expect(runtime.getHistory()).toEqual(restoredHistory);
  expect(() =>
    createTranscriptionDemo({ initialEvents: [{ type: 'turn', turn: { id: 10 } }] })
  ).toThrow('Invalid transcript event');
  expect('next' in runtime.state$).toBe(false);
});
