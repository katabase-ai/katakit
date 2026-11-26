import { describe, expect, it } from 'vitest';
import { bingoPacks, drawBingoPack } from './packs';
import { normalizePhrase } from './plugin';

export const validateBingoPacks = () =>
  bingoPacks.every(pack => {
    const phrases = pack.tiers.flat();
    return (
      pack.tiers.every(tier => tier.length >= 8) &&
      phrases.every(phrase => normalizePhrase(phrase)) &&
      new Set(phrases.map(normalizePhrase)).size === phrases.length
    );
  });

describe('bingo packs', () => {
  it('has distinct nonblank entries in every tier', () => {
    expect(validateBingoPacks()).toBe(true);
    expect(bingoPacks.map(pack => pack.id)).toEqual([
      'meeting',
      'animals',
      'us-states',
      'world-capitals',
      'tongue-twisters',
      'corporate-jargon',
      'ai-jargon',
    ]);
  });
  it('draws 25 distinct phrases with at most nine from each tier', () => {
    for (const pack of bingoPacks) {
      const squares = drawBingoPack(pack.id, () => 0.5);
      expect(squares).toHaveLength(25);
      expect(new Set(squares.map(normalizePhrase)).size).toBe(25);
      const phrases = new Set<string>(pack.tiers.flat());
      expect(squares.every(square => phrases.has(square))).toBe(true);
      for (const tier of pack.tiers) {
        const entries = new Set<string>(tier);
        expect(squares.filter(square => entries.has(square)).length).toBeLessThanOrEqual(9);
      }
    }
  });
  it('contains exactly the 50 US states, without DC or territories', () => {
    const states = bingoPacks.find(pack => pack.id === 'us-states')!.tiers.flat();
    const expected = `Alabama Alaska Arizona Arkansas California Colorado Connecticut Delaware Florida Georgia
      Hawaii Idaho Illinois Indiana Iowa Kansas Kentucky Louisiana Maine Maryland Massachusetts Michigan
      Minnesota Mississippi Missouri Montana Nebraska Nevada New Hampshire New Jersey New Mexico New York
      North Carolina North Dakota Ohio Oklahoma Oregon Pennsylvania Rhode Island South Carolina South Dakota
      Tennessee Texas Utah Vermont Virginia Washington West Virginia Wisconsin Wyoming`;
    expect(states.toSorted()).toEqual(
      expected
        .match(
          /New (?:Hampshire|Jersey|Mexico|York)|North (?:Carolina|Dakota)|Rhode Island|South (?:Carolina|Dakota)|West Virginia|[A-Z][a-z]+/g
        )!
        .toSorted()
    );
  });
});
