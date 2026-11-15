export type WhisperRequest =
  | { type: 'warmup' }
  | { type: 'transcribe'; id: number; audio: Float32Array };

export type WhisperResponse =
  | { type: 'ready' }
  | { type: 'progress'; progress: number }
  | { type: 'transcript'; id: number; text: string }
  | { type: 'error'; message: string };
