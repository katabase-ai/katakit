import { expect, test, vi } from 'vitest';
import type { MicrophoneOptions } from '@katakit/transcription/browser';
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
  await owner.load();
  await first.release();
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
  expect(incoming.ingestSegment).not.toHaveBeenCalled();
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

test('root teardown disposes a helper immediately while an explicit preload is pending', async () => {
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
  const disposal = owner.dispose();
  await Promise.all([loading, disposal]);
  expect(dispose).toHaveBeenCalledOnce();
  expect(owner.getSnapshot().input.phase).toBe('disposed');
});
