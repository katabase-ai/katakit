import { afterEach, expect, test, vi } from 'vitest';
import { createTranscriptionDemo } from '../../transcription-react/src/createTranscriptionDemo';
import { createBrowserBingoDemo } from '../../bingo-react/src/createBrowserBingoDemo';

afterEach(() => vi.useRealTimers());

test('separate transcripts and Bingo state remain isolated; close completes every owned projection and timer', () => {
  vi.useFakeTimers();
  const transcript = createTranscriptionDemo();
  const bingo = createBrowserBingoDemo();
  const completed = vi.fn();
  const bingoCompleted = vi.fn();
  transcript.state$.subscribe({ complete: completed });
  bingo.state$.subscribe({ complete: bingoCompleted });
  transcript.ingestSegment({ id: 'first', sourceId: 'one', text: 'a private transcript' });
  expect(bingo.state$.getValue().lastHeard).toBeUndefined();
  bingo.ingestSegment({ id: 'second', sourceId: 'two', text: 'Quick question' });
  expect(bingo.state$.getValue().board.marked[0]).toBe(true);
  expect(transcript.state$.getValue().currentTurn?.text).toBe('a private transcript');
  expect(vi.getTimerCount()).toBe(2);
  transcript.close();
  bingo.close();
  expect(completed).toHaveBeenCalledOnce();
  expect(bingoCompleted).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  const fresh = createBrowserBingoDemo();
  expect(fresh.state$.getValue().board.marked[0]).toBe(false);
  expect(fresh.state$.getValue().lastHeard).toBeUndefined();
  fresh.close();
});
