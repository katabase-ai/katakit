import type { Stream, TranscriptEventListener } from '@moonshine-ai/moonshine-wasm';
// Vite's worker URL query exports a URL, not the processor module's default export.
// oxlint-disable-next-line import/default
import workletUrl from './microphoneCaptureWorklet?worker&url';
import type { MicrophoneCaptureMessage } from './microphoneCaptureWorklet';

/** One recording owns one capture stream and audio graph. Based on protozoa-app's adapter. */
export const createMicrophoneCapture = (
  createStream: () => Pick<
    Stream,
    'start' | 'stop' | 'close' | 'addAudio' | 'transcribe' | 'addListener'
  >,
  onSamples?: (samples: Float32Array) => void
) => {
  const listeners: TranscriptEventListener[] = [];
  let stream: ReturnType<typeof createStream> | undefined;
  let device: MediaStream | undefined;
  let context: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let processor: AudioWorkletNode | undefined;
  let flushed: (() => void) | undefined;
  let stopping: Promise<void> | undefined;
  let failed = false;

  const fail = (error: unknown) => {
    if (failed) return;
    failed = true;
    flushed?.();
    const cause = error instanceof Error ? error : new Error(String(error));
    for (const listener of listeners) listener.onError?.({ error: cause });
  };

  const releaseAudio = async () => {
    source?.disconnect();
    processor?.disconnect();
    processor?.port.close();
    for (const track of device?.getTracks() ?? []) track.stop();
    try {
      await context?.close();
    } finally {
      context = undefined;
      device = undefined;
      source = undefined;
      processor = undefined;
    }
  };

  const start = async () => {
    try {
      device = await navigator.mediaDevices.getUserMedia({ audio: true });
      context = new AudioContext({ sampleRate: 16_000 });
      if (context.state === 'suspended') await context.resume();
      await context.audioWorklet.addModule(workletUrl);
      source = context.createMediaStreamSource(device);
      processor = new AudioWorkletNode(context, 'katakit-microphone-capture', {
        channelCount: 1,
        channelCountMode: 'explicit',
      });
      processor.onprocessorerror = () => fail(new Error('Microphone audio processing failed.'));
      stream = createStream();
      for (const listener of listeners) stream.addListener(listener);
      stream.start();
      const sampleRate = context.sampleRate;
      processor.port.onmessage = ({ data }: MessageEvent<MicrophoneCaptureMessage>) => {
        if (data.type === 'flushed') {
          flushed?.();
          return;
        }
        if (failed) return;
        try {
          onSamples?.(data.samples);
          stream?.addAudio(data.samples, sampleRate);
          stream?.transcribe();
        } catch (error) {
          fail(error);
          void stop();
        }
      };
      source.connect(processor);
      // An inaudible output keeps the capture graph active without playing the mic back.
      processor.connect(context.destination);
    } catch (error) {
      await releaseAudio();
      throw error;
    }
  };

  const stop = () => {
    stopping ??= (async () => {
      source?.disconnect();
      try {
        if (!failed && processor && context?.state === 'running') {
          const pending = Promise.withResolvers<void>();
          const recordingContext = context;
          const onStateChange = () => {
            if (recordingContext.state !== 'running') pending.resolve();
          };
          flushed = pending.resolve;
          recordingContext.addEventListener('statechange', onStateChange);
          try {
            processor.port.postMessage({ type: 'flush' });
            await pending.promise;
          } finally {
            flushed = undefined;
            recordingContext.removeEventListener('statechange', onStateChange);
          }
        }
        stream?.stop();
      } finally {
        await releaseAudio();
      }
    })();
    return stopping;
  };

  return {
    start,
    stop,
    close: () => {
      stream?.close();
      stream = undefined;
    },
    addListener: (listener: TranscriptEventListener) => {
      listeners.push(listener);
      stream?.addListener(listener);
    },
  };
};
