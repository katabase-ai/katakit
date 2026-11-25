import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserBingoDemo, type BrowserBingoEvent } from './createBrowserBingoDemo';
import { makeSquares } from './bingo';

afterEach(() => vi.useRealTimers());

describe('browser Bingo history', () => {
  it('migrates legacy records, preserves serialized metadata and continues core sequencing', () => {
    const legacy = [
      {
        type: 'transcript',
        event: {
          type: 'segment',
          segment: { sourceId: 'saved', id: 'original', text: 'Quick question' },
        },
      },
    ];
    const live = createBrowserBingoDemo({ initialEvents: legacy });
    expect(live.getHistory()[0]?.meta).toEqual({ seq: 0, timestamp: new Date(0) });
    const restored = createBrowserBingoDemo({
      initialEvents: JSON.parse(JSON.stringify(live.getHistory())),
    });
    expect(restored.getHistory()).toEqual(live.getHistory());
    expect(restored.transcript.currentTurn$.get()?.id).toBe('saved\0original');
    restored.bingoMethods.setOverride(1, true);
    expect(restored.getHistory().map(event => event.meta.seq)).toEqual([0, 1]);
    expect(() =>
      createBrowserBingoDemo({
        initialEvents: [{ ...legacy[0], meta: { seq: 9, timestamp: new Date(0) } }],
      })
    ).toThrow('Invalid Bingo history metadata.');
    expect(() =>
      createBrowserBingoDemo({
        initialEvents: [{ ...legacy[0], meta: { seq: 0, timestamp: 'invalid' } }],
      })
    ).toThrow('Invalid Bingo history timestamp.');
    live.close();
    restored.close();
  });
  it('immediately matches finalized input, replays without effects, and continues with stable IDs', () => {
    vi.useFakeTimers();
    const live = createBrowserBingoDemo();
    live.updateProvisional('Quick question');
    expect(live.state$.getValue().board.marked[0]).toBe(false);
    expect(live.getHistory()).toEqual([]);
    live.ingestSegment({
      sourceId: 'mic',
      id: 'original',
      text: 'Quick question',
      speaker: 'A',
      startMs: 10,
      endMs: 20,
    });
    expect(live.state$.getValue().board.marked[0]).toBe(true);
    live.bingoMethods.setSquares(
      makeSquares(['Quick question', ...Array.from({ length: 23 }, (_, i) => `phrase ${i}`)])
    );
    live.bingoMethods.setOverride(1, true);
    const history = live.getHistory();
    const timerCount = vi.getTimerCount();
    const restored = createBrowserBingoDemo({ initialEvents: history });
    const notifications = vi.fn();
    restored.transcriptEvents$.subscribe(notifications);
    expect(vi.getTimerCount()).toBe(timerCount);
    expect(restored.getHistory()).toEqual(history);
    expect(restored.state$.getValue()).toEqual(live.state$.getValue());
    expect(restored.transcript.currentTurn$.get()).toEqual(live.transcript.currentTurn$.get());
    expect(restored.transcript.provisional$.get()).toBeUndefined();
    restored.ingestSegment({ sourceId: 'mic', id: 'original', text: 'duplicate ignored' });
    expect(restored.getHistory()).toEqual(history);
    expect(notifications).not.toHaveBeenCalled();
    for (const runtime of [live, restored]) {
      runtime.ingestSegment({
        sourceId: 'mic',
        id: 'next',
        text: 'phrase 1',
        speaker: 'A',
        startMs: 21,
      });
      runtime.flush();
      expect(runtime.transcript.conversationTurns$.get()[0]?.id).toBe('mic\0original');
    }
    expect(restored.getHistory()).toEqual(live.getHistory());
    expect(restored.state$.getValue()).toEqual(live.state$.getValue());
    live.close();
    restored.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears evidence, retains board corrections, and admits reused segment IDs after reset', () => {
    const live = createBrowserBingoDemo();
    live.ingestSegment({ sourceId: 'mic', id: 'one', text: 'Quick question' });
    live.bingoMethods.setOverride(1, true);
    live.reset();
    expect(live.state$.getValue().board.marked[0]).toBe(false);
    expect(live.state$.getValue().board.marked[1]).toBe(true);
    const restored = createBrowserBingoDemo({ initialEvents: live.getHistory() });
    expect(restored.state$.getValue()).toEqual(live.state$.getValue());
    restored.ingestSegment({ sourceId: 'mic', id: 'one', text: 'Can you hear me' });
    expect(restored.state$.getValue().board.marked[2]).toBe(true);
    live.close();
    restored.close();
  });

  it('detaches on close, cancels live timers, and never flushes untouched replay', () => {
    vi.useFakeTimers();
    const live = createBrowserBingoDemo();
    live.ingestSegment({ sourceId: 'mic', id: 'one', text: 'Quick question' });
    const history = live.getHistory();
    const restored = createBrowserBingoDemo({ initialEvents: history });
    restored.close();
    restored.close();
    restored.flush();
    expect(restored.getHistory()).toEqual(history);
    live.close();
    const stopped = live.getHistory();
    live.ingestSegment({ sourceId: 'mic', id: 'late', text: 'Circle back' });
    live.bingoMethods.setOverride(1, true);
    vi.runAllTimers();
    expect(vi.getTimerCount()).toBe(0);
    expect(live.getHistory()).toEqual(stopped);
    expect(live.state$.getValue().board.marked[1]).toBe(false);
  });

  it('rejects malformed history and isolates snapshots from caller mutation', () => {
    expect(() =>
      createBrowserBingoDemo({
        initialEvents: [
          { type: 'transcript', event: { type: 'segment', segment: { id: 3 } } },
        ] as unknown as BrowserBingoEvent[],
      })
    ).toThrow('Invalid transcript event');
    const live = createBrowserBingoDemo();
    live.ingestSegment({ sourceId: 'mic', id: 'id', text: 'Quick question' });
    const history = live.getHistory();
    const first = history[0];
    if (first?.type === 'transcript' && first.event.type === 'segment')
      first.event.segment.text = 'mutated';
    const restored = createBrowserBingoDemo({ initialEvents: live.getHistory() });
    expect(restored.state$.getValue().board.marked[0]).toBe(true);
    live.close();
    restored.close();
  });
});
