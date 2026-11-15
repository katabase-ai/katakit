import type { MicrophoneCaptureMessage } from './runtime/microphone-worklet';

/** One recording owns one microphone and audio graph. Recognition is source-neutral. */
export const createMicrophoneCapture = (
  workletUrl: string,
  onAudio: (audio: Float32Array, sampleRate: number) => void,
  onError: (error: Error) => void
) => {
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
    onError(cause);
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
      processor = new AudioWorkletNode(context, 'speech-microphone-capture', {
        channelCount: 1,
        channelCountMode: 'explicit',
      });
      processor.onprocessorerror = () => fail(new Error('Microphone audio processing failed.'));
      const sampleRate = context.sampleRate;
      processor.port.onmessage = ({ data }: MessageEvent<MicrophoneCaptureMessage>) => {
        if (data.type === 'flushed') {
          flushed?.();
          return;
        }
        if (failed) return;
        try {
          onAudio(data.samples, sampleRate);
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
      } finally {
        await releaseAudio();
      }
    })();
    return stopping;
  };

  return {
    start,
    stop,
  };
};
