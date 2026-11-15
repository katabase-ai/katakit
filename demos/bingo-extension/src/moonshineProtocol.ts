import type { TranscriptionSegment } from '@katakit/transcription';

export type MoonshineRequest =
  | { type: 'warmup'; assetUrl: string }
  | { type: 'start'; sourceId: string }
  | { type: 'audio'; samples: Float32Array }
  | { type: 'stop' };

export type MoonshineResponse =
  | { type: 'progress'; progress: number }
  | { type: 'ready' }
  | { type: 'final'; segment: TranscriptionSegment }
  | { type: 'stopped' }
  | { type: 'error'; message: string };
