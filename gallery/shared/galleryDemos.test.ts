import { afterEach, expect, test, vi } from 'vitest';
import { createTranscriptionDemo } from '../../examples/demos/transcription/src/transcription/createTranscriptionDemo';
import { createNotesDemo } from '../../examples/demos/notes/src/createNotesDemo';
import {
  transcriptionDemoDetails,
  bingoDemoDetails,
  notesDemoDetails,
  colorClashDemoDetails,
  listExtractionDemoDetails,
  wordRushDemoDetails,
} from './galleryDemoDetails';
import {
  transcriptionGalleryDemo,
  bingoGalleryDemo,
  notesGalleryDemo,
  colorClashGalleryDemo,
  listExtractionGalleryDemo,
  wordRushGalleryDemo,
} from './galleryDemos';

afterEach(() => vi.useRealTimers());

test('each named loader carries its matching metadata independent of catalogue position', () => {
  for (const [entry, details] of [
    [transcriptionGalleryDemo, transcriptionDemoDetails],
    [bingoGalleryDemo, bingoDemoDetails],
    [notesGalleryDemo, notesDemoDetails],
    [colorClashGalleryDemo, colorClashDemoDetails],
    [listExtractionGalleryDemo, listExtractionDemoDetails],
    [wordRushGalleryDemo, wordRushDemoDetails],
  ] as const) {
    expect(entry).toMatchObject(details);
  }
});

test('transcription and notes visits keep separate transcripts and release their timers', () => {
  vi.useFakeTimers();
  const transcript = createTranscriptionDemo();
  const notes = createNotesDemo();
  const completed = vi.fn();
  const notesCompleted = vi.fn();
  transcript.state$.subscribe({ complete: completed });
  notes.state$.subscribe({ complete: notesCompleted });
  transcript.ingestSegment({ id: 'first', sourceId: 'one', text: 'a private transcript' });
  expect(transcript.state$.get().currentTurn?.text).toBe('a private transcript');
  expect(notes.state$.get().turns).toEqual([]);
  notes.ingestSegment({ id: 'third', sourceId: 'three', text: 'private notes input' });
  expect(vi.getTimerCount()).toBe(2);
  transcript.close();
  notes.close();
  expect(completed).toHaveBeenCalledOnce();
  expect(notesCompleted).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
