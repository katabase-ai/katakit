// Deliberate declarations for a proposal, NOT shipped implementations.
// Names and selected contract fields mirror #61's agreed design comment.
declare module '@katakit/transcription' {
  export type RunContext = {
    recordingId: string;
    sourceId: string;
    runId: string;
    modelId?: string;
  };
  export type RecognizerStart = RunContext & { audioOriginMs: number };
  export type AudioFrame = {
    recordingId: string;
    sourceId: string;
    sequence: number;
    startMs: number;
    sampleRate: number;
    samples: Float32Array;
  };
  export type SegmentUpdate = RunContext & {
    id: string;
    revision: number;
    text: string;
    textFinal: boolean;
    startMs?: number;
    endMs?: number;
    timing?: 'speech' | 'chunk';
    participantId?: string;
    // The complete speaker-span contract remains in the agreed issue spec.
  };
  export type RunEnd = RunContext & {
    outcome: 'drained' | 'failed' | 'cancelled';
    acceptedThroughMs?: number;
  };
  export type EngineEvents = {
    onProgress(progress?: number): void;
    onUpdate(update: SegmentUpdate): void;
    onError(error: unknown): void;
  };
  export type EngineSession = {
    start(run: RecognizerStart): void | Promise<void>;
    write(frame: AudioFrame): void;
    stop(): void | Promise<void>;
    close(): void | Promise<void>;
  };
  export type TranscriptionEngine = (events: EngineEvents) => Promise<EngineSession>;
  export type Transcriber = {
    load(): Promise<void>;
    start(run: RecognizerStart): Promise<void>;
    write(frame: AudioFrame): void;
    stop(): Promise<void>;
    dispose(): Promise<void>;
  };
  export type AudioSource = {
    subscribe(onFrame: (frame: AudioFrame) => void): { unsubscribe(): void };
    start(): Promise<void>;
    stop(): Promise<void>;
    dispose(): Promise<void>;
  };
  export function createTranscriber(options: {
    engine: TranscriptionEngine;
    onUpdate(update: SegmentUpdate): void;
    onStop?(end: RunEnd): void;
  }): Transcriber;
}
declare module '@katakit/transcription-moonshine/browser' {
  import type { TranscriptionEngine } from '@katakit/transcription';
  export function createMoonshineEngine(options: {
    model: 'tiny' | 'small' | 'medium';
    assetsBaseUrl: string;
  }): TranscriptionEngine;
}
declare module '@katakit/transcription-whisper/browser' {
  import type { TranscriptionEngine } from '@katakit/transcription';
  export function createWhisperEngine(options: {
    model: 'tiny';
    assetsBaseUrl: string;
  }): TranscriptionEngine;
}
declare module '@katakit/transcription/vite' {
  import type { Plugin } from 'vite';
  export function transcriptionAssetsPlugin(options: { assetsPath: string }): Plugin;
}
declare module '@katakit/transcription-moonshine/vite' {
  import type { Plugin } from 'vite';
  export function moonshineAssetsPlugin(options: { assetsPath: string; isolate?: boolean }): Plugin;
}
