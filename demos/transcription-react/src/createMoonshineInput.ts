import type { TranscriptLine, Transcriber } from '@moonshine-ai/moonshine-wasm';
import type { TranscriptSegment } from '@katakit/transcription';
import { createAudioLevelReporter } from '@katakit/site-ui/audio-level';
import { moonshineAssetBase } from './moonshineAssets';
import { createMicrophoneCapture } from './createMicrophoneCapture';
import { moonshineArchitecture, type ModelId } from './models';

export type InputPhase =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'error';
export type InputState = { phase: InputPhase; progress?: number; error?: string };

/** Own model and capture explicitly; Katakit owns only transcript state. */
export const createMoonshineInput = (params: {
  modelId: Exclude<ModelId, 'whisper-tiny'>;
  onState: (state: InputState) => void;
  onProvisional: (text: string) => void;
  onFinal: (segment: TranscriptSegment) => void;
  onStop: () => void;
  onLevel?: (level: number) => void;
}) => {
  let model: Transcriber | undefined;
  let loading: Promise<void> | undefined;
  let starting: Promise<void> | undefined;
  let stopping: Promise<void> | undefined;
  let capture: ReturnType<typeof createMicrophoneCapture> | undefined;
  let disposed = false;
  let phase: InputPhase = 'idle';

  const update = (state: InputState) => {
    phase = state.phase;
    if (!disposed) params.onState(state);
  };
  const fail = (error: unknown) => {
    update({ phase: 'error', error: error instanceof Error ? error.message : String(error) });
    void stop();
  };

  const load = () => {
    if (model || disposed) return Promise.resolve();
    loading ??= (async () => {
      update({ phase: 'loading' });
      try {
        // Preserve Moonshine's ESM/WASM/pthread sibling layout instead of bundling generated JS.
        const sdk: typeof import('@moonshine-ai/moonshine-wasm') = await import(
          /* @vite-ignore */ `${moonshineAssetBase}index.js`
        );
        const loaded = await sdk.Transcriber.load({
          language: 'en',
          modelArch: moonshineArchitecture(params.modelId),
          onProgress: (bytes, total) =>
            update({ phase: 'loading', progress: total ? bytes / total : undefined }),
        });
        if (disposed) loaded.close();
        else {
          model = loaded;
          update({ phase: 'ready' });
        }
      } catch (error) {
        fail(error);
      } finally {
        loading = undefined;
      }
    })();
    return loading;
  };

  const start = () => {
    if (disposed || starting || stopping || phase === 'recording') return Promise.resolve();
    starting = (async () => {
      try {
        await load();
        if (!model || disposed) return;
        update({ phase: 'starting' });
        const sourceId = crypto.randomUUID();
        const completed = new Set<TranscriptLine['id']>();
        const current = createMicrophoneCapture(
          () => model!.createStream(),
          params.onLevel ? createAudioLevelReporter(params.onLevel, 16_000) : undefined
        );
        capture = current;
        current.addListener({
          onLineStarted: ({ line }) => params.onProvisional(line.text),
          onLineTextChanged: ({ line }) => params.onProvisional(line.text),
          onLineCompleted: ({ line }) => {
            if (completed.has(line.id) || disposed) return;
            completed.add(line.id);
            params.onFinal({
              sourceId,
              id: line.id,
              text: line.text,
              startMs: line.startTime * 1000,
              endMs: (line.startTime + line.duration) * 1000,
            });
          },
          onError: ({ error }) => fail(error),
        });
        try {
          await current.start();
          if (!disposed && capture === current) update({ phase: 'recording' });
        } catch (error) {
          fail(error);
        }
      } finally {
        starting = undefined;
      }
    })();
    return starting;
  };

  const stop = () => {
    stopping ??= (async () => {
      if (!disposed && phase !== 'error') update({ phase: 'stopping' });
      try {
        await starting;
        await capture?.stop();
      } finally {
        capture?.close();
        capture = undefined;
        params.onStop();
        if (!disposed && phase !== 'error') update({ phase: model ? 'ready' : 'idle' });
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
      await stop();
      model?.close();
      model = undefined;
    },
  };
};
