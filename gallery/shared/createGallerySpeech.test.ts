import { expect, test, vi } from 'vitest';
import type { MicrophoneOptions } from '@katakit/transcription/browser';
import { TranscriptionError } from '@katakit/transcription';
import { createGallerySpeech } from './createGallerySpeech';

const fixture = () => {
  const events: string[] = [];
  const inputs: {
    callbacks: MicrophoneOptions;
    sourceId?: string;
    disposed: boolean;
    tail?: Promise<void>;
  }[] = [];
  const owner = createGallerySpeech({
    createTranscriber: callbacks => {
      const input = {
        callbacks,
        sourceId: undefined as string | undefined,
        disposed: false,
        tail: undefined as Promise<void> | undefined,
      };
      inputs.push(input);
      return {
        load: async () => {
          events.push('load');
          callbacks.onState?.({ phase: 'ready' });
        },
        start: async options => {
          input.sourceId = options?.sourceId;
          events.push('start');
          callbacks.onState?.({ phase: 'running' });
        },
        stop: async () => {
          events.push('stop');
          await input.tail;
          if (input.sourceId)
            callbacks.onFinal({ id: 'tail', sourceId: input.sourceId, text: 'final words' });
          callbacks.onStop?.();
          callbacks.onState?.({ phase: 'ready' });
        },
        dispose: async () => {
          input.disposed = true;
          events.push('dispose');
        },
      };
    },
  });
  const sink = (name: string) => ({
    ingestSegment: vi.fn(() => {
      events.push(`${name}:final`);
    }),
    updateProvisional: vi.fn(),
    flush: vi.fn(() => {
      events.push(`${name}:flush`);
    }),
    close: vi.fn(() => {
      events.push(`${name}:close`);
    }),
  });
  return { owner, inputs, sink, events };
};

test('constructs lazily and retains the same loaded model after releasing and attaching demos', async () => {
  const { owner, inputs, sink } = fixture();
  const first = owner.attach(() => sink('first'));
  await first.ready;
  expect(inputs).toHaveLength(0);
  expect(owner.getSnapshot().attached).toBe(true);
  await owner.load();
  const release = first.release();
  expect(owner.getSnapshot().attached).toBe(false);
  await release;
  await owner.attach(() => sink('second')).ready;
  expect(inputs).toHaveLength(1);
  expect(inputs[0]?.disposed).toBe(false);
  expect(owner.getSnapshot().input.phase).toBe('ready');
  await owner.dispose();
  expect(inputs[0]?.disposed).toBe(true);
});

test('drains final results into the outgoing sink before closing it or creating the next runtime', async () => {
  const { owner, inputs, sink, events } = fixture();
  const outgoing = sink('outgoing');
  await owner.attach(() => outgoing).ready;
  await owner.start();
  let finish!: () => void;
  inputs[0]!.tail = new Promise(resolve => {
    finish = resolve;
  });
  const incoming = sink('incoming');
  const next = owner.attach(() => {
    events.push('incoming:create');
    return incoming;
  });
  await vi.waitFor(() => expect(events).toContain('stop'));
  expect(outgoing.close).not.toHaveBeenCalled();
  expect(events).not.toContain('incoming:create');
  finish();
  await next.ready;
  expect(events.indexOf('outgoing:final')).toBeLessThan(events.indexOf('outgoing:close'));
  expect(events.indexOf('outgoing:close')).toBeLessThan(events.indexOf('incoming:create'));
  expect(incoming.ingestSegment).not.toHaveBeenCalled();
  inputs[0]!.callbacks.onFinal({
    id: 'late',
    sourceId: inputs[0]!.sourceId!,
    text: 'late old result',
  });
  inputs[0]!.callbacks.onProvisional?.('late old preview');
  expect(incoming.ingestSegment).not.toHaveBeenCalled();
  expect(incoming.updateProvisional).not.toHaveBeenCalled();
  expect(owner.getSnapshot().input.phase).toBe('ready');
  await owner.dispose();
});

test('rapidly cancelled mounts never create orphan runtimes, and old release cannot close the new sink', async () => {
  const { owner, sink } = fixture();
  const cancelled = vi.fn(() => sink('cancelled'));
  const first = owner.attach(cancelled);
  const release = first.release();
  const incoming = sink('incoming');
  const second = owner.attach(() => incoming);
  await Promise.all([release, second.ready]);
  expect(cancelled).not.toHaveBeenCalled();
  await first.release();
  expect(incoming.close).not.toHaveBeenCalled();
  await owner.dispose();
  expect(incoming.close).toHaveBeenCalledOnce();
});

test('recording locks selection; stopped model replacement disposes before new helper creation', async () => {
  const { owner, inputs, sink } = fixture();
  await owner.attach(() => sink('demo')).ready;
  await owner.start();
  await owner.select('whisper-tiny');
  expect(owner.getSnapshot().model).toBe('moonshine-small');
  await owner.stop();
  await owner.select('whisper-tiny');
  expect(inputs[0]?.disposed).toBe(true);
  expect(inputs).toHaveLength(1);
  await owner.load();
  expect(inputs[1]?.callbacks.model).toBe('whisper-tiny');
  await owner.dispose();
});

test('navigation while starting cancels through utility disposal before microphone permission', async () => {
  let finish!: () => void;
  let disposed = false;
  const microphone = vi.fn();
  const owner = createGallerySpeech({
    createTranscriber: callbacks => ({
      load: async () => undefined,
      start: async () => {
        callbacks.onState?.({ phase: 'loading' });
        await new Promise<void>(resolve => {
          finish = resolve;
        });
        if (!disposed) microphone();
      },
      stop: async () => undefined,
      dispose: async () => {
        disposed = true;
        finish();
      },
    }),
  });
  const { sink } = fixture();
  const lease = owner.attach(() => sink('demo'));
  await lease.ready;
  const starting = owner.start();
  await vi.waitFor(() => expect(owner.getSnapshot().input.phase).toBe('loading'));
  await lease.release();
  await starting;
  expect(microphone).not.toHaveBeenCalled();
  await owner.dispose();
});

test('a failed load remains retryable without changing the selected model', async () => {
  let failed = false;
  const owner = createGallerySpeech({
    createTranscriber: callbacks => ({
      load: async () => {
        if (!failed) {
          failed = true;
          throw new Error('download failed');
        }
        callbacks.onState?.({ phase: 'ready' });
      },
      start: async () => undefined,
      stop: async () => undefined,
      dispose: async () => undefined,
    }),
  });
  const { sink } = fixture();
  await owner.attach(() => sink('demo')).ready;
  await owner.load();
  expect(owner.getSnapshot().error).toBe('download failed');
  await owner.load();
  expect(owner.getSnapshot().input.phase).toBe('ready');
  expect(owner.getSnapshot().error).toBeUndefined();
  expect(owner.getSnapshot().model).toBe('moonshine-small');
  await owner.dispose();
});

test.each(['dispose', 'cancel'] as const)(
  '%s disposes a helper immediately while an explicit preload is pending',
  async action => {
    let finish!: () => void;
    const dispose = vi.fn(async () => {
      finish();
    });
    const owner = createGallerySpeech({
      createTranscriber: callbacks => ({
        load: async () => {
          callbacks.onState?.({ phase: 'loading' });
          await new Promise<void>(resolve => {
            finish = resolve;
          });
        },
        start: async () => undefined,
        stop: async () => undefined,
        dispose,
      }),
    });
    const { sink } = fixture();
    await owner.attach(() => sink('demo')).ready;
    const loading = owner.load();
    await vi.waitFor(() => expect(owner.getSnapshot().input.phase).toBe('loading'));
    const disposal = owner[action]();
    await Promise.all([loading, disposal]);
    expect(dispose).toHaveBeenCalledOnce();
    expect(owner.getSnapshot().input.phase).toBe(action === 'dispose' ? 'disposed' : 'idle');
    expect(owner.getSnapshot().error).toBeUndefined();
  }
);

test('downloads without a demo attachment or microphone start, then retains the model on attachment', async () => {
  const { owner, sink, inputs, events } = fixture();
  await owner.load();
  expect(inputs).toHaveLength(1);
  expect(events).toEqual(['load']);
  expect(owner.getSnapshot().input.phase).toBe('ready');
  expect(owner.getSnapshot().attached).toBe(false);
  await owner.attach(() => sink('demo')).ready;
  expect(inputs).toHaveLength(1);
  expect(events).not.toContain('start');
  await owner.dispose();
});

test('reports load, microphone, and recording outcomes to the host without recognized text', async () => {
  const reported: Record<string, unknown>[] = [];
  let demoId = 'bingo';
  let callbacks: MicrophoneOptions | undefined;
  let sourceId: string | undefined;
  const owner = createGallerySpeech({
    onEvent: event => reported.push(event),
    getDemoId: () => demoId,
    createTranscriber: options => {
      callbacks = options;
      return {
        load: async () => {},
        start: async start => {
          sourceId = start?.sourceId;
          options.onState?.({ phase: 'loading', progress: 0 });
          options.onState?.({ phase: 'ready' });
          options.onState?.({ phase: 'starting' });
          options.onState?.({ phase: 'running' });
        },
        stop: async () => {
          options.onState?.({ phase: 'stopping' });
          options.onState?.({ phase: 'ready' });
        },
        dispose: async () => {},
      };
    },
  });
  await owner.attach(() => ({
    ingestSegment: vi.fn(),
    updateProvisional: vi.fn(),
    flush: vi.fn(),
    close: vi.fn(),
  })).ready;
  await owner.start();
  callbacks?.onFinal({ id: 'one', sourceId: sourceId!, text: 'spoken words' });
  callbacks?.onFinal({ id: 'two', sourceId: sourceId!, text: 'more spoken words' });
  // Navigation changes the active demo before the outgoing recording finishes draining.
  demoId = 'notes';
  await owner.stop();
  expect(reported.map(event => [event.type, event.demoId])).toEqual([
    ['speechModelLoadFinished', 'bingo'],
    ['microphoneRequested', 'bingo'],
    ['microphoneAnswered', 'bingo'],
    ['recordingStarted', 'bingo'],
    ['recordingStopped', 'bingo'],
  ]);
  expect(reported[0]).toMatchObject({ outcome: 'completed', model: 'moonshine-small' });
  expect(reported[2]).toMatchObject({ outcome: 'granted' });
  expect(reported[4]).toMatchObject({ segmentCount: 2 });
  expect(JSON.stringify(reported)).not.toContain('spoken');
  await owner.select('whisper-tiny');
  expect(reported.at(-1)).toEqual({
    type: 'speechModelChanged',
    model: 'whisper-tiny',
    demoId: 'notes',
  });
});

test('reports a denied microphone and a cancelled download by their own outcomes', async () => {
  const reported: Record<string, unknown>[] = [];
  let denied = true;
  let releaseDownload: (() => void) | undefined;
  const owner = createGallerySpeech({
    onEvent: event => reported.push(event),
    createTranscriber: options => ({
      load: async () => {},
      start: async () => {
        if (!denied) {
          options.onState?.({ phase: 'loading' });
          await new Promise<void>(resolve => {
            releaseDownload = resolve;
          });
        }
        options.onState?.({ phase: 'starting' });
        const error = new TranscriptionError('microphone-permission-denied', 'Permission denied');
        options.onState?.({ phase: 'error', error });
        throw error;
      },
      stop: async () => {},
      dispose: async () => releaseDownload?.(),
    }),
  });
  await owner.attach(() => ({
    ingestSegment: vi.fn(),
    updateProvisional: vi.fn(),
    flush: vi.fn(),
    close: vi.fn(),
  })).ready;
  await owner.start();
  expect(reported.at(-1)).toMatchObject({
    type: 'microphoneAnswered',
    outcome: 'denied',
    errorCode: 'microphone-permission-denied',
  });
  denied = false;
  void owner.start();
  await vi.waitFor(() => expect(owner.getSnapshot().input.phase).toBe('loading'));
  await owner.cancel();
  expect(reported.at(-1)).toMatchObject({ type: 'speechModelLoadFinished', outcome: 'cancelled' });
});
