import { EventLogPlugin, makeKatakit } from '@katakit/core';
import { map } from 'rxjs';
import { afterEach, expect, it, vi } from 'vitest';
import {
  makeTranscriptIngestionPlugin,
  parseTranscriptRecordedEvent,
  type TranscriptRecordedEvent,
} from './plugin';

afterEach(() => vi.useRealTimers());
const segment = (id: string, text = id, sourceId = 'mic'): TranscriptRecordedEvent => ({
  type: 'segment',
  segment: { id, text, sourceId, speaker: 'Ada', startMs: 10, endMs: 20 },
});
const setup = (history: unknown[] = []) => {
  const runtime = makeKatakit({
    plugins: [],
    existingEvents: history.map((value, seq) => ({
      ...parseTranscriptRecordedEvent(value),
      meta: { seq, timestamp: new Date(0) },
    })),
  }).start();
  const logEvents$ = runtime.getObservables(EventLogPlugin).events$;
  const withoutMeta = ({ meta: _meta, ...event }: Record<string, unknown>) =>
    parseTranscriptRecordedEvent(event);
  const events$ = logEvents$.pipe(map(withoutMeta));
  const emitEvent = (event: TranscriptRecordedEvent) =>
    runtime.getMethods(EventLogPlugin).emitEvent(parseTranscriptRecordedEvent(event));
  const transcript = makeTranscriptIngestionPlugin({
    turnSilenceMs: 1000,
    eventLog: { events$, emitEvent, toEvent: event => event, fromEvent: event => event },
  });
  const kit = makeKatakit({ plugins: [transcript.configure({})] }).start();
  return {
    ...kit.getMethods(transcript),
    ...kit.getObservables(transcript),
    history: () => logEvents$.getAll().map(withoutMeta),
    emitEvent,
  };
};

it('replays pending segments and legacy turns without notifications, timers, IDs or close writes', () => {
  vi.useFakeTimers();
  const history: TranscriptRecordedEvent[] = [
    { type: 'turn', turn: { id: 'saved', sourceId: 'legacy', text: 'Saved' } },
    segment('one'),
  ];
  const t = setup(history);
  const notify = vi.fn();
  t.events$.subscribe(notify);
  expect(t.currentTurn$.get()).toEqual({
    id: 'mic\0one',
    sourceId: 'mic',
    text: 'one',
    speaker: 'Ada',
    startMs: 10,
    endMs: 20,
  });
  expect(t.conversationTurns$.get()[0]?.id).toBe('saved');
  expect(vi.getTimerCount()).toBe(0);
  vi.runAllTimers();
  t.close();
  t.close();
  t.flush();
  expect(t.history()).toEqual(history);
  expect(notify).not.toHaveBeenCalled();
});

it('continues restored content, deduplicates source identities and roundtrips atomic flush state', () => {
  vi.useFakeTimers();
  const t = setup([segment('one'), segment('one')]);
  t.ingestSegment({ id: 'one', sourceId: 'mic', text: 'retransmission' });
  expect(t.history()).toHaveLength(2);
  t.ingestSegment({
    id: 'two',
    sourceId: 'mic',
    speaker: 'Ada',
    text: 'two',
    startMs: 21,
    endMs: 30,
  });
  expect(t.currentTurn$.get()?.text).toBe('one two');
  const snapshots: string[][] = [];
  t.state$.subscribe(state =>
    snapshots.push(
      [...state.conversationTurns, ...(state.currentTurn ? [state.currentTurn] : [])].map(
        turn => turn.text
      )
    )
  );
  vi.advanceTimersByTime(1000);
  expect(snapshots).toEqual([['one two'], ['one two']]);
  const replay = setup(t.history());
  expect(replay.state$.get()).toEqual(t.state$.get());
  expect(vi.getTimerCount()).toBe(0);
  replay.close();
  t.close();
});

it('reset through the host cancels pending live timers, clears provisional and permits ID reuse', () => {
  vi.useFakeTimers();
  const t = setup();
  t.ingestSegment({ id: 'one', sourceId: 'mic', text: 'old' });
  t.updateProvisional('unfinished');
  t.emitEvent({ type: 'reset' });
  expect(t.provisional$.get()).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
  t.ingestSegment({ id: 'one', sourceId: 'mic', text: 'new' });
  t.close();
  t.close();
  t.reset();
  t.flush();
  expect(t.history().map(event => event.type)).toEqual(['segment', 'reset', 'segment', 'turn']);
  expect(t.conversationTurns$.get().map(turn => turn.text)).toEqual(['new']);
  expect(vi.getTimerCount()).toBe(0);
});

it('projects segment-only snapshots with source/speaker/time boundaries and duplicate turns', () => {
  const legacy: TranscriptRecordedEvent = {
    type: 'turn',
    turn: { id: 'legacy', sourceId: 'old', text: 'legacy' },
  };
  const t = setup([
    legacy,
    legacy,
    segment('one'),
    segment('two', 'two', 'other'),
    {
      type: 'segment',
      segment: { id: 'three', sourceId: 'other', speaker: 'Bob', text: 'three', startMs: 2000 },
    },
  ]);
  expect(t.conversationTurns$.get().map(turn => turn.text)).toEqual(['legacy', 'one', 'two']);
  expect(t.currentTurn$.get()?.text).toBe('three');
  t.close();
});

it('rejects malformed restored and live content without losing the next valid segment', () => {
  expect(() => setup([{ type: 'segment', segment: { id: 'x', text: 'bad' } }])).toThrow(
    'Invalid transcript event'
  );
  const t = setup();
  expect(() => t.ingestSegment({ id: 'x', sourceId: 'mic', text: 'bad', startMs: NaN })).toThrow(
    'Invalid transcript event'
  );
  expect(t.history()).toEqual([]);
  t.ingestSegment({ id: 'x', sourceId: 'mic', text: 'good' });
  t.close();
  expect(t.conversationTurns$.get()[0]?.text).toBe('good');
});

it('releases log readers on close and leaves host log writable', () => {
  const t = setup([segment('one')]);
  const before = t.state$.get();
  t.close();
  t.emitEvent(segment('two'));
  expect(t.history()).toHaveLength(2);
  expect(t.state$.get()).toBe(before);
  const complete = vi.fn();
  t.events$.subscribe({ complete });
  expect(complete).toHaveBeenCalledOnce();
});

it('keeps method ownership when the devtools hook wraps the observable collection', () => {
  const key = Symbol.for('katakit.devtools.observables.v1');
  Reflect.set(globalThis, key, (_runtime: object, _plugin: string, streams: object) => ({
    ...streams,
  }));
  try {
    const t = setup();
    t.ingestSegment({ id: 'one', sourceId: 'mic', text: 'recorded' });
    t.close();
    expect(t.conversationTurns$.get()[0]?.text).toBe('recorded');
  } finally {
    Reflect.deleteProperty(globalThis, key);
  }
});
