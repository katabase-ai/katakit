import { describe, expect, it, vi, afterEach } from 'vitest';
import { makeKatakit } from '@katakit/core';
import { makeTranscriptionPlugin } from './plugin';

afterEach(() => vi.useRealTimers());

const setup = (turnSilenceMs = 1000) => {
  const Transcription = makeTranscriptionPlugin({ turnSilenceMs });
  const kit = makeKatakit({ plugins: [Transcription.configure({})] });
  const { ingestSegment, updateProvisional, flush, reset, close } = kit
    .start()
    .getMethods(Transcription);
  const state = () => kit.getObservables(Transcription).state$.get();
  return { ingestSegment, updateProvisional, flush, reset, close, state };
};

describe('conversation transcription', () => {
  it('exposes a readable but not writable state observable', () => {
    const Transcription = makeTranscriptionPlugin();
    const kit = makeKatakit({ plugins: [Transcription.configure({})] });
    const state$ = kit.getObservables(Transcription).state$;
    expect('next' in state$).toBe(false);
    const methods = kit.start().getMethods(Transcription);
    methods.ingestSegment({ sourceId: 'mic', id: '1', text: 'Hello.' });
    expect(state$.get().current?.text).toBe('Hello.');
    methods.close();
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
    expect(t.state()).toEqual({ turns: [], provisional: undefined });
  });

  it('resets turns, provisional text, pending flushes and deduplication for a new session', () => {
    vi.useFakeTimers();
    const t = setup();
    t.ingestSegment({ sourceId: 'mic', id: '1', text: 'Old phrase' });
    t.updateProvisional('old interim');
    t.reset();
    vi.advanceTimersByTime(1000);
    expect(t.state()).toEqual({ turns: [] });
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
});
