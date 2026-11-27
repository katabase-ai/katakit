import { afterEach, expect, test, vi } from 'vitest';
import { createNotesDemo } from '../src/createNotesDemo';
import {
  createTranscriptPreview,
  type TranscriptPreviewLine,
} from '../src/createTranscriptPreview';
import type { NotesConnection } from '../src/notesModel';

afterEach(() => vi.useRealTimers());

const setup = () => {
  vi.useFakeTimers();
  const runtime = createNotesDemo();
  let lines: TranscriptPreviewLine[] = [];
  const close = createTranscriptPreview({
    events$: runtime.transcriptEvents$,
    onLines: value => {
      lines = value;
    },
  });
  return {
    runtime,
    lines: () => lines,
    text: () => lines.map(line => line.text),
    close: () => {
      close();
      runtime.close();
    },
  };
};
const say = (preview: ReturnType<typeof setup>, text: string) => {
  preview.runtime.ingestSegment({ id: text, sourceId: 'mic', text });
  preview.runtime.flush();
};

test('lines are newest first and expire from the end while inference retains every turn', async () => {
  const preview = setup();
  say(preview, 'Plan the release.');
  vi.advanceTimersByTime(10_000);
  say(preview, 'Ship on Tuesday.');
  expect(preview.text()).toEqual(['Ship on Tuesday.', 'Plan the release.']);
  vi.advanceTimersByTime(10_000);
  expect(preview.text()).toEqual(['Ship on Tuesday.']);
  vi.advanceTimersByTime(10_000);
  expect(preview.lines()).toEqual([]);
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

test('lines spoken quickly all stay until they age out', () => {
  const preview = setup();
  ['One.', 'Two.', 'Three.', 'Four.', 'Five.'].forEach(text => say(preview, text));
  expect(preview.text()).toEqual(['Five.', 'Four.', 'Three.', 'Two.', 'One.']);
  preview.close();
});

test('the line being spoken stays first and keeps its identity through corrections and finalization', () => {
  const preview = setup();
  say(preview, 'An earlier thought.');
  preview.runtime.updateProvisional('Meet John');
  const draft = preview.lines()[0]!;
  expect(draft.provisional).toBe(true);
  preview.runtime.updateProvisional('Meet Jon on Tuesday');
  expect(preview.lines()[0]!.id).toBe(draft.id);
  say(preview, 'Meet Jon on Tuesday.');
  expect(preview.lines().map(({ id, provisional }) => ({ id, provisional }))).toEqual([
    { id: draft.id, provisional: false },
    { id: expect.any(Number), provisional: false },
  ]);
  expect(preview.text()).toEqual(['Meet Jon on Tuesday.', 'An earlier thought.']);
  preview.close();
});

test('replay never presents old transcript as freshly spoken lines', () => {
  const runtime = createNotesDemo({
    initialEvents: [
      {
        type: 'transcriptTurn',
        turn: { id: 'old', sourceId: 'mic', text: 'Old speech.' },
      },
    ],
  });
  const onLines = vi.fn();
  const close = createTranscriptPreview({ events$: runtime.transcriptEvents$, onLines });
  expect(onLines).not.toHaveBeenCalled();
  runtime.ingestSegment({ id: 'new', sourceId: 'mic', text: 'New speech.' });
  expect(onLines.mock.lastCall![0].map((line: TranscriptPreviewLine) => line.text)).toEqual([
    'New speech.',
  ]);
  close();
  runtime.close();
});

test('a discarded draft is not reused by the next utterance, clearing notes keeps the transcript, and unmount releases the timer', async () => {
  const preview = setup();
  preview.runtime.updateProvisional('Discard this draft');
  const original = preview.lines()[0]!;
  preview.runtime.updateProvisional('');
  await vi.advanceTimersByTimeAsync(0);
  expect(preview.lines()).toEqual([]);
  preview.runtime.updateProvisional('A new thought');
  expect(preview.lines()[0]!.id).not.toBe(original.id);
  say(preview, 'A new thought.');
  preview.runtime.notes.clear();
  expect(preview.text()).toEqual(['A new thought.']);
  preview.close();
  expect(vi.getTimerCount()).toBe(0);
});
