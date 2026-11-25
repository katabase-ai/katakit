import { describe, expect, it } from 'vitest';
import { orderHydration, restoreSegments } from './history';

const segment = (id: string, sourceId = 'session') => ({ id, sourceId, text: id });

describe('extension history admission', () => {
  it('validates stored content, preserves identities, deduplicates before retention', () => {
    const history = Array.from({ length: 2002 }, (_, i) => segment(String(i)));
    expect(
      restoreSegments([
        ...history,
        history[2001],
        null,
        { ...segment('bad'), startMs: NaN },
        { ...segment('backwards'), startMs: 2, endMs: 1 },
      ])
    ).toEqual(history.slice(-2000));
    expect(restoreSegments([segment('same'), segment('same', 'other')])).toHaveLength(2);
    expect(restoreSegments({})).toEqual([]);
  });

  it('keeps snapshot before live delivery and discards stale snapshots on concurrent reset', () => {
    const old = segment('old');
    const next = segment('next');
    expect(orderHydration([old], [{ type: 'TRANSCRIPT_SEGMENT', segment: next }])).toEqual({
      initialSegments: [old],
      live: [{ type: 'TRANSCRIPT_SEGMENT', segment: next }],
    });
    expect(
      orderHydration(
        [old, next],
        [
          { type: 'TRANSCRIPT_SEGMENT', segment: old },
          { type: 'CAPTURE_RESET' },
          { type: 'TRANSCRIPT_SEGMENT', segment: next },
        ]
      )
    ).toEqual({ initialSegments: [], live: [{ type: 'TRANSCRIPT_SEGMENT', segment: next }] });
  });
});
