import type { SpeechError } from './errors';

/** Final recognition result. Times are milliseconds relative to a session. */
export type SpeechSegment = {
  id: string;
  sourceId: string;
  text: string;
  startMs?: number;
  endMs?: number;
};

export type SpeechState = {
  phase: 'idle' | 'loading' | 'ready' | 'starting' | 'running' | 'stopping' | 'error' | 'disposed';
  progress?: number;
  error?: SpeechError;
};

/** The same result callbacks work for streaming and chunked recognizers. */
export type SpeechCallbacks = {
  onState?: (state: SpeechState) => void;
  onProvisional?: (text: string) => void;
  onFinal: (segment: SpeechSegment) => void;
  /** All pending final results have been delivered; safe to flush a transcript turn. */
  onStop?: () => void;
};

export type Transcriber = {
  load: () => Promise<void>;
  /** Begin a session. Omit sourceId to generate a distinct ID for every session. */
  start: (options?: { sourceId?: string }) => Promise<void>;
  /** Mono float PCM in [-1, 1]. The caller retains ownership of the buffer. */
  write: (audio: Float32Array, sampleRate: number) => void;
  /** Drain pending recognition; keep the loaded model for another session. */
  stop: () => Promise<void>;
  /** Stop and release the model/worker. Idempotent, including during loading. */
  dispose: () => Promise<void>;
};

export type EngineEvents = {
  onProgress: (progress?: number) => void;
  onProvisional: (text: string) => void;
  onFinal: (segment: SpeechSegment) => void;
  onError: (error: unknown) => void;
};

export type EngineSession = {
  start: (sourceId: string) => void;
  write: (audio: Float32Array, sampleRate: number) => void;
  stop: () => void | Promise<void>;
  close: () => void;
};

/** An engine loads one recognizer and returns a reusable session owner. */
export type SpeechEngine = (events: EngineEvents) => Promise<EngineSession>;
