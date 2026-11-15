import type { EngineSession, EngineEvents, SpeechEngine } from './types';

type MoonshineLine = { id: string; text: string; startTime: number; duration: number };
type MoonshineStream = {
  start: () => void;
  stop: () => void;
  close: () => void;
  addAudio: (audio: Float32Array, sampleRate: number) => void;
  transcribe: () => unknown;
  addListener: (listener: {
    onLineStarted: (event: { line: MoonshineLine }) => void;
    onLineTextChanged: (event: { line: MoonshineLine }) => void;
    onLineCompleted: (event: { line: MoonshineLine }) => void;
    onError: (event: { error: Error }) => void;
  }) => void;
};

// Keep the public contract structural so Whisper users need no Moonshine SDK types.
type MoonshineSdk = {
  Transcriber: {
    load: (options: {
      language: string;
      modelArch: 2 | 4 | 5;
      onProgress: (loaded: number, total: number | undefined) => void;
    }) => Promise<{ createStream: () => MoonshineStream; close: () => void }>;
  };
};

export type MoonshineOptions = {
  model?: 'tiny' | 'small' | 'medium';
  /** Load the SDK with its ESM, WASM and pthread files preserved as siblings. */
  loadSdk: () => Promise<MoonshineSdk>;
};

export const loadMoonshine = async (
  options: MoonshineOptions,
  events: EngineEvents
): Promise<EngineSession> => {
  const sdk = await options.loadSdk();
  const model = await sdk.Transcriber.load({
    language: 'en',
    modelArch: { tiny: 2, small: 4, medium: 5 }[options.model ?? 'small'] as 2 | 4 | 5,
    onProgress: (bytes, total) => events.onProgress(total ? bytes / total : undefined),
  });
  let stream: MoonshineStream | undefined;
  return {
    start: sourceId => {
      const completed = new Set<string>();
      stream = model.createStream();
      stream.addListener({
        onLineStarted: ({ line }) => events.onProvisional(line.text),
        onLineTextChanged: ({ line }) => events.onProvisional(line.text),
        onLineCompleted: ({ line }) => {
          if (completed.has(line.id)) return;
          completed.add(line.id);
          events.onFinal({
            sourceId,
            id: line.id,
            text: line.text,
            startMs: line.startTime * 1000,
            endMs: (line.startTime + line.duration) * 1000,
          });
        },
        onError: ({ error }) => events.onError(error),
      });
      stream.start();
    },
    write: (audio, sampleRate) => {
      stream!.addAudio(audio, sampleRate);
      stream!.transcribe();
    },
    stop: () => {
      try {
        stream?.stop();
      } finally {
        stream?.close();
        stream = undefined;
      }
    },
    close: () => {
      try {
        stream?.close();
      } finally {
        stream = undefined;
        model.close();
      }
    },
  };
};

export const moonshine =
  (options: MoonshineOptions): SpeechEngine =>
  events =>
    loadMoonshine(options, events);
