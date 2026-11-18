import { afterEach, expect, test, vi } from 'vitest';
import { createTranscriptionDemo } from '../../transcription-react/src/createTranscriptionDemo';
import { createBrowserBingoDemo } from '../../bingo-react/src/createBrowserBingoDemo';
import { createNotesDemo } from '../../notes-react/src/createNotesDemo';
import {
  transcriptionDemoDetails,
  bingoDemoDetails,
  notesDemoDetails,
  colorClashDemoDetails,
} from './galleryDemoDetails';
import {
  transcriptionGalleryDemo,
  bingoGalleryDemo,
  notesGalleryDemo,
  colorClashGalleryDemo,
} from './galleryDemos';

afterEach(() => vi.useRealTimers());

test('each named loader carries its matching metadata independent of catalogue position', () => {
  for (const [entry, details] of [
    [transcriptionGalleryDemo, transcriptionDemoDetails],
    [bingoGalleryDemo, bingoDemoDetails],
    [notesGalleryDemo, notesDemoDetails],
    [colorClashGalleryDemo, colorClashDemoDetails],
  ] as const) {
    expect(entry).toMatchObject(details);
  }
});

test('separate transcripts and Bingo state remain isolated; close completes every owned projection and timer', () => {
  vi.useFakeTimers();
  const transcript = createTranscriptionDemo();
  const bingo = createBrowserBingoDemo();
  const notes = createNotesDemo();
  const completed = vi.fn();
  const bingoCompleted = vi.fn();
  const notesCompleted = vi.fn();
  transcript.state$.subscribe({ complete: completed });
  bingo.state$.subscribe({ complete: bingoCompleted });
  notes.state$.subscribe({ complete: notesCompleted });
  transcript.ingestSegment({ id: 'first', sourceId: 'one', text: 'a private transcript' });
  expect(bingo.state$.getValue().lastHeard).toBeUndefined();
  bingo.ingestSegment({ id: 'second', sourceId: 'two', text: 'Quick question' });
  expect(bingo.state$.getValue().board.marked[0]).toBe(true);
  expect(transcript.state$.getValue().currentTurn?.text).toBe('a private transcript');
  expect(notes.state$.get().turns).toEqual([]);
  notes.ingestSegment({ id: 'third', sourceId: 'three', text: 'private notes input' });
  expect(vi.getTimerCount()).toBe(3);
  transcript.close();
  bingo.close();
  notes.close();
  expect(completed).toHaveBeenCalledOnce();
  expect(bingoCompleted).toHaveBeenCalledOnce();
  expect(notesCompleted).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  const fresh = createBrowserBingoDemo();
  expect(fresh.state$.getValue().board.marked[0]).toBe(false);
  expect(fresh.state$.getValue().lastHeard).toBeUndefined();
  fresh.close();
});
