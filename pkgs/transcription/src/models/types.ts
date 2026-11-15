import type { TranscriptSegment } from '../plugin';

export type ModelState = {
  phase: 'idle' | 'loading' | 'ready' | 'starting' | 'running' | 'stopping' | 'error';
  progress?: number;
  error?: string;
};

/** The same result callbacks work for streaming and chunked recognizers. */
export type TranscriptionCallbacks = {
  onState?: (state: ModelState) => void;
  onProvisional?: (text: string) => void;
  onFinal: (segment: TranscriptSegment) => void;
  /** All pending final results have been delivered; safe to flush a transcript turn. */
  onStop?: () => void;
};

export type TranscriptionModel = {
  load: () => Promise<void>;
  /** Begin a session. Omit sourceId to generate a distinct ID for every session. */
  start: (sourceId?: string) => Promise<void>;
  /** Mono float PCM in [-1, 1]. The caller retains ownership of the buffer. */
  write: (audio: Float32Array, sampleRate: number) => void;
  /** Drain pending recognition; keep the loaded model for another session. */
  stop: () => Promise<void>;
  /** Stop and release the model/worker. Idempotent, including during loading. */
  dispose: () => Promise<void>;
};

export type ProviderEvents = {
  onProgress: (progress?: number) => void;
  onProvisional: (text: string) => void;
  onFinal: (segment: TranscriptSegment) => void;
  onError: (error: unknown) => void;
};

export type Provider = {
  start: (sourceId: string) => void;
  write: (audio: Float32Array, sampleRate: number) => void;
  stop: () => void | Promise<void>;
  close: () => void;
};
