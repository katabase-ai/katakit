import { describe, expect, test, vi } from 'vitest';
import { createColorClash } from '../src/color-clash/createColorClash';

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
  test('leaving during instructions creates no round or target and cannot start one later', () => {
    let time = 0;
    const random = vi.fn(() => 0);
    const game = createColorClash({ now: () => time, random });
    expect(game.events$.getAll()).toHaveLength(0);
    game.begin();
    expect(random).not.toHaveBeenCalled();
    game.finish();
    time = 30000;
    game.advance();
    expect(game.events$.getAll()).toHaveLength(0);
    expect(game.getSnapshot().phase).toBe('finished');
    game.close();
  });

  test('only a started live round can request capture stop, including after replay', () => {
    const { game, advance } = fixture();
    expect(game.isLiveRound()).toBe(false);
    expect(game.hasBegunLiveRound()).toBe(false);
    game.begin();
    expect(game.isLiveRound()).toBe(true);
    expect(game.hasBegunLiveRound()).toBe(false);
    advance(1600);
    expect(game.isLiveRound()).toBe(true);
    expect(game.hasBegunLiveRound()).toBe(true);
    game.finish();
    expect(game.isLiveRound()).toBe(false);
    expect(game.hasBegunLiveRound()).toBe(true);

    const replay = createColorClash({ initialEvents: game.events$.getAll() });
    expect(replay.isLiveRound()).toBe(false);
    expect(replay.hasBegunLiveRound()).toBe(false);
    replay.begin();
    replay.finish();
    expect(replay.isLiveRound()).toBe(false);
    expect(replay.hasBegunLiveRound()).toBe(false);
    expect(replay.events$.getAll()).toHaveLength(game.events$.getAll().length);
    game.close();
    replay.close();
  });

  test('a duplicate begin cannot restart instructions or extend a live round', () => {
    const { game, advance } = fixture();
    game.begin();
    advance(1000);
    game.begin();
    advance(600);
    expect(game.getSnapshot()).toMatchObject({ phase: 'playing', remainingMs: 20000 });
    advance(1000);
    game.begin();
    expect(game.getSnapshot()).toMatchObject({ phase: 'playing', remainingMs: 19000 });
    expect(game.events$.getAll().map(event => event.type)).toEqual(['roundStarted']);
    game.close();
  });

  test('replays targets, deadline and score without redrawing or restoring transient transcript', () => {
    const { game, advance, say } = fixture();
    game.begin();
    advance(1600);
    game.updateProvisional('red');
    game.updateProvisional('red blue');
    say('red blue');
    game.finish();
    const events = game.events$.getAll();
    const expected = game.game$.get();
    const random = vi.fn(() => 0.5);
    let replayTime = 1600;
    const replay = createColorClash({ now: () => replayTime, random, initialEvents: events });
    expect(random).not.toHaveBeenCalled();
    expect(replay.events$.getAll()).toEqual(game.events$.getAll());
    expect(replay.game$.get()).toEqual(expected);
    expect(replay.getSnapshot()).toMatchObject({ transcript: '', provisional: '' });
    expect(replay.isLiveRound()).toBe(false);
    replay.advance();
    replay.updateProvisional('green');
    expect(replay.events$.getAll()).toHaveLength(events.length);
    replay.begin();
    expect(random).not.toHaveBeenCalled();
    expect(replay.getSnapshot().phase).toBe('instructions');
    replayTime += 1600;
    replay.advance();
    expect(random).toHaveBeenCalled();
    game.close();
    replay.close();
  });

  test('gives instructions before a full twenty-second round and ignores late results', () => {
    const { game, advance, say } = fixture();
    game.begin();
    say('red');
    expect(game.getSnapshot()).toMatchObject({ phase: 'instructions', score: 0 });
    expect(game.events$.getAll()).toHaveLength(0);
    advance(1600);
    expect(game.getSnapshot()).toMatchObject({ phase: 'playing', remainingMs: 20000 });
    advance(19999);
    expect(game.getSnapshot().phase).toBe('playing');
    advance(1);
    say(game.getSnapshot().target!.ink);
    expect(game.getSnapshot()).toMatchObject({ phase: 'finished', remainingMs: 0, score: 0 });
  });

  test('reading the word loses a chance; saying its different ink color pops it', () => {
    const { game, advance, say } = fixture();
    game.begin();
    advance(1600);
    const target = game.getSnapshot().target!;
    expect(target.word).not.toBe(target.ink);
    say(target.word);
    expect(game.getSnapshot()).toMatchObject({ score: 0, mistake: 1 });
    say(target.ink);
    expect(game.getSnapshot()).toMatchObject({ score: 1, popped: target });
    expect(game.getSnapshot().target!.ink).not.toBe(target.ink);
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
