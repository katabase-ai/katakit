import { describe, expect, it, vi } from 'vitest';
import { makeKatakit } from '@katakit/core';
import { makeTranscriptIngestionPlugin } from '@katakit/transcript-ingestion';
import { makeBingoPlugin, makeSquares, matchPhrase, winningLines, type BingoEvent } from './plugin';

const setup = (initialEvents: BingoEvent[] = []) => {
  const bingo = makeBingoPlugin();
  const kit = makeKatakit({ plugins: [bingo.configure({ initialEvents })] });
  const history: BingoEvent[] = [];
  kit.getObservables(bingo).events$.subscribe(event => history.push(event));
  return {
    history,
    state: kit.getObservables(bingo).state$,
    methods: kit.start().getMethods(bingo),
  };
};

describe('Bingo plugin', () => {
  it('replays actual draws, corrections, evidence and wins, then continues identically', () => {
    const live = setup();
    const squares = makeSquares(Array.from({ length: 24 }, (_, i) => `phrase ${i}`));
    live.methods.setTurns([{ id: 'original', text: 'phrase 0 and phrase 1' }]);
    live.methods.setSquares(squares);
    squares[0] = 'caller mutation';
    for (const i of [2, 3, 4]) live.methods.setOverride(i, true);
    const restored = setup(JSON.parse(JSON.stringify(live.history)));
    expect(restored.state.get()).toEqual(live.state.get());
    expect(restored.state.get().winningLines).toContainEqual([0, 1, 2, 3, 4]);
    expect(restored.history).toEqual(live.history);
    for (const runtime of [live, restored]) {
      runtime.methods.setOverride(2, undefined);
      runtime.methods.setTurns([
        { id: 'original', text: 'phrase 0 and phrase 1' },
        { id: 'next', text: 'phrase 2' },
      ]);
    }
    expect(restored.state.get()).toEqual(live.state.get());
    expect(restored.history).toEqual(live.history);
  });
  it('deduplicates repeated transcript views and replays clears without old evidence', () => {
    const live = setup();
    live.methods.setTurns([{ id: 'original', text: 'Quick question' }]);
    live.methods.setTurns([{ id: 'original', text: 'Quick question' }]);
    expect(live.history).toHaveLength(1);
    live.methods.setTurns([]);
    const restored = setup(live.history);
    expect(restored.state.get()).toEqual(live.state.get());
    expect(restored.state.get().evidence[0]).toBeUndefined();
    restored.methods.setTurns([{ id: 'original', text: 'Can you hear me' }]);
    expect(restored.state.get().marked[2]).toBe(true);
  });
  it('validates restored history and legacy boards before accepting them', () => {
    expect(() => setup([{ type: 'override-set', index: 12, value: false }])).toThrow();
    expect(() =>
      setup([
        {
          type: 'turns-set',
          turns: [
            { id: 'x', text: 'a' },
            { id: 'x', text: 'b' },
          ],
        },
      ])
    ).toThrow('Duplicate');
    const live = setup();
    expect(() => live.methods.restoreBoard({ squares: [], overrides: {} })).toThrow();
    expect(live.history).toEqual([]);
    live.methods.restoreBoard({
      squares: makeSquares(Array(24).fill('phrase')),
      overrides: { 0: false },
    });
    const restored = setup(live.history);
    expect(restored.state.get()).toEqual(live.state.get());
    expect(restored.state.get().evidence.every(value => value === undefined)).toBe(true);
  });
  it('closes projections and rejects late commands without appending', () => {
    const live = setup();
    const completed = vi.fn();
    live.state.subscribe({ complete: completed });
    live.methods.close();
    live.methods.close();
    live.methods.setOverride(0, true);
    live.methods.setTurns([{ id: 'late', text: 'Quick question' }]);
    expect(completed).toHaveBeenCalledTimes(1);
    expect(live.history).toEqual([]);
  });
  it('reacts to transcription events without a mounted UI subscription', async () => {
    const transcriptIngestion = makeTranscriptIngestionPlugin();
    const bingo = makeBingoPlugin({ TranscriptIngestionPlugin: transcriptIngestion });
    const kit = makeKatakit({ plugins: [transcriptIngestion.configure({}), bingo.configure({})] });
    const running = kit.start();
    const { ingestSegment, updateProvisional, flush, reset, close } =
      running.getMethods(transcriptIngestion);
    const state = kit.getObservables(bingo).state$;

    updateProvisional('Quick question');
    expect(state.get().marked[0]).toBe(false);
    ingestSegment({ sourceId: 'mic', id: '1', text: 'Quick question' });
    await vi.waitFor(() => expect(state.get().marked[0]).toBe(true));
    flush();
    await vi.waitFor(() => expect(state.get().evidence[0]).toBe('Quick question'));
    reset();
    await vi.waitFor(() => expect(state.get().marked[0]).toBe(false));

    ingestSegment({ sourceId: 'mic', id: '1', text: 'Can you hear me?' });
    await vi.waitFor(() => expect(state.get().marked[2]).toBe(true));
    close();
  });
  it('matches complete phrases across punctuation and case, not substrings', () => {
    expect(matchPhrase('circle back', 'Can we circle, back tomorrow?')).toBe(true);
    expect(matchPhrase('plan', 'planet')).toBe(false);
  });
  it('marks finalized turns and exposes supporting text', () => {
    const { state, methods } = setup();
    methods.setTurns([{ id: '1', text: 'Quick question: can you hear me?' }]);
    expect(state.get().marked[0]).toBe(true);
    expect(state.get().evidence[0]).toBe('Quick question: can you hear me?');
    expect(state.get().marked[2]).toBe(true);
    methods.setTurns([]);
    expect(state.get().marked[0]).toBe(false);
  });
  it('allows corrections and restores board state without retaining old turns', () => {
    const { state, methods } = setup();
    methods.setOverride(0, true);
    expect(state.get().marked[0]).toBe(true);
    methods.setTurns([{ id: '1', text: 'Quick question' }]);
    methods.setOverride(0, false);
    expect(state.get().marked[0]).toBe(false);
    const next = makeSquares(Array.from({ length: 24 }, (_, i) => `phrase ${i}`));
    methods.setSquares(next);
    expect(state.get().overrides).toEqual({});
    methods.restoreBoard({ squares: next, overrides: { 0: true } });
    expect(state.get().marked[0]).toBe(true);
    expect(() => methods.setOverride(12, true)).toThrow('Invalid bingo square index.');
    expect(() => methods.restoreBoard({ squares: next, overrides: { 12: false } })).toThrow(
      'Invalid bingo square override.'
    );
  });
  it('rechecks existing turns and keeps accepting turns after a card change', () => {
    const { state, methods } = setup();
    methods.setTurns([{ id: '1', text: 'The tiger is nearby.' }]);
    methods.setOverride(0, true);
    methods.setSquares(
      makeSquares(['Tiger', ...Array.from({ length: 23 }, (_, i) => `phrase ${i}`)])
    );
    expect(state.get().overrides).toEqual({});
    expect(state.get().marked[0]).toBe(true);
    expect(state.get().evidence[0]).toBe('The tiger is nearby.');

    methods.setTurns([
      { id: '1', text: 'The tiger is nearby.' },
      { id: '2', text: 'I also saw phrase 0.' },
    ]);
    expect(state.get().marked[1]).toBe(true);
    methods.setSquares(
      makeSquares(['phrase 0', ...Array.from({ length: 23 }, (_, i) => `other ${i}`)])
    );
    expect(state.get().marked[0]).toBe(true);
    expect(state.get().evidence[0]).toBe('I also saw phrase 0.');
  });
  it('has isolated runtime instances and detects wins', () => {
    const first = setup();
    const second = setup();
    for (let i = 0; i < 5; i++) first.methods.setOverride(i, true);
    expect(first.state.get().winningLines).toContainEqual([0, 1, 2, 3, 4]);
    expect(second.state.get().winningLines).toEqual([]);
    const marked = Array(25).fill(false) as boolean[];
    for (const i of [0, 6, 12, 18, 24]) marked[i] = true;
    expect(winningLines(marked)).toContainEqual([0, 6, 12, 18, 24]);
  });
});
