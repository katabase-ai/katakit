import type { TranscriptSegment } from '@katakit/transcription';
import { createAudioLevelReporter } from '@katakit/site-ui/audio-level';
// Vite query imports expose generated worker URLs/constructors.
// oxlint-disable-next-line import/default
import workletUrl from './microphoneCaptureWorklet?worker&url';
// oxlint-disable-next-line import/default
import WhisperWorker from './whisperWorker?worker';
import type { MicrophoneCaptureMessage } from './microphoneCaptureWorklet';
import type { WhisperRequest, WhisperResponse } from './whisperProtocol';
import { createWhisperChunks } from './whisperChunks';
import type { InputState } from './createMoonshineInput';

export const createWhisperInput = (params: {
  onState: (state: InputState) => void;
  onFinal: (segment: TranscriptSegment) => void;
  onStop: () => void;
  onLevel?: (level: number) => void;
}) => {
  let worker: Worker | undefined;
  let device: MediaStream | undefined;
  let context: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let processor: AudioWorkletNode | undefined;
  let starting: Promise<void> | undefined;
  let stopping: Promise<void> | undefined;
  let warmup: ReturnType<typeof Promise.withResolvers<void>> | undefined;
  let flushed: ReturnType<typeof Promise.withResolvers<void>> | undefined;
  let pending: ReturnType<typeof Promise.withResolvers<void>> | undefined;
  let disposed = false;
  let failed = false;
  let loaded = false;
  let phase: InputState['phase'] = 'idle';
  let chunks = createWhisperChunks();
  let queued: { id: number; audio: Float32Array }[] = [];
  let chunkDurations = new Map<number, number>();
  let nextId = 0;
  let sourceId = '';
  let inFlight = false;
  let reportLevel: ((samples: Float32Array) => void) | undefined;

  const update = (state: InputState) => {
    phase = state.phase;
    if (!disposed) params.onState(state);
  };
  const fail = (error: unknown) => {
    if (failed) return;
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    update({ phase: 'error', error: message });
    warmup?.resolve();
    flushed?.resolve();
    pending?.resolve();
    void stop();
  };
  const sendNext = () => {
    if (inFlight || !queued.length || failed) return;
    const next = queued.shift()!;
    inFlight = true;
    worker!.postMessage({ type: 'transcribe', ...next } satisfies WhisperRequest, [
      next.audio.buffer,
    ]);
  };
  const enqueue = (audio: Float32Array) => {
    const id = nextId++;
    chunkDurations.set(id, audio.length / 16);
    queued.push({ id, audio });
    sendNext();
  };
  const start = () => {
    if (disposed || starting || stopping || phase === 'recording') return Promise.resolve();
    starting = (async () => {
      try {
        failed = false;
        update({ phase: loaded ? 'starting' : 'loading' });
        if (!worker) {
          worker = new WhisperWorker();
          worker.onerror = event => fail(event.message || 'Whisper worker failed');
          worker.onmessage = ({ data }: MessageEvent<WhisperResponse>) => {
            if (data.type === 'error') return fail(data.message);
            if (data.type === 'progress') {
              if (phase === 'loading') update({ phase: 'loading', progress: data.progress });
            } else if (data.type === 'ready') {
              warmup?.resolve();
            } else if (data.type === 'transcript') {
              inFlight = false;
              const durationMs = chunkDurations.get(data.id) ?? 10_000;
              chunkDurations.delete(data.id);
              if (!disposed && !failed && data.text.trim()) {
                params.onFinal({
                  sourceId,
                  id: String(data.id),
                  text: data.text,
                  startMs: data.id * 10_000,
                  endMs: data.id * 10_000 + durationMs,
                });
              }
              sendNext();
              if (!inFlight && !queued.length) pending?.resolve();
            }
          };
        }
        if (!loaded) {
          warmup = Promise.withResolvers<void>();
          worker.postMessage({ type: 'warmup' } satisfies WhisperRequest);
          await warmup.promise;
          warmup = undefined;
          loaded = true;
        }
        if (disposed || failed) return;
        update({ phase: 'starting' });
        chunks = createWhisperChunks();
        queued = [];
        chunkDurations = new Map();
        nextId = 0;
        sourceId = crypto.randomUUID();
        reportLevel = params.onLevel ? createAudioLevelReporter(params.onLevel, 16_000) : undefined;
        device = await navigator.mediaDevices.getUserMedia({ audio: true });
        context = new AudioContext({ sampleRate: 16_000 });
        if (context.state === 'suspended') await context.resume();
        if (context.sampleRate !== 16_000) throw new Error('Whisper requires 16 kHz audio.');
        await context.audioWorklet.addModule(workletUrl);
        source = context.createMediaStreamSource(device);
        processor = new AudioWorkletNode(context, 'katakit-microphone-capture', {
          channelCount: 1,
          channelCountMode: 'explicit',
        });
        processor.onprocessorerror = () => fail(new Error('Microphone audio processing failed.'));
        processor.port.onmessage = ({ data }: MessageEvent<MicrophoneCaptureMessage>) => {
          if (data.type === 'flushed') {
            flushed?.resolve();
            return;
          }
          if (!failed) {
            reportLevel?.(data.samples);
            for (const chunk of chunks.push(data.samples)) enqueue(chunk);
          }
        };
        source.connect(processor);
        processor.connect(context.destination);
        if (!disposed && !failed) update({ phase: 'recording' });
      } catch (error) {
        fail(error);
      } finally {
        starting = undefined;
      }
    })();
    return starting;
  };

  const releaseAudio = async () => {
    source?.disconnect();
    processor?.disconnect();
    processor?.port.close();
    for (const track of device?.getTracks() ?? []) track.stop();
    await context?.close();
    source = undefined;
    processor = undefined;
    device = undefined;
    context = undefined;
  };

  const stop = () => {
    stopping ??= (async () => {
      if (!disposed && !failed) update({ phase: 'stopping' });
      try {
        await starting;
        source?.disconnect();
        if (!failed && processor && context?.state === 'running') {
          flushed = Promise.withResolvers<void>();
          processor.port.postMessage({ type: 'flush' });
          await flushed.promise;
          flushed = undefined;
        }
        if (!failed) {
          const last = chunks.flush();
          if (last) enqueue(last);
          if (inFlight || queued.length) {
            pending = Promise.withResolvers<void>();
            await pending.promise;
            pending = undefined;
          }
        }
      } finally {
        await releaseAudio();
        params.onStop();
        if (!disposed && !failed) update({ phase: 'ready' });
        stopping = undefined;
      }
    })();
    return stopping;
  };

  return {
    start,
    stop,
    dispose: async () => {
      disposed = true;
      try {
        await stop();
      } finally {
        worker?.terminate();
        worker = undefined;
      }
    },
  };
};
