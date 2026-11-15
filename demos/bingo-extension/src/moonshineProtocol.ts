import type { TranscriptLine } from '@moonshine-ai/moonshine-wasm';

export type MoonshineRequest =
  | { type: 'warmup'; assetUrl: string }
  | { type: 'start' }
  | { type: 'audio'; samples: Float32Array }
  | { type: 'stop' };

export type MoonshineResponse =
  | { type: 'progress'; progress: number }
  | { type: 'ready' }
  | { type: 'provisional'; text: string }
  | { type: 'final'; line: TranscriptLine }
  | { type: 'stopped' }
  | { type: 'error'; message: string };
