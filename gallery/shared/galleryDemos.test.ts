import { afterEach, expect, test, vi } from 'vitest';
import { createTranscriptionDemo } from '../../examples/demos/transcription-react/src/createTranscriptionDemo';
import { createBingoSession } from '../../examples/demos/bingo-react/src/bingo/createBingoSession';
import { createNotesDemo } from '../../examples/demos/notes-react/src/createNotesDemo';
import {
  transcriptionDemoDetails,
  bingoDemoDetails,
  notesDemoDetails,
  colorClashDemoDetails,
  listExtractionDemoDetails,
  brainstormDemoDetails,
} from './galleryDemoDetails';
import {
  transcriptionGalleryDemo,
  bingoGalleryDemo,
  notesGalleryDemo,
  colorClashGalleryDemo,
  listExtractionGalleryDemo,
  brainstormGalleryDemo,
} from './galleryDemos';

afterEach(() => vi.useRealTimers());

test('each named loader carries its matching metadata independent of catalogue position', () => {
  for (const [entry, details] of [
    [transcriptionGalleryDemo, transcriptionDemoDetails],
    [bingoGalleryDemo, bingoDemoDetails],
    [notesGalleryDemo, notesDemoDetails],
    [colorClashGalleryDemo, colorClashDemoDetails],
    [listExtractionGalleryDemo, listExtractionDemoDetails],
    [brainstormGalleryDemo, brainstormDemoDetails],
  ] as const) {
    expect(entry).toMatchObject(details);
  }
});

test('separate transcripts and Bingo state remain isolated; close completes every owned projection and timer', () => {
  vi.useFakeTimers();
  const transcript = createTranscriptionDemo();
  const bingo = createBingoSession();
  const notes = createNotesDemo();
  const completed = vi.fn();
  const bingoCompleted = vi.fn();
  const notesCompleted = vi.fn();
  transcript.state$.subscribe({ complete: completed });
  bingo.board$.subscribe({ complete: bingoCompleted });
  notes.state$.subscribe({ complete: notesCompleted });
  transcript.ingestSegment({ id: 'first', sourceId: 'one', text: 'a private transcript' });
  bingo.ingestSegment({ id: 'second', sourceId: 'two', text: 'Quick question' });
  expect(bingo.board$.get().marked[0]).toBe(true);
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
  const fresh = createBingoSession();
  expect(fresh.board$.get().marked[0]).toBe(false);
  fresh.close();
});
