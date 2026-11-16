import { describe, expect, test } from 'vitest';
import { createColorClash } from './createColorClash';

const fixture = () => {
  let time = 0;
  const game = createColorClash({ now: () => time, random: () => 0 });
  const advance = (milliseconds: number) => {
    time += milliseconds;
    game.advance();
  };
  const say = (text: string) => game.ingestSegment({ id: 'segment', sourceId: 'microphone', text });
  return { game, advance, say };
};

describe('Color Clash transcription and round lifecycle', () => {
  test('gives instructions before a full twenty-second round and ignores late results', () => {
    const { game, advance, say } = fixture();
    game.begin();
    say(game.getSnapshot().target.ink);
    expect(game.getSnapshot()).toMatchObject({ phase: 'instructions', score: 0 });
    advance(1600);
    expect(game.getSnapshot()).toMatchObject({ phase: 'playing', remainingMs: 20000 });
    advance(19999);
    expect(game.getSnapshot().phase).toBe('playing');
    advance(1);
    say(game.getSnapshot().target.ink);
    expect(game.getSnapshot()).toMatchObject({ phase: 'finished', remainingMs: 0, score: 0 });
  });

  test('reading the word loses a chance; saying its different ink color pops it', () => {
    const { game, advance, say } = fixture();
    game.begin();
    advance(1600);
    const target = game.getSnapshot().target;
    expect(target.word).not.toBe(target.ink);
    say(target.word);
    expect(game.getSnapshot()).toMatchObject({ score: 0, mistake: 1 });
    say(target.ink);
    expect(game.getSnapshot()).toMatchObject({ score: 1, popped: target });
    expect(game.getSnapshot().target.ink).not.toBe(target.ink);
  });

  test('provisional revisions and the final result do not award points for the same spoken position twice', () => {
    const { game, advance, say } = fixture();
    game.begin();
    advance(1600);
    game.updateProvisional('red');
    game.updateProvisional('red blue');
    expect(game.getSnapshot().score).toBe(2);
    game.updateProvisional('blue blue');
    say('red blue');
    expect(game.getSnapshot()).toMatchObject({ score: 2, transcript: 'red blue', provisional: '' });
    // The next segment has fresh positions, even when its first word repeats an earlier one.
    say('red');
    expect(game.getSnapshot().score).toBe(3);
  });

  test('accepts a corrected color at a position that was not previously a color', () => {
    const { game, advance } = fixture();
    game.begin();
    advance(1600);
    game.updateProvisional('read');
    game.updateProvisional('red');
    expect(game.getSnapshot().score).toBe(1);
  });

  test('ending early keeps the transcript but freezes scoring, and replay clears the previous round', () => {
    const { game, advance, say } = fixture();
    game.begin();
    advance(1600);
    say('red');
    game.finish();
    say('blue');
    expect(game.getSnapshot()).toMatchObject({
      phase: 'finished',
      score: 1,
      transcript: 'red blue',
    });
    game.begin();
    expect(game.getSnapshot()).toMatchObject({
      phase: 'instructions',
      score: 0,
      transcript: '',
      remainingMs: 20000,
    });
    const previous = game.getSnapshot();
    game.close();
    advance(30000);
    say('red');
    game.begin();
    expect(game.getSnapshot()).toBe(previous);
  });
});
