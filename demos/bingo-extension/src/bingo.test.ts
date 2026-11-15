import { describe, expect, it } from 'vitest';
import { defaultSquares, matchPhrase, parseSquares, winningLines } from './bingo';

describe('conversation bingo', () => {
  it('matches a complete phrase across punctuation and case, not part of a word', () => {
    expect(matchPhrase('circle back', 'Can we circle, back tomorrow?')).toBe(true);
    expect(matchPhrase('plan', 'planet')).toBe(false);
    expect(matchPhrase('can you hear me', 'Can you hear me now?')).toBe(true);
  });
  it('requires 24 custom squares and reserves the center', () => {
    expect(parseSquares('one\ntwo')).toBeUndefined();
    expect(parseSquares(Array.from({ length: 24 }, (_, i) => `phrase ${i}`).join('\n'))?.[12]).toBe(
      'Free space'
    );
    expect(defaultSquares).toHaveLength(25);
  });
  it('counts horizontal, vertical and diagonal wins', () => {
    const marked = Array(25).fill(false) as boolean[];
    for (const i of [0, 1, 2, 3, 4, 6, 12, 18, 24]) marked[i] = true;
    expect(winningLines(marked)).toEqual([
      [0, 1, 2, 3, 4],
      [0, 6, 12, 18, 24],
    ]);
  });
});
