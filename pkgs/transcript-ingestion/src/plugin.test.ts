import { describe, expect, it, vi, afterEach } from 'vitest';
import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin, type TranscriptEvent } from './plugin';

afterEach(() => vi.useRealTimers());

const setup = (turnSilenceMs = 1000) => {
  const TranscriptIngestionPlugin = makeTranscriptIngestionPlugin({ turnSilenceMs });
  const kit = makeKatakit({ plugins: [TranscriptIngestionPlugin.configure({})] });
  const observables = kit.getObservables(TranscriptIngestionPlugin);
  const methods = kit.start().getMethods(TranscriptIngestionPlugin);
  const state = () => ({
    turns: observables.conversationTurns$.get(),
    current: observables.currentTurn$.get(),
    provisional: observables.provisional$.get(),
  });
  return { ...methods, ...observables, state };
};

describe('conversation transcription', () => {
  it('exposes focused readable but not writable observables and a live event stream', () => {
    const t = setup();
    expect('next' in t.conversationTurns$).toBe(false);
    expect('next' in t.events$).toBe(false);
    const events: TranscriptEvent[] = [];
    const subscription = t.events$.subscribe(event => events.push(event));
    t.updateProvisional('Hello');
    t.ingestSegment({ sourceId: 'mic', id: '1', text: 'Hello.' });
    expect(t.currentTurn$.get()?.text).toBe('Hello.');
    expect(events.map(event => event.type)).toEqual(['provisional', 'provisional', 'segment']);
    subscription.unsubscribe();
    t.close();
  });

  it('assembles small finalized chunks into a turn while keeping interim text separate', () => {
    vi.useFakeTimers();
    const t = setup();
    t.updateProvisional('Build');
    expect(t.state().turns).toEqual([]);
    t.ingestSegment({ sourceId: 'mic', id: '1', text: 'Build', startMs: 0, endMs: 100 });
    t.updateProvisional('a demo');
    t.ingestSegment({ sourceId: 'mic', id: '2', text: 'a demo.', startMs: 100, endMs: 500 });
    t.ingestSegment({ sourceId: 'mic', id: '2', text: 'a demo.', startMs: 100, endMs: 500 });
    expect(t.state().current?.text).toBe('Build a demo.');
    expect(t.state().provisional).toBeUndefined();
    vi.advanceTimersByTime(1000);
    expect(t.state().turns.map(turn => turn.text)).toEqual(['Build a demo.']);
    t.close();
  });

  it('splits at speaker/source changes and timestamped gaps, and flushes on stop', () => {
    const t = setup();
    t.ingestSegment({ sourceId: 'meeting', id: '1', text: 'First.', speaker: 'Ada', endMs: 100 });
    t.ingestSegment({
      sourceId: 'meeting',
      id: '2',
      text: 'Second.',
      speaker: 'Bob',
      startMs: 150,
      endMs: 200,
    });
    t.ingestSegment({
      sourceId: 'meeting',
      id: '3',
      text: 'Later.',
      speaker: 'Bob',
      startMs: 2000,
    });
    t.flush();
    expect(t.state().turns.map(turn => turn.text)).toEqual(['First.', 'Second.', 'Later.']);
    t.close();
  });

  it('clears pending provisional text on stop without saving it as a turn', () => {
    const t = setup();
    t.updateProvisional('unfinished');
    t.close();
    expect(t.state()).toEqual({ turns: [], current: undefined, provisional: undefined });
  });

  it('keeps the last finalized words through flush and clears them on reset', () => {
    const t = setup();
    expect(t.lastHeard$.get()).toBeUndefined();
    t.updateProvisional('interim');
    expect(t.lastHeard$.get()).toBeUndefined();
    t.ingestSegment({ sourceId: 'mic', id: '1', text: 'Quick question' });
    expect(t.lastHeard$.get()).toBe('Quick question');
    t.updateProvisional('Quick question maybe');
    expect(t.lastHeard$.get()).toBe('Quick question');
    t.ingestSegment({ sourceId: 'mic', id: '2', text: 'for you' });
    expect(t.lastHeard$.get()).toBe('Quick question for you');
    t.flush();
    expect(t.lastHeard$.get()).toBe('Quick question for you');
    t.reset();
    expect(t.lastHeard$.get()).toBeUndefined();
    t.close();
  });

  it('resets turns, provisional text, pending flushes and deduplication for a new session', () => {
    vi.useFakeTimers();
    const t = setup();
    t.ingestSegment({ sourceId: 'mic', id: '1', text: 'Old phrase' });
    t.updateProvisional('old interim');
    t.reset();
    vi.advanceTimersByTime(1000);
    expect(t.state()).toEqual({ turns: [], current: undefined, provisional: undefined });
    t.ingestSegment({ sourceId: 'mic', id: '1', text: 'New phrase' });
    expect(t.state().current?.text).toBe('New phrase');
    t.close();
  });

  it('preserves long source turns and distinguishes IDs across sources', () => {
    const t = setup();
    t.ingestSegment({
      sourceId: 'recall',
      id: '1',
      text: 'A complete multi-sentence turn. More context.',
    });
    t.ingestSegment({ sourceId: 'mic', id: '1', text: 'Another source.' });
    t.close();
    expect(t.state().turns.map(turn => turn.text)).toEqual([
      'A complete multi-sentence turn. More context.',
      'Another source.',
    ]);
  });

  it('forwards only selected host-shaped events, synchronously, without requiring a log', () => {
    const sent: { kind: string; text: string }[] = [];
    const TranscriptIngestionPlugin = makeTranscriptIngestionPlugin({
      forward: {
        createEvent: (event: TranscriptEvent) => {
          if (event.type === 'segment')
            return { kind: 'transcript-segment', text: event.segment.text };
          if (event.type === 'turn') return { kind: 'transcript-turn', text: event.turn.text };
          return undefined;
        },
        emitEvent: event => sent.push(event),
      },
    });
    const kit = makeKatakit({ plugins: [TranscriptIngestionPlugin.configure({})] });
    const methods = kit.start().getMethods(TranscriptIngestionPlugin);
    methods.updateProvisional('hello');
    methods.ingestSegment({ sourceId: 'mic', id: '1', text: 'Hello.' });
    expect(sent).toEqual([{ kind: 'transcript-segment', text: 'Hello.' }]);
    methods.flush();
    expect(sent).toEqual([
      { kind: 'transcript-segment', text: 'Hello.' },
      { kind: 'transcript-turn', text: 'Hello.' },
    ]);
    expect(kit.getObservables(TranscriptIngestionPlugin).conversationTurns$.get()[0]?.text).toBe(
      'Hello.'
    );
    methods.close();
  });

  it('completes its live stream and stops accepting input after close', () => {
    vi.useFakeTimers();
    const t = setup();
    const complete = vi.fn();
    t.events$.subscribe({ complete });
    t.ingestSegment({ sourceId: 'mic', id: '1', text: 'Hello.' });
    t.close();
    t.close();
    t.ingestSegment({ sourceId: 'mic', id: '2', text: 'Ignored.' });
    t.updateProvisional('Ignored');
    vi.advanceTimersByTime(2000);
    expect(t.conversationTurns$.get().map(turn => turn.text)).toEqual(['Hello.']);
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
