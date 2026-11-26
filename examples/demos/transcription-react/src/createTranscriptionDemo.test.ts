import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createTranscriptionDemo } from './createTranscriptionDemo';

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
  const serialized = JSON.parse(JSON.stringify(saved));
  live.close();
  expect(vi.getTimerCount()).toBe(0);

  const uuid = vi.spyOn(crypto, 'randomUUID');
  const timer = vi.spyOn(globalThis, 'setTimeout');
  const replay = createTranscriptionDemo({ initialEvents: serialized });
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

test('history validation copies records instead of retaining caller-owned payloads', () => {
  const record = {
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

test.each([
  { type: 'unknown', meta: { seq: 0, timestamp: new Date(0) } },
  { type: 'provisionalUtteranceAdded', text: 'draft', speaker: 'input' },
  {
    type: 'provisionalUtteranceAdded',
    text: 'draft',
    speaker: 'input',
    meta: { seq: 1, timestamp: new Date(0) },
  },
  {
    type: 'provisionalUtteranceAdded',
    text: 'draft',
    speaker: 'input',
    meta: { seq: 0, timestamp: 'invalid' },
  },
  {
    type: 'utteranceAdded',
    text: 'bad timing',
    speaker: 'input',
    id: 'one',
    startMs: 10,
    endMs: 0,
    meta: { seq: 0, timestamp: new Date(0) },
  },
])('rejects invalid history before acquiring live resources: %j', record => {
  expect(() => createTranscriptionDemo({ initialEvents: [record] })).toThrow(
    /Invalid|sequence numbers|timestamps/
  );
  expect(vi.getTimerCount()).toBe(0);
});

test('rejects duplicate history IDs and invalid live input without partial writes', () => {
  const demo = createTranscriptionDemo();
  demo.ingestSegment({ ...segment, text: '  ' });
  expect(demo.events$.getAll()).toEqual([]);
  expect(() => demo.ingestSegment({ ...segment, startMs: NaN })).toThrow(/Invalid/);
  expect(() => demo.ingestSegment({ ...segment, endMs: 0 })).toThrow('timestamps must be ordered');
  expect(demo.events$.getAll()).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
  demo.ingestSegment(segment);
  const event = demo.events$.getAll()[0]!;
  expect(() =>
    createTranscriptionDemo({
      initialEvents: [event, { ...event, meta: { ...event.meta, seq: 1 } }],
    })
  ).toThrow('duplicate ID');
  demo.close();
});
