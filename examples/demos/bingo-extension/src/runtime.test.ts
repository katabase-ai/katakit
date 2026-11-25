import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPanelRuntime } from './runtime';
import { defaultSquares } from './bingo';
import { orderHydration } from './history';

afterEach(() => vi.useRealTimers());
const first = {
  id: 'original-id',
  sourceId: 'meeting-1',
  text: 'Quick question',
  startMs: 0,
  endMs: 100,
};
const second = { id: 'next', sourceId: 'meeting-1', text: 'Circle back', startMs: 200, endMs: 300 };

describe('extension event-sourced runtime', () => {
  it('replays full event history exactly, including explicit silence boundaries and IDs', () => {
    const live = createPanelRuntime();
    live.methods.ingestSegment(first);
    live.methods.flush();
    live.methods.ingestSegment(second);
    const history = live.events$.getAll();
    const replay = createPanelRuntime([], undefined, history);
    expect(replay.transcript.state$.get()).toEqual(live.transcript.state$.get());
    expect(replay.board$.get()).toEqual(live.board$.get());
    expect(replay.events$.getAll()).toEqual(history);
    replay.close();
    expect(replay.events$.getAll()).toEqual(history);
    live.close();
    expect(() => createPanelRuntime([], undefined, [{ type: 'segment', segment: null }])).toThrow(
      'Invalid restored'
    );
  });

  it('replays restored content without timers or duplicate writes, then continues live', () => {
    vi.useFakeTimers();
    const live = createPanelRuntime();
    live.methods.ingestSegment(first);
    live.methods.ingestSegment(second);
    const snapshot = live.transcript.segments$.get();
    const restored = createPanelRuntime(snapshot);
    expect(restored.transcript.state$.get()).toEqual(live.transcript.state$.get());
    expect(restored.board$.get()).toEqual(live.board$.get());
    live.close();
    expect(vi.getTimerCount()).toBe(0);
    const before = restored.events$.getAll();
    vi.runAllTimers();
    expect(restored.events$.getAll()).toEqual(before);
    restored.methods.ingestSegment(second);
    expect(restored.events$.getAll()).toEqual(before);
    restored.methods.ingestSegment({
      ...second,
      id: 'third',
      text: 'Next steps',
      startMs: 400,
      endMs: 500,
    });
    expect(restored.transcript.segments$.get().map(segment => segment.id)).toEqual([
      'original-id',
      'next',
      'third',
    ]);
    expect(restored.board$.get().marked[3]).toBe(true);
    restored.close();
    restored.close();
    const closed = restored.events$.getAll();
    vi.runAllTimers();
    expect(restored.events$.getAll()).toEqual(closed);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('migrates board snapshots independently of transcript clear and panel reopen', () => {
    const snapshot = { squares: [...defaultSquares], overrides: { 1: false, 3: true } };
    const panel = createPanelRuntime([first, second], snapshot);
    expect(panel.restoredBoard).toBe(true);
    expect(panel.board$.get().marked.slice(0, 4)).toEqual([true, false, false, true]);
    panel.methods.reset();
    expect(panel.board$.get().marked.slice(0, 4)).toEqual([false, false, false, true]);
    expect(panel.transcript.segments$.get()).toEqual([]);
    panel.close();
    const reopened = createPanelRuntime([], snapshot);
    expect(reopened.board$.get()).toEqual(panel.board$.get());
    reopened.close();
    const malformed = createPanelRuntime([null, { ...first, id: 7 }], {
      squares: [4],
      overrides: {},
    });
    expect(malformed.restoredBoard).toBe(false);
    expect(malformed.transcript.segments$.get()).toEqual([]);
    malformed.close();
  });

  it('deduplicates snapshot/live overlap and resets pending hydration in arrival order', () => {
    const ordered = orderHydration(
      [first, second],
      [{ type: 'TRANSCRIPT_SEGMENT', segment: second }]
    );
    const panel = createPanelRuntime(ordered.initialSegments);
    for (const message of ordered.live)
      if (message.type === 'TRANSCRIPT_SEGMENT') panel.methods.ingestSegment(message.segment);
    expect(panel.transcript.segments$.get()).toEqual([first, second]);
    expect(panel.events$.getAll()).toHaveLength(2);
    panel.close();
  });
});
