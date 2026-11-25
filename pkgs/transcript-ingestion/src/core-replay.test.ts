import { EventLogPlugin, makeKatakit, type KatakitEvent } from '@katakit/core';
import { afterEach, expect, it, vi } from 'vitest';
import {
  fromTranscriptIngestionEvent,
  makeTranscriptIngestionPlugin,
  toTranscriptIngestionEvent,
  type TranscriptEvent,
} from './index';

afterEach(() => vi.useRealTimers());
const saved = (event: Record<string, unknown>, seq = 0): KatakitEvent => ({
  ...event,
  meta: { seq, timestamp: new Date(0) },
});
const utterance = {
  type: 'utteranceAdded',
  id: 'segment',
  sourceId: 'source',
  speaker: 'Ada',
  text: 'Saved',
  startMs: 10,
  endMs: 30,
};
const create = (existingEvents: KatakitEvent[] = []) => {
  const transcript = makeTranscriptIngestionPlugin();
  const kit = makeKatakit({ existingEvents, plugins: [transcript.configure({})] });
  const state = kit.getObservables(transcript);
  const log = kit.getObservables(EventLogPlugin).events$;
  const alive = kit.start();
  return {
    ...state,
    ...alive.getMethods(transcript),
    log,
    append: alive.getMethods(EventLogPlugin).emitEvent,
  };
};

it('hydrates the built-in log before start without IDs, timers, provisional recovery or close writes', () => {
  vi.useFakeTimers();
  const random = vi.spyOn(crypto, 'randomUUID');
  const history = [
    saved(utterance),
    saved({ type: 'provisionalUtteranceAdded', text: 'stale', speaker: 'Ada' }, 1),
  ];
  const t = create(history);
  expect(t.state$.get().currentTurn).toEqual({
    id: 'source\0segment',
    sourceId: 'source',
    speaker: 'Ada',
    text: 'Saved',
    startMs: 10,
    endMs: 30,
  });
  expect(t.provisional$.get()).toBeUndefined();
  expect(t.provisionalUtterance$.get()).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  t.close();
  t.close();
  t.flush();
  expect(t.log.getAll()).toEqual(history);
  expect(random).not.toHaveBeenCalled();
  random.mockRestore();
});

it('deduplicates restored IDs, continues atomically, and records flush/reset into the same core log', () => {
  vi.useFakeTimers();
  const t = create([saved(utterance)]);
  t.ingestSegment({ id: 'segment', sourceId: 'source', text: 'duplicate' });
  expect(t.log.getAll()).toHaveLength(1);
  t.ingestUtterance({ ...utterance, id: 'next', text: 'continued', startMs: 31, endMs: 50 });
  const snapshots: string[][] = [];
  t.state$.subscribe(state =>
    snapshots.push(
      [...state.conversationTurns, ...(state.currentTurn ? [state.currentTurn] : [])].map(
        turn => turn.text
      )
    )
  );
  t.flush();
  expect(snapshots).toEqual([['Saved continued'], ['Saved continued']]);
  expect(t.log.getAll().map(event => event.type)).toEqual([
    'utteranceAdded',
    'utteranceAdded',
    'conversationTurnAdded',
  ]);
  const replay = create(t.log.getAll());
  expect(replay.state$.get()).toEqual(t.state$.get());
  replay.close();
  t.reset();
  t.ingestSegment({ id: 'segment', sourceId: 'source', text: 'fresh' });
  t.close();
  expect(t.conversationTurns$.get().map(turn => turn.text)).toEqual(['fresh']);
  expect(vi.getTimerCount()).toBe(0);
});

it('preserves source/speaker/time boundaries and ignores legacy provisional history', () => {
  const t = create([saved(utterance)]);
  t.ingestSegment({
    id: 'two',
    sourceId: 'source',
    speaker: 'Bob',
    text: 'Bob',
    startMs: 40,
    endMs: 50,
  });
  t.ingestSegment({
    id: 'two',
    sourceId: 'other',
    speaker: 'Bob',
    text: 'other',
    startMs: 51,
    endMs: 60,
  });
  t.ingestSegment({ id: 'late', sourceId: 'other', speaker: 'Bob', text: 'later', startMs: 5000 });
  t.close();
  expect(t.conversationTurns$.get().map(turn => turn.text)).toEqual([
    'Saved',
    'Bob',
    'other',
    'later',
  ]);
  expect(t.segments$.get()).toHaveLength(4);
});

it('an external core reset discards pending input and cancels only ingestion-owned resources', () => {
  vi.useFakeTimers();
  const t = create();
  t.ingestUtterance(utterance);
  t.updateProvisionalUtterance({ speaker: 'Bob', text: 'unfinished' });
  expect(t.log.getAll()).toHaveLength(1);
  t.append({ type: 'transcriptReset' });
  expect(t.state$.get()).toEqual({ segments: [], conversationTurns: [], currentTurn: undefined });
  expect(t.provisional$.get()).toBeUndefined();
  expect(t.provisionalUtterance$.get()).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  t.close();
  t.append(utterance);
  expect(t.log.getAll()).toHaveLength(3);
  expect(t.segments$.get()).toEqual([]);
});

it('validates mapped core content while leaving unrelated core event schemas to the host', () => {
  expect(() => create([saved({ ...utterance, startMs: NaN })])).toThrow('Invalid transcript event');
  expect(() => fromTranscriptIngestionEvent({ ...utterance, sourceId: null })).toThrow(
    'Invalid transcript event'
  );
  expect(fromTranscriptIngestionEvent({ type: 'unrelated' })).toBeUndefined();
  const record = fromTranscriptIngestionEvent(utterance)!;
  expect(toTranscriptIngestionEvent(record)).toEqual(utterance);
});

it('keeps the original notification/forward API live-only and readable', () => {
  const forwarded: TranscriptEvent[] = [];
  const transcript = makeTranscriptIngestionPlugin({
    forward: { createEvent: event => event, emitEvent: event => forwarded.push(event) },
  });
  const kit = makeKatakit({
    existingEvents: [saved(utterance)],
    plugins: [transcript.configure({})],
  }).start();
  const views = kit.getObservables(transcript);
  const input = kit.getMethods(transcript);
  const seen: TranscriptEvent[] = [];
  views.events$.subscribe(event => seen.push(event));
  expect(seen).toEqual([]);
  expect(forwarded).toEqual([]);
  expect('next' in views.state$).toBe(false);
  input.updateProvisional('new');
  input.flush();
  input.close();
  expect(seen.map(event => event.type)).toEqual(['provisional', 'turn']);
  expect(forwarded.map(event => event.type)).toEqual(['provisional', 'turn']);
});
