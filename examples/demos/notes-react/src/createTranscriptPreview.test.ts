import { afterEach, expect, test, vi } from 'vitest';
import { createNotesDemo } from './createNotesDemo';
import { createTranscriptPreview, type TranscriptPreviewWord } from './createTranscriptPreview';
import type { NotesConnection } from './notesModel';

afterEach(() => vi.useRealTimers());

const setup = () => {
  vi.useFakeTimers();
  const runtime = createNotesDemo();
  let words: TranscriptPreviewWord[] = [];
  const close = createTranscriptPreview({
    events$: runtime.transcriptEvents$,
    onWords: value => {
      words = value;
    },
  });
  return {
    runtime,
    words: () => words,
    close: () => {
      close();
      runtime.close();
    },
  };
};

test('words expire individually within twenty seconds while inference retains every turn', async () => {
  const preview = setup();
  preview.runtime.ingestSegment({ id: 'first', sourceId: 'mic', text: 'Plan the release.' });
  preview.runtime.flush();
  const first = preview.words()[0]!;
  vi.advanceTimersByTime(10_000);
  preview.runtime.ingestSegment({ id: 'second', sourceId: 'mic', text: 'Ship on Tuesday.' });
  preview.runtime.flush();
  vi.advanceTimersByTime(first.durationMs - 10_000);
  expect(preview.words().map(word => word.text)).toEqual([
    'the',
    'release.',
    'Ship',
    'on',
    'Tuesday.',
  ]);
  vi.advanceTimersByTime(20_000 - first.durationMs);
  expect(preview.words().map(word => word.text)).toEqual(['Ship', 'on', 'Tuesday.']);
  vi.advanceTimersByTime(10_000);
  expect(preview.words()).toEqual([]);
  expect(preview.runtime.state$.get().turns.map(turn => turn.text)).toEqual([
    'Plan the release.',
    'Ship on Tuesday.',
  ]);
  const requestCompletion = vi.fn<NotesConnection['requestCompletion']>().mockResolvedValue({
    choices: [{ finish_reason: 'stop', message: { content: '{"additions":[],"rewords":[]}' } }],
  });
  preview.runtime.notes.connect({
    model: 'test',
    maxBodyBytes: 16384,
    maxOutputTokens: 1024,
    requestCompletion,
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(requestCompletion).toHaveBeenCalledOnce();
  expect(requestCompletion.mock.calls[0]![0].body).toContain('Plan the release.');
  expect(requestCompletion.mock.calls[0]![0].body).toContain('Ship on Tuesday.');
  preview.close();
});

test('provisional corrections and finalization keep word identity and expiry', () => {
  const preview = setup();
  preview.runtime.updateProvisional('Meet John');
  const original = preview.words();
  vi.advanceTimersByTime(5_000);
  preview.runtime.updateProvisional('Meet Jon on Tuesday');
  expect(
    preview
      .words()
      .slice(0, 2)
      .map(({ id, expiresAt }) => ({ id, expiresAt }))
  ).toEqual(original.map(({ id, expiresAt }) => ({ id, expiresAt })));
  const corrected = preview.words();
  preview.runtime.ingestSegment({ id: 'first', sourceId: 'mic', text: 'Meet Jon on Tuesday.' });
  preview.runtime.flush();
  expect(preview.words().map(({ id, expiresAt }) => ({ id, expiresAt }))).toEqual(
    corrected.map(({ id, expiresAt }) => ({ id, expiresAt }))
  );
  expect(preview.words().every(word => !word.provisional)).toBe(true);
  expect(preview.words().map(word => word.text)).toEqual(['Meet', 'Jon', 'on', 'Tuesday.']);
  vi.advanceTimersByTime(15_000);
  expect(preview.words().map(word => word.text)).toEqual(['on', 'Tuesday.']);
  preview.close();
});

test('expired provisional words do not reappear on updates, finalization, or clear', () => {
  const preview = setup();
  preview.runtime.updateProvisional('Keep this thought');
  vi.advanceTimersByTime(20_000);
  expect(preview.words()).toEqual([]);
  preview.runtime.updateProvisional('Keep this thought pending');
  expect(preview.words().map(word => word.text)).toEqual(['pending']);
  preview.runtime.ingestSegment({
    id: 'first',
    sourceId: 'mic',
    text: 'Keep this thought pending.',
  });
  preview.runtime.flush();
  expect(preview.words().map(word => word.text)).toEqual(['pending.']);
  preview.runtime.notes.clear();
  expect(preview.words().map(word => word.text)).toEqual(['pending.']);
  preview.close();
  expect(vi.getTimerCount()).toBe(0);
});

test('replay never presents old transcript as freshly spoken words', () => {
  const runtime = createNotesDemo({
    initialEvents: [
      { type: 'transcriptTurn', turn: { id: 'old', sourceId: 'mic', text: 'Old speech.' } },
    ],
  });
  const onWords = vi.fn();
  const close = createTranscriptPreview({ events$: runtime.transcriptEvents$, onWords });
  expect(onWords).not.toHaveBeenCalled();
  runtime.ingestSegment({ id: 'new', sourceId: 'mic', text: 'New speech.' });
  expect(onWords.mock.lastCall![0].map((word: TranscriptPreviewWord) => word.text)).toEqual([
    'New',
    'speech.',
  ]);
  close();
  runtime.close();
});

test('a discarded draft cannot age the next utterance and unmount releases its expiry timer', async () => {
  const preview = setup();
  preview.runtime.updateProvisional('Discard this draft');
  const original = preview.words()[0]!;
  vi.advanceTimersByTime(10_000);
  preview.runtime.updateProvisional('');
  await vi.advanceTimersByTimeAsync(0);
  preview.runtime.updateProvisional('A new thought');
  expect(preview.words()[0]!.id).not.toBe(original.id);
  expect(preview.words()[0]!.expiresAt).toBeGreaterThan(original.expiresAt);
  preview.close();
  expect(vi.getTimerCount()).toBe(0);
});
