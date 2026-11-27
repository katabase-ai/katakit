import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createTranscriptionDemo } from './createTranscriptionDemo';
import type { UtteranceAddedEvent } from '@katakit/transcript-ingestion';

const segment = {
  sourceId: 'recording-one',
  id: 'segment-one',
  text: 'Hello',
  startMs: 10,
  endMs: 100,
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

test('restores completed, pending and provisional content without IDs, timers or new facts', () => {
  const live = createTranscriptionDemo();
  live.ingestSegment(segment);
  live.ingestSegment({ ...segment, id: 'second', text: 'world', startMs: 100, endMs: 200 });
  vi.advanceTimersByTime(1400);
  expect(live.state$.get().completedTurns).toMatchObject([
    { text: 'Hello world', startMs: 10, endMs: 200 },
  ]);
  live.ingestSegment({ ...segment, id: 'third', text: 'Still here', startMs: 300, endMs: 400 });
  live.updateProvisional('thinking');
  const expected = live.state$.get();
  const saved = live.events$.getAll();
  live.close();
  expect(vi.getTimerCount()).toBe(0);

  const uuid = vi.spyOn(crypto, 'randomUUID');
  const timer = vi.spyOn(globalThis, 'setTimeout');
  const replay = createTranscriptionDemo({ initialEvents: saved });
  expect(replay.state$.get()).toEqual(expected);
  expect(replay.events$.getAll()).toEqual(saved);
  vi.advanceTimersByTime(10_000);
  expect(replay.state$.get()).toEqual(expected);
  expect(replay.events$.getAll()).toEqual(saved);
  replay.close();
  expect(replay.events$.getAll()).toEqual(saved);
  expect(uuid).not.toHaveBeenCalled();
  expect(timer).not.toHaveBeenCalled();
});

test('restores deduplication and source boundaries before accepting new live input', () => {
  const live = createTranscriptionDemo();
  live.ingestSegment(segment);
  live.close();
  const replay = createTranscriptionDemo({ initialEvents: live.events$.getAll() });
  replay.ingestSegment(segment);
  expect(replay.events$.getAll()).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);

  // A new recording may reuse recognizer-local IDs and audio timestamps.
  replay.ingestSegment({ ...segment, sourceId: 'recording-two', text: 'New recording' });
  expect(replay.state$.get().completedTurns).toMatchObject([{ text: 'Hello' }]);
  expect(replay.state$.get().currentTurn?.text).toBe('New recording');
  replay.flush();
  replay.flush();
  vi.advanceTimersByTime(2000);
  expect(replay.state$.get().completedTurns.map(turn => turn.text)).toEqual([
    'Hello',
    'New recording',
  ]);
  expect(replay.events$.getAll().map(event => event.type)).toEqual([
    'utteranceAdded',
    'conversationTurnAdded',
    'utteranceAdded',
    'conversationTurnAdded',
  ]);
  replay.close();
});

test('splits a resumed pending turn at an audio gap without replaying a silence timer', () => {
  const first = createTranscriptionDemo();
  first.ingestSegment(segment);
  first.close();
  const resumed = createTranscriptionDemo({ initialEvents: first.events$.getAll() });
  resumed.ingestSegment({ ...segment, id: 'later', text: 'Later', startMs: 2000, endMs: 2100 });
  expect(resumed.state$.get().completedTurns).toMatchObject([{ text: 'Hello' }]);
  expect(resumed.state$.get().currentTurn?.text).toBe('Later');
  resumed.flush();
  resumed.close();
});

test.each([
  { startMs: undefined, endMs: undefined },
  { startMs: 0, endMs: 5 },
])('keeps live and resumed histories restorable when audio time moves backwards: %j', times => {
  const first = createTranscriptionDemo();
  first.ingestSegment(segment);
  first.close();
  const resumed = createTranscriptionDemo({ initialEvents: first.events$.getAll() });
  const live = createTranscriptionDemo();
  live.ingestSegment(segment);

  for (const demo of [live, resumed]) {
    demo.ingestSegment({ ...segment, ...times, id: 'earlier', text: 'Earlier audio' });
    demo.flush();
    demo.close();
    expect(demo.state$.get().completedTurns.map(turn => turn.text)).toEqual([
      'Hello',
      'Earlier audio',
    ]);
    const replay = createTranscriptionDemo({
      initialEvents: demo.events$.getAll(),
    });
    expect(replay.state$.get()).toEqual(demo.state$.get());
    replay.close();
  }
});

test('close cancels pending work, completes the view, and ignores every late input', () => {
  const demo = createTranscriptionDemo();
  const complete = vi.fn();
  demo.state$.subscribe({ complete });
  demo.ingestSegment(segment);
  expect(vi.getTimerCount()).toBe(1);
  const state = demo.state$.get();
  const history = demo.events$.getAll();
  demo.close();
  demo.close();
  demo.ingestSegment({ ...segment, id: 'late' });
  demo.updateProvisional('late draft');
  demo.flush();
  vi.advanceTimersByTime(2000);
  expect(complete).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  expect(demo.state$.get()).toEqual(state);
  expect(demo.events$.getAll()).toEqual(history);

  const next = createTranscriptionDemo();
  expect(next.state$.get()).toEqual({
    completedTurns: [],
    currentTurn: null,
    provisional: undefined,
  });
  expect(next.events$.getAll()).toEqual([]);
  next.close();
});

test('drain and flush finalize the last input and clear drafts before closing', () => {
  const demo = createTranscriptionDemo();
  demo.updateProvisional('draft');
  demo.flush();
  expect(demo.state$.get().provisional).toBe('');
  demo.ingestSegment(segment);
  demo.flush();
  demo.close();
  expect(demo.state$.get().completedTurns).toMatchObject([{ text: 'Hello' }]);
  expect(demo.state$.get().currentTurn).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  const replay = createTranscriptionDemo({ initialEvents: demo.events$.getAll() });
  expect(replay.state$.get()).toEqual(demo.state$.get());
  replay.close();
});

test('copies typed seed history instead of retaining caller-owned payloads', () => {
  const record: UtteranceAddedEvent = {
    type: 'utteranceAdded',
    id: JSON.stringify([segment.sourceId, segment.id]),
    speaker: segment.sourceId,
    text: 'Original',
    startMs: 0,
    endMs: 100,
    meta: { seq: 0, timestamp: new Date(0) },
  };
  const demo = createTranscriptionDemo({ initialEvents: [record] });
  record.text = 'Changed outside';
  record.meta.timestamp.setTime(1000);
  expect(demo.events$.getAll()[0]).toMatchObject({
    text: 'Original',
    meta: { timestamp: new Date(0) },
  });
  expect(demo.state$.get().currentTurn?.text).toBe('Original');
  demo.close();
});

test('rejects invalid live input without partial writes', () => {
  const demo = createTranscriptionDemo();
  demo.ingestSegment({ ...segment, text: '  ' });
  expect(demo.events$.getAll()).toEqual([]);
  expect(() => demo.ingestSegment({ ...segment, sourceId: '' })).toThrow(
    'requires source and segment IDs'
  );
  expect(() => demo.ingestSegment({ ...segment, startMs: NaN })).toThrow(
    'timestamps must be finite'
  );
  expect(() => demo.ingestSegment({ ...segment, endMs: 0 })).toThrow('timestamps must be finite');
  expect(demo.events$.getAll()).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
  demo.ingestSegment(segment);
  expect(demo.state$.get().currentTurn?.text).toBe('Hello');
  demo.close();
});
