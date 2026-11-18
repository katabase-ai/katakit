import { expect, test, vi } from 'vitest';
import type { MicrophoneOptions } from '@katakit/transcription/browser';
import { createGallerySpeech, type GalleryInputSink } from './createGallerySpeech';
import { createTranscriptionDemo } from '../../transcription-react/src/createTranscriptionDemo';
import { createBrowserBingoDemo } from '../../bingo-react/src/createBrowserBingoDemo';
import { createNotesDemo } from '../../notes-react/src/createNotesDemo';
import { createColorClash } from './color-clash/createColorClash';

type ContentSink = GalleryInputSink & { content: () => string };
const demos: { name: string; create: () => ContentSink }[] = [
  {
    name: 'Transcription',
    create: () => {
      const runtime = createTranscriptionDemo();
      return {
        ...runtime,
        content: () => {
          const s = runtime.state$.getValue();
          return [...s.completedTurns.map(t => t.text), s.currentTurn?.text]
            .filter(Boolean)
            .join(' ');
        },
      };
    },
  },
  {
    name: 'Bingo',
    create: () => {
      const runtime = createBrowserBingoDemo();
      return { ...runtime, content: () => runtime.state$.getValue().lastHeard ?? '' };
    },
  },
  {
    name: 'Notes',
    create: () => {
      const runtime = createNotesDemo();
      return {
        ...runtime,
        content: () =>
          runtime.state$
            .get()
            .turns.map(t => t.text)
            .join(' '),
      };
    },
  },
  {
    name: 'Color Clash',
    create: () => {
      const runtime = createColorClash({ random: () => 0.25 });
      return { ...runtime, content: () => runtime.getSnapshot().transcript };
    },
  },
];

test.each(demos)(
  '$name retains content through stop/restart but starts a fresh visit without late input',
  async demo => {
    let callbacks!: MicrophoneOptions;
    let sourceId!: string;
    const createTranscriber = vi.fn((options: MicrophoneOptions) => {
      callbacks = options;
      return {
        load: async () => callbacks.onState?.({ phase: 'ready' }),
        start: async (input?: { sourceId?: string }) => {
          sourceId = input!.sourceId!;
          callbacks.onState?.({ phase: 'running' });
        },
        stop: async () => {
          callbacks.onStop?.();
          callbacks.onState?.({ phase: 'ready' });
        },
        dispose: async () => {},
      };
    });
    const owner = createGallerySpeech({ createTranscriber });
    const first = owner.attach(demo.create);
    const old = (await first.ready)!;
    await owner.start();
    const oldSource = sourceId;
    callbacks.onFinal({ id: 'first', sourceId, text: 'Quick question: plan the launch.' });
    await owner.stop();
    expect(old.content()).toContain('Quick question: plan the launch.');
    await owner.start();
    expect(old.content()).toContain('Quick question: plan the launch.');
    await first.release();
    const next = owner.attach(demo.create);
    const fresh = (await next.ready)!;
    expect(fresh.content()).toBe('');
    callbacks.onFinal({ id: 'late', sourceId: oldSource, text: 'Old visit tail' });
    expect(fresh.content()).toBe('');
    expect(createTranscriber).toHaveBeenCalledOnce();
    await next.release();
    await owner.dispose();
  }
);

test('a new Bingo card clears manual overrides while retaining matches from the visit transcript', () => {
  const runtime = createBrowserBingoDemo();
  runtime.ingestSegment({ id: 'heard', sourceId: 'review', text: 'Quick question' });
  runtime.flush();
  runtime.bingoMethods.setOverride(1, true);
  const squares = [...runtime.state$.getValue().board.squares];
  runtime.bingoMethods.setSquares(squares);
  const { board, lastHeard } = runtime.state$.getValue();
  expect(board.marked[0]).toBe(true);
  expect(board.evidence[0]).toBe('Quick question');
  expect(board.marked[1]).toBe(false);
  expect(board.overrides).toEqual({});
  expect(lastHeard).toBe('Quick question');
  runtime.close();
});
