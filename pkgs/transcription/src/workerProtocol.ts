import type { TranscriptionModelId } from './catalog';
import type { TranscriptionErrorCode } from './errors';
import type { TranscriptionSegment } from './types';

/** Private transport contract. Applications consume Transcriber and its callbacks. */
export type TranscriptionWorkerRequest =
  | { type: 'load'; id: number; model: TranscriptionModelId; assetsBaseUrl: string }
  | { type: 'start'; id: number; sourceId: string }
  | { type: 'audio'; samples: Float32Array; sampleRate: number }
  | { type: 'stop'; id: number }
  | { type: 'dispose'; id: number };

export type TranscriptionWorkerResponse =
  | { type: 'complete'; id: number }
  | { type: 'progress'; progress?: number }
  | { type: 'provisional'; text: string }
  | { type: 'final'; segment: TranscriptionSegment }
  | { type: 'error'; code: TranscriptionErrorCode; message: string };
